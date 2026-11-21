import time
from dataclasses import dataclass, field
from typing import Any

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# Lunch & break slots on Saturday:
# - 12:00 PM - 12:30 PM (30-min midday break between slot 1 and slot 2)
# - 02:00 PM - 02:50 PM (50-min lunch break between slot 2 and slot 3)
LUNCH_SLOT_INDEX = -1
LUNCH_BREAK_LABEL = "02:00 PM - 02:50 PM (50-Min Lunch Break on Sat)"

WEEKDAY_SLOTS = [
    (5, "04:30 PM - 06:00 PM"),
]

SATURDAY_SLOTS = [
    (0, "09:00 AM - 10:30 AM"),
    (1, "10:45 AM - 12:00 PM"),
    (2, "12:30 PM - 02:00 PM"),
    (3, "02:50 PM - 03:40 PM"),
    (4, "04:00 PM - 04:50 PM"),
]

TIME_SLOTS = SATURDAY_SLOTS + WEEKDAY_SLOTS
SLOT_LABELS = dict(TIME_SLOTS)


def get_teaching_slots_for_day(day: str) -> list[tuple[int, str]]:
    return SATURDAY_SLOTS if day == "Sat" else WEEKDAY_SLOTS


@dataclass
class ScheduleRequestItem:
    request_id: str
    section_code: str
    course_code: str
    course_title: str
    faculty_username: str
    faculty_name: str
    student_count: int
    room_type: str = "lecture"
    course_kind: str = "core"  # core | elective | backlog
    sessions_per_week: int = 3
    student_ids: set[str] = field(default_factory=set)


@dataclass
class RoomItem:
    room_code: str
    capacity: int
    room_type: str = "lecture"


def _violates_consecutive_limit(
    occupied_slots: set[int],
    candidate_slot: int,
    max_consecutive: int = 3,
    day: str = "Sat",
) -> bool:
    """Ensure adding candidate_slot never creates >3 consecutive lecture hours (breaks reset streak)."""
    if day != "Sat":
        return False
    test = occupied_slots | {candidate_slot}
    # Saturday contiguous blocks separated by 30-min midday break & 50-min lunch break
    for block in ([0, 1], [2], [3, 4]):
        streak = 0
        for idx in block:
            if idx in test:
                streak += 1
                if streak > max_consecutive:
                    return True
            else:
                streak = 0
    return False


def generate_clash_free_timetable(
    requests: list[ScheduleRequestItem],
    rooms: list[RoomItem],
) -> dict[str, Any]:
    """
    Constraint-prioritized greedy M3 Timetable Clash Resolver.
    - Mon–Fri: single evening slot (04:30 PM - 06:00 PM).
    - Sat: 5 slots (09:00–10:30, 10:45–12:00, [30m break], 12:30–02:00, [50m lunch], 02:50–03:40, 04:00–04:50).
    - Never double-books a student, section, faculty member, or room.
    - Respects room capacity (capacity >= student_count) and prefers matching room_type.
    - Enforces <= 3 consecutive lecture slots per section and faculty member per day.
    """
    t0 = time.perf_counter()

    kind_priority = {"backlog": 0, "elective": 1, "core": 2}
    ordered_requests = sorted(
        requests,
        key=lambda r: (
            kind_priority.get(r.course_kind, 2),
            -r.student_count,
            -len(r.student_ids),
            -r.sessions_per_week,
        ),
    )

    sorted_rooms = sorted(rooms, key=lambda rm: rm.capacity)

    room_busy: dict[tuple[str, int], set[str]] = {}
    faculty_busy: dict[tuple[str, int], set[str]] = {}
    section_busy: dict[tuple[str, int], set[str]] = {}
    student_busy: dict[tuple[str, int], set[str]] = {}
    all_day_slots: list[tuple[str, int, str]] = []
    for d in DAYS:
        for s, lbl in get_teaching_slots_for_day(d):
            all_day_slots.append((d, s, lbl))
            room_busy[(d, s)] = set()
            faculty_busy[(d, s)] = set()
            section_busy[(d, s)] = set()
            student_busy[(d, s)] = set()

    section_day_slots: dict[tuple[str, str], set[int]] = {}
    faculty_day_slots: dict[tuple[str, str], set[int]] = {}
    req_by_id = {r.request_id: r for r in ordered_requests}

    placements: list[dict[str, Any]] = []
    unscheduled: list[dict[str, str]] = []

    def _room_candidates(req: ScheduleRequestItem) -> list[RoomItem]:
        viable = [rm for rm in sorted_rooms if rm.capacity >= req.student_count]
        return [rm for rm in viable if rm.room_type == req.room_type] + [
            rm for rm in viable if rm.room_type != req.room_type
        ]

    def _can_place(
        req: ScheduleRequestItem,
        day: str,
        slot_idx: int,
        room_candidates: list[RoomItem],
    ) -> RoomItem | None:
        key = (day, slot_idx)
        if req.section_code in section_busy[key]:
            return None
        if req.faculty_username in faculty_busy[key]:
            return None
        if req.student_ids and not req.student_ids.isdisjoint(student_busy[key]):
            return None
        sec_slots = section_day_slots.setdefault((req.section_code, day), set())
        fac_slots = faculty_day_slots.setdefault((req.faculty_username, day), set())
        if _violates_consecutive_limit(sec_slots, slot_idx, 3, day):
            return None
        if _violates_consecutive_limit(fac_slots, slot_idx, 3, day):
            return None
        for rm in room_candidates:
            if rm.room_code not in room_busy[key]:
                return rm
        return None

    def _add_placement(
        req: ScheduleRequestItem,
        day: str,
        slot_idx: int,
        slot_label: str,
        rm: RoomItem,
    ) -> None:
        key = (day, slot_idx)
        room_busy[key].add(rm.room_code)
        faculty_busy[key].add(req.faculty_username)
        section_busy[key].add(req.section_code)
        if req.student_ids:
            student_busy[key].update(req.student_ids)
        section_day_slots.setdefault((req.section_code, day), set()).add(slot_idx)
        faculty_day_slots.setdefault((req.faculty_username, day), set()).add(slot_idx)
        placements.append(
            {
                "_request_id": req.request_id,
                "day": day,
                "slot_index": slot_idx,
                "slot_label": slot_label,
                "section_code": req.section_code,
                "course_code": req.course_code,
                "course_title": req.course_title,
                "faculty_username": req.faculty_username,
                "faculty_name": req.faculty_name,
                "room_code": rm.room_code,
                "student_count": req.student_count,
                "room_capacity": rm.capacity,
                "course_kind": req.course_kind,
            }
        )

    def _remove_at(idx: int) -> tuple[dict[str, Any], ScheduleRequestItem]:
        p = placements[idx]
        r = req_by_id[p["_request_id"]]
        key = (p["day"], p["slot_index"])
        room_busy[key].discard(p["room_code"])
        faculty_busy[key].discard(r.faculty_username)
        section_busy[key].discard(r.section_code)
        if r.student_ids:
            student_busy[key].difference_update(r.student_ids)
        section_day_slots[(r.section_code, p["day"])].discard(p["slot_index"])
        faculty_day_slots[(r.faculty_username, p["day"])].discard(p["slot_index"])
        return p, r

    def _restore_at(idx: int, old_p: dict[str, Any], r: ScheduleRequestItem) -> None:
        key = (old_p["day"], old_p["slot_index"])
        room_busy[key].add(old_p["room_code"])
        faculty_busy[key].add(r.faculty_username)
        section_busy[key].add(r.section_code)
        if r.student_ids:
            student_busy[key].update(r.student_ids)
        section_day_slots.setdefault((r.section_code, old_p["day"]), set()).add(old_p["slot_index"])
        faculty_day_slots.setdefault((r.faculty_username, old_p["day"]), set()).add(old_p["slot_index"])
        placements[idx] = old_p

    for req in ordered_requests:
        room_candidates = _room_candidates(req)
        if not room_candidates:
            unscheduled.append(
                {
                    "section_code": req.section_code,
                    "course_code": req.course_code,
                    "course_title": req.course_title,
                    "course_kind": req.course_kind,
                    "reason": (
                        f"No room has sufficient capacity for {req.student_count} students "
                        f"(largest available room holds {max((r.capacity for r in sorted_rooms), default=0)})."
                    ),
                }
            )
            continue

        sessions_needed = req.sessions_per_week
        placed_count = 0

        # Pass 1: spread across distinct weekdays/Saturday first
        for day in DAYS:
            if placed_count >= sessions_needed:
                break
            for slot_idx, slot_label in get_teaching_slots_for_day(day):
                chosen_room = _can_place(req, day, slot_idx, room_candidates)
                if chosen_room:
                    _add_placement(req, day, slot_idx, slot_label, chosen_room)
                    placed_count += 1
                    break

        # Pass 2: allow additional slots on the same day (e.g. Saturday multi-slot schedule) until filled or blocked
        while placed_count < sessions_needed:
            progressed = False
            for day in DAYS:
                if placed_count >= sessions_needed:
                    break
                for slot_idx, slot_label in get_teaching_slots_for_day(day):
                    chosen_room = _can_place(req, day, slot_idx, room_candidates)
                    if chosen_room:
                        _add_placement(req, day, slot_idx, slot_label, chosen_room)
                        placed_count += 1
                        progressed = True
                        break
            if not progressed:
                break

        # Pass 3: 1-swap local repair for tightly constrained cohorts
        while placed_count < sessions_needed:
            repaired = False
            for idx in range(len(placements)):
                p = placements[idx]
                if p["_request_id"] == req.request_id:
                    continue
                other_req = req_by_id[p["_request_id"]]
                shares_blocker = (
                    other_req.section_code == req.section_code
                    or other_req.faculty_username == req.faculty_username
                    or bool(req.student_ids and not req.student_ids.isdisjoint(other_req.student_ids))
                )
                if not shares_blocker:
                    continue

                old_p, _ = _remove_at(idx)
                rm_for_req = _can_place(req, old_p["day"], old_p["slot_index"], room_candidates)
                if rm_for_req:
                    _add_placement(req, old_p["day"], old_p["slot_index"], old_p["slot_label"], rm_for_req)
                    other_rooms = _room_candidates(other_req)
                    moved = False
                    for d2, s2, lbl2 in all_day_slots:
                        if d2 == old_p["day"] and s2 == old_p["slot_index"]:
                            continue
                        rm_for_other = _can_place(other_req, d2, s2, other_rooms)
                        if rm_for_other:
                            updated_other = {
                                **old_p,
                                "day": d2,
                                "slot_index": s2,
                                "slot_label": lbl2,
                                "room_code": rm_for_other.room_code,
                                "room_capacity": rm_for_other.capacity,
                            }
                            _restore_at(idx, updated_other, other_req)
                            placed_count += 1
                            repaired = True
                            moved = True
                            break
                    if moved:
                        break
                    # Undo temporary placement of req at the end of placements
                    _remove_at(len(placements) - 1)
                    placements.pop()
                _restore_at(idx, old_p, other_req)
            if not repaired:
                break

        if placed_count < sessions_needed:
            unscheduled.append(
                {
                    "section_code": req.section_code,
                    "course_code": req.course_code,
                    "course_title": req.course_title,
                    "course_kind": req.course_kind,
                    "reason": (
                        f"Scheduled {placed_count}/{sessions_needed} sessions; remaining sessions "
                        f"blocked by simultaneous faculty ({req.faculty_name}), student cohort, "
                        f"room availability, or the 3-consecutive-lecture ceiling."
                    ),
                }
            )

    scheduled_slots = [{k: v for k, v in p.items() if k != "_request_id"} for p in placements]
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    return {
        "scheduled_slots": scheduled_slots,
        "unscheduled": unscheduled,
        "lunch_break_slot": LUNCH_BREAK_LABEL,
        "stats": {
            "total_requests": len(requests),
            "scheduled_sessions": len(scheduled_slots),
            "unscheduled_count": len(unscheduled),
            "generation_ms": elapsed_ms,
        },
        "algorithm_notes": (
            "Uses a Most-Constrained-First (backlog/elective and cohort-size prioritized) "
            "greedy constraint solver with O(1) conflict hash sets. Schedules Mon–Fri on the "
            "single 04:30 PM – 06:00 PM slot and Saturday across 5 slots while preserving the "
            "30-min midday break (12:00 PM – 12:30 PM) and 50-min lunch break (02:00 PM – 02:50 PM), "
            "capping consecutive lectures at 3. Limitation: because it is a single-pass greedy heuristic "
            "without global backtracking/ILP, tightly saturated timetables (>92% utilization) may leave "
            "edge courses unscheduled even when a multi-swap global permutation exists."
        ),
    }


def build_benchmark_dataset(
    num_students: int = 1500, num_sections: int = 120
) -> tuple[list[ScheduleRequestItem], list[RoomItem]]:
    """Generate a realistic 1,500-student, 120-section benchmark workload."""
    rooms: list[RoomItem] = []
    for i in range(1, 81):
        rooms.append(RoomItem(room_code=f"LH-{100 + i}", capacity=80 if i % 2 == 0 else 60, room_type="lecture"))
    for i in range(1, 46):
        rooms.append(RoomItem(room_code=f"LAB-{300 + i}", capacity=60, room_type="lab"))

    requests: list[ScheduleRequestItem] = []
    students_per_sec = max(10, num_students // num_sections)

    for sec_idx in range(num_sections):
        sec_code = f"SEC-{sec_idx + 1:03d}"
        start_stu = sec_idx * students_per_sec
        cohort = {f"STU-{s}" for s in range(start_stu, start_stu + students_per_sec)}

        for c_idx in range(3):
            fac_id = ((sec_idx * 3 + c_idx) % 180) + 1
            kind = "backlog" if (sec_idx % 12 == 0 and c_idx == 2) else ("elective" if c_idx == 2 else "core")
            stu_set = set(cohort)
            if kind in {"backlog", "elective"} and sec_idx > 0:
                stu_set.add(f"STU-{(sec_idx - 1) * students_per_sec}")

            requests.append(
                ScheduleRequestItem(
                    request_id=f"{sec_code}-C{c_idx + 1}",
                    section_code=sec_code,
                    course_code=f"CS{300 + (c_idx * 20) + (sec_idx % 5)}",
                    course_title=f"Course Module {c_idx + 1}",
                    faculty_username=f"FAC{fac_id:03d}",
                    faculty_name=f"Prof. Faculty {fac_id}",
                    student_count=len(stu_set),
                    room_type="lab" if c_idx == 1 else "lecture",
                    course_kind=kind,
                    sessions_per_week=2 if c_idx == 2 else 3,
                    student_ids=stu_set,
                )
            )

    return requests, rooms
