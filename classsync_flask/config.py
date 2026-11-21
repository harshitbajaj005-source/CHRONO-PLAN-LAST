import os
import secrets
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


_IS_VERCEL = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
_DEFAULT_INSTANCE_DIR = (
    Path(os.getenv("TMPDIR", "/tmp")) / "classsync_instance"
    if _IS_VERCEL
    else BASE_DIR / "instance"
)


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_storage_path(env_var: str, default_filename: str) -> str:
    override = os.getenv(env_var, "").strip()
    if override:
        candidate = Path(override)
        if candidate.is_absolute():
            return str(candidate.resolve())
        if _IS_VERCEL:
            return str((_DEFAULT_INSTANCE_DIR / candidate.name).resolve())
        return str((BASE_DIR / candidate).resolve())
    return str((_DEFAULT_INSTANCE_DIR / default_filename).resolve())


class Config:
    """Environment-driven application configuration with safe development fallbacks."""

    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    # Ephemeral fallback only for local dev if SECRET_KEY is unset; production requires .env SECRET_KEY
    _env_secret = os.getenv("SECRET_KEY", "").strip()
    if FLASK_ENV == "production" and len(_env_secret) < 32:
        raise RuntimeError(
            "SECRET_KEY environment variable (>= 32 chars) must be set in production."
        )
    SECRET_KEY = _env_secret or secrets.token_hex(32)

    INSTANCE_DIR = _DEFAULT_INSTANCE_DIR
    DATABASE_PATH = _resolve_storage_path("DATABASE_PATH", "classsync.db")
    AUDIT_LOG_PATH = _resolve_storage_path("AUDIT_LOG_PATH", "security_audit.log")
    UPLOAD_FOLDER = _resolve_storage_path("UPLOAD_FOLDER", "uploads")

    MAX_CONTENT_LENGTH = 2 * 1024 * 1024  # 2 MB upload limit
    ALLOWED_UPLOAD_EXTENSIONS = {".csv", ".json"}

    PERMANENT_SESSION_LIFETIME = timedelta(
        minutes=max(5, int(os.getenv("SESSION_LIFETIME_MINUTES", "60")))
    )
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _parse_bool(
        os.getenv("SESSION_COOKIE_SECURE"),
        default=(FLASK_ENV == "production"),
    )

    MAX_LOGIN_ATTEMPTS = max(3, int(os.getenv("MAX_LOGIN_ATTEMPTS", "5")))
    LOCKOUT_MINUTES = max(1, int(os.getenv("LOCKOUT_MINUTES", "15")))
    RATE_LIMIT_PER_MINUTE = max(20, int(os.getenv("RATE_LIMIT_PER_MINUTE", "120")))
    LOGIN_RATE_LIMIT_PER_MINUTE = max(5, int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "15")))
