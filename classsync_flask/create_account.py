import getpass
import sys

from config import Config
from db import db_session
from init_db import init_database
from security import hash_password
from validators import (
    VALID_DEPARTMENTS,
    validate_email,
    validate_full_name,
    validate_password_strength,
    validate_username,
)


def create_user_interactive() -> None:
    init_database(Config.DATABASE_PATH)
    print("ClassSync M3 — Secure Account Creation")
    print("Roles available: admin, faculty, student")

    role = input("Role (admin/faculty/student): ").strip().lower()
    if role not in {"admin", "faculty", "student"}:
        print("Error: Role must be 'admin', 'faculty', or 'student'.")
        sys.exit(1)

    try:
        username = validate_username(input("Username (e.g. admin01 or prof.vance): "))
        full_name = validate_full_name(input("Full Name: "))
        email = validate_email(
            input("University Email: "),
            require_lpu=(role == "student"),
        )

        department = ""
        section = ""
        if role == "faculty":
            print("Departments:", ", ".join(sorted(VALID_DEPARTMENTS)))
            department = input("Department [BTech CSE department]: ").strip() or "BTech CSE department"
            if department not in VALID_DEPARTMENTS:
                raise ValueError("Invalid department name.")
        elif role == "student":
            section = input("Section [CSE-4B]: ").strip().upper() or "CSE-4B"
            department = "BTech CSE department"

        password = getpass.getpass("Password (hidden): ")
        confirm = getpass.getpass("Confirm Password (hidden): ")
        if password != confirm:
            raise ValueError("Passwords do not match.")
        validate_password_strength(password, role)

        password_hash = hash_password(password)

        with db_session(Config.DATABASE_PATH) as conn:
            conn.execute(
                """
                INSERT INTO users (username, full_name, email, role, department, section, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (username, full_name, email, role, department, section, password_hash),
            )

        print(f"Created {role} account '{username}' securely.")
    except Exception as exc:
        print(f"Account creation failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    create_user_interactive()
