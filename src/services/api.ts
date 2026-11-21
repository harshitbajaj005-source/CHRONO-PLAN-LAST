import type {
  ApiAuthSession,
  Course,
  DepartmentRoom,
  FacultyDepartment,
  FacultySubjectAssignment,
  M3GenerationResponse,
  M3ScheduledSlot,
  RoomReservation,
  ScheduleConflict,
  UserProfile,
  UserRole,
} from '../types.ts';

export interface LoginPayload {
  role: UserRole;
  identifier?: string;
  fullName?: string;
  section?: string;
  year?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  facultyCode?: string;
  registrationNumber: string;
  email?: string;
  password: string;
}

export interface BlockSummary {
  blockNumber: number;
  blockName: string;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
}

export interface RoomAvailabilityItem extends DepartmentRoom {
  booking: RoomReservation | null;
  systemOccupied: boolean;
  available: boolean;
}

export interface FacultyAvailabilityResponse {
  department: FacultyDepartment;
  blockNumber: number;
  blockSummaries: BlockSummary[];
  rooms: RoomAvailabilityItem[];
  reservations: RoomReservation[];
  subjects: FacultySubjectAssignment[];
}

export interface StudentDashboardResponse {
  profile: UserProfile;
  courses: Course[];
  conflicts: ScheduleConflict[];
  totalCredits: number;
  facultySubjects: FacultySubjectAssignment[];
  bookedCountsByDepartment?: Record<string, number>;
}

let preAuthCsrfToken = '';

async function ensurePreAuthCsrf(): Promise<string> {
  if (preAuthCsrfToken) return preAuthCsrfToken;
  const status = await getAuthStatusApi();
  return status.csrfToken;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  session?: ApiAuthSession | null
): Promise<T> {
  const headers = new Headers(options.headers);
  const method = (options.method || 'GET').toUpperCase();

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (session) {
    headers.set('Authorization', `Bearer ${session.token}`);
    headers.set('x-api-key', session.apiKey);
    if (method !== 'GET') {
      headers.set('x-csrf-token', session.csrfToken);
    }
  } else if (method !== 'GET') {
    const token = await ensurePreAuthCsrf();
    headers.set('x-csrf-token', token);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (typeof data?.csrfToken === 'string' && !session) {
    preAuthCsrfToken = data.csrfToken;
  }

  if (!response.ok) {
    if (response.status === 403 && !session) {
      preAuthCsrfToken = '';
    }
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function getAuthStatusApi(): Promise<{
  needsAdminSetup: boolean;
  csrfToken: string;
}> {
  const res = await apiRequest<{ needsAdminSetup: boolean; csrfToken: string }>(
    '/api/auth/status',
    { method: 'GET' }
  );
  preAuthCsrfToken = res.csrfToken;
  return res;
}

export function bootstrapAdminApi(payload: {
  username: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<{ message: string; csrfToken: string }> {
  return apiRequest('/api/auth/bootstrap-admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginWithApi(payload: LoginPayload): Promise<ApiAuthSession> {
  return apiRequest<ApiAuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface RegisterStudentPayload {
  fullName: string;
  section: string;
  year: string;
  registrationNumber: string;
  rfId: string;
  specialCode: string;
  email: string;
  password: string;
}

export interface RegisterFacultyPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  facultyCode: string;
  registrationNumber: string;
  password: string;
}

export function registerStudentApi(
  payload: RegisterStudentPayload
): Promise<{ message: string; registrationNumber: string; email: string }> {
  return apiRequest('/api/auth/register-student', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerFacultyApi(
  payload: RegisterFacultyPayload
): Promise<{ message: string; facultyCode: string; registrationNumber: string }> {
  return apiRequest('/api/auth/register-faculty', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutWithApi(session: ApiAuthSession): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(
    '/api/auth/logout',
    { method: 'POST' },
    session
  );
}

export function createAdminUserApi(
  session: ApiAuthSession,
  payload: {
    role: UserRole;
    username: string;
    fullName: string;
    email: string;
    department?: string;
    section?: string;
    password: string;
  }
): Promise<{ message: string }> {
  return apiRequest(
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    session
  );
}

export function uploadAcademicDatasetApi(
  session: ApiAuthSession,
  payload: { filename: string; content: string }
): Promise<{
  message: string;
  imported: { rooms: number; courses: number; sections: number };
}> {
  return apiRequest(
    '/api/admin/upload',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    session
  );
}

export function generateM3TimetableApi(
  session: ApiAuthSession,
  payload: { mode: 'database' | 'benchmark'; numStudents?: number; numSections?: number }
): Promise<M3GenerationResponse> {
  return apiRequest(
    '/api/timetable/generate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    session
  );
}

export function fetchM3TimetableApi(
  session: ApiAuthSession
): Promise<{ slots: M3ScheduledSlot[] }> {
  return apiRequest('/api/timetable', { method: 'GET' }, session);
}

export function fetchStudentDashboard(
  session: ApiAuthSession
): Promise<StudentDashboardResponse> {
  return apiRequest<StudentDashboardResponse>(
    '/api/student/dashboard',
    { method: 'GET' },
    session
  );
}

export function toggleStudentCourseApi(
  session: ApiAuthSession,
  courseId: string
): Promise<{
  courses: Course[];
  conflicts: ScheduleConflict[];
  totalCredits: number;
}> {
  return apiRequest(
    '/api/student/courses/toggle',
    {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    },
    session
  );
}

export function updateStudentProfileApi(
  session: ApiAuthSession,
  updates: {
    fullName: string;
    section: string;
    year: string;
    email: string;
    studentDepartment?: FacultyDepartment | null;
  }
): Promise<{ profile: UserProfile }> {
  return apiRequest(
    '/api/student/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
    session
  );
}

export function selectStudentDepartmentApi(
  session: ApiAuthSession,
  department: FacultyDepartment | null
): Promise<StudentDashboardResponse> {
  return apiRequest<StudentDashboardResponse>(
    '/api/student/department',
    {
      method: 'POST',
      body: JSON.stringify({ department }),
    },
    session
  );
}

export function selectFacultyDepartmentApi(
  session: ApiAuthSession,
  department: FacultyDepartment | null
): Promise<{ profile: UserProfile }> {
  return apiRequest(
    '/api/faculty/department',
    {
      method: 'POST',
      body: JSON.stringify({ department }),
    },
    session
  );
}

export function fetchFacultyAvailabilityApi(
  session: ApiAuthSession,
  params: {
    department: FacultyDepartment;
    blockNumber: number;
    dateKey: string;
    timeSlot: string;
  }
): Promise<FacultyAvailabilityResponse> {
  const qs = new URLSearchParams({
    department: params.department,
    blockNumber: String(params.blockNumber),
    dateKey: params.dateKey,
    timeSlot: params.timeSlot,
  });
  return apiRequest<FacultyAvailabilityResponse>(
    `/api/faculty/availability?${qs.toString()}`,
    { method: 'GET' },
    session
  );
}

export function scheduleFacultySubjectApi(
  session: ApiAuthSession,
  payload: {
    department: FacultyDepartment;
    blockNumber: number;
    floorNumber: number;
    classIndex: number;
    dateKey: string;
    timeSlot: string;
    subjectCode: string;
    subjectTitle: string;
  }
): Promise<{
  reservation: RoomReservation;
  subject: FacultySubjectAssignment;
}> {
  return apiRequest(
    '/api/faculty/subject-schedule',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    session
  );
}

export function cancelFacultyReservationApi(
  session: ApiAuthSession,
  reservationId: string
): Promise<{ ok: boolean }> {
  return apiRequest(
    `/api/faculty/reservations/${encodeURIComponent(reservationId)}`,
    { method: 'DELETE' },
    session
  );
}

export function submitSupportTicketApi(payload: {
  email: string;
  topic: string;
  message: string;
}): Promise<{ ticketId: string; topic: string; status: string }> {
  return apiRequest('/api/support', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
