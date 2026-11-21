import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type {
  FacultySubjectAssignment,
  RoomReservation,
  UserRole,
} from '../src/types.ts';

const INSTANCE_DIR = path.resolve(process.cwd(), 'instance');
const AUDIT_LOG_PATH = path.join(INSTANCE_DIR, 'express_security_audit.log');
const ACCOUNTS_PATH = path.join(INSTANCE_DIR, 'express_accounts.json');
const BOOKINGS_PATH = path.join(INSTANCE_DIR, 'express_bookings.json');

export interface StoredAccount {
  username: string;
  role: UserRole;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  department: string;
  section: string;
  year: string;
  registrationNumber: string;
  facultyCode?: string;
  rfId?: string;
  specialCode?: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
}

interface BruteForceRecord {
  failedCount: number;
  lockedUntil: number | null;
}

const bruteForceStore = new Map<string, BruteForceRecord>();
const rateBuckets = new Map<string, number[]>();

function ensureInstanceDir(): void {
  if (!fs.existsSync(INSTANCE_DIR)) {
    fs.mkdirSync(INSTANCE_DIR, { recursive: true, mode: 0o750 });
  }
}

export function hashPassword(plain: string): string {
  if (!plain || plain.length < 1) {
    throw new Error('Password is required.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(storedHash: string, candidate: string): boolean {
  if (!storedHash || !candidate) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(candidate, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function auditSecurityEvent(
  event: string,
  details: Record<string, string | number | boolean | undefined> = {}
): void {
  try {
    ensureInstanceDir();
    const ts = new Date().toISOString();
    const safeFields = Object.entries(details)
      .filter(([k]) => !/password|secret|token|key/i.test(k))
      .map(([k, v]) => `${k}=${String(v ?? '').replace(/[\r\n]/g, ' ').slice(0, 160)}`)
      .join(' ');
    fs.appendFileSync(AUDIT_LOG_PATH, `${ts} | ${event} | ${safeFields}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // Keep server operational even if audit log write encounters disk restrictions
  }
}

export function loadAccounts(): StoredAccount[] {
  ensureInstanceDir();
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ACCOUNTS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: StoredAccount[]): void {
  ensureInstanceDir();
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function findAccountByIdentifier(identifier: string): StoredAccount | undefined {
  const norm = identifier.trim().toLowerCase();
  if (!norm) return undefined;
  return loadAccounts().find(
    (acc) =>
      acc.username.toLowerCase() === norm ||
      acc.email.toLowerCase() === norm ||
      (acc.facultyCode && acc.facultyCode.toLowerCase() === norm)
  );
}

export function findAccountByRfId(rfId: string): StoredAccount | undefined {
  const norm = rfId.trim().toLowerCase();
  if (!norm) return undefined;
  return loadAccounts().find(
    (acc) => acc.rfId && acc.rfId.toLowerCase() === norm
  );
}

export function hasAdminAccount(): boolean {
  return loadAccounts().some((acc) => acc.role === 'admin' && acc.isActive);
}

export function upsertAccount(account: StoredAccount): void {
  const accounts = loadAccounts();
  const idx = accounts.findIndex(
    (a) => a.username.toLowerCase() === account.username.toLowerCase()
  );
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  saveAccounts(accounts);
}

export interface PersistedBookingsState {
  reservations: RoomReservation[];
  facultySubjects: FacultySubjectAssignment[];
  studentEnrollments: Record<string, string[]>;
}

export function loadBookingsState(): PersistedBookingsState {
  ensureInstanceDir();
  if (!fs.existsSync(BOOKINGS_PATH)) {
    return { reservations: [], facultySubjects: [], studentEnrollments: {} };
  }
  try {
    const raw = fs.readFileSync(BOOKINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      reservations: Array.isArray(parsed?.reservations) ? parsed.reservations : [],
      facultySubjects: Array.isArray(parsed?.facultySubjects)
        ? parsed.facultySubjects
        : [],
      studentEnrollments:
        parsed?.studentEnrollments &&
        typeof parsed.studentEnrollments === 'object' &&
        !Array.isArray(parsed.studentEnrollments)
          ? parsed.studentEnrollments
          : {},
    };
  } catch {
    return { reservations: [], facultySubjects: [], studentEnrollments: {} };
  }
}

export function saveBookingsState(state: PersistedBookingsState): void {
  ensureInstanceDir();
  fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(state, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function getClientIp(req: Request): string {
  const fwd = String(req.header('x-forwarded-for') || '')
    .split(',')[0]
    .trim();
  return fwd || req.ip || '127.0.0.1';
}

export function checkBruteForce(
  identifier: string,
  ip: string
): { locked: boolean; waitMinutes: number } {
  const key = `${identifier.toLowerCase()}::${ip}`;
  const rec = bruteForceStore.get(key);
  if (!rec || !rec.lockedUntil) {
    return { locked: false, waitMinutes: 0 };
  }
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return {
      locked: true,
      waitMinutes: Math.max(1, Math.ceil((rec.lockedUntil - now) / 60000)),
    };
  }
  bruteForceStore.delete(key);
  return { locked: false, waitMinutes: 0 };
}

export function recordFailedLogin(
  identifier: string,
  ip: string,
  maxAttempts: number,
  lockoutMinutes: number
): boolean {
  const key = `${identifier.toLowerCase()}::${ip}`;
  const current = bruteForceStore.get(key) || { failedCount: 0, lockedUntil: null };
  const nextCount = current.failedCount + 1;
  const isLocked = nextCount >= maxAttempts;
  bruteForceStore.set(key, {
    failedCount: nextCount,
    lockedUntil: isLocked ? Date.now() + lockoutMinutes * 60000 : null,
  });
  return isLocked;
}

export function clearFailedLogins(identifier: string, ip: string): void {
  bruteForceStore.delete(`${identifier.toLowerCase()}::${ip}`);
}

export function rateLimitMiddleware(scope: string, maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const key = `${scope}::${ip}`;
    const now = Date.now();
    const bucket = (rateBuckets.get(key) || []).filter((ts) => now - ts < 60000);
    if (bucket.length >= maxPerMinute) {
      auditSecurityEvent('RATE_LIMIT_EXCEEDED', { scope, ip });
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }
    bucket.push(now);
    rateBuckets.set(key, bucket);
    next();
  };
}

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

export function sanitizeCell(value: unknown, maxLen = 120): string {
  let text = String(value ?? '').trim();
  if (text && ['=', '+', '-', '@', '\t', '\r'].includes(text[0])) {
    text = `'${text}`;
  }
  return text.slice(0, maxLen);
}

export interface UploadedRoomRow {
  roomCode: string;
  building: string;
  floor: number;
  capacity: number;
  roomType: 'lecture' | 'lab' | 'seminar';
}

export interface UploadedCourseRow {
  courseCode: string;
  title: string;
  department: string;
  credits: number;
  courseKind: 'core' | 'elective' | 'backlog';
  roomType: 'lecture' | 'lab' | 'seminar';
  sessionsPerWeek: number;
  facultyUsername: string;
}

export interface UploadedSectionRow {
  sectionCode: string;
  department: string;
  studentCount: number;
}

export interface ParsedAcademicUpload {
  rooms: UploadedRoomRow[];
  courses: UploadedCourseRow[];
  sections: UploadedSectionRow[];
}

const VALID_ROOM_TYPES = new Set(['lecture', 'lab', 'seminar']);
const VALID_COURSE_KINDS = new Set(['core', 'elective', 'backlog']);
const SAFE_TEXT_RE = /^[\w\s.,&()/+-]{1,120}$/;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function validateRoomObj(raw: Record<string, unknown>): UploadedRoomRow {
  const roomCode = String(raw.room_code ?? raw.roomCode ?? '').trim().toUpperCase();
  const building = String(raw.building ?? '').trim();
  const roomType = String(raw.room_type ?? raw.roomType ?? 'lecture')
    .trim()
    .toLowerCase();
  const floor = Number(raw.floor ?? 1);
  const capacity = Number(raw.capacity ?? 0);

  if (!/^[A-Z]{1,5}-?[0-9]{2,4}$/.test(roomCode)) {
    throw new Error('Invalid room code (e.g. LH-101).');
  }
  if (!SAFE_TEXT_RE.test(building)) {
    throw new Error('Invalid building name.');
  }
  if (!VALID_ROOM_TYPES.has(roomType)) {
    throw new Error('Room type must be lecture, lab, or seminar.');
  }
  if (!Number.isInteger(floor) || floor < 1 || floor > 50) {
    throw new Error('Floor must be between 1 and 50.');
  }
  if (!Number.isInteger(capacity) || capacity < 10 || capacity > 500) {
    throw new Error('Room capacity must be between 10 and 500.');
  }

  return {
    roomCode,
    building: sanitizeCell(building, 80),
    floor,
    capacity,
    roomType: roomType as 'lecture' | 'lab' | 'seminar',
  };
}

function validateCourseObj(raw: Record<string, unknown>): UploadedCourseRow {
  const courseCode = String(raw.course_code ?? raw.courseCode ?? '')
    .trim()
    .toUpperCase();
  const title = String(raw.title ?? '').trim();
  const department = String(raw.department ?? 'BTech CSE department').trim();
  const courseKind = String(raw.course_kind ?? raw.courseKind ?? 'core')
    .trim()
    .toLowerCase();
  const roomType = String(raw.room_type ?? raw.roomType ?? 'lecture')
    .trim()
    .toLowerCase();
  const credits = Number(raw.credits ?? 3);
  const sessionsPerWeek = Number(raw.sessions_per_week ?? raw.sessionsPerWeek ?? 3);
  const facultyUsername = String(
    raw.faculty_username ?? raw.facultyUsername ?? 'FAC-STAFF'
  ).trim();

  if (!/^[A-Z]{2,5}[0-9]{3}$/.test(courseCode)) {
    throw new Error('Course code must be 2–5 letters followed by 3 digits.');
  }
  if (!SAFE_TEXT_RE.test(title)) {
    throw new Error('Course title contains unsupported characters.');
  }
  if (!VALID_COURSE_KINDS.has(courseKind)) {
    throw new Error('Course kind must be core, elective, or backlog.');
  }
  if (!VALID_ROOM_TYPES.has(roomType)) {
    throw new Error('Room type must be lecture, lab, or seminar.');
  }
  if (Number.isNaN(credits) || credits < 0.5 || credits > 10) {
    throw new Error('Credits must be between 0.5 and 10.');
  }
  if (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 6) {
    throw new Error('Sessions per week must be between 1 and 6.');
  }

  return {
    courseCode,
    title: sanitizeCell(title, 100),
    department: sanitizeCell(department, 60),
    credits,
    courseKind: courseKind as 'core' | 'elective' | 'backlog',
    roomType: roomType as 'lecture' | 'lab' | 'seminar',
    sessionsPerWeek,
    facultyUsername: sanitizeCell(facultyUsername, 40),
  };
}

function validateSectionObj(raw: Record<string, unknown>): UploadedSectionRow {
  const sectionCode = String(raw.section_code ?? raw.sectionCode ?? '')
    .trim()
    .toUpperCase();
  const department = String(raw.department ?? 'BTech CSE department').trim();
  const studentCount = Number(raw.student_count ?? raw.studentCount ?? 0);

  if (!/^[A-Z0-9-]{2,16}$/.test(sectionCode)) {
    throw new Error('Section code must be 2–16 alphanumeric/hyphen characters.');
  }
  if (!Number.isInteger(studentCount) || studentCount < 1 || studentCount > 300) {
    throw new Error('Section student count must be between 1 and 300.');
  }

  return {
    sectionCode,
    department: sanitizeCell(department, 60),
    studentCount,
  };
}

export function parseUploadedAcademicFile(
  filename: string,
  content: string
): ParsedAcademicUpload {
  const cleanName = path.basename(String(filename || '')).trim();
  const ext = path.extname(cleanName).toLowerCase();
  if (ext !== '.csv' && ext !== '.json') {
    throw new Error('Only .csv and .json files are permitted.');
  }
  if (!content || content.trim().length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
    throw new Error('Uploaded file exceeds the 2 MB size limit.');
  }
  if (content.includes('\u0000')) {
    throw new Error('Uploaded file contains invalid binary characters.');
  }

  const result: ParsedAcademicUpload = { rooms: [], courses: [], sections: [] };

  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Uploaded JSON file is malformed.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON root must be an object with rooms/courses/sections arrays.');
    }
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rooms)) {
      for (const r of obj.rooms.slice(0, 500)) {
        if (r && typeof r === 'object') {
          result.rooms.push(validateRoomObj(r as Record<string, unknown>));
        }
      }
    }
    if (Array.isArray(obj.courses)) {
      for (const c of obj.courses.slice(0, 500)) {
        if (c && typeof c === 'object') {
          result.courses.push(validateCourseObj(c as Record<string, unknown>));
        }
      }
    }
    if (Array.isArray(obj.sections)) {
      for (const s of obj.sections.slice(0, 500)) {
        if (s && typeof s === 'object') {
          result.sections.push(validateSectionObj(s as Record<string, unknown>));
        }
      }
    }
  } else {
    const lines = content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV file must include a header row and at least one record.');
    }
    const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1, 1001).map((line) => {
      const vals = splitCsvLine(line);
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => {
        rec[h] = vals[i] ?? '';
      });
      return rec;
    });

    const headerSet = new Set(headers);
    if (headerSet.has('room_code') && headerSet.has('capacity')) {
      for (const r of rows) result.rooms.push(validateRoomObj(r));
    } else if (headerSet.has('course_code') && headerSet.has('title')) {
      for (const r of rows) result.courses.push(validateCourseObj(r));
    } else if (headerSet.has('section_code') && headerSet.has('student_count')) {
      for (const r of rows) result.sections.push(validateSectionObj(r));
    } else {
      throw new Error(
        'CSV columns must match rooms (room_code, capacity), courses (course_code, title), or sections (section_code, student_count).'
      );
    }
  }

  if (
    result.rooms.length === 0 &&
    result.courses.length === 0 &&
    result.sections.length === 0
  ) {
    throw new Error('No valid records found in the uploaded file.');
  }

  return result;
}
