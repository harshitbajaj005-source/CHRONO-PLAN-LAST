export const M3_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type M3Day = (typeof M3_DAYS)[number];

export const M3_WEEKDAY_SLOTS = [
  { index: 5, label: '04:30 PM - 06:00 PM' },
] as const;

export const M3_SATURDAY_SLOTS = [
  { index: 0, label: '09:00 AM - 10:30 AM' },
  { index: 1, label: '10:45 AM - 12:00 PM' },
  { index: 2, label: '12:30 PM - 02:00 PM' },
  { index: 3, label: '02:50 PM - 03:40 PM' },
  { index: 4, label: '04:00 PM - 04:50 PM' },
] as const;

export const M3_LUNCH_BREAK_LABEL = '02:00 PM - 02:50 PM (50-Min Lunch Break on Sat)';

export function getM3TeachingSlotsForDay(day: M3Day) {
  return day === 'Sat' ? M3_SATURDAY_SLOTS : M3_WEEKDAY_SLOTS;
}

export interface M3RoomInput {
  roomCode: string;
  capacity: number;
  roomType: 'lecture' | 'lab' | 'seminar';
}

export interface M3ScheduleRequest {
  requestId: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  facultyUsername: string;
  facultyName: string;
  studentCount: number;
  roomType: 'lecture' | 'lab' | 'seminar';
  courseKind: 'core' | 'elective' | 'backlog';
  sessionsPerWeek: number;
  studentIds: string[];
}

export interface M3ScheduledSlot {
  day: M3Day;
  slotIndex: number;
  slotLabel: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  facultyUsername: string;
  facultyName: string;
  roomCode: string;
  studentCount: number;
  roomCapacity: number;
  courseKind: 'core' | 'elective' | 'backlog';
}

export interface M3UnscheduledItem {
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  courseKind: 'core' | 'elective' | 'backlog';
  reason: string;
}

export interface M3GenerationResult {
  scheduledSlots: M3ScheduledSlot[];
  unscheduled: M3UnscheduledItem[];
  lunchBreakSlot: string;
  stats: {
    totalRequests: number;
    scheduledSessions: number;
    unscheduledCount: number;
    generationMs: number;
  };
  algorithmNotes: string;
}

function violatesConsecutiveLimit(
  day: M3Day,
  occupiedSlots: Set<number>,
  candidateSlot: number,
  maxConsecutive = 3
): boolean {
  if (day !== 'Sat') {
    // Only 1 slot (04:30 PM - 06:00 PM) exists Mon-Fri
    return false;
  }
  // Saturday has 30-min break after slot 1 and 50-min lunch break after slot 2
  const blocks = [[0, 1], [2], [3, 4]];
  for (const block of blocks) {
    let streak = 0;
    for (const idx of block) {
      if (idx === candidateSlot || occupiedSlots.has(idx)) {
        streak += 1;
        if (streak > maxConsecutive) return true;
      } else {
        streak = 0;
      }
    }
  }
  return false;
}

export function generateM3Timetable(
  requests: M3ScheduleRequest[],
  rooms: M3RoomInput[]
): M3GenerationResult {
  const t0 = performance.now();

  const kindPriority: Record<string, number> = {
    backlog: 0,
    elective: 1,
    core: 2,
  };

  const ordered = [...requests].sort((a, b) => {
    const ka = kindPriority[a.courseKind] ?? 2;
    const kb = kindPriority[b.courseKind] ?? 2;
    if (ka !== kb) return ka - kb;
    if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;
    if (b.studentIds.length !== a.studentIds.length) {
      return b.studentIds.length - a.studentIds.length;
    }
    return b.sessionsPerWeek - a.sessionsPerWeek;
  });

  const sortedRooms = [...rooms].sort((a, b) => a.capacity - b.capacity);

  const roomBusy = new Map<string, Set<string>>();
  const facultyBusy = new Map<string, Set<string>>();
  const sectionBusy = new Map<string, Set<string>>();
  const studentBusy = new Map<string, Set<string>>();
  const sectionDaySlots = new Map<string, Set<number>>();
  const facultyDaySlots = new Map<string, Set<number>>();
  const allDaySlots: Array<{ day: M3Day; index: number; label: string }> = [];

  for (const day of M3_DAYS) {
    for (const s of getM3TeachingSlotsForDay(day)) {
      allDaySlots.push({ day, index: s.index, label: s.label });
      const k = `${day}:${s.index}`;
      roomBusy.set(k, new Set());
      facultyBusy.set(k, new Set());
      sectionBusy.set(k, new Set());
      studentBusy.set(k, new Set());
    }
  }

  const reqById = new Map(ordered.map((r) => [r.requestId, r]));
  interface InternalPlacement extends M3ScheduledSlot {
    _requestId: string;
  }
  const placements: InternalPlacement[] = [];
  const unscheduled: M3UnscheduledItem[] = [];

  const getRoomCandidates = (req: M3ScheduleRequest): M3RoomInput[] => {
    const viableRooms = sortedRooms.filter((rm) => rm.capacity >= req.studentCount);
    return [
      ...viableRooms.filter((r) => r.roomType === req.roomType),
      ...viableRooms.filter((r) => r.roomType !== req.roomType),
    ];
  };

  const getOrCreateSet = (map: Map<string, Set<number>>, key: string): Set<number> => {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    return set;
  };

  const canPlace = (
    req: M3ScheduleRequest,
    day: M3Day,
    slotIndex: number,
    roomCandidates: M3RoomInput[]
  ): M3RoomInput | undefined => {
    const key = `${day}:${slotIndex}`;
    if (sectionBusy.get(key)!.has(req.sectionCode)) return undefined;
    if (facultyBusy.get(key)!.has(req.facultyUsername)) return undefined;

    const stuSet = studentBusy.get(key)!;
    for (const sid of req.studentIds) {
      if (stuSet.has(sid)) return undefined;
    }

    const secSlots = getOrCreateSet(sectionDaySlots, `${req.sectionCode}:${day}`);
    const facSlots = getOrCreateSet(facultyDaySlots, `${req.facultyUsername}:${day}`);
    if (violatesConsecutiveLimit(day, secSlots, slotIndex, 3)) return undefined;
    if (violatesConsecutiveLimit(day, facSlots, slotIndex, 3)) return undefined;

    const rSet = roomBusy.get(key)!;
    return roomCandidates.find((rm) => !rSet.has(rm.roomCode));
  };

  const addPlacement = (
    req: M3ScheduleRequest,
    day: M3Day,
    slotIndex: number,
    slotLabel: string,
    chosenRoom: M3RoomInput
  ) => {
    const key = `${day}:${slotIndex}`;
    roomBusy.get(key)!.add(chosenRoom.roomCode);
    facultyBusy.get(key)!.add(req.facultyUsername);
    sectionBusy.get(key)!.add(req.sectionCode);
    const stuSet = studentBusy.get(key)!;
    for (const sid of req.studentIds) stuSet.add(sid);
    getOrCreateSet(sectionDaySlots, `${req.sectionCode}:${day}`).add(slotIndex);
    getOrCreateSet(facultyDaySlots, `${req.facultyUsername}:${day}`).add(slotIndex);

    placements.push({
      _requestId: req.requestId,
      day,
      slotIndex,
      slotLabel,
      sectionCode: req.sectionCode,
      courseCode: req.courseCode,
      courseTitle: req.courseTitle,
      facultyUsername: req.facultyUsername,
      facultyName: req.facultyName,
      roomCode: chosenRoom.roomCode,
      studentCount: req.studentCount,
      roomCapacity: chosenRoom.capacity,
      courseKind: req.courseKind,
    });
  };

  const removeAt = (idx: number): { p: InternalPlacement; r: M3ScheduleRequest } => {
    const p = placements[idx];
    const r = reqById.get(p._requestId)!;
    const key = `${p.day}:${p.slotIndex}`;
    roomBusy.get(key)!.delete(p.roomCode);
    facultyBusy.get(key)!.delete(r.facultyUsername);
    sectionBusy.get(key)!.delete(r.sectionCode);
    const stuSet = studentBusy.get(key)!;
    for (const sid of r.studentIds) stuSet.delete(sid);
    sectionDaySlots.get(`${r.sectionCode}:${p.day}`)?.delete(p.slotIndex);
    facultyDaySlots.get(`${r.facultyUsername}:${p.day}`)?.delete(p.slotIndex);
    return { p, r };
  };

  const restoreAt = (idx: number, oldP: InternalPlacement, r: M3ScheduleRequest) => {
    const key = `${oldP.day}:${oldP.slotIndex}`;
    roomBusy.get(key)!.add(oldP.roomCode);
    facultyBusy.get(key)!.add(r.facultyUsername);
    sectionBusy.get(key)!.add(r.sectionCode);
    const stuSet = studentBusy.get(key)!;
    for (const sid of r.studentIds) stuSet.add(sid);
    getOrCreateSet(sectionDaySlots, `${r.sectionCode}:${oldP.day}`).add(oldP.slotIndex);
    getOrCreateSet(facultyDaySlots, `${r.facultyUsername}:${oldP.day}`).add(oldP.slotIndex);
    placements[idx] = oldP;
  };

  for (const req of ordered) {
    const roomCandidates = getRoomCandidates(req);
    if (roomCandidates.length === 0) {
      const maxCap = sortedRooms.reduce((m, r) => Math.max(m, r.capacity), 0);
      unscheduled.push({
        sectionCode: req.sectionCode,
        courseCode: req.courseCode,
        courseTitle: req.courseTitle,
        courseKind: req.courseKind,
        reason: `No room has sufficient capacity for ${req.studentCount} students (largest available room holds ${maxCap}).`,
      });
      continue;
    }

    let placedCount = 0;

    // Pass 1: spread across distinct days first
    for (const day of M3_DAYS) {
      if (placedCount >= req.sessionsPerWeek) break;
      for (const slot of getM3TeachingSlotsForDay(day)) {
        const chosenRoom = canPlace(req, day, slot.index, roomCandidates);
        if (chosenRoom) {
          addPlacement(req, day, slot.index, slot.label, chosenRoom);
          placedCount += 1;
          break;
        }
      }
    }

    // Pass 2: allow additional slots on the same day (e.g. Saturday)
    while (placedCount < req.sessionsPerWeek) {
      let progressed = false;
      for (const day of M3_DAYS) {
        if (placedCount >= req.sessionsPerWeek) break;
        for (const slot of getM3TeachingSlotsForDay(day)) {
          const chosenRoom = canPlace(req, day, slot.index, roomCandidates);
          if (chosenRoom) {
            addPlacement(req, day, slot.index, slot.label, chosenRoom);
            placedCount += 1;
            progressed = true;
            break;
          }
        }
      }
      if (!progressed) break;
    }

    // Pass 3: 1-swap local repair for tightly packed cohorts
    while (placedCount < req.sessionsPerWeek) {
      let repaired = false;
      for (let idx = 0; idx < placements.length; idx++) {
        const p = placements[idx];
        if (p._requestId === req.requestId) continue;
        const otherReq = reqById.get(p._requestId)!;
        const sharesBlocker =
          otherReq.sectionCode === req.sectionCode ||
          otherReq.facultyUsername === req.facultyUsername ||
          req.studentIds.some((sid) => otherReq.studentIds.includes(sid));
        if (!sharesBlocker) continue;

        const { p: oldP } = removeAt(idx);
        const rmForReq = canPlace(req, oldP.day, oldP.slotIndex, roomCandidates);
        if (rmForReq) {
          addPlacement(req, oldP.day, oldP.slotIndex, oldP.slotLabel, rmForReq);
          const otherRooms = getRoomCandidates(otherReq);
          let moved = false;
          for (const cand of allDaySlots) {
            if (cand.day === oldP.day && cand.index === oldP.slotIndex) continue;
            const rmForOther = canPlace(otherReq, cand.day, cand.index, otherRooms);
            if (rmForOther) {
              restoreAt(
                idx,
                {
                  ...oldP,
                  day: cand.day,
                  slotIndex: cand.index,
                  slotLabel: cand.label,
                  roomCode: rmForOther.roomCode,
                  roomCapacity: rmForOther.capacity,
                },
                otherReq
              );
              placedCount += 1;
              repaired = true;
              moved = true;
              break;
            }
          }
          if (moved) break;
          removeAt(placements.length - 1);
          placements.pop();
        }
        restoreAt(idx, oldP, otherReq);
      }
      if (!repaired) break;
    }

    if (placedCount < req.sessionsPerWeek) {
      unscheduled.push({
        sectionCode: req.sectionCode,
        courseCode: req.courseCode,
        courseTitle: req.courseTitle,
        courseKind: req.courseKind,
        reason: `Scheduled ${placedCount}/${req.sessionsPerWeek} sessions; remaining sessions blocked by simultaneous faculty (${req.facultyName}), student cohort, room availability, or the 3-consecutive-lecture ceiling.`,
      });
    }
  }

  const scheduledSlots: M3ScheduledSlot[] = placements.map(({ _requestId: _omit, ...rest }) => rest);
  const generationMs = Math.round((performance.now() - t0) * 100) / 100;

  return {
    scheduledSlots,
    unscheduled,
    lunchBreakSlot: M3_LUNCH_BREAK_LABEL,
    stats: {
      totalRequests: requests.length,
      scheduledSessions: scheduledSlots.length,
      unscheduledCount: unscheduled.length,
      generationMs,
    },
    algorithmNotes:
      'Most-Constrained-First (backlog/elective and cohort-size prioritized) greedy constraint solver with O(1) conflict sets. Schedules Mon–Fri on the single 04:30 PM – 06:00 PM slot and Saturday across 5 slots while preserving the 30-min midday break (12:00 PM – 12:30 PM) and 50-min lunch break (02:00 PM – 02:50 PM), capping consecutive lectures at 3. Limitation: single-pass greedy placement without global backtracking/ILP may leave edge courses unscheduled above ~92% capacity.',
  };
}

export function buildM3BenchmarkDataset(
  numStudents = 1500,
  numSections = 120
): { requests: M3ScheduleRequest[]; rooms: M3RoomInput[] } {
  const rooms: M3RoomInput[] = [];
  for (let i = 1; i <= 80; i++) {
    rooms.push({
      roomCode: `LH-${100 + i}`,
      capacity: i % 2 === 0 ? 80 : 60,
      roomType: 'lecture',
    });
  }
  for (let i = 1; i <= 45; i++) {
    rooms.push({
      roomCode: `LAB-${300 + i}`,
      capacity: 60,
      roomType: 'lab',
    });
  }

  const requests: M3ScheduleRequest[] = [];
  const studentsPerSec = Math.max(10, Math.floor(numStudents / numSections));

  for (let secIdx = 0; secIdx < numSections; secIdx++) {
    const secCode = `SEC-${String(secIdx + 1).padStart(3, '0')}`;
    const startStu = secIdx * studentsPerSec;
    const baseCohort: string[] = [];
    for (let s = startStu; s < startStu + studentsPerSec; s++) {
      baseCohort.push(`STU-${s}`);
    }

    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const facId = ((secIdx * 3 + cIdx) % 180) + 1;
      const kind: 'core' | 'elective' | 'backlog' =
        secIdx % 12 === 0 && cIdx === 2
          ? 'backlog'
          : cIdx === 2
          ? 'elective'
          : 'core';
      const stuIds = [...baseCohort];
      if ((kind === 'backlog' || kind === 'elective') && secIdx > 0) {
        stuIds.push(`STU-${(secIdx - 1) * studentsPerSec}`);
      }

      requests.push({
        requestId: `${secCode}-C${cIdx + 1}`,
        sectionCode: secCode,
        courseCode: `CS${300 + cIdx * 20 + (secIdx % 5)}`,
        courseTitle: `Course Module ${cIdx + 1}`,
        facultyUsername: `FAC${String(facId).padStart(3, '0')}`,
        facultyName: `Prof. Faculty ${facId}`,
        studentCount: stuIds.length,
        roomType: cIdx === 1 ? 'lab' : 'lecture',
        courseKind: kind,
        sessionsPerWeek: cIdx === 2 ? 2 : 3,
        studentIds: stuIds,
      });
    }
  }

  return { requests, rooms };
}
