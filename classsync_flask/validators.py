import csv
import io
import json
import re
from typing import Any

SAFE_TEXT_RE = re.compile(r"^[\w\s.,&()/+-]{1,120}$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,40}$")
COURSE_CODE_RE = re.compile(r"^[A-Z]{2,5}[0-9]{3}$")
ROOM_CODE_RE = re.compile(r"^[A-Z]{1,5}-?[0-9]{2,4}$")
SECTION_CODE_RE = re.compile(r"^[A-Z0-9-]{2,16}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

VALID_DEPARTMENTS = {
    "BTech CSE department",
    "Business department",
    "Architecture department",
    "Agriculture department",
    "Law department",
    "MBBS department",
    "Civil department",
    "Others",
}

VALID_ROOM_TYPES = {"lecture", "lab", "seminar"}
VALID_COURSE_KINDS = {"core", "elective", "backlog"}


def sanitize_cell(value: Any, max_len: int = 120) -> str:
    text = str(value or "").strip()
    # Neutralize CSV formula injection prefixes
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        text = "'" + text
    return text[:max_len]


def validate_username(raw: Any) -> str:
    val = str(raw or "").strip()
    if not USERNAME_RE.match(val):
        raise ValueError("Username must be 3–40 characters using letters, numbers, '.', '_', or '-'.")
    return val


def validate_email(raw: Any, require_lpu: bool = False) -> str:
    val = str(raw or "").strip().lower()
    if not EMAIL_RE.match(val):
        raise ValueError("Please provide a valid university email address.")
    if require_lpu and not val.endswith("@lpu.in"):
        raise ValueError("Student email must end with @lpu.in.")
    return val


def validate_full_name(raw: Any) -> str:
    val = str(raw or "").strip()
    if not (2 <= len(val) <= 80) or not re.match(r"^[A-Za-z][A-Za-z\s'.-]{1,79}$", val):
        raise ValueError("Please enter a valid full name (letters and spaces only).")
    return val


def validate_password_strength(password: str, role: str) -> None:
    if not password:
        raise ValueError("Password is required.")
    if role == "student":
        if not (8 <= len(password) <= 10):
            raise ValueError("Student password must be between 8 and 10 characters long.")
        if not re.fullmatch(r"[A-Za-z0-9]+", password):
            raise ValueError(
                "Student password must include alphabets and digits only (no symbols or spaces)."
            )
        if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
            raise ValueError("Student password must include both alphabets and digits.")
    elif role == "faculty":
        if not re.fullmatch(r"\d{4,}[A-Za-z]", password):
            raise ValueError(
                "Faculty password must have at least 4 digits first followed by 1 alphabet at the end (minimum 5 characters)."
            )
    elif role == "admin":
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
            raise ValueError("Password must include both letters and digits.")


def validate_room_payload(data: dict[str, Any]) -> dict[str, Any]:
    room_code = str(data.get("room_code", "")).strip().upper()
    building = str(data.get("building", "")).strip()
    room_type = str(data.get("room_type", "lecture")).strip().lower()

    if not ROOM_CODE_RE.match(room_code):
        raise ValueError("Invalid room code (e.g. LH-101).")
    if not SAFE_TEXT_RE.match(building):
        raise ValueError("Invalid building name.")
    if room_type not in VALID_ROOM_TYPES:
        raise ValueError("Room type must be lecture, lab, or seminar.")

    try:
        floor = int(data.get("floor", 1))
        capacity = int(data.get("capacity", 0))
    except (TypeError, ValueError) as exc:
        raise ValueError("Floor and capacity must be whole numbers.") from exc

    if not (1 <= floor <= 50):
        raise ValueError("Floor must be between 1 and 50.")
    if not (10 <= capacity <= 500):
        raise ValueError("Room capacity must be between 10 and 500.")

    return {
        "room_code": room_code,
        "building": sanitize_cell(building, 80),
        "floor": floor,
        "capacity": capacity,
        "room_type": room_type,
    }


def validate_course_payload(data: dict[str, Any]) -> dict[str, Any]:
    course_code = str(data.get("course_code", "")).strip().upper()
    title = str(data.get("title", "")).strip()
    department = str(data.get("department", "BTech CSE department")).strip()
    course_kind = str(data.get("course_kind", "core")).strip().lower()
    room_type = str(data.get("room_type", "lecture")).strip().lower()
    faculty_username = str(data.get("faculty_username", "")).strip() or None

    if not COURSE_CODE_RE.match(course_code):
        raise ValueError("Course code must be 2–5 letters followed by 3 digits (e.g. CSE310).")
    if not SAFE_TEXT_RE.match(title):
        raise ValueError("Course title contains unsupported characters.")
    if department not in VALID_DEPARTMENTS:
        raise ValueError("Selected department is not recognized.")
    if course_kind not in VALID_COURSE_KINDS:
        raise ValueError("Course kind must be core, elective, or backlog.")
    if room_type not in VALID_ROOM_TYPES:
        raise ValueError("Room type must be lecture, lab, or seminar.")

    try:
        credits = float(data.get("credits", 3.0))
        sessions = int(data.get("sessions_per_week", 3))
    except (TypeError, ValueError) as exc:
        raise ValueError("Credits and sessions per week must be numeric.") from exc

    if not (0.5 <= credits <= 10.0) or not (1 <= sessions <= 6):
        raise ValueError("Credits must be 0.5–10 and sessions 1–6 per week.")

    if faculty_username:
        faculty_username = validate_username(faculty_username)

    return {
        "course_code": course_code,
        "title": sanitize_cell(title, 100),
        "department": department,
        "credits": credits,
        "course_kind": course_kind,
        "room_type": room_type,
        "sessions_per_week": sessions,
        "faculty_username": faculty_username,
    }


def validate_section_payload(data: dict[str, Any]) -> dict[str, Any]:
    section_code = str(data.get("section_code", "")).strip().upper()
    department = str(data.get("department", "BTech CSE department")).strip()
    if not SECTION_CODE_RE.match(section_code):
        raise ValueError("Section code must be 2–16 alphanumeric/hyphen characters.")
    if department not in VALID_DEPARTMENTS:
        raise ValueError("Selected department is not recognized.")
    try:
        student_count = int(data.get("student_count", 0))
    except (TypeError, ValueError) as exc:
        raise ValueError("Student count must be an integer.") from exc
    if not (1 <= student_count <= 300):
        raise ValueError("Section student count must be between 1 and 300.")
    return {
        "section_code": section_code,
        "department": department,
        "student_count": student_count,
    }


def validate_enrollment_payload(data: dict[str, Any]) -> dict[str, Any]:
    student_username = validate_username(data.get("student_username", ""))
    section_code = str(data.get("section_code", "")).strip().upper()
    course_code = str(data.get("course_code", "")).strip().upper()
    enrollment_type = str(data.get("enrollment_type", "core")).strip().lower()

    if not SECTION_CODE_RE.match(section_code):
        raise ValueError("Invalid section code.")
    if not COURSE_CODE_RE.match(course_code):
        raise ValueError("Invalid course code.")
    if enrollment_type not in VALID_COURSE_KINDS:
        raise ValueError("Invalid enrollment type.")

    return {
        "student_username": student_username,
        "section_code": section_code,
        "course_code": course_code,
        "enrollment_type": enrollment_type,
    }


def parse_and_validate_upload(raw_bytes: bytes, ext: str) -> dict[str, list[dict[str, Any]]]:
    """Validate uploaded CSV or JSON dataset containing rooms, courses, or sections."""
    text = raw_bytes.decode("utf-8")
    result: dict[str, list[dict[str, Any]]] = {"rooms": [], "courses": [], "sections": []}

    if ext == ".json":
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("Uploaded JSON file is malformed.") from exc
        if not isinstance(payload, dict):
            raise ValueError("JSON root must be an object with rooms/courses/sections arrays.")

        for room in payload.get("rooms", [])[:500]:
            if isinstance(room, dict):
                result["rooms"].append(validate_room_payload(room))
        for course in payload.get("courses", [])[:500]:
            if isinstance(course, dict):
                result["courses"].append(validate_course_payload(course))
        for sec in payload.get("sections", [])[:500]:
            if isinstance(sec, dict):
                result["sections"].append(validate_section_payload(sec))
    else:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise ValueError("CSV file has no header row.")
        fields = set(reader.fieldnames)
        rows = list(reader)[:1000]
        if {"room_code", "capacity"}.issubset(fields):
            for r in rows:
                result["rooms"].append(validate_room_payload(r))
        elif {"course_code", "title"}.issubset(fields):
            for r in rows:
                result["courses"].append(validate_course_payload(r))
        elif {"section_code", "student_count"}.issubset(fields):
            for r in rows:
                result["sections"].append(validate_section_payload(r))
        else:
            raise ValueError(
                "CSV columns must match rooms (room_code, capacity), courses (course_code, title), or sections (section_code, student_count)."
            )

    if not any(result.values()):
        raise ValueError("No valid records found in the uploaded file.")
    return result
