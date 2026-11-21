import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  auditSecurityEvent,
  checkBruteForce,
  clearFailedLogins,
  findAccountByIdentifier,
  findAccountByRfId,
  getClientIp,
  hasAdminAccount,
  hashPassword,
  loadAccounts,
  loadBookingsState,
  parseUploadedAcademicFile,
  rateLimitMiddleware,
  recordFailedLogin,
  safeEqual,
  saveBookingsState,
  securityHeadersMiddleware,
  upsertAccount,
  verifyPassword,
  type StoredAccount,
  type UploadedCourseRow,
  type UploadedRoomRow,
  type UploadedSectionRow,
} from './server/security.ts';
import {
  buildM3BenchmarkDataset,
  generateM3Timetable,
  type M3RoomInput,
  type M3ScheduleRequest,
  type M3ScheduledSlot,
} from './server/m3Scheduler.ts';
import { findCatalogCourseByCode } from './src/data/courseCatalog.ts';
import {
  buildBlockRooms,
  DEFAULT_FACULTY_PROFILE,
  DEFAULT_STUDENT_PROFILE,
  FACULTY_DEPARTMENTS,
  getDepartmentBlockCount,
  getTimeSlotsForDate,
  isSlotOccupiedBySchedule,
} from './src/data/mockAcademicData.ts';
import type {
  Course,
  DayKey,
  FacultyDepartment,
  FacultySubjectAssignment,
  RoomReservation,
  ScheduleConflict,
  UserProfile,
  UserRole,
} from './src/types.ts';
import {
  validateAlphabeticFullName,
  validateDepartmentSubjectCode,
  validateFacultyPassword,
  validateSingleAlphabeticName,
  validateStudentPassword,
  validateStudentSection,
} from './src/utils/subjectValidation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_SECRET =
  process.env.CHRONOPLAN_API_KEY || crypto.randomBytes(32).toString('hex');
const SESSION_LIFETIME_MINUTES = Math.max(
  5,
  Number(process.env.SESSION_LIFETIME_MINUTES || 30)
);
const MAX_LOGIN_ATTEMPTS = Math.max(
  3,
  Number(process.env.MAX_LOGIN_ATTEMPTS || 5)
);
const LOCKOUT_MINUTES = Math.max(1, Number(process.env.LOCKOUT_MINUTES || 15));
const RATE_LIMIT_PER_MINUTE = Math.max(
  30,
  Number(process.env.RATE_LIMIT_PER_MINUTE || 120)
);

interface ServerSession {
  token: string;
  apiKey: string;
  csrfToken: string;
  role: UserRole;
  profile: UserProfile;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, ServerSession>();
const preAuthCsrfTokens = new Map<string, number>();

const initialBookings = loadBookingsState();
const reservations: RoomReservation[] = [...initialBookings.reservations];
const facultySubjects: FacultySubjectAssignment[] = [...initialBookings.facultySubjects];
const studentEnrollments = new Map<string, Set<string>>(
  Object.entries(initialBookings.studentEnrollments).map(([sid, ids]) => [
    sid,
    new Set(Array.isArray(ids) ? ids : []),
  ])
);

function persistBookingsState(): void {
  const serializedEnrollments: Record<string, string[]> = {};
  for (const [sid, set] of studentEnrollments.entries()) {
    if (set.size > 0) {
      serializedEnrollments[sid] = Array.from(set);
    }
  }
  saveBookingsState({
    reservations,
    facultySubjects,
    studentEnrollments: serializedEnrollments,
  });
}

// M3 dataset & generated slots storage
const m3Rooms: UploadedRoomRow[] = [
  { roomCode: 'LH-101', building: 'CSE Block 1', floor: 1, capacity: 70, roomType: 'lecture' },
  { roomCode: 'LH-102', building: 'CSE Block 1', floor: 1, capacity: 75, roomType: 'lecture' },
  { roomCode: 'LAB-301', building: 'CSE Block 2', floor: 3, capacity: 60, roomType: 'lab' },
  { roomCode: 'SEM-201', building: 'Business Block 1', floor: 2, capacity: 55, roomType: 'seminar' },
];
const m3Courses: UploadedCourseRow[] = [
  {
    courseCode: 'CSE310',
    title: 'Advanced Algorithms',
    department: 'BTech CSE department',
    credits: 4,
    courseKind: 'core',
    roomType: 'lecture',
    sessionsPerWeek: 3,
    facultyUsername: 'FAC001',
  },
  {
    courseCode: 'CSE325',
    title: 'Database Systems Lab',
    department: 'BTech CSE department',
    credits: 3,
    courseKind: 'core',
    roomType: 'lab',
    sessionsPerWeek: 2,
    facultyUsername: 'FAC002',
  },
  {
    courseCode: 'CSE350',
    title: 'Software Engineering Elective',
    department: 'BTech CSE department',
    credits: 3,
    courseKind: 'elective',
    roomType: 'lecture',
    sessionsPerWeek: 2,
    facultyUsername: 'FAC003',
  },
  {
    courseCode: 'CSE302',
    title: 'Discrete Structures Backlog',
    department: 'BTech CSE department',
    credits: 3,
    courseKind: 'backlog',
    roomType: 'lecture',
    sessionsPerWeek: 2,
    facultyUsername: 'FAC001',
  },
];
const m3Sections: UploadedSectionRow[] = [
  { sectionCode: 'CSE-4B', department: 'BTech CSE department', studentCount: 55 },
  { sectionCode: 'CSE-4C', department: 'BTech CSE department', studentCount: 52 },
];
let m3TimetableSlots: M3ScheduledSlot[] = [];

function issuePreAuthCsrfToken(): string {
  const now = Date.now();
  for (const [tok, exp] of preAuthCsrfTokens.entries()) {
    if (exp <= now) preAuthCsrfTokens.delete(tok);
  }
  if (preAuthCsrfTokens.size > 4000) {
    preAuthCsrfTokens.clear();
  }
  const token = crypto.randomBytes(24).toString('base64url');
  preAuthCsrfTokens.set(token, now + 30 * 60 * 1000);
  return token;
}

function consumePreAuthCsrfToken(token: string): boolean {
  const exp = preAuthCsrfTokens.get(token);
  if (!exp || exp <= Date.now()) {
    preAuthCsrfTokens.delete(token);
    return false;
  }
  return true;
}

function getDayKeyFromDateKey(dateKey: string): DayKey {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return 'Mon';
  const jsDay = new Date(y, m - 1, d).getDay();
  const map: Record<number, DayKey> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
  };
  return map[jsDay] || 'Mon';
}

function getStudentEnrolledSet(studentId: string): Set<string> {
  let set = studentEnrollments.get(studentId);
  if (!set) {
    set = new Set<string>();
    studentEnrollments.set(studentId, set);
  }
  return set;
}

function countEnrolledStudentsForAssignment(assignmentId: string): number {
  let count = 0;
  for (const set of studentEnrollments.values()) {
    if (set.has(assignmentId)) count++;
  }
  return count;
}

function getBookedCoursesForDepartment(
  studentId: string,
  department: FacultyDepartment | null | undefined
): Course[] {
  if (!department) {
    return [];
  }
  const enrolledSet = getStudentEnrolledSet(studentId);
  return facultySubjects
    .filter((sub) => sub.department === department)
    .map((sub) => {
      const catalogMatch = findCatalogCourseByCode(sub.subjectCode);
      const day = getDayKeyFromDateKey(sub.dateKey);
      const parts = sub.subjectCode.split('-');
      const takenSeats = countEnrolledStudentsForAssignment(sub.id);
      return {
        id: sub.id,
        code: sub.subjectCode,
        threeDigitCode: parts[1] || '',
        trackPrefix: parts[0] || '',
        title: sub.subjectTitle,
        instructor: sub.facultyName,
        department: sub.department,
        credits: catalogMatch?.credits ?? 3.0,
        scheduleSummary: `${day} · ${sub.timeSlot} (${sub.dateKey})`,
        day,
        dateKey: sub.dateKey,
        timeSlot: sub.timeSlot,
        room: `${sub.blockName} · Floor ${sub.floorNumber} · ${sub.roomName}`,
        enrolled: enrolledSet.has(sub.id),
        seatsLeft: Math.max(0, 60 - takenSeats),
        description:
          catalogMatch?.description ||
          `${sub.subjectTitle} scheduled by ${sub.facultyName} in ${sub.blockName}, ${sub.roomName} on ${sub.dateKey}.`,
      };
    });
}

function getDepartmentFacultySubjects(
  department: FacultyDepartment | null | undefined
): FacultySubjectAssignment[] {
  if (!department) return [];
  return facultySubjects.filter((s) => s.department === department);
}

function getBookedCountsByDepartment(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of FACULTY_DEPARTMENTS) {
    counts[d.name] = 0;
  }
  for (const sub of facultySubjects) {
    counts[sub.department] = (counts[sub.department] || 0) + 1;
  }
  return counts;
}

function computeStudentConflicts(courses: Course[]): ScheduleConflict[] {
  const list: ScheduleConflict[] = [];
  const enrolled = courses.filter((c) => c.enrolled);
  const slotMap = new Map<string, Course[]>();

  for (const course of enrolled) {
    const key = `${course.dateKey || course.day}|${course.timeSlot}`;
    const bucket = slotMap.get(key) || [];
    bucket.push(course);
    slotMap.set(key, bucket);
  }

  for (const [, bucket] of slotMap.entries()) {
    if (bucket.length < 2) continue;
    const primary = bucket[0];
    for (let i = 1; i < bucket.length; i++) {
      const colliding = bucket[i];
      const dateOrDay = colliding.dateKey || colliding.day;
      list.push({
        id: `conflict-${primary.id}-${colliding.id}`,
        type: 'course-overlap',
        title: `${dateOrDay} ${colliding.timeSlot} Slot Collision`,
        description: `${colliding.code} (${colliding.title}) overlaps with ${primary.code} (${primary.title}) on ${dateOrDay} at ${colliding.timeSlot}.`,
        severity: 'action-required',
        affectedCourseId: colliding.id,
        suggestedActionLabel: `Drop ${colliding.code} & Restore`,
      });
    }
  }

  return list;
}

interface AuthedRequest extends Request {
  session?: ServerSession;
}

function requirePreAuthCsrf(req: Request, res: Response, next: NextFunction): void {
  const csrfHeader = String(req.header('x-csrf-token') || '').trim();
  if (!csrfHeader || !consumePreAuthCsrfToken(csrfHeader)) {
    auditSecurityEvent('CSRF_VALIDATION_FAILED', {
      path: req.path,
      ip: getClientIp(req),
    });
    res.status(403).json({
      error: 'Request verification expired. Please refresh and try again.',
    });
    return;
  }
  next();
}

function requireApiAuth(allowedRoles?: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const apiKeyHeader = (req.header('x-api-key') || '').trim();

    if (!token || !apiKeyHeader) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const session = sessions.get(token);
    if (!session || Date.now() >= session.expiresAt) {
      if (session) {
        sessions.delete(token);
        auditSecurityEvent('SESSION_EXPIRED', {
          username: session.profile.registrationNumber || session.profile.email,
        });
      }
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const matchesSessionKey = safeEqual(apiKeyHeader, session.apiKey);
    const matchesEnvKey =
      Boolean(process.env.CHRONOPLAN_API_KEY) &&
      safeEqual(apiKeyHeader, String(process.env.CHRONOPLAN_API_KEY));

    if (!matchesSessionKey && !matchesEnvKey) {
      res.status(403).json({ error: 'Invalid API key.' });
      return;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const csrfHeader = String(req.header('x-csrf-token') || '').trim();
      if (!csrfHeader || !safeEqual(csrfHeader, session.csrfToken)) {
        auditSecurityEvent('CSRF_VALIDATION_FAILED', {
          path: req.path,
          ip: getClientIp(req),
          role: session.role,
        });
        res.status(403).json({ error: 'Invalid request verification token.' });
        return;
      }
    }

    if (allowedRoles && !allowedRoles.includes(session.role)) {
      auditSecurityEvent('RBAC_DENIED', {
        path: req.path,
        role: session.role,
        required: allowedRoles.join(','),
      });
      res.status(403).json({
        error: 'You do not have permission to perform this action.',
      });
      return;
    }

    req.session = session;
    next();
  };
}

function isValidDepartment(value: unknown): value is FacultyDepartment {
  return FACULTY_DEPARTMENTS.some((d) => d.name === value);
}

function createServerSession(role: UserRole, profile: UserProfile): ServerSession {
  const token = crypto.randomBytes(32).toString('hex');
  const apiKey = crypto
    .createHmac('sha256', API_SECRET)
    .update(token)
    .digest('hex')
    .slice(0, 32);
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const session: ServerSession = {
    token,
    apiKey,
    csrfToken,
    role,
    profile,
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MINUTES * 60 * 1000,
  };
  sessions.set(token, session);
  return session;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '2mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'chronoplan-api' });
  });

  // Pre-auth status & CSRF token endpoint (no sensitive internals exposed)
  app.get(
    '/api/auth/status',
    rateLimitMiddleware('auth_status', RATE_LIMIT_PER_MINUTE),
    (_req, res) => {
      res.json({
        needsAdminSetup: !hasAdminAccount(),
        csrfToken: issuePreAuthCsrfToken(),
      });
    }
  );

  // One-time secure Administrator account creation
  app.post(
    '/api/auth/bootstrap-admin',
    rateLimitMiddleware('login', 20),
    requirePreAuthCsrf,
    (req, res) => {
      if (hasAdminAccount()) {
        res.status(403).json({ error: 'Administrator account is already configured.' });
        return;
      }

      const body = req.body || {};
      const username = String(body.username || '').trim();
      const fullName = String(body.fullName || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
        res.status(400).json({ error: 'Username must be 3–40 letters, digits, ., _, or -.' });
        return;
      }
      if (!/^[A-Za-z][A-Za-z\s'.-]{1,79}$/.test(fullName)) {
        res.status(400).json({ error: 'Please enter a valid full name.' });
        return;
      }
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        res.status(400).json({
          error: 'Password must be at least 8 characters and include letters and digits.',
        });
        return;
      }

      const account: StoredAccount = {
        username,
        role: 'admin',
        fullName,
        email,
        department: '',
        section: '',
        year: '',
        registrationNumber: 'ADMIN',
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      upsertAccount(account);
      auditSecurityEvent('ADMIN_BOOTSTRAPPED', { username, ip: getClientIp(req) });

      res.status(201).json({
        message: 'Administrator account created. Please sign in.',
        csrfToken: issuePreAuthCsrfToken(),
      });
    }
  );

  // Register a New Student ID (persisted in database with RF ID, Special Code, LPU email & password)
  app.post(
    '/api/auth/register-student',
    rateLimitMiddleware('register', 25),
    requirePreAuthCsrf,
    (req, res) => {
      const body = req.body || {};
      const fullName = String(body.fullName || '').trim();
      const section = String(body.section || '').trim().toUpperCase();
      const year = String(body.year || '3rd Year').trim();
      const studentId = String(body.registrationNumber || '').trim();
      const rfId = String(body.rfId || '').trim().toUpperCase();
      const specialCode = String(body.specialCode || '').trim().toUpperCase();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      const studentNameErr = validateAlphabeticFullName(fullName, 'Student name');
      if (studentNameErr) {
        res.status(400).json({ error: studentNameErr });
        return;
      }
      const sectionErr = validateStudentSection(section);
      if (sectionErr) {
        res.status(400).json({ error: sectionErr });
        return;
      }
      if (!/^\d{7}$/.test(studentId)) {
        res.status(400).json({ error: 'Student ID must be exactly 7 digits.' });
        return;
      }
      if (!/^[A-Za-z0-9-]{4,24}$/.test(rfId)) {
        res.status(400).json({
          error: 'Special RF ID must be 4–24 alphanumeric characters.',
        });
        return;
      }
      if (!/^[A-Za-z0-9-]{4,20}$/.test(specialCode)) {
        res.status(400).json({
          error: 'Special Code must be 4–20 alphanumeric characters.',
        });
        return;
      }
      if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(email)) {
        res.status(400).json({
          error: 'LPU email must end with @lpu.in.',
        });
        return;
      }
      const pwError = validateStudentPassword(password);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      if (findAccountByIdentifier(studentId) || findAccountByIdentifier(email)) {
        res.status(409).json({
          error: 'A student account with this Student ID or @lpu.in email is already registered.',
        });
        return;
      }
      if (findAccountByRfId(rfId)) {
        res.status(409).json({
          error: 'This Special RF ID is already assigned to another student account.',
        });
        return;
      }

      upsertAccount({
        username: studentId,
        role: 'student',
        fullName,
        email,
        department: '',
        section,
        year,
        registrationNumber: studentId,
        rfId,
        specialCode,
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      auditSecurityEvent('STUDENT_REGISTERED', {
        studentId,
        email,
        rfId,
        ip: getClientIp(req),
      });

      res.status(201).json({
        message: `New Student ID ${studentId} registered and saved to the database.`,
        registrationNumber: studentId,
        email,
      });
    }
  );

  // Register a New Faculty ID (persisted in database with Faculty Login ID, 5-digit Faculty ID & password)
  app.post(
    '/api/auth/register-faculty',
    rateLimitMiddleware('register', 25),
    requirePreAuthCsrf,
    (req, res) => {
      const body = req.body || {};
      const firstName = String(body.firstName || '').trim();
      const middleName = String(body.middleName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const facultyCode = String(body.facultyCode || '').trim().toUpperCase();
      const facultyId = String(body.registrationNumber || '').trim();
      const password = String(body.password || '');

      const firstErr = validateSingleAlphabeticName(firstName, 'First name', true);
      if (firstErr) {
        res.status(400).json({ error: firstErr });
        return;
      }
      const middleErr = validateSingleAlphabeticName(middleName, 'Middle name', false);
      if (middleErr) {
        res.status(400).json({ error: middleErr });
        return;
      }
      const lastErr = validateSingleAlphabeticName(lastName, 'Last name', true);
      if (lastErr) {
        res.status(400).json({ error: lastErr });
        return;
      }
      if (!/^[A-Za-z]{3}\d{3}$/.test(facultyCode)) {
        res.status(400).json({
          error: 'Faculty Login ID must be 3 alphabets followed by 3 digits.',
        });
        return;
      }
      if (!/^\d{5}$/.test(facultyId)) {
        res.status(400).json({ error: 'Faculty ID must be exactly 5 digits.' });
        return;
      }
      const pwError = validateFacultyPassword(password);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      if (findAccountByIdentifier(facultyCode)) {
        res.status(409).json({
          error: 'This Faculty Login ID is already registered.',
        });
        return;
      }
      const duplicateFacId = loadAccounts().some(
        (acc) => acc.role === 'faculty' && acc.registrationNumber === facultyId
      );
      if (duplicateFacId) {
        res.status(409).json({
          error: 'This 5-digit Faculty ID is already registered.',
        });
        return;
      }

      const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      upsertAccount({
        username: facultyCode,
        role: 'faculty',
        fullName: combinedName,
        firstName,
        middleName,
        lastName,
        email: `${facultyCode.toLowerCase()}@lpu.in`,
        department: '',
        section: '',
        year: '',
        registrationNumber: facultyId,
        facultyCode,
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      auditSecurityEvent('FACULTY_REGISTERED', {
        facultyCode,
        facultyId,
        ip: getClientIp(req),
      });

      res.status(201).json({
        message: `New Faculty ID ${facultyCode} (${facultyId}) registered and saved to the database.`,
        facultyCode,
        registrationNumber: facultyId,
      });
    }
  );

  // Unified Authentication Endpoint (Student, Faculty, Admin)
  app.post(
    '/api/auth/login',
    rateLimitMiddleware('login', 30),
    requirePreAuthCsrf,
    (req, res) => {
      const body = req.body || {};
      const role = body.role as UserRole;
      const clientIp = getClientIp(req);

      if (role !== 'student' && role !== 'faculty' && role !== 'admin') {
        res.status(400).json({ error: 'Invalid portal role.' });
        return;
      }

      if (role === 'admin') {
        const identifier = String(body.identifier || '').trim();
        const password = String(body.password || '');
        if (!identifier || !password) {
          res.status(400).json({ error: 'Please enter both your username or email and password.' });
          return;
        }

        const lock = checkBruteForce(identifier, clientIp);
        if (lock.locked) {
          auditSecurityEvent('LOGIN_BLOCKED_LOCKOUT', { identifier, ip: clientIp });
          res.status(429).json({
            error: `Too many unsuccessful sign-in attempts. Please try again in ${lock.waitMinutes} minute(s).`,
          });
          return;
        }

        const existing = findAccountByIdentifier(identifier);
        if (
          !existing ||
          existing.role !== 'admin' ||
          !existing.isActive ||
          !verifyPassword(existing.passwordHash, password)
        ) {
          const nowLocked = recordFailedLogin(
            identifier,
            clientIp,
            MAX_LOGIN_ATTEMPTS,
            LOCKOUT_MINUTES
          );
          auditSecurityEvent('LOGIN_FAILED', { identifier, ip: clientIp, role: 'admin' });
          if (nowLocked) {
            res.status(429).json({
              error: 'Too many unsuccessful sign-in attempts. Please try again later.',
            });
            return;
          }
          res.status(401).json({ error: 'Incorrect administrator credentials.' });
          return;
        }

        clearFailedLogins(identifier, clientIp);
        const profile: UserProfile = {
          ...DEFAULT_FACULTY_PROFILE,
          role: 'admin',
          fullName: existing.fullName,
          email: existing.email,
          registrationNumber: existing.username,
          department: 'Administration',
        };
        const session = createServerSession('admin', profile);
        auditSecurityEvent('LOGIN_SUCCESS', { username: existing.username, role: 'admin', ip: clientIp });
        res.json({
          token: session.token,
          apiKey: session.apiKey,
          csrfToken: session.csrfToken,
          role: 'admin',
          profile,
        });
        return;
      }

      if (role === 'student') {
        const fullName = String(body.fullName || '').trim();
        const section = String(body.section || '').trim();
        const year = String(body.year || '3rd Year').trim();
        const studentId = String(body.registrationNumber || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        const studentNameErr = validateAlphabeticFullName(fullName, 'Student name');
        if (studentNameErr) {
          res.status(400).json({ error: studentNameErr });
          return;
        }
        const sectionErr = validateStudentSection(section);
        if (sectionErr) {
          res.status(400).json({ error: sectionErr });
          return;
        }
        if (!/^\d{7}$/.test(studentId)) {
          res.status(400).json({ error: 'Student ID must be exactly 7 digits.' });
          return;
        }
        if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(email)) {
          res.status(400).json({
            error:
              'Student email must end with @lpu.in. Personal @gmail.com addresses are not accepted.',
          });
          return;
        }
        const studentPwError = validateStudentPassword(password);
        if (studentPwError) {
          res.status(400).json({ error: studentPwError });
          return;
        }

        const lock = checkBruteForce(email, clientIp);
        if (lock.locked) {
          auditSecurityEvent('LOGIN_BLOCKED_LOCKOUT', { identifier: email, ip: clientIp });
          res.status(429).json({
            error: `Too many unsuccessful sign-in attempts. Please try again in ${lock.waitMinutes} minute(s).`,
          });
          return;
        }

        const existing = findAccountByIdentifier(email) || findAccountByIdentifier(studentId);
        if (existing) {
          if (existing.role !== 'student') {
            res.status(403).json({ error: 'This account is not registered as a student.' });
            return;
          }
          if (
            !existing.isActive ||
            existing.registrationNumber !== studentId ||
            existing.email.toLowerCase() !== email ||
            !verifyPassword(existing.passwordHash, password)
          ) {
            const nowLocked = recordFailedLogin(
              email,
              clientIp,
              MAX_LOGIN_ATTEMPTS,
              LOCKOUT_MINUTES
            );
            auditSecurityEvent('LOGIN_FAILED', { identifier: email, ip: clientIp, role: 'student' });
            if (nowLocked) {
              res.status(429).json({
                error: 'Too many unsuccessful sign-in attempts. Please try again later.',
              });
              return;
            }
            res.status(401).json({ error: 'Incorrect email/ID or password.' });
            return;
          }
        } else {
          upsertAccount({
            username: studentId,
            role: 'student',
            fullName,
            email,
            department: '',
            section,
            year,
            registrationNumber: studentId,
            passwordHash: hashPassword(password),
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }

        clearFailedLogins(email, clientIp);
        const profile: UserProfile = {
          ...DEFAULT_STUDENT_PROFILE,
          role: 'student',
          studentDepartment: null,
          department: '',
          fullName: existing ? existing.fullName : fullName,
          section: existing?.section || section,
          year: existing?.year || year,
          registrationNumber: studentId,
          rfId: existing?.rfId,
          specialCode: existing?.specialCode,
          email,
        };
        const session = createServerSession('student', profile);
        auditSecurityEvent('LOGIN_SUCCESS', { username: studentId, role: 'student', ip: clientIp });
        res.json({
          token: session.token,
          apiKey: session.apiKey,
          csrfToken: session.csrfToken,
          role: 'student',
          profile,
        });
        return;
      }

      // Faculty sign-in (supports smooth ChronoPlan login + verified credential checks)
      const firstName = String(body.firstName || '').trim();
      const middleName = String(body.middleName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const facultyCode = String(body.facultyCode || '').trim().toUpperCase();
      const facultyId = String(body.registrationNumber || '').trim();
      const password = String(body.password || '');

      const firstErr = validateSingleAlphabeticName(firstName, 'First name', true);
      if (firstErr) {
        res.status(400).json({ error: firstErr });
        return;
      }
      const middleErr = validateSingleAlphabeticName(middleName, 'Middle name', false);
      if (middleErr) {
        res.status(400).json({ error: middleErr });
        return;
      }
      const lastErr = validateSingleAlphabeticName(lastName, 'Last name', true);
      if (lastErr) {
        res.status(400).json({ error: lastErr });
        return;
      }
      if (!/^[A-Za-z]{3}\d{3}$/.test(facultyCode)) {
        res.status(400).json({ error: 'Invalid Faculty Login ID.' });
        return;
      }
      if (!/^\d{5}$/.test(facultyId)) {
        res.status(400).json({ error: 'Faculty ID must be exactly 5 digits.' });
        return;
      }

      const pwError = validateFacultyPassword(password);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      const lock = checkBruteForce(facultyCode, clientIp);
      if (lock.locked) {
        auditSecurityEvent('LOGIN_BLOCKED_LOCKOUT', { identifier: facultyCode, ip: clientIp });
        res.status(429).json({
          error: `Too many unsuccessful sign-in attempts. Please try again in ${lock.waitMinutes} minute(s).`,
        });
        return;
      }

      const existing = findAccountByIdentifier(facultyCode);
      if (existing) {
        if (existing.role !== 'faculty') {
          res.status(403).json({ error: 'This account is not registered as faculty.' });
          return;
        }
        if (
          !existing.isActive ||
          existing.registrationNumber !== facultyId ||
          !verifyPassword(existing.passwordHash, password)
        ) {
          const nowLocked = recordFailedLogin(
            facultyCode,
            clientIp,
            MAX_LOGIN_ATTEMPTS,
            LOCKOUT_MINUTES
          );
          auditSecurityEvent('LOGIN_FAILED', {
            identifier: facultyCode,
            ip: clientIp,
            role: 'faculty',
          });
          if (nowLocked) {
            res.status(429).json({
              error: 'Too many unsuccessful sign-in attempts. Please try again later.',
            });
            return;
          }
          res.status(401).json({ error: 'Incorrect Faculty ID, Login ID, or password.' });
          return;
        }
      } else {
        const existingByFacId = loadAccounts().find(
          (acc) => acc.role === 'faculty' && acc.registrationNumber === facultyId
        );
        if (existingByFacId) {
          res.status(401).json({ error: 'Incorrect Faculty ID, Login ID, or password.' });
          return;
        }
        const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ');
        upsertAccount({
          username: facultyCode,
          role: 'faculty',
          fullName: combinedName,
          firstName,
          middleName,
          lastName,
          email: `${facultyCode.toLowerCase()}@lpu.in`,
          department: '',
          section: '',
          year: '',
          registrationNumber: facultyId,
          facultyCode,
          passwordHash: hashPassword(password),
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      clearFailedLogins(facultyCode, clientIp);
      const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const profile: UserProfile = {
        ...DEFAULT_FACULTY_PROFILE,
        role: 'faculty',
        firstName,
        middleName,
        lastName,
        fullName: existing ? existing.fullName : combinedName,
        facultyCode,
        facultyDepartment: null,
        registrationNumber: facultyId,
        department: existing?.department || '',
        email: `${facultyCode.toLowerCase()}@lpu.in`,
      };
      const session = createServerSession('faculty', profile);
      auditSecurityEvent('LOGIN_SUCCESS', { username: facultyCode, role: 'faculty', ip: clientIp });

      res.json({
        token: session.token,
        apiKey: session.apiKey,
        csrfToken: session.csrfToken,
        role: 'faculty',
        profile,
      });
    }
  );

  app.post('/api/auth/logout', requireApiAuth(), (req: AuthedRequest, res) => {
    if (req.session) {
      auditSecurityEvent('LOGOUT', {
        username: req.session.profile.facultyCode || req.session.profile.registrationNumber,
      });
      sessions.delete(req.session.token);
    }
    res.json({ ok: true, csrfToken: issuePreAuthCsrfToken() });
  });

  // Admin-only user creation with scrypt password hashing
  app.post(
    '/api/admin/users',
    rateLimitMiddleware('admin_users', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['admin']),
    (req: AuthedRequest, res) => {
      const body = req.body || {};
      const role = String(body.role || '').trim().toLowerCase() as UserRole;
      const username = String(body.username || '').trim();
      const fullName = String(body.fullName || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const department = String(body.department || '').trim();
      const section = String(body.section || '').trim().toUpperCase();

      if (role !== 'admin' && role !== 'faculty' && role !== 'student') {
        res.status(400).json({ error: 'Role must be admin, faculty, or student.' });
        return;
      }
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
        res.status(400).json({ error: 'Username must be 3–40 letters, digits, ., _, or -.' });
        return;
      }
      if (!/^[A-Za-z][A-Za-z\s'.-]{1,79}$/.test(fullName)) {
        res.status(400).json({ error: 'Please enter a valid full name.' });
        return;
      }
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (role === 'student' && !email.endsWith('@lpu.in')) {
        res.status(400).json({ error: 'Student email must end with @lpu.in.' });
        return;
      }
      if (role === 'student') {
        const studentPwError = validateStudentPassword(password);
        if (studentPwError) {
          res.status(400).json({ error: studentPwError });
          return;
        }
      } else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        res.status(400).json({
          error: 'Password must be at least 8 characters and include letters and digits.',
        });
        return;
      }
      if (findAccountByIdentifier(username) || findAccountByIdentifier(email)) {
        res.status(409).json({ error: 'An account with that username or email already exists.' });
        return;
      }

      upsertAccount({
        username,
        role,
        fullName,
        email,
        department,
        section: section || (role === 'student' ? 'CSE-4B' : ''),
        year: '3rd Year',
        registrationNumber: username,
        facultyCode: role === 'faculty' ? username.toUpperCase() : undefined,
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      auditSecurityEvent('ADMIN_CREATED_USER', {
        admin: req.session!.profile.registrationNumber,
        createdUsername: username,
        createdRole: role,
      });

      res.status(201).json({ message: `Account created for ${fullName}.` });
    }
  );

  // Safe CSV/JSON dataset upload (Admin / Faculty)
  app.post(
    '/api/admin/upload',
    rateLimitMiddleware('upload', 30),
    requireApiAuth(['admin', 'faculty']),
    (req: AuthedRequest, res) => {
      const filename = String(req.body?.filename || '').trim();
      const content = String(req.body?.content || '');

      try {
        const parsed = parseUploadedAcademicFile(filename, content);
        for (const r of parsed.rooms) {
          const idx = m3Rooms.findIndex((x) => x.roomCode === r.roomCode);
          if (idx >= 0) m3Rooms[idx] = r;
          else m3Rooms.push(r);
        }
        for (const c of parsed.courses) {
          const idx = m3Courses.findIndex((x) => x.courseCode === c.courseCode);
          if (idx >= 0) m3Courses[idx] = c;
          else m3Courses.push(c);
        }
        for (const s of parsed.sections) {
          const idx = m3Sections.findIndex((x) => x.sectionCode === s.sectionCode);
          if (idx >= 0) m3Sections[idx] = s;
          else m3Sections.push(s);
        }

        auditSecurityEvent('UPLOAD_ACCEPTED', {
          user: req.session!.profile.registrationNumber,
          rooms: parsed.rooms.length,
          courses: parsed.courses.length,
          sections: parsed.sections.length,
        });

        res.json({
          message: 'Dataset validated and imported.',
          imported: {
            rooms: parsed.rooms.length,
            courses: parsed.courses.length,
            sections: parsed.sections.length,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid file upload.';
        auditSecurityEvent('UPLOAD_REJECTED', {
          user: req.session!.profile.registrationNumber,
          reason: msg,
        });
        res.status(400).json({ error: msg });
      }
    }
  );

  // M3 Timetable Clash Resolver generation & 1,500-student benchmark
  app.post(
    '/api/timetable/generate',
    rateLimitMiddleware('generate', 30),
    requireApiAuth(['admin', 'faculty']),
    (req: AuthedRequest, res) => {
      const mode = String(req.body?.mode || 'database').trim().toLowerCase();

      if (mode === 'benchmark') {
        const numStudents = Math.min(3000, Math.max(100, Number(req.body?.numStudents || 1500)));
        const numSections = Math.min(200, Math.max(10, Number(req.body?.numSections || 120)));
        const { requests, rooms } = buildM3BenchmarkDataset(numStudents, numSections);
        const result = generateM3Timetable(requests, rooms);
        auditSecurityEvent('TIMETABLE_BENCHMARK_GENERATED', {
          user: req.session!.profile.registrationNumber,
          ms: result.stats.generationMs,
        });
        res.json(result);
        return;
      }

      const roomInputs: M3RoomInput[] = m3Rooms.map((r) => ({
        roomCode: r.roomCode,
        capacity: r.capacity,
        roomType: r.roomType,
      }));
      const requests: M3ScheduleRequest[] = [];
      for (const sec of m3Sections) {
        const deptCourses = m3Courses.filter((c) => c.department === sec.department);
        for (const c of deptCourses) {
          const cohortIds = Array.from(
            { length: sec.studentCount },
            (_, idx) => `${sec.sectionCode}-S${idx + 1}`
          );
          requests.push({
            requestId: `${sec.sectionCode}-${c.courseCode}`,
            sectionCode: sec.sectionCode,
            courseCode: c.courseCode,
            courseTitle: c.title,
            facultyUsername: c.facultyUsername,
            facultyName: c.facultyUsername,
            studentCount: sec.studentCount,
            roomType: c.roomType,
            courseKind: c.courseKind,
            sessionsPerWeek: c.sessionsPerWeek,
            studentIds: cohortIds,
          });
        }
      }

      const result = generateM3Timetable(requests, roomInputs);
      m3TimetableSlots = result.scheduledSlots;
      auditSecurityEvent('TIMETABLE_GENERATED', {
        user: req.session!.profile.registrationNumber,
        sessions: result.stats.scheduledSessions,
      });
      res.json(result);
    }
  );

  app.get(
    '/api/timetable',
    rateLimitMiddleware('timetable', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['admin', 'faculty', 'student']),
    (req: AuthedRequest, res) => {
      const { role, profile } = req.session!;
      let slots = m3TimetableSlots;
      if (role === 'student') {
        const sec = profile.section.toUpperCase();
        slots = m3TimetableSlots.filter((s) => s.sectionCode.toUpperCase() === sec || s.sectionCode === 'CSE-4B');
      } else if (role === 'faculty') {
        const fc = (profile.facultyCode || profile.registrationNumber).toUpperCase();
        const mine = m3TimetableSlots.filter((s) => s.facultyUsername.toUpperCase() === fc);
        slots = mine.length > 0 ? mine : m3TimetableSlots;
      }
      res.json({ slots });
    }
  );

  // Student dashboard data (strictly scoped to chosen department & faculty-booked classes)
  app.get(
    '/api/student/dashboard',
    rateLimitMiddleware('student_dash', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['student']),
    (req: AuthedRequest, res) => {
      const studentId = req.session!.profile.registrationNumber;
      const dept = req.session!.profile.studentDepartment ?? null;
      const visibleCourses = getBookedCoursesForDepartment(studentId, dept);
      const conflicts = computeStudentConflicts(visibleCourses);
      const totalCredits = visibleCourses
        .filter((c) => c.enrolled)
        .reduce((sum, c) => sum + c.credits, 0);

      res.json({
        profile: req.session!.profile,
        courses: visibleCourses,
        conflicts,
        totalCredits,
        facultySubjects: getDepartmentFacultySubjects(dept),
        bookedCountsByDepartment: getBookedCountsByDepartment(),
      });
    }
  );

  // Student department selection after login
  app.post(
    '/api/student/department',
    rateLimitMiddleware('student_dept', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['student']),
    (req: AuthedRequest, res) => {
      const dept = req.body?.department ?? null;
      if (dept !== null && !isValidDepartment(dept)) {
        res.status(400).json({ error: 'Invalid department selection.' });
        return;
      }

      const session = req.session!;
      session.profile = {
        ...session.profile,
        studentDepartment: dept,
        department: dept || '',
      };

      const studentId = session.profile.registrationNumber;
      const visibleCourses = getBookedCoursesForDepartment(studentId, dept);
      const conflicts = computeStudentConflicts(visibleCourses);
      const totalCredits = visibleCourses
        .filter((c) => c.enrolled)
        .reduce((sum, c) => sum + c.credits, 0);

      res.json({
        profile: session.profile,
        courses: visibleCourses,
        conflicts,
        totalCredits,
        facultySubjects: getDepartmentFacultySubjects(dept),
        bookedCountsByDepartment: getBookedCountsByDepartment(),
      });
    }
  );

  app.post(
    '/api/student/courses/toggle',
    rateLimitMiddleware('student_courses', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['student']),
    (req: AuthedRequest, res) => {
      const courseId = String(req.body?.courseId || '').trim();
      const studentId = req.session!.profile.registrationNumber;
      const dept = req.session!.profile.studentDepartment ?? null;

      if (!dept) {
        res.status(400).json({ error: 'Please select your department first.' });
        return;
      }

      const targetBooking = facultySubjects.find(
        (s) => s.id === courseId && s.department === dept
      );

      if (!targetBooking) {
        res.status(404).json({
          error: 'Class not found or has not been booked by faculty for your chosen department.',
        });
        return;
      }

      const enrolledSet = getStudentEnrolledSet(studentId);
      if (enrolledSet.has(courseId)) {
        enrolledSet.delete(courseId);
      } else {
        enrolledSet.add(courseId);
      }
      persistBookingsState();

      const visibleCourses = getBookedCoursesForDepartment(studentId, dept);
      const conflicts = computeStudentConflicts(visibleCourses);
      const totalCredits = visibleCourses
        .filter((c) => c.enrolled)
        .reduce((sum, c) => sum + c.credits, 0);

      res.json({ courses: visibleCourses, conflicts, totalCredits });
    }
  );

  app.patch(
    '/api/student/profile',
    rateLimitMiddleware('student_profile', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['student']),
    (req: AuthedRequest, res) => {
      const session = req.session!;
      const fullName = String(req.body?.fullName || session.profile.fullName).trim();
      const section = String(req.body?.section || session.profile.section).trim();
      const year = String(req.body?.year || session.profile.year).trim();
      const email = String(req.body?.email || session.profile.email)
        .trim()
        .toLowerCase();
      const studentDepartment =
        req.body?.studentDepartment !== undefined
          ? req.body.studentDepartment
          : session.profile.studentDepartment;

      if (
        studentDepartment !== null &&
        studentDepartment !== undefined &&
        !isValidDepartment(studentDepartment)
      ) {
        res.status(400).json({ error: 'Invalid department selection.' });
        return;
      }

      const studentNameErr = validateAlphabeticFullName(fullName, 'Student name');
      if (studentNameErr) {
        res.status(400).json({ error: studentNameErr });
        return;
      }
      const sectionErr = validateStudentSection(section);
      if (sectionErr) {
        res.status(400).json({ error: sectionErr });
        return;
      }

      if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(email)) {
        res.status(400).json({ error: 'Student email must end with @lpu.in.' });
        return;
      }

      session.profile = {
        ...session.profile,
        fullName,
        section,
        year,
        email,
        studentDepartment: studentDepartment ?? null,
        department: studentDepartment || '',
      };
      res.json({ profile: session.profile });
    }
  );

  // Faculty department selection
  app.post(
    '/api/faculty/department',
    rateLimitMiddleware('faculty_dept', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['faculty']),
    (req: AuthedRequest, res) => {
      const dept = req.body?.department ?? null;
      if (dept !== null && !isValidDepartment(dept)) {
        res.status(400).json({ error: 'Invalid department selection.' });
        return;
      }

      const session = req.session!;
      session.profile = {
        ...session.profile,
        facultyDepartment: dept,
        department: dept || '',
      };
      res.json({ profile: session.profile });
    }
  );

  // Faculty block/floor/room availability & reservations
  app.get(
    '/api/faculty/availability',
    rateLimitMiddleware('faculty_avail', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['faculty']),
    (req: AuthedRequest, res) => {
      const dept = req.query.department;
      const dateKey = String(req.query.dateKey || '');
      const timeSlot = String(req.query.timeSlot || '');
      const blockNumber = parseInt(String(req.query.blockNumber || '1'), 10);

      if (!isValidDepartment(dept)) {
        res.status(400).json({ error: 'Valid department query parameter is required.' });
        return;
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
        !getTimeSlotsForDate(dateKey).includes(timeSlot)
      ) {
        res.status(400).json({ error: 'Valid dateKey and timeSlot are required for this day.' });
        return;
      }

      const blockCount = getDepartmentBlockCount(dept);
      const safeBlock = Math.min(Math.max(1, blockNumber || 1), blockCount);

      const blockSummaries = [];
      for (let b = 1; b <= blockCount; b++) {
        const rooms = buildBlockRooms(dept, b);
        let occupied = 0;
        for (const room of rooms) {
          const booked = reservations.some(
            (r) =>
              r.roomId === room.id &&
              r.dateKey === dateKey &&
              r.timeSlot === timeSlot
          );
          const scheduled = isSlotOccupiedBySchedule(
            dept,
            room.blockNumber,
            room.floorNumber,
            room.classIndex,
            dateKey,
            timeSlot
          );
          if (booked || scheduled) occupied++;
        }
        blockSummaries.push({
          blockNumber: b,
          blockName: `Block ${b}`,
          totalRooms: rooms.length,
          availableRooms: rooms.length - occupied,
          occupiedRooms: occupied,
        });
      }

      const selectedBlockRooms = buildBlockRooms(dept, safeBlock).map((room) => {
        const booking = reservations.find(
          (r) =>
            r.roomId === room.id &&
            r.dateKey === dateKey &&
            r.timeSlot === timeSlot
        );
        const systemOccupied = isSlotOccupiedBySchedule(
          dept,
          room.blockNumber,
          room.floorNumber,
          room.classIndex,
          dateKey,
          timeSlot
        );
        return {
          ...room,
          booking: booking || null,
          systemOccupied,
          available: !booking && !systemOccupied,
        };
      });

      const myCode = req.session!.profile.facultyCode;
      const myReservations = reservations.filter((r) => r.facultyCode === myCode);
      const mySubjects = facultySubjects.filter((s) => s.facultyCode === myCode);

      res.json({
        department: dept,
        blockNumber: safeBlock,
        blockSummaries,
        rooms: selectedBlockRooms,
        reservations: myReservations,
        subjects: mySubjects,
      });
    }
  );

  // Faculty schedules/reserves a classroom for a specific subject code & publishes to Student Dashboard
  app.post(
    '/api/faculty/subject-schedule',
    rateLimitMiddleware('faculty_sched', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['faculty']),
    (req: AuthedRequest, res) => {
      const body = req.body || {};
      const dept = body.department;
      const blockNumber = parseInt(String(body.blockNumber || ''), 10);
      const floorNumber = parseInt(String(body.floorNumber || ''), 10);
      const classIndex = parseInt(String(body.classIndex || ''), 10);
      const dateKey = String(body.dateKey || '');
      const timeSlot = String(body.timeSlot || '');
      const rawSubjectCode = String(body.subjectCode || '');
      const subjectTitle = String(body.subjectTitle || '').trim();

      if (!isValidDepartment(dept)) {
        res.status(400).json({ error: 'Invalid department.' });
        return;
      }

      const maxBlocks = getDepartmentBlockCount(dept);
      if (
        Number.isNaN(blockNumber) ||
        blockNumber < 1 ||
        blockNumber > maxBlocks ||
        Number.isNaN(floorNumber) ||
        floorNumber < 1 ||
        floorNumber > 9 ||
        Number.isNaN(classIndex) ||
        classIndex < 1 ||
        classIndex > 10
      ) {
        res.status(400).json({ error: 'Invalid block, floor, or classroom coordinates.' });
        return;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
        !getTimeSlotsForDate(dateKey).includes(timeSlot)
      ) {
        res.status(400).json({ error: 'Invalid date or time slot for the selected day.' });
        return;
      }

      const subjectCheck = validateDepartmentSubjectCode(dept, rawSubjectCode);
      if (!subjectCheck.valid) {
        res.status(400).json({ error: subjectCheck.error });
        return;
      }

      if (!subjectTitle) {
        res.status(400).json({ error: 'Please enter the subject title you are teaching.' });
        return;
      }

      const targetRooms = buildBlockRooms(dept, blockNumber);
      const room = targetRooms.find(
        (r) => r.floorNumber === floorNumber && r.classIndex === classIndex
      );
      if (!room) {
        res.status(404).json({ error: 'Classroom not found.' });
        return;
      }

      const alreadyBooked = reservations.some(
        (r) =>
          r.roomId === room.id &&
          r.dateKey === dateKey &&
          r.timeSlot === timeSlot
      );
      const systemOccupied = isSlotOccupiedBySchedule(
        dept,
        blockNumber,
        floorNumber,
        classIndex,
        dateKey,
        timeSlot
      );

      if (alreadyBooked || systemOccupied) {
        res.status(409).json({
          error: `${room.name} in ${room.blockName} is already occupied for ${dateKey} (${timeSlot}).`,
        });
        return;
      }

      const session = req.session!;
      const reservationId = `res-${crypto.randomUUID()}`;
      const reservation: RoomReservation = {
        id: reservationId,
        roomId: room.id,
        department: dept,
        blockName: room.blockName,
        floorNumber: room.floorNumber,
        roomName: room.name,
        dateKey,
        timeSlot,
        subjectCode: subjectCheck.normalizedCode,
        courseTitle: subjectTitle,
        instructorName: session.profile.fullName,
        facultyCode: session.profile.facultyCode || '',
      };

      const publishedSubject: FacultySubjectAssignment = {
        id: `sub-${crypto.randomUUID()}`,
        reservationId,
        facultyCode: session.profile.facultyCode || '',
        facultyName: session.profile.fullName,
        department: dept,
        subjectCode: subjectCheck.normalizedCode,
        subjectTitle,
        blockName: room.blockName,
        floorNumber: room.floorNumber,
        roomName: room.name,
        dateKey,
        timeSlot,
      };

      reservations.unshift(reservation);
      facultySubjects.unshift(publishedSubject);
      persistBookingsState();

      res.status(201).json({
        reservation,
        subject: publishedSubject,
      });
    }
  );

  app.delete(
    '/api/faculty/reservations/:id',
    rateLimitMiddleware('faculty_del', RATE_LIMIT_PER_MINUTE),
    requireApiAuth(['faculty']),
    (req: AuthedRequest, res) => {
      const id = String(req.params.id || '');
      const idx = reservations.findIndex((r) => r.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Reservation not found.' });
        return;
      }

      const myCode = req.session!.profile.facultyCode;
      if (reservations[idx].facultyCode !== myCode) {
        res.status(403).json({ error: 'You can only release your own reservations.' });
        return;
      }

      reservations.splice(idx, 1);
      const subIdx = facultySubjects.findIndex((s) => s.reservationId === id);
      if (subIdx !== -1) {
        const [removedSub] = facultySubjects.splice(subIdx, 1);
        for (const set of studentEnrollments.values()) {
          set.delete(removedSub.id);
        }
      }
      persistBookingsState();

      res.json({ ok: true });
    }
  );

  app.post(
    '/api/support',
    rateLimitMiddleware('support', 20),
    requirePreAuthCsrf,
    (req, res) => {
      const email = String(req.body?.email || '').trim();
      const topic = String(req.body?.topic || '').trim();
      const message = String(req.body?.message || '').trim();

      if (!email || !message) {
        res.status(400).json({ error: 'Email and support message are required.' });
        return;
      }

      res.status(201).json({
        ticketId: `REG-${Math.floor(10000 + Math.random() * 90000)}`,
        topic: topic || 'General Inquiry',
        status: 'Logged',
      });
    }
  );

  // Generic JSON error handler (never leaks stack traces or secrets)
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const typeName = err instanceof Error ? err.name : 'UnknownError';
    auditSecurityEvent('UNHANDLED_SERVER_ERROR', {
      path: req.path,
      errorType: typeName,
    });
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
    });
  });

  const PORT = Number(process.env.PORT || 3000);
  const httpServer = http.createServer(app);

  // Vite dev middleware OR static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        allowedHosts: true,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    const shutdown = () => {
      vite.close().finally(() => {
        httpServer.close(() => process.exit(0));
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ChronoPlan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
