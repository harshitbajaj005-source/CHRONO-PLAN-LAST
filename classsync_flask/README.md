# ClassSync M3 — Timetable Clash Resolver (Hardened Python Flask Edition)

A complete, VS Code-ready Python Flask + HTML/CSS/JavaScript implementation of **ClassSync M3 Timetable Clash Resolver** with silent backend security enforcement and an automated M3 constraint solver.

---

## Implemented Backend Security Controls (16 Controls)

1. **Authentication & Password Verification**: Server-side login via `POST /api/auth/login` supporting username or email.
2. **Role-Based Access Control (RBAC)**: Strict `@roles_required(...)` enforcement for `admin`, `faculty`, and `student` across all endpoints.
3. **Strong Password Hashing**: Argon2id (`argon2-cffi`) with per-user cryptographic salts and transparent rehash upgrades; zero plain-text passwords stored.
4. **Brute-Force Login Protection**: Per-identifier + IP failed-attempt tracking in SQLite (`login_attempts`) with automatic timed lockout (`429 Too Many Requests`).
5. **Secure Session Management**: Signed Flask sessions with `HttpOnly`, `SameSite=Lax`, configurable `Secure` flag, server-side expiration timestamp (`expires_at`), and session regeneration on login.
6. **CSRF Protection**: Cryptographic per-session CSRF tokens validated with `hmac.compare_digest` via `@require_csrf` on every state-changing route (`POST`/`PUT`/`PATCH`/`DELETE`).
7. **SQL Injection Prevention**: 100% parameterized SQLite queries (`?` placeholders) with `PRAGMA foreign_keys = ON`.
8. **Input Validation & Sanitization**: Strict regex/range validation for usernames, `@lpu.in` student emails, course codes, room capacities, section sizes, and CSV formula-injection neutralization (`validators.py`).
9. **API Authorization**: Every protected endpoint verifies active session + role server-side even when called directly with `curl` or Postman.
10. **Rate Limiting**: Sliding-window per-IP rate limiting on general APIs (`120/min`) and stricter limits on authentication endpoints (`15/min`).
11. **Safe File Upload Validation**: `.csv`/`.json` allowlist, `werkzeug.utils.secure_filename`, 2 MB size cap, UTF-8 text verification, path-traversal confinement check, and schema validation.
12. **Private Security Audit Logging**: Server-only log written to `instance/security_audit.log` (passwords/tokens scrubbed; never exposed to the UI or API).
13. **Generic Error Handling**: Central `400`/`404`/`405`/`413`/`500` handlers returning safe messages without stack traces, database details, or secrets.
14. **HTTP Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, strict `Content-Security-Policy`, `Cache-Control: no-store` on `/api/*`, and `Strict-Transport-Security` in production.
15. **Environment-Based Secrets Management**: All configuration loaded from `.env` via `python-dotenv`; `.env.example` contains zero real secrets.
16. **Database Security**: Isolated `instance/` storage, WAL journaling, `CHECK` constraints, and foreign-key enforcement.

---

## VS Code Setup Instructions

### 1. Open in VS Code & Create Virtual Environment
```bash
cd classsync_flask
python -m venv .venv
```
Activate the virtual environment:
- **Windows (PowerShell)**: `.\.venv\Scripts\Activate.ps1`
- **macOS / Linux**: `source .venv/bin/activate`

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure `.env`
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Generate a strong `SECRET_KEY` and paste it into `.env`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Initialize Database & Create Admin / Faculty Accounts
Initialize the SQLite database tables and seed rooms/sections/courses:
```bash
python init_db.py
```
Create Administrator and Faculty accounts interactively (passwords are hidden and Argon2id-hashed):
```bash
python create_account.py
```
*(Alternatively, if no admin exists yet, opening the app in your browser presents a one-time Administrator setup form.)*

### 5. Start the Flask Server
```bash
python app.py
```
Open **`http://127.0.0.1:5000`** in your browser.

---

## Running Security & M3 Scheduler Tests
```bash
pytest -v
```
Tests verify Argon2id hashing, security headers, CSRF rejection, RBAC cross-role blocking, brute-force lockout, private audit logging, parameterized SQL injection resistance, session expiration, unsafe upload rejection, and the **1,500-student / 120-section M3 timetable benchmark**.

---

## Honest Limitations & Security Notes
- **Scheduling Heuristic**: `scheduler.py` uses a Most-Constrained-First greedy constraint solver (`O(1)` conflict hash sets) rather than a global Integer Linear Programming (ILP) solver. It runs in milliseconds–seconds for 1,500 students and 120 sections and guarantees zero double-bookings, but under >92% room utilization an edge course may remain unscheduled where a multi-course swap permutation could exist.
- **No Absolute Security Claims**: No software system is guaranteed unhackable. In production, always deploy behind HTTPS (`SESSION_COOKIE_SECURE=true`, `FLASK_ENV=production`), configure a persistent external store (e.g., Redis) for multi-worker rate limiting, and keep dependencies updated.
