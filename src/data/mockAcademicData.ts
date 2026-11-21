import type {
  AppNotification,
  Course,
  DayKey,
  DaySchedule,
  DepartmentRoom,
  FacultyDepartment,
  RoomReservation,
  UserProfile,
} from '../types.ts';

import { ALL_CATALOG_COURSES } from './courseCatalog.ts';

export const DEFAULT_STUDENT_PROFILE: UserProfile = {
  role: 'student',
  fullName: 'Alex Mercer',
  studentDepartment: null,
  section: '4B',
  year: '3rd Year',
  registrationNumber: '1220456',
  department: '',
  email: 'alex.mercer@lpu.in',
  semester: 'Fall Semester 2024',
  attendancePct: 92,
  activeBacklogs: 0,
};

export const DEFAULT_FACULTY_PROFILE: UserProfile = {
  role: 'faculty',
  fullName: 'Faculty Member',
  facultyCode: '',
  facultyDepartment: null,
  section: 'Block 1',
  year: 'Faculty',
  registrationNumber: '10452',
  department: '',
  email: 'faculty@lpu.in',
  semester: 'Spring Term 2025',
  attendancePct: 100,
  activeBacklogs: 0,
};

export const FACULTY_DEPARTMENTS: {
  name: FacultyDepartment;
  blocksCount: number;
  summary: string;
}[] = [
  {
    name: 'BTech CSE department',
    blocksCount: 5,
    summary: '5 Blocks · 9 Floors/Block · 10 Classes/Floor',
  },
  {
    name: 'Business department',
    blocksCount: 3,
    summary: '3 Blocks · 9 Floors/Block · 10 Classes/Floor',
  },
  {
    name: 'Architecture department',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
  {
    name: 'Agriculture department',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
  {
    name: 'Law department',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
  {
    name: 'MBBS department',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
  {
    name: 'Civil department',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
  {
    name: 'Others',
    blocksCount: 1,
    summary: '1 Block · 9 Floors · 10 Classes/Floor',
  },
];

export const FLOORS_PER_BLOCK = 9;
export const CLASSES_PER_FLOOR = 10;

export function getDepartmentBlockCount(department: FacultyDepartment): number {
  const match = FACULTY_DEPARTMENTS.find((d) => d.name === department);
  return match ? match.blocksCount : 1;
}

export function buildBlockRooms(
  department: FacultyDepartment,
  blockNumber: number
): DepartmentRoom[] {
  const rooms: DepartmentRoom[] = [];
  const blockName = `Block ${blockNumber}`;
  const slug = department.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  for (let floor = 1; floor <= FLOORS_PER_BLOCK; floor++) {
    for (let cls = 1; cls <= CLASSES_PER_FLOOR; cls++) {
      const roomCode = `${floor}${String(cls).padStart(2, '0')}`;
      rooms.push({
        id: `${slug}-b${blockNumber}-f${floor}-c${cls}`,
        department,
        blockNumber,
        blockName,
        floorNumber: floor,
        classIndex: cls,
        roomCode,
        name: `Room ${roomCode}`,
        capacity: cls <= 2 ? '120 Seats' : cls <= 6 ? '60 Seats' : '45 Seats',
        equipment:
          cls % 3 === 0
            ? 'Smart Lab · 4K Laser'
            : cls % 2 === 0
            ? 'Dual Projectors · Audio'
            : 'Smart Podium · Climate Control',
      });
    }
  }
  return rooms;
}

export const WEEKDAY_TIME_SLOTS = ['04:30 PM - 06:00 PM'];

export const SATURDAY_TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:45 AM - 12:00 PM',
  '12:30 PM - 02:00 PM',
  '02:50 PM - 03:40 PM',
  '04:00 PM - 04:50 PM',
];

export const TIME_SLOTS = [...WEEKDAY_TIME_SLOTS, ...SATURDAY_TIME_SLOTS];

export function isSaturdayDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 6;
}

export function isSundayDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 0;
}

export function getTimeSlotsForDate(dateKey: string): string[] {
  if (isSaturdayDateKey(dateKey)) {
    return SATURDAY_TIME_SLOTS;
  }
  if (isSundayDateKey(dateKey)) {
    return [];
  }
  return WEEKDAY_TIME_SLOTS;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSlotOccupiedBySchedule(
  department: FacultyDepartment,
  blockNumber: number,
  floorNumber: number,
  classIndex: number,
  dateKey: string,
  timeSlot: string
): boolean {
  // Deterministic realistic occupancy across some classrooms so professors see live Available vs Occupied states
  const dayNum = parseInt(dateKey.split('-')[2] || '1', 10);
  const slotIdx = TIME_SLOTS.indexOf(timeSlot);
  const deptOffset = department.length;
  const hash = (dayNum * 7 + slotIdx * 13 + blockNumber * 5 + floorNumber * 3 + classIndex + deptOffset) % 11;
  return hash === 0 || hash === 4;
}

export const WEEKLY_SCHEDULE: Record<DayKey, DaySchedule> = {
  Mon: {
    day: 'Mon',
    dateLabel: 'Oct 21',
    breakLabel: 'Single Evening Slot (04:30 PM – 06:00 PM)',
    periods: [
      {
        id: 'mon-p1',
        periodCode: 'P1',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        courseCode: 'CS-401',
        title: 'Advanced Algorithms',
        room: 'Block 1 · Room 402',
        instructor: 'Prof. Evelyn Vance',
        status: 'now',
        reminderEnabled: true,
        attended: false,
        topic: 'Amortized Analysis & Fibonacci Heaps',
        credits: 4.0,
      },
    ],
  },
  Tue: {
    day: 'Tue',
    dateLabel: 'Oct 22',
    breakLabel: 'Single Evening Slot (04:30 PM – 06:00 PM)',
    periods: [
      {
        id: 'tue-p1',
        periodCode: 'P1',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        courseCode: 'CS-312',
        title: 'Database Systems Lab',
        room: 'Block 2 · Room 305',
        instructor: 'Dr. Marcus Chen',
        status: 'upcoming',
        reminderEnabled: false,
        attended: false,
        topic: 'B+ Tree Indexing & Query Execution Plans',
        credits: 2.5,
      },
    ],
  },
  Wed: {
    day: 'Wed',
    dateLabel: 'Oct 23',
    breakLabel: 'Single Evening Slot (04:30 PM – 06:00 PM)',
    periods: [
      {
        id: 'wed-p1',
        periodCode: 'P1',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        courseCode: 'CS-350',
        title: 'Software Engineering',
        room: 'Block 1 · Room 201',
        instructor: 'Prof. Sarah Jenkins',
        status: 'upcoming',
        reminderEnabled: true,
        attended: false,
        topic: 'Domain-Driven Design & Microservice Boundaries',
        credits: 3.0,
      },
    ],
  },
  Thu: {
    day: 'Thu',
    dateLabel: 'Oct 24',
    breakLabel: 'Single Evening Slot (04:30 PM – 06:00 PM)',
    periods: [
      {
        id: 'thu-p1',
        periodCode: 'P1',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        courseCode: 'CS-320',
        title: 'Computer Networks',
        room: 'Block 3 · Room 507',
        instructor: 'Dr. Alan Turing',
        status: 'upcoming',
        reminderEnabled: false,
        attended: false,
        topic: 'TCP Congestion Control & QUIC Protocol',
        credits: 3.0,
      },
    ],
  },
  Fri: {
    day: 'Fri',
    dateLabel: 'Oct 25',
    breakLabel: 'Single Evening Slot (04:30 PM – 06:00 PM)',
    periods: [
      {
        id: 'fri-p1',
        periodCode: 'P1',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        courseCode: 'DES-210',
        title: 'UI/UX Design Studio',
        room: 'Block 4 · Room 109',
        instructor: 'Prof. Maya Lin',
        status: 'upcoming',
        reminderEnabled: false,
        attended: false,
        topic: 'Mobile Touch Ergonomics Lab',
        credits: 3.0,
      },
    ],
  },
  Sat: {
    day: 'Sat',
    dateLabel: 'Oct 26',
    breakLabel: '02:00 PM – 02:50 PM · 50-Min Lunch Break',
    breaks: [
      { afterPeriodIndex: 1, label: '12:00 PM – 12:30 PM · 30-Min Midday Break' },
      { afterPeriodIndex: 2, label: '02:00 PM – 02:50 PM · 50-Min Lunch Break' },
    ],
    periods: [
      {
        id: 'sat-p1',
        periodCode: 'P1',
        startTime: '09:00 AM',
        endTime: '10:30 AM',
        courseCode: 'CS-401',
        title: 'Advanced Algorithms',
        room: 'Block 1 · Room 402',
        instructor: 'Prof. Evelyn Vance',
        status: 'completed',
        reminderEnabled: false,
        attended: true,
        topic: 'Max-Flow Min-Cut & Bipartite Matching',
        credits: 4.0,
      },
      {
        id: 'sat-p2',
        periodCode: 'P2',
        startTime: '10:45 AM',
        endTime: '12:00 PM',
        courseCode: 'CS-312',
        title: 'Database Systems Lab',
        room: 'Block 2 · Room 305',
        instructor: 'Dr. Marcus Chen',
        status: 'completed',
        reminderEnabled: false,
        attended: true,
        topic: 'MVCC Isolation Levels & Distributed Locks',
        credits: 2.5,
      },
      {
        id: 'sat-p3',
        periodCode: 'P3',
        startTime: '12:30 PM',
        endTime: '02:00 PM',
        courseCode: 'CS-350',
        title: 'Software Engineering',
        room: 'Block 1 · Room 201',
        instructor: 'Prof. Sarah Jenkins',
        status: 'now',
        reminderEnabled: true,
        attended: false,
        topic: 'Continuous Delivery & Contract Testing',
        credits: 3.0,
      },
      {
        id: 'sat-p4',
        periodCode: 'P4',
        startTime: '02:50 PM',
        endTime: '03:40 PM',
        courseCode: 'CS-320',
        title: 'Computer Networks',
        room: 'Block 3 · Room 507',
        instructor: 'Dr. Alan Turing',
        status: 'upcoming',
        reminderEnabled: false,
        attended: false,
        topic: 'TLS 1.3 Handshake & Zero-RTT Sessions',
        credits: 3.0,
      },
      {
        id: 'sat-p5',
        periodCode: 'P5',
        startTime: '04:00 PM',
        endTime: '04:50 PM',
        courseCode: 'AI-410',
        title: 'Artificial Intelligence',
        room: 'Block 5 · Room 610',
        instructor: 'Dr. John McCarthy',
        status: 'upcoming',
        reminderEnabled: true,
        attended: false,
        topic: 'Monte Carlo Tree Search & Alpha-Beta Pruning',
        credits: 3.0,
      },
    ],
  },
};

export const INITIAL_COURSES: Course[] = ALL_CATALOG_COURSES;

export const INITIAL_RESERVATIONS: RoomReservation[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Software Engineering starts now',
    detail: 'Block 1 · Room 201 · Prof. Sarah Jenkins (11:00 AM – 12:00 PM)',
    time: 'Just now',
    read: false,
    category: 'schedule',
  },
  {
    id: 'notif-2',
    title: 'Zero Schedule Conflicts Verified',
    detail: 'All 18.5 enrolled credits across 6 courses are conflict-free.',
    time: '2h ago',
    read: false,
    category: 'system',
  },
  {
    id: 'notif-3',
    title: 'Department Room Matrix Live',
    detail: 'Real-time block, floor, and class slot availability synchronized.',
    time: 'Yesterday',
    read: true,
    category: 'room',
  },
];
