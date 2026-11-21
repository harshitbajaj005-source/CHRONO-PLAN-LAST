import io
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import create_app
from db import db_session
from scheduler import (
    LUNCH_SLOT_INDEX,
    build_benchmark_dataset,
    generate_clash_free_timetable,
)
from security import hash_password, verify_password


@pytest.fixture()
def client(tmp_path):
    db_path = str(tmp_path / "test.db")
    log_path = str(tmp_path / "audit.log")
    upload_dir = str(tmp_path / "uploads")
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret-key-with-sufficient-entropy-0001",
            "DATABASE_PATH": db_path,
            "AUDIT_LOG_PATH": log_path,
            "UPLOAD_FOLDER": upload_dir,
            "SESSION_COOKIE_SECURE": False,
            "MAX_LOGIN_ATTEMPTS": 3,
            "LOCKOUT_MINUTES": 5,
            "RATE_LIMIT_PER_MINUTE": 200,
            "LOGIN_RATE_LIMIT_PER_MINUTE": 40,
        }
    )

    with db_session(db_path) as conn:
        conn.execute(
            """
            INSERT INTO users (username, full_name, email, role, department, section, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("admin01", "Alice Admin", "admin01@lpu.in", "admin", "", "", hash_password("AdminPass123")),
        )
        conn.execute(
            """
            INSERT INTO users (username, full_name, email, role, department, section, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("prof01", "Evelyn Vance", "prof01@lpu.in", "faculty", "BTech CSE department", "", hash_password("FacultyPass123")),
        )
        conn.execute(
            """
            INSERT INTO users (username, full_name, email, role, department, section, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            ("stu01", "Alex Mercer", "alex@lpu.in", "student", "BTech CSE department", "CSE-4B", hash_password("12abCD34")),
        )

    with app.test_client() as test_client:
        test_client.app = app
        yield test_client


def _get_csrf(test_client) -> str:
    res = test_client.get("/api/csrf")
    return res.get_json()["csrf_token"]


def _login(test_client, identifier: str, password: str):
    csrf = _get_csrf(test_client)
    return test_client.post(
        "/api/auth/login",
        json={"identifier": identifier, "password": password},
        headers={"X-CSRF-Token": csrf},
    )


def test_argon2_password_hashing():
    pw_hash = hash_password("StrongPass99")
    assert pw_hash.startswith("$argon2id$")
    assert "StrongPass99" not in pw_hash
    assert verify_password(pw_hash, "StrongPass99")
    assert not verify_password(pw_hash, "WrongPass99")


def test_http_security_headers(client):
    res = client.get("/")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in res.headers["Content-Security-Policy"]


def test_csrf_protection_enforced(client):
    res = client.post("/api/auth/login", json={"identifier": "admin01", "password": "AdminPass123"})
    assert res.status_code == 403


def test_rbac_blocks_student_from_admin_and_faculty_endpoints(client):
    login_res = _login(client, "stu01", "12abCD34")
    assert login_res.status_code == 200
    csrf = login_res.get_json()["csrf_token"]

    res_gen = client.post(
        "/api/timetable/generate",
        json={"mode": "database"},
        headers={"X-CSRF-Token": csrf},
    )
    assert res_gen.status_code == 403

    res_create = client.post(
        "/api/admin/users",
        json={"role": "faculty", "username": "x", "full_name": "X Y", "email": "x@lpu.in", "password": "Password1"},
        headers={"X-CSRF-Token": csrf},
    )
    assert res_create.status_code == 403


def test_brute_force_lockout_and_audit_log(client):
    for _ in range(3):
        r = _login(client, "prof01", "WrongPassword1")
    assert r.status_code == 429

    # Even with correct password while locked out, access is blocked
    blocked = _login(client, "prof01", "FacultyPass123")
    assert blocked.status_code == 429

    log_content = Path(client.app.config["AUDIT_LOG_PATH"]).read_text(encoding="utf-8")
    assert "LOGIN_FAILED" in log_content
    assert "WrongPassword1" not in log_content


def test_sql_injection_payload_blocked_or_parameterized(client):
    res = _login(client, "admin01' OR '1'='1", "anything")
    assert res.status_code == 401


def test_session_expiration(client):
    _login(client, "stu01", "12abCD34")
    with client.session_transaction() as sess:
        sess["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    res = client.get("/api/timetable")
    assert res.status_code == 401


def test_file_upload_rejects_executable_extension(client):
    login_res = _login(client, "admin01", "AdminPass123")
    csrf = login_res.get_json()["csrf_token"]
    res = client.post(
        "/api/admin/upload",
        data={"file": (io.BytesIO(b"print('evil')"), "payload.py")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf},
    )
    assert res.status_code == 400


def test_m3_scheduler_1500_students_120_sections_under_60s():
    requests, rooms = build_benchmark_dataset(1500, 120)
    result = generate_clash_free_timetable(requests, rooms)

    assert result["stats"]["generation_ms"] < 60000
    assert result["stats"]["scheduled_sessions"] > 0

    # Verify zero room/section/faculty double-booking and no lunch break violations
    seen_rooms = set()
    seen_sections = set()
    seen_faculty = set()
    sec_day = {}
    fac_day = {}
    for slot in result["scheduled_slots"]:
        if slot["day"] == "Sat":
            assert slot["slot_index"] in {0, 1, 2, 3, 4}
        else:
            assert slot["slot_index"] == 5
        assert slot["student_count"] <= slot["room_capacity"]

        rk = (slot["day"], slot["slot_index"], slot["room_code"])
        sk = (slot["day"], slot["slot_index"], slot["section_code"])
        fk = (slot["day"], slot["slot_index"], slot["faculty_username"])
        assert rk not in seen_rooms
        assert sk not in seen_sections
        assert fk not in seen_faculty
        seen_rooms.add(rk)
        seen_sections.add(sk)
        seen_faculty.add(fk)
        sec_day.setdefault((slot["section_code"], slot["day"]), []).append(slot["slot_index"])
        fac_day.setdefault((slot["faculty_username"], slot["day"]), []).append(slot["slot_index"])

    for store in (sec_day, fac_day):
        for idxs in store.values():
            idxs.sort()
            run = 1
            for i in range(1, len(idxs)):
                if idxs[i] == idxs[i - 1] + 1:
                    run += 1
                    assert run <= 3
                else:
                    run = 1


def test_student_password_policy(client):
    login_res = _login(client, "admin01", "AdminPass123")
    assert login_res.status_code == 200
    csrf = login_res.get_json()["csrf_token"]

    for idx, bad_pw in enumerate(["abc1234", "abc12345678", "Abc@1234", "12345678", "Abcdefgh"]):
        res = client.post(
            "/api/admin/users",
            json={
                "role": "student",
                "username": f"stu_bad_{idx}",
                "full_name": "Bad Student",
                "email": f"bad{idx}@lpu.in",
                "password": bad_pw,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 400

    for idx, good_pw in enumerate(["12abCD34", "99Z88y77", "A1B2C3D4e5"]):
        res = client.post(
            "/api/admin/users",
            json={
                "role": "student",
                "username": f"stu_ok_{idx}",
                "full_name": "Good Student",
                "email": f"good{idx}@lpu.in",
                "password": good_pw,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 201


def test_faculty_password_policy(client):
    login_res = _login(client, "admin01", "AdminPass123")
    assert login_res.status_code == 200
    csrf = login_res.get_json()["csrf_token"]

    for idx, bad_pw in enumerate(["123A", "12345", "A1234", "1234AB", "1234@"]):
        res = client.post(
            "/api/admin/users",
            json={
                "role": "faculty",
                "username": f"fac_bad_{idx}",
                "full_name": "Bad Faculty",
                "email": f"facbad{idx}@lpu.in",
                "password": bad_pw,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 400

    for idx, good_pw in enumerate(["4829A", "1234z", "90210K"]):
        res = client.post(
            "/api/admin/users",
            json={
                "role": "faculty",
                "username": f"fac_ok_{idx}",
                "full_name": "Good Faculty",
                "email": f"facok{idx}@lpu.in",
                "password": good_pw,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 201
