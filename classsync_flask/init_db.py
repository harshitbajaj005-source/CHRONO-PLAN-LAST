from config import Config
from db import db_session

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
    department TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(identifier, ip_address)
);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL UNIQUE,
    building TEXT NOT NULL,
    floor INTEGER NOT NULL CHECK (floor >= 1 AND floor <= 50),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    room_type TEXT NOT NULL DEFAULT 'lecture' CHECK (room_type IN ('lecture', 'lab', 'seminar'))
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    credits REAL NOT NULL CHECK (credits > 0),
    course_kind TEXT NOT NULL DEFAULT 'core' CHECK (course_kind IN ('core', 'elective', 'backlog')),
    room_type TEXT NOT NULL DEFAULT 'lecture' CHECK (room_type IN ('lecture', 'lab', 'seminar')),
    sessions_per_week INTEGER NOT NULL DEFAULT 3 CHECK (sessions_per_week BETWEEN 1 AND 6),
    faculty_username TEXT REFERENCES users(username) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_code TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    student_count INTEGER NOT NULL CHECK (student_count > 0)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    section_code TEXT NOT NULL REFERENCES sections(section_code) ON DELETE CASCADE,
    course_code TEXT NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    enrollment_type TEXT NOT NULL DEFAULT 'core' CHECK (enrollment_type IN ('core', 'elective', 'backlog')),
    UNIQUE(student_username, course_code)
);

CREATE TABLE IF NOT EXISTS timetable_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL CHECK (day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')),
    slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 7),
    slot_label TEXT NOT NULL,
    section_code TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    faculty_username TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    room_code TEXT NOT NULL,
    student_count INTEGER NOT NULL,
    room_capacity INTEGER NOT NULL,
    course_kind TEXT NOT NULL DEFAULT 'core',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_day_slot ON timetable_slots(day, slot_index);
CREATE INDEX IF NOT EXISTS idx_slots_section ON timetable_slots(section_code);
CREATE INDEX IF NOT EXISTS idx_slots_faculty ON timetable_slots(faculty_username);
"""

SEED_ROOMS = [
    ("LH-101", "Academic Block 1", 1, 120, "lecture"),
    ("LH-102", "Academic Block 1", 1, 90, "lecture"),
    ("LH-201", "Academic Block 1", 2, 75, "lecture"),
    ("LH-202", "Academic Block 1", 2, 75, "lecture"),
    ("LAB-301", "Tech Wing", 3, 60, "lab"),
    ("LAB-302", "Tech Wing", 3, 60, "lab"),
    ("SEM-401", "Commons Hall", 4, 80, "seminar"),
    ("SEM-402", "Commons Hall", 4, 80, "seminar"),
    ("LH-501", "Academic Block 2", 5, 110, "lecture"),
    ("LH-502", "Academic Block 2", 5, 70, "lecture"),
]

SEED_SECTIONS = [
    ("CSE-4A", "BTech CSE department", 58),
    ("CSE-4B", "BTech CSE department", 62),
    ("BBA-2A", "Business department", 55),
    ("MBA-1A", "Business department", 48),
]

SEED_COURSES = [
    ("CSE310", "Advanced Algorithms", "BTech CSE department", 4.0, "core", "lecture", 3),
    ("CSE312", "Database Systems Lab", "BTech CSE department", 2.5, "core", "lab", 2),
    ("CSE350", "Software Engineering", "BTech CSE department", 3.0, "core", "lecture", 3),
    ("CSE380", "Distributed Systems", "BTech CSE department", 3.0, "elective", "seminar", 2),
    ("CSE305", "Discrete Structures (Backlog)", "BTech CSE department", 3.0, "backlog", "lecture", 2),
    ("BBA110", "Managerial Economics", "Business department", 3.0, "core", "lecture", 3),
    ("MBA520", "Corporate Strategy", "Business department", 3.0, "elective", "seminar", 2),
]


def init_database(db_path: str = Config.DATABASE_PATH) -> None:
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.executemany(
            """
            INSERT OR IGNORE INTO rooms (room_code, building, floor, capacity, room_type)
            VALUES (?, ?, ?, ?, ?)
            """,
            SEED_ROOMS,
        )
        conn.executemany(
            """
            INSERT OR IGNORE INTO sections (section_code, department, student_count)
            VALUES (?, ?, ?)
            """,
            SEED_SECTIONS,
        )
        conn.executemany(
            """
            INSERT OR IGNORE INTO courses (
                course_code, title, department, credits, course_kind, room_type, sessions_per_week
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            SEED_COURSES,
        )


if __name__ == "__main__":
    init_database()
    print(f"Initialized database at {Config.DATABASE_PATH}")
