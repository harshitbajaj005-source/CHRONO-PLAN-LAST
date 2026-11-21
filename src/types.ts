export type UserRole = 'student' | 'faculty' | 'admin';

export type ActiveTab = 'schedule' | 'courses' | 'conflicts' | 'profile';

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type FacultyDepartment =
  | 'BTech CSE department'
  | 'Business department'
  | 'Architecture department'
  | 'Agriculture department'
  | 'Law department'
  | 'MBBS department'
  | 'Civil department'
  | 'Others';

export interface UserProfile {
  role: UserRole;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  facultyCode?: string;
  facultyDepartment?: FacultyDepartment | null;
  studentDepartment?: FacultyDepartment | null;
  section: string;
  year: string;
  registrationNumber: string; // 7-digit Student ID or 5-digit Faculty ID
  rfId?: string;
  specialCode?: string;
  department: string;
  email: string;
  semester: string;
  attendancePct: number;
  activeBacklogs: number;
}

export interface ApiAuthSession {
  token: string;
  apiKey: string;
  csrfToken: string;
  role: UserRole;
  profile: UserProfile;
}

export interface M3ScheduledSlot {
  day: DayKey;
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

export interface M3GenerationResponse {
  scheduledSlots: M3ScheduledSlot[];
  unscheduled: Array<{
    sectionCode: string;
    courseCode: string;
    courseTitle: string;
    courseKind: string;
    reason: string;
  }>;
  lunchBreakSlot: string;
  stats: {
    totalRequests: number;
    scheduledSessions: number;
    unscheduledCount: number;
    generationMs: number;
  };
  algorithmNotes: string;
}

export interface SchedulePeriod {
  id: string;
  periodCode: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  title: string;
  room: string;
  instructor: string;
  status: 'completed' | 'now' | 'upcoming';
  reminderEnabled: boolean;
  attended?: boolean;
  topic: string;
  credits: number;
}

export interface DayBreak {
  afterPeriodIndex: number;
  label: string;
}

export interface DaySchedule {
  day: DayKey;
  dateLabel: string;
  breakLabel: string;
  breaks?: DayBreak[];
  periods: SchedulePeriod[];
}

export interface Course {
  id: string;
  code: string;
  threeDigitCode?: string;
  trackPrefix?: string;
  title: string;
  instructor: string;
  department: string;
  credits: number;
  scheduleSummary: string;
  day: DayKey;
  dateKey?: string;
  timeSlot: string;
  room: string;
  enrolled: boolean;
  seatsLeft: number;
  description: string;
}

export interface DepartmentRoom {
  id: string;
  department: FacultyDepartment;
  blockNumber: number;
  blockName: string;
  floorNumber: number; // 1..9
  classIndex: number; // 1..10
  roomCode: string; // e.g. "101".."910"
  name: string; // e.g. "Room 101"
  capacity: string;
  equipment: string;
}

export interface RoomReservation {
  id: string;
  roomId: string;
  department: FacultyDepartment;
  blockName: string;
  floorNumber: number;
  roomName: string;
  dateKey: string; // YYYY-MM-DD
  timeSlot: string;
  subjectCode: string;
  courseTitle: string;
  instructorName: string;
  facultyCode?: string;
}

export interface FacultySubjectAssignment {
  id: string;
  reservationId: string;
  facultyCode: string;
  facultyName: string;
  department: FacultyDepartment;
  subjectCode: string;
  subjectTitle: string;
  blockName: string;
  floorNumber: number;
  roomName: string;
  dateKey: string;
  timeSlot: string;
}

export interface ScheduleConflict {
  id: string;
  type: 'course-overlap' | 'room-booking';
  title: string;
  description: string;
  severity: 'action-required' | 'resolved';
  affectedCourseId?: string;
  suggestedActionLabel: string;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  category: 'schedule' | 'room' | 'system';
}
