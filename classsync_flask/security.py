import hmac
import logging
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Callable, Iterable

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from flask import Flask, current_app, g, jsonify, request, session
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from db import db_session

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Sliding window request timestamps per (scope, client_ip)
_rate_buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def hash_password(plain_password: str) -> str:
    if not plain_password or len(plain_password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return _password_hasher.hash(plain_password)


def verify_password(stored_hash: str, candidate_password: str) -> bool:
    if not stored_hash or not candidate_password:
        return False
    try:
        return _password_hasher.verify(stored_hash, candidate_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return False


def setup_private_audit_logger(app: Flask) -> logging.Logger:
    log_path = Path(app.config["AUDIT_LOG_PATH"]).resolve()
    log_path.parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("classsync.security_audit")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    target_path = str(log_path)
    has_target_handler = any(
        getattr(h, "baseFilename", None) == target_path for h in logger.handlers
    )
    if not has_target_handler:
        for existing in list(logger.handlers):
            logger.removeHandler(existing)
            existing.close()
        handler = logging.FileHandler(log_path, encoding="utf-8")
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )
        formatter.converter = time.gmtime
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


def audit_event(event: str, **details: object) -> None:
    logger = logging.getLogger("classsync.security_audit")
    safe_pairs = []
    for k, v in details.items():
        if "password" in k.lower() or "secret" in k.lower() or "token" in k.lower():
            continue
        cleaned = str(v).replace("\n", " ").replace("\r", " ")[:180]
        safe_pairs.append(f"{k}={cleaned}")
    logger.info("%s | %s", event, " ".join(safe_pairs))


def get_client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    return forwarded or (request.remote_addr or "127.0.0.1")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def check_brute_force(db_path: str, identifier: str, ip_address: str) -> tuple[bool, int]:
    """Return (is_locked, remaining_seconds)."""
    with db_session(db_path) as conn:
        row = conn.execute(
            """
            SELECT failed_count, locked_until
            FROM login_attempts
            WHERE identifier = ? AND ip_address = ?
            """,
            (identifier, ip_address),
        ).fetchone()

        if not row or not row["locked_until"]:
            return False, 0

        locked_until = datetime.fromisoformat(row["locked_until"])
        now = _utcnow()
        if locked_until > now:
            return True, int((locked_until - now).total_seconds()) + 1

        # Lockout expired; reset counter
        conn.execute(
            """
            UPDATE login_attempts
            SET failed_count = 0, locked_until = NULL
            WHERE identifier = ? AND ip_address = ?
            """,
            (identifier, ip_address),
        )
        return False, 0


def record_failed_login(
    db_path: str,
    identifier: str,
    ip_address: str,
    max_attempts: int,
    lockout_minutes: int,
) -> bool:
    """Increment failed attempts; return True if account/IP is now locked."""
    now = _utcnow()
    with db_session(db_path) as conn:
        row = conn.execute(
            """
            SELECT failed_count
            FROM login_attempts
            WHERE identifier = ? AND ip_address = ?
            """,
            (identifier, ip_address),
        ).fetchone()

        new_count = (row["failed_count"] if row else 0) + 1
        locked_until = None
        is_locked = new_count >= max_attempts
        if is_locked:
            locked_until = (now + timedelta(minutes=lockout_minutes)).isoformat()

        conn.execute(
            """
            INSERT INTO login_attempts (identifier, ip_address, failed_count, locked_until, last_attempt_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(identifier, ip_address) DO UPDATE SET
                failed_count = excluded.failed_count,
                locked_until = excluded.locked_until,
                last_attempt_at = excluded.last_attempt_at
            """,
            (identifier, ip_address, new_count, locked_until, now.isoformat()),
        )
        return is_locked


def clear_failed_logins(db_path: str, identifier: str, ip_address: str) -> None:
    with db_session(db_path) as conn:
        conn.execute(
            "DELETE FROM login_attempts WHERE identifier = ? AND ip_address = ?",
            (identifier, ip_address),
        )


def get_or_create_csrf_token() -> str:
    token = session.get("_csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["_csrf_token"] = token
    return token


def verify_csrf_token() -> bool:
    expected = session.get("_csrf_token", "")
    provided = (
        request.headers.get("X-CSRF-Token")
        or (request.get_json(silent=True) or {}).get("csrf_token")
        or request.form.get("csrf_token", "")
    )
    if not expected or not provided:
        return False
    return hmac.compare_digest(str(expected), str(provided))


def check_rate_limit(scope: str, limit_per_minute: int) -> bool:
    client_ip = get_client_ip()
    key = (scope, client_ip)
    now = time.monotonic()
    bucket = _rate_buckets[key]
    while bucket and now - bucket[0] > 60.0:
        bucket.popleft()
    if len(bucket) >= limit_per_minute:
        return False
    bucket.append(now)
    return True


def rate_limit(scope: str, limit_key: str = "RATE_LIMIT_PER_MINUTE") -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            limit = int(current_app.config.get(limit_key, 120))
            if not check_rate_limit(scope, limit):
                audit_event("RATE_LIMIT_EXCEEDED", scope=scope, ip=get_client_ip())
                return (
                    jsonify({"error": "Too many requests. Please wait a moment and try again."}),
                    429,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_csrf(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if not verify_csrf_token():
                audit_event(
                    "CSRF_VALIDATION_FAILED",
                    path=request.path,
                    ip=get_client_ip(),
                    user=session.get("username", "anonymous"),
                )
                return jsonify({"error": "Invalid or missing request verification token."}), 403
        return fn(*args, **kwargs)

    return wrapper


def _load_current_user() -> dict | None:
    user_id = session.get("user_id")
    expires_at = session.get("expires_at")
    if not user_id or not expires_at:
        return None

    try:
        exp_dt = datetime.fromisoformat(expires_at)
    except ValueError:
        session.clear()
        return None

    if _utcnow() >= exp_dt:
        audit_event("SESSION_EXPIRED", username=session.get("username", "unknown"))
        session.clear()
        return None

    with db_session(current_app.config["DATABASE_PATH"]) as conn:
        row = conn.execute(
            """
            SELECT id, username, full_name, email, role, department, section, is_active
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if not row or not row["is_active"]:
        session.clear()
        return None

    return dict(row)


def login_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _load_current_user()
        if not user:
            return jsonify({"error": "Authentication required. Please sign in."}), 401
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def roles_required(*allowed_roles: Iterable[str] | str) -> Callable:
    flat_roles: set[str] = set()
    for item in allowed_roles:
        if isinstance(item, str):
            flat_roles.add(item)
        else:
            flat_roles.update(item)

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            user = g.current_user
            if user["role"] not in flat_roles:
                audit_event(
                    "RBAC_DENIED",
                    username=user["username"],
                    role=user["role"],
                    required=",".join(sorted(flat_roles)),
                    path=request.path,
                )
                return jsonify({"error": "You do not have permission for this action."}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def validate_and_save_upload(
    file_storage: FileStorage,
    upload_dir: str,
    allowed_extensions: set[str],
    max_bytes: int,
) -> tuple[str, bytes]:
    if not file_storage or not file_storage.filename:
        raise ValueError("Please choose a CSV or JSON file to upload.")

    safe_name = secure_filename(file_storage.filename)
    if not safe_name:
        raise ValueError("Invalid filename.")

    ext = Path(safe_name).suffix.lower()
    if ext not in allowed_extensions:
        raise ValueError("Only .csv and .json files are permitted.")

    raw_bytes = file_storage.read(max_bytes + 1)
    if len(raw_bytes) == 0:
        raise ValueError("Uploaded file is empty.")
    if len(raw_bytes) > max_bytes:
        raise ValueError("Uploaded file exceeds the 2 MB size limit.")

    # Verify UTF-8 text content (reject binary executables disguised as CSV/JSON)
    try:
        raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Uploaded file must be valid UTF-8 text.") from exc

    base_dir = Path(upload_dir).resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    target_name = f"{secrets.token_hex(8)}_{safe_name}"
    target_path = (base_dir / target_name).resolve()

    if not str(target_path).startswith(str(base_dir) + os.sep):
        raise ValueError("Invalid upload path.")

    target_path.write_bytes(raw_bytes)
    return str(target_path), raw_bytes


def register_security_headers(app: Flask) -> None:
    @app.after_request
    def apply_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        if app.config.get("FLASK_ENV") == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def handle_400(_err):
        return jsonify({"error": "Invalid request payload."}), 400

    @app.errorhandler(404)
    def handle_404(_err):
        return jsonify({"error": "Requested resource was not found."}), 404

    @app.errorhandler(413)
    def handle_413(_err):
        return jsonify({"error": "Upload exceeds maximum allowed size (2 MB)."}), 413

    @app.errorhandler(405)
    def handle_405(_err):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        audit_event("UNHANDLED_SERVER_ERROR", error_type=type(err).__name__, path=request.path)
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500
