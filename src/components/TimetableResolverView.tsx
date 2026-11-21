import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  createAdminUserApi,
  fetchM3TimetableApi,
  generateM3TimetableApi,
  uploadAcademicDatasetApi,
} from '../services/api';
import type {
  ApiAuthSession,
  DayKey,
  M3GenerationResponse,
  M3ScheduledSlot,
  UserRole,
} from '../types';

interface TimetableResolverViewProps {
  session: ApiAuthSession;
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TimetableResolverView: React.FC<TimetableResolverViewProps> = ({
  session,
}) => {
  const [activeDay, setActiveDay] = useState<DayKey>('Mon');
  const [slots, setSlots] = useState<M3ScheduledSlot[]>([]);
  const [genResult, setGenResult] = useState<M3GenerationResponse | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Dataset upload
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Account creation
  const [newRole, setNewRole] = useState<UserRole>('faculty');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDeptOrSec, setNewDeptOrSec] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchM3TimetableApi(session)
      .then((data) => setSlots(data.slots || []))
      .catch(() => {});
  }, [session]);

  const handleGenerate = async (mode: 'database' | 'benchmark') => {
    setGenLoading(true);
    setGenError(null);
    try {
      const result = await generateM3TimetableApi(
        session,
        mode === 'benchmark'
          ? { mode: 'benchmark', numStudents: 1500, numSections: 120 }
          : { mode: 'database' }
      );
      setGenResult(result);
      if (mode === 'database') {
        setSlots(result.scheduledSlots);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unable to generate timetable.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus(null);
    setUploadError(null);
    try {
      const text = await file.text();
      const res = await uploadAcademicDatasetApi(session, {
        filename: file.name,
        content: text,
      });
      setUploadStatus(
        `${res.message} Rooms: ${res.imported.rooms}, Courses: ${res.imported.courses}, Sections: ${res.imported.sections}.`
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to import file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus(null);
    setCreateError(null);
    try {
      const res = await createAdminUserApi(session, {
        role: newRole,
        username: newUsername,
        fullName: newFullName,
        email: newEmail,
        department: newRole === 'faculty' ? newDeptOrSec : '',
        section: newRole === 'student' ? newDeptOrSec : '',
        password: newPassword,
      });
      setCreateStatus(res.message);
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewDeptOrSec('');
      setNewPassword('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create account.');
    }
  };

  const daySlots = slots
    .filter((s) => s.day === activeDay)
    .sort((a, b) => a.slotIndex - b.slotIndex);

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#5A6B6D]">
            Academic Administration · M3 Clash Resolver
          </p>
          <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#0F1F21] mt-1">
            Timetable &amp; Department Coordination
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={genLoading}
            onClick={() => handleGenerate('database')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {genLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarCheck2 className="w-4 h-4" />
            )}
            <span>Generate Conflict-Free Timetable</span>
          </button>

          <button
            type="button"
            disabled={genLoading}
            onClick={() => handleGenerate('benchmark')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#B9F2F7] hover:bg-[#A3EBF2] text-[#0D4E52] text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            <Users className="w-4 h-4" />
            <span>Run 1,500 Students / 120 Sections Test</span>
          </button>
        </div>
      </div>

      {genError && (
        <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-xs font-medium text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{genError}</span>
        </div>
      )}

      {genResult && (
        <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif font-bold text-lg text-[#0F1F21] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#0D4E52]" />
              <span>
                Scheduled {genResult.stats.scheduledSessions} sessions in{' '}
                {genResult.stats.generationMs} ms
              </span>
            </h2>
            <span className="text-xs font-medium text-[#5A6B6D]">
              Lunch preserved: {genResult.lunchBreakSlot} · Unscheduled:{' '}
              {genResult.stats.unscheduledCount}
            </span>
          </div>
          {genResult.unscheduled.length > 0 && (
            <div className="rounded-2xl bg-[#FEF3C7]/60 border border-[#FDE68A] p-3 text-xs text-[#92400E] space-y-1">
              {genResult.unscheduled.slice(0, 8).map((u, i) => (
                <p key={`${u.sectionCode}-${u.courseCode}-${i}`}>
                  <strong>
                    {u.sectionCode} · {u.courseCode}:
                  </strong>{' '}
                  {u.reason}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-[#5A6B6D] leading-relaxed">
            {genResult.algorithmNotes}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Weekly Timetable Viewer */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#0D4E52]" />
              <h2 className="font-serif font-bold text-lg text-[#0F1F21]">
                Weekly Schedule
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    activeDay === day
                      ? 'bg-[#0D4E52] text-white'
                      : 'bg-[#EEF2F2] text-[#495B5D] hover:bg-[#E1E7E7]'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {daySlots.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#5A6B6D]">
              Click &ldquo;Generate Conflict-Free Timetable&rdquo; to populate{' '}
              {activeDay} sessions.
            </div>
          ) : (
            <div className="space-y-2.5">
              {daySlots.map((slot, idx) => {
                const prev = daySlots[idx - 1];
                const showMiddayBreak =
                  activeDay === 'Sat' &&
                  slot.slotIndex >= 2 &&
                  (!prev || prev.slotIndex < 2);
                const showLunchBreak =
                  activeDay === 'Sat' &&
                  slot.slotIndex >= 3 &&
                  (!prev || prev.slotIndex < 3);
                return (
                  <React.Fragment
                    key={`${slot.day}-${slot.slotIndex}-${slot.sectionCode}-${slot.courseCode}`}
                  >
                    {showMiddayBreak && (
                      <div className="rounded-xl bg-[#EEF4F4] py-2 px-3 text-center text-xs font-medium text-[#5A6B6D]">
                        12:00 PM – 12:30 PM · 30-Min Midday Break
                      </div>
                    )}
                    {showLunchBreak && (
                      <div className="rounded-xl bg-[#EEF4F4] py-2 px-3 text-center text-xs font-medium text-[#5A6B6D]">
                        02:00 PM – 02:50 PM · 50-Min Lunch Break
                      </div>
                    )}
                    <div className="rounded-2xl border border-[#E7EFEF] bg-[#FAFBFB] p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-2 rounded-xl bg-[#B9F2F7] text-[#0D4E52] font-mono text-xs font-bold shrink-0">
                          {slot.slotLabel.split(' - ')[0]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F1F21] truncate">
                            {slot.courseCode} · {slot.courseTitle}
                          </p>
                          <p className="text-xs text-[#5A6B6D] truncate">
                            {slot.sectionCode} · {slot.roomCode} ({slot.studentCount}/
                            {slot.roomCapacity}) · {slot.facultyName}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#EEF4F4] text-[#0D4E52] uppercase">
                        {slot.courseKind}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Data Import & Account Onboarding */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#0D4E52]" />
              <h2 className="font-serif font-bold text-base text-[#0F1F21]">
                Import Rooms, Courses or Sections
              </h2>
            </div>
            <p className="text-xs text-[#5A6B6D]">
              Select a `.csv` or `.json` academic schedule file (up to 2 MB).
            </p>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="block w-full text-xs text-[#5A6B6D] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#EEF4F4] file:text-[#0D4E52] hover:file:bg-[#E1ECEC]"
            />
            {uploadStatus && (
              <p className="text-xs font-medium text-[#175B3A]">{uploadStatus}</p>
            )}
            {uploadError && (
              <p className="text-xs font-medium text-[#991B1B]">{uploadError}</p>
            )}
          </div>

          <form
            onSubmit={handleCreateAccount}
            className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#0D4E52]" />
              <h2 className="font-serif font-bold text-base text-[#0F1F21]">
                Create Faculty or Student Account
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
              >
                <option value="faculty">Faculty</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username / ID"
                className="h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
              />
            </div>

            <input
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Full Name"
              className="w-full h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
            />

            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="University Email (@lpu.in for students)"
              className="w-full h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
            />

            <input
              type="text"
              value={newDeptOrSec}
              onChange={(e) => setNewDeptOrSec(e.target.value)}
              placeholder={
                newRole === 'student'
                  ? 'Section (e.g. CSE-4B)'
                  : 'Department (optional)'
              }
              className="w-full h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
            />

            <input
              type="password"
              required
              maxLength={newRole === 'student' ? 10 : undefined}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={
                newRole === 'student'
                  ? 'Password (8–10 chars, letters & digits only)'
                  : 'Temporary Password (8+ chars, letters & digits)'
              }
              className="w-full h-10 px-3 rounded-xl bg-[#F2F4F5] text-xs text-[#0F1F21] focus:outline-none focus:ring-2 focus:ring-[#0D4E52]"
            />

            {createStatus && (
              <p className="text-xs font-medium text-[#175B3A]">{createStatus}</p>
            )}
            {createError && (
              <p className="text-xs font-medium text-[#991B1B]">{createError}</p>
            )}

            <button
              type="submit"
              className="w-full h-10 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold transition-colors"
            >
              Create Account
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
