import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, g, jsonify, render_template, request, session

_BASE_DIR = Path(__file__).resolve().parent
if str(_BASE_DIR) not in sys.path:
    sys.path.insert(0, str(_BASE_DIR))

from config import Config
from db import db_session
from init_db import init_database
from scheduler import (
    DAYS,
    SLOT_LABELS,
    RoomItem,
    ScheduleRequestItem,
    _violates_consecutive_limit,
    build_benchmark_dataset,
    generate_clash_free_timetable,
    get_teaching_slots_for_day,
)
from security import (
    audit_event,
    check_brute_force,
    clear_failed_logins,
    get_client_ip,
    get_or_create_csrf_token,
    hash_password,
    login_required,
    needs_rehash,
    rate_limit,
    record_failed_login,
    register_error_handlers,
    register_security_headers,
    require_csrf,
    roles_required,
    setup_private_audit_logger,
    validate_and_save_upload,
    verify_password,
)
from validators import (
    SECTION_CODE_RE,
    VALID_DEPARTMENTS,
    parse_and_validate_upload,
    validate_course_payload,
    validate_email,
    validate_enrollment_payload,
    validate_full_name,
    validate_password_strength,
    validate_room_payload,
    validate_username,
)


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(_BASE_DIR / "templates"),
        static_folder=str(_BASE_DIR / "static"),
    )
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    init_database(app.config["DATABASE_PATH"])
    setup_private_audit_logger(app)
    register_security_headers(app)
    register_error_handlers(app)

    @app.get("/")
    def index():
        csrf_token = get_or_create_csrf_token()
        return render_template("index.html", csrf_token=csrf_token)

    @app.get("/api/csrf")
    @rate_limit("csrf")
    def get_csrf():
        return jsonify({"csrf_token": get_or_create_csrf_token()})

    @app.get("/api/auth/me")
    @rate_limit("auth_me")
    def auth_me():
        with db_session(app.config["DATABASE_PATH"]) as conn:
            admin_exists = (
                conn.execute(
                    "SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"
                ).fetchone()
                is not None
            )

        user_id = session.get("user_id")
        expires_at = session.get("expires_at")
        if not user_id or not expires_at:
            return jsonify(
                {
                    "authenticated": False,
                    "needs_admin_setup": not admin_exists,
                    "csrf_token": get_or_create_csrf_token(),
                }
            )

        try:
            exp_dt = datetime.fromisoformat(expires_at)
        except ValueError:
            session.clear()
            return jsonify(
                {
                    "authenticated": False,
                    "needs_admin_setup": not admin_exists,
                    "csrf_token": get_or_create_csrf_token(),
                }
            )

        if datetime.now(timezone.utc) >= exp_dt:
            session.clear()
            return jsonify(
                {
                    "authenticated": False,
                    "needs_admin_setup": not admin_exists,
                    "csrf_token": get_or_create_csrf_token(),
                }
            )

        with db_session(app.config["DATABASE_PATH"]) as conn:
            row = conn.execute(
                """
                SELECT id, username, full_name, email, role, department, section
                FROM users WHERE id = ? AND is_active = 1
                """,
                (user_id,),
            ).fetchone()

        if not row:
            session.clear()
            return jsonify(
                {
                    "authenticated": False,
                    "needs_admin_setup": not admin_exists,
                    "csrf_token": get_or_create_csrf_token(),
                }
            )

        return jsonify(
            {
                "authenticated": True,
                "user": dict(row),
                "needs_admin_setup": not admin_exists,
                "csrf_token": get_or_create_csrf_token(),
            }
        )

    @app.post("/api/auth/bootstrap-admin")
    @rate_limit("login", limit_key="LOGIN_RATE_LIMIT_PER_MINUTE")
    @require_csrf
    def bootstrap_admin():
        """One-time secure admin account creation when no admin exists yet."""
        data = request.get_json(silent=True) or {}
        try:
            username = validate_username(data.get("username", ""))
            full_name = validate_full_name(data.get("full_name", ""))
            email = validate_email(data.get("email", ""))
            password = str(data.get("password", ""))
            validate_password_strength(password, "admin")
            pw_hash = hash_password(password)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        with db_session(app.config["DATABASE_PATH"]) as conn:
            existing = conn.execute(
                "SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"
            ).fetchone()
            if existing:
                return (
                    jsonify({"error": "Administrator account already configured."}),
                    403,
                )
            conn.execute(
                """
                INSERT INTO users (username, full_name, email, role, password_hash)
                VALUES (?, ?, ?, 'admin', ?)
                """,
                (username, full_name, email, pw_hash),
            )

        audit_event("ADMIN_BOOTSTRAPPED", username=username, ip=get_client_ip())
        return jsonify({"message": "Administrator account created. Please sign in."}), 201

    @app.post("/api/auth/login")
    @rate_limit("login", limit_key="LOGIN_RATE_LIMIT_PER_MINUTE")
    @require_csrf
    def login():
        data = request.get_json(silent=True) or {}
        identifier = str(data.get("identifier", "")).strip()
        password = str(data.get("password", ""))
        client_ip = get_client_ip()

        if not identifier or not password:
            return jsonify({"error": "Please enter both your username or email and password."}), 400

        norm_id = identifier.lower()
        locked, wait_seconds = check_brute_force(
            app.config["DATABASE_PATH"], norm_id, client_ip
        )
        if locked:
            audit_event("LOGIN_BLOCKED_LOCKOUT", identifier=norm_id, ip=client_ip)
            mins = max(1, (wait_seconds + 59) // 60)
            return (
                jsonify(
                    {
                        "error": f"Too many unsuccessful sign-in attempts. Please try again in {mins} minute(s)."
                    }
                ),
                429,
            )

        with db_session(app.config["DATABASE_PATH"]) as conn:
            user = conn.execute(
                """
                SELECT id, username, full_name, email, role, department, section, password_hash, is_active
                FROM users
                WHERE lower(username) = ? OR lower(email) = ?
                """,
                (norm_id, norm_id),
            ).fetchone()

            if not user or not user["is_active"] or not verify_password(user["password_hash"], password):
                now_locked = record_failed_login(
                    app.config["DATABASE_PATH"],
                    norm_id,
                    client_ip,
                    app.config["MAX_LOGIN_ATTEMPTS"],
                    app.config["LOCKOUT_MINUTES"],
                )
                audit_event(
                    "LOGIN_FAILED",
                    identifier=norm_id,
                    ip=client_ip,
                    locked=now_locked,
                )
                if now_locked:
                    return (
                        jsonify(
                            {
                                "error": "Too many unsuccessful sign-in attempts. Please try again later."
                            }
                        ),
                        429,
                    )
                return jsonify({"error": "Incorrect username/email or password."}), 401

            # Seamless Argon2id parameter upgrade if policy changes
            if needs_rehash(user["password_hash"]):
                new_hash = hash_password(password)
                conn.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (new_hash, user["id"]),
                )

        clear_failed_logins(app.config["DATABASE_PATH"], norm_id, client_ip)

        # Regenerate session state & CSRF token on authentication
        session.clear()
        session.permanent = True
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["role"] = user["role"]
        expires_at = datetime.now(timezone.utc) + app.config["PERMANENT_SESSION_LIFETIME"]
        session["expires_at"] = expires_at.isoformat()
        csrf_token = get_or_create_csrf_token()

        audit_event(
            "LOGIN_SUCCESS",
            username=user["username"],
            role=user["role"],
            ip=client_ip,
        )

        return jsonify(
            {
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "full_name": user["full_name"],
                    "email": user["email"],
                    "role": user["role"],
                    "department": user["department"],
                    "section": user["section"],
                },
                "csrf_token": csrf_token,
            }
        )

    @app.post("/api/auth/logout")
    @rate_limit("logout")
    @require_csrf
    def logout():
        username = session.get("username", "anonymous")
        session.clear()
        csrf_token = get_or_create_csrf_token()
        audit_event("LOGOUT", username=username, ip=get_client_ip())
        return jsonify({"message": "Signed out.", "csrf_token": csrf_token})

    @app.post("/api/admin/users")
    @rate_limit("admin_users")
    @roles_required("admin")
    @require_csrf
    def admin_create_user():
        data = request.get_json(silent=True) or {}
        role = str(data.get("role", "")).strip().lower()
        if role not in {"admin", "faculty", "student"}:
            return jsonify({"error": "Role must be admin, faculty, or student."}), 400

        try:
            username = validate_username(data.get("username", ""))
            full_name = validate_full_name(data.get("full_name", ""))
            email = validate_email(data.get("email", ""), require_lpu=(role == "student"))
            password = str(data.get("password", ""))
            validate_password_strength(password, role)
            department = str(data.get("department", "")).strip()
            if department and department not in VALID_DEPARTMENTS:
                raise ValueError("Invalid department selected.")
            section = str(data.get("section", "")).strip().upper()[:16]
            if section and not SECTION_CODE_RE.match(section):
                raise ValueError("Section code must be 2–16 alphanumeric/hyphen characters.")
            if role == "student" and not section:
                section = "CSE-4B"
            pw_hash = hash_password(password)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        with db_session(app.config["DATABASE_PATH"]) as conn:
            dup = conn.execute(
                "SELECT 1 FROM users WHERE lower(username) = ? OR lower(email) = ?",
                (username.lower(), email.lower()),
            ).fetchone()
            if dup:
                return jsonify({"error": "Username or email is already registered."}), 409

            conn.execute(
                """
                INSERT INTO users (username, full_name, email, role, department, section, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (username, full_name, email, role, department, section, pw_hash),
            )

        audit_event(
            "ADMIN_CREATED_USER",
            admin=g.current_user["username"],
            created_username=username,
            created_role=role,
        )
        return jsonify({"message": f"Account created for {full_name}."}), 201

    @app.get("/api/rooms")
    @rate_limit("rooms")
    @login_required
    def list_rooms():
        with db_session(app.config["DATABASE_PATH"]) as conn:
            rows = conn.execute(
                "SELECT room_code, building, floor, capacity, room_type FROM rooms ORDER BY room_code"
            ).fetchall()
        return jsonify({"rooms": [dict(r) for r in rows]})

    @app.get("/api/courses")
    @rate_limit("courses")
    @roles_required("admin", "student")
    def list_courses():
        with db_session(app.config["DATABASE_PATH"]) as conn:
            rows = conn.execute(
                """
                SELECT course_code, title, department, credits, course_kind, room_type, sessions_per_week, faculty_username
                FROM courses ORDER BY course_code
                """
            ).fetchall()
        return jsonify({"courses": [dict(r) for r in rows]})

    @app.post("/api/enrollments")
    @rate_limit("enrollments")
    @roles_required("admin", "student")
    @require_csrf
    def add_enrollment():
        data = request.get_json(silent=True) or {}
        if g.current_user["role"] == "student":
            data["student_username"] = g.current_user["username"]
            data["section_code"] = g.current_user["section"] or data.get("section_code", "")

        try:
            cleaned = validate_enrollment_payload(data)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        with db_session(app.config["DATABASE_PATH"]) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO enrollments (student_username, section_code, course_code, enrollment_type)
                VALUES (?, ?, ?, ?)
                """,
                (
                    cleaned["student_username"],
                    cleaned["section_code"],
                    cleaned["course_code"],
                    cleaned["enrollment_type"],
                ),
            )
        return jsonify({"message": "Enrollment saved."}), 201

    @app.post("/api/admin/upload")
    @rate_limit("upload")
    @roles_required("admin", "faculty")
    @require_csrf
    def upload_academic_data():
        file_obj = request.files.get("file")
        try:
            saved_path, raw_bytes = validate_and_save_upload(
                file_obj,
                app.config["UPLOAD_FOLDER"],
                app.config["ALLOWED_UPLOAD_EXTENSIONS"],
                app.config["MAX_CONTENT_LENGTH"],
            )
            ext = Path(saved_path).suffix.lower()
            parsed = parse_and_validate_upload(raw_bytes, ext)
        except ValueError as exc:
            audit_event(
                "UPLOAD_REJECTED",
                username=g.current_user["username"],
                reason=str(exc),
            )
            return jsonify({"error": str(exc)}), 400

        with db_session(app.config["DATABASE_PATH"]) as conn:
            for room in parsed["rooms"]:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO rooms (room_code, building, floor, capacity, room_type)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        room["room_code"],
                        room["building"],
                        room["floor"],
                        room["capacity"],
                        room["room_type"],
                    ),
                )
            for course in parsed["courses"]:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO courses (
                        course_code, title, department, credits, course_kind, room_type, sessions_per_week, faculty_username
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        course["course_code"],
                        course["title"],
                        course["department"],
                        course["credits"],
                        course["course_kind"],
                        course["room_type"],
                        course["sessions_per_week"],
                        course["faculty_username"],
                    ),
                )
            for sec in parsed["sections"]:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO sections (section_code, department, student_count)
                    VALUES (?, ?, ?)
                    """,
                    (sec["section_code"], sec["department"], sec["student_count"]),
                )

        audit_event(
            "UPLOAD_ACCEPTED",
            username=g.current_user["username"],
            rooms=len(parsed["rooms"]),
            courses=len(parsed["courses"]),
            sections=len(parsed["sections"]),
        )
        return jsonify(
            {
                "message": "Dataset validated and imported.",
                "imported": {k: len(v) for k, v in parsed.items()},
            }
        )

    @app.post("/api/timetable/generate")
    @rate_limit("generate")
    @roles_required("admin", "faculty")
    @require_csrf
    def generate_timetable():
        data = request.get_json(silent=True) or {}
        mode = str(data.get("mode", "database")).strip().lower()

        if mode == "benchmark":
            try:
                num_students = min(3000, max(100, int(data.get("num_students", 1500))))
                num_sections = min(200, max(10, int(data.get("num_sections", 120))))
            except (TypeError, ValueError):
                return jsonify({"error": "Invalid benchmark student or section count."}), 400
            requests_list, rooms_list = build_benchmark_dataset(num_students, num_sections)
            result = generate_clash_free_timetable(requests_list, rooms_list)
            audit_event(
                "TIMETABLE_BENCHMARK_GENERATED",
                username=g.current_user["username"],
                students=num_students,
                sections=num_sections,
                ms=result["stats"]["generation_ms"],
            )
            return jsonify(result)

        # Build scheduling requests from database tables
        with db_session(app.config["DATABASE_PATH"]) as conn:
            room_rows = conn.execute(
                "SELECT room_code, capacity, room_type FROM rooms"
            ).fetchall()
            section_rows = conn.execute(
                "SELECT section_code, department, student_count FROM sections"
            ).fetchall()
            course_rows = conn.execute(
                """
                SELECT c.course_code, c.title, c.department, c.course_kind, c.room_type,
                       c.sessions_per_week, COALESCE(c.faculty_username, 'FAC-STAFF') AS fac_user,
                       COALESCE(u.full_name, 'Assigned Faculty') AS fac_name
                FROM courses c
                LEFT JOIN users u ON u.username = c.faculty_username
                """
            ).fetchall()
            enrollment_rows = conn.execute(
                "SELECT student_username, section_code, course_code FROM enrollments"
            ).fetchall()

        rooms_list = [
            RoomItem(room_code=r["room_code"], capacity=r["capacity"], room_type=r["room_type"])
            for r in room_rows
        ]
        requests_list: list[ScheduleRequestItem] = []
        for sec in section_rows:
            dept_courses = [c for c in course_rows if c["department"] == sec["department"]]
            for c in dept_courses:
                enrolled_students = {
                    e["student_username"]
                    for e in enrollment_rows
                    if e["section_code"] == sec["section_code"] and e["course_code"] == c["course_code"]
                }
                requests_list.append(
                    ScheduleRequestItem(
                        request_id=f"{sec['section_code']}-{c['course_code']}",
                        section_code=sec["section_code"],
                        course_code=c["course_code"],
                        course_title=c["title"],
                        faculty_username=c["fac_user"],
                        faculty_name=c["fac_name"],
                        student_count=sec["student_count"],
                        room_type=c["room_type"],
                        course_kind=c["course_kind"],
                        sessions_per_week=c["sessions_per_week"],
                        student_ids=enrolled_students,
                    )
                )

        result = generate_clash_free_timetable(requests_list, rooms_list)

        with db_session(app.config["DATABASE_PATH"]) as conn:
            conn.execute("DELETE FROM timetable_slots")
            conn.executemany(
                """
                INSERT INTO timetable_slots (
                    day, slot_index, slot_label, section_code, course_code, course_title,
                    faculty_username, faculty_name, room_code, student_count, room_capacity, course_kind
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        s["day"],
                        s["slot_index"],
                        s["slot_label"],
                        s["section_code"],
                        s["course_code"],
                        s["course_title"],
                        s["faculty_username"],
                        s["faculty_name"],
                        s["room_code"],
                        s["student_count"],
                        s["room_capacity"],
                        s["course_kind"],
                    )
                    for s in result["scheduled_slots"]
                ],
            )

        audit_event(
            "TIMETABLE_GENERATED",
            username=g.current_user["username"],
            sessions=result["stats"]["scheduled_sessions"],
            unscheduled=result["stats"]["unscheduled_count"],
        )
        return jsonify(result)

    @app.get("/api/timetable")
    @rate_limit("timetable_read")
    @login_required
    def get_timetable():
        user = g.current_user
        with db_session(app.config["DATABASE_PATH"]) as conn:
            if user["role"] == "faculty":
                rows = conn.execute(
                    """
                    SELECT * FROM timetable_slots
                    WHERE faculty_username = ?
                    ORDER BY day, slot_index
                    """,
                    (user["username"],),
                ).fetchall()
            elif user["role"] == "student":
                section = user["section"] or "CSE-4B"
                rows = conn.execute(
                    """
                    SELECT * FROM timetable_slots
                    WHERE section_code = ?
                    ORDER BY day, slot_index
                    """,
                    (section,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM timetable_slots ORDER BY day, slot_index, section_code"
                ).fetchall()

        return jsonify({"slots": [dict(r) for r in rows]})

    @app.post("/api/faculty/assign-subject")
    @rate_limit("faculty_assign")
    @roles_required("faculty", "admin")
    @require_csrf
    def faculty_assign_subject():
        """Simple faculty workflow: assign a subject to a section/room/slot with automatic clash checks."""
        data = request.get_json(silent=True) or {}
        try:
            course_data = validate_course_payload(
                {
                    "course_code": data.get("course_code", ""),
                    "title": data.get("title", ""),
                    "department": data.get("department") or g.current_user.get("department") or "BTech CSE department",
                    "credits": data.get("credits", 3.0),
                    "course_kind": data.get("course_kind", "core"),
                    "room_type": data.get("room_type", "lecture"),
                    "sessions_per_week": 1,
                    "faculty_username": g.current_user["username"],
                }
            )
            day = str(data.get("day", "Mon")).strip()
            slot_index = int(data.get("slot_index", 0))
            section_code = str(data.get("section_code", "CSE-4B")).strip().upper()
            room_code = str(data.get("room_code", "LH-101")).strip().upper()
        except (ValueError, TypeError) as exc:
            return jsonify({"error": str(exc)}), 400

        if day not in DAYS:
            return jsonify({"error": "Invalid weekday."}), 400
        allowed_slots = {idx for idx, _ in get_teaching_slots_for_day(day)}
        if slot_index not in allowed_slots:
            if day == "Sat":
                return jsonify({"error": "Selected slot is not a valid Saturday teaching slot (breaks at 12:00–12:30 and 02:00–02:50 are preserved)."}), 400
            return jsonify({"error": "Only the 04:30 PM - 06:00 PM slot is available Monday through Friday."}), 400

        with db_session(app.config["DATABASE_PATH"]) as conn:
            room = conn.execute(
                "SELECT room_code, capacity FROM rooms WHERE room_code = ?",
                (room_code,),
            ).fetchone()
            sec = conn.execute(
                "SELECT section_code, student_count FROM sections WHERE section_code = ?",
                (section_code,),
            ).fetchone()
            if not room or not sec:
                return jsonify({"error": "Specified room or section was not found."}), 404
            if room["capacity"] < sec["student_count"]:
                return jsonify({"error": "Room capacity is smaller than section student count."}), 409

            clash = conn.execute(
                """
                SELECT section_code, room_code, faculty_username
                FROM timetable_slots
                WHERE day = ? AND slot_index = ? AND (room_code = ? OR section_code = ? OR faculty_username = ?)
                """,
                (day, slot_index, room_code, section_code, g.current_user["username"]),
            ).fetchone()
            if clash:
                return jsonify({"error": "Time-slot conflict detected for room, section, or faculty."}), 409

            sec_day_rows = conn.execute(
                "SELECT slot_index FROM timetable_slots WHERE day = ? AND section_code = ?",
                (day, section_code),
            ).fetchall()
            fac_day_rows = conn.execute(
                "SELECT slot_index FROM timetable_slots WHERE day = ? AND faculty_username = ?",
                (day, g.current_user["username"]),
            ).fetchall()
            if _violates_consecutive_limit({r["slot_index"] for r in sec_day_rows}, slot_index, 3, day) or _violates_consecutive_limit({r["slot_index"] for r in fac_day_rows}, slot_index, 3, day):
                return jsonify({"error": "Scheduling this slot would exceed 3 consecutive lectures in a day."}), 409

            conn.execute(
                """
                INSERT OR REPLACE INTO courses (
                    course_code, title, department, credits, course_kind, room_type, sessions_per_week, faculty_username
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    course_data["course_code"],
                    course_data["title"],
                    course_data["department"],
                    course_data["credits"],
                    course_data["course_kind"],
                    course_data["room_type"],
                    1,
                    g.current_user["username"],
                ),
            )
            conn.execute(
                """
                INSERT INTO timetable_slots (
                    day, slot_index, slot_label, section_code, course_code, course_title,
                    faculty_username, faculty_name, room_code, student_count, room_capacity, course_kind
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    day,
                    slot_index,
                    SLOT_LABELS[slot_index],
                    section_code,
                    course_data["course_code"],
                    course_data["title"],
                    g.current_user["username"],
                    g.current_user["full_name"],
                    room["room_code"],
                    sec["student_count"],
                    room["capacity"],
                    course_data["course_kind"],
                ),
            )

        return jsonify({"message": "Subject scheduled without clashes."}), 201

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=(Config.FLASK_ENV == "development"))
