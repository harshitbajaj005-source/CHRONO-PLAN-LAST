import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  GraduationCap,
  Plus,
  Share2,
  ShieldCheck,
  UserCheck,
  Utensils,
} from 'lucide-react';
import { getCoursesByDepartment } from '../data/courseCatalog';
import {
  Course,
  DayKey,
  DaySchedule,
  FacultyDepartment,
  FacultySubjectAssignment,
  SchedulePeriod,
  UserProfile,
} from '../types';
import { downloadWeeklyICS } from '../utils/exportUtils';
import { DEPARTMENT_COURSE_SPECS } from '../utils/subjectValidation';
import { StudentDepartmentSelector } from './StudentDepartmentSelector';
import { SubjectCodeLookupPanel } from './SubjectCodeLookupPanel';

interface StudentScheduleViewProps {
  profile: UserProfile;
  courses: Course[];
  weeklySchedule: Record<DayKey, DaySchedule>;
  facultySubjects: FacultySubjectAssignment[];
  bookedCountsByDepartment?: Record<string, number>;
  totalCredits: number;
  conflictCount: number;
  onSelectDepartment: (department: FacultyDepartment | null) => Promise<void>;
  onToggleEnroll: (courseId: string) => void;
  onSelectPeriod: (period: SchedulePeriod) => void;
  onTogglePeriodReminder: (day: DayKey, periodId: string) => void;
  onNavigateConflicts: () => void;
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_DATE_LABELS: Record<DayKey, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

const SAMPLE_DAY_TEMPLATES: Record<
  DayKey,
  {
    startOffset: number;
    slots: { start: string; end: string }[];
    breaks: { afterPeriodIndex: number; label: string }[];
  }
> = {
  Mon: {
    startOffset: 0,
    slots: [
      { start: '09:00 AM', end: '10:00 AM' },
      { start: '10:15 AM', end: '11:15 AM' },
      { start: '11:30 AM', end: '12:30 PM' },
      { start: '01:30 PM', end: '02:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 2, label: '12:30 PM – 01:30 PM · Lunch Break' }],
  },
  Tue: {
    startOffset: 4,
    slots: [
      { start: '09:30 AM', end: '10:30 AM' },
      { start: '10:45 AM', end: '11:45 AM' },
      { start: '12:30 PM', end: '01:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 1, label: '11:45 AM – 12:30 PM · Midday Break' }],
  },
  Wed: {
    startOffset: 7,
    slots: [
      { start: '09:00 AM', end: '10:00 AM' },
      { start: '10:15 AM', end: '11:15 AM' },
      { start: '11:30 AM', end: '12:30 PM' },
      { start: '01:30 PM', end: '02:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 2, label: '12:30 PM – 01:30 PM · Lunch Break' }],
  },
  Thu: {
    startOffset: 11,
    slots: [
      { start: '09:30 AM', end: '10:30 AM' },
      { start: '10:45 AM', end: '11:45 AM' },
      { start: '12:30 PM', end: '01:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 1, label: '11:45 AM – 12:30 PM · Midday Break' }],
  },
  Fri: {
    startOffset: 14,
    slots: [
      { start: '09:00 AM', end: '10:00 AM' },
      { start: '10:15 AM', end: '11:15 AM' },
      { start: '11:30 AM', end: '12:30 PM' },
      { start: '01:30 PM', end: '02:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 2, label: '12:30 PM – 01:30 PM · Lunch Break' }],
  },
  Sat: {
    startOffset: 18,
    slots: [
      { start: '09:30 AM', end: '10:30 AM' },
      { start: '10:45 AM', end: '11:45 AM' },
      { start: '12:30 PM', end: '01:30 PM' },
    ],
    breaks: [{ afterPeriodIndex: 1, label: '11:45 AM – 12:30 PM · Midday Break' }],
  },
};

export const StudentScheduleView: React.FC<StudentScheduleViewProps> = ({
  profile,
  courses,
  weeklySchedule,
  facultySubjects,
  bookedCountsByDepartment,
  totalCredits,
  conflictCount,
  onSelectDepartment,
  onToggleEnroll,
  onSelectPeriod,
  onTogglePeriodReminder,
  onNavigateConflicts,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayKey>('Mon');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [reminderOverrides, setReminderOverrides] = useState<
    Record<string, boolean>
  >({});

  const selectedDepartment = profile.studentDepartment ?? null;

  const enrolledCourses = useMemo(
    () =>
      selectedDepartment
        ? courses.filter((c) => c.enrolled && c.department === selectedDepartment)
        : [],
    [courses, selectedDepartment]
  );

  // Build weekly schedule for student's selected department (3-4 sample department classes per day + any chosen faculty-booked classes)
  const effectiveWeeklySchedule = useMemo(() => {
    const result = {} as Record<DayKey, DaySchedule>;
    const deptCatalog = selectedDepartment
      ? getCoursesByDepartment(selectedDepartment)
      : [];
    const deptSlug = (selectedDepartment || 'none')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    for (const day of DAYS) {
      const base = weeklySchedule[day];
      const tpl = SAMPLE_DAY_TEMPLATES[day];
      const dayBookedCourses = enrolledCourses.filter((c) => c.day === day);
      const bookedCodes = new Set(dayBookedCourses.map((c) => c.code));

      const bookedPeriods: SchedulePeriod[] = dayBookedCourses.map((course, idx) => {
        const [startTime = '04:30 PM', endTime = '06:00 PM'] =
          course.timeSlot.split(' - ');
        return {
          id: course.id,
          periodCode: `P${idx + 1}`,
          startTime,
          endTime,
          courseCode: course.code,
          title: course.title,
          room: course.room,
          instructor: course.instructor,
          status: idx === 0 ? 'now' : 'upcoming',
          reminderEnabled: Boolean(reminderOverrides[course.id]),
          attended: false,
          topic: course.description,
          credits: course.credits,
        };
      });

      const samplePeriods: SchedulePeriod[] = [];
      if (deptCatalog.length > 0 && bookedPeriods.length < tpl.slots.length) {
        const remainingSlots = tpl.slots.slice(bookedPeriods.length);
        let cursor = 0;
        for (let i = 0; i < remainingSlots.length; i++) {
          let course =
            deptCatalog[(tpl.startOffset + cursor) % deptCatalog.length];
          let guard = 0;
          while (bookedCodes.has(course.code) && guard < deptCatalog.length) {
            cursor++;
            course =
              deptCatalog[(tpl.startOffset + cursor) % deptCatalog.length];
            guard++;
          }
          cursor++;

          const slot = remainingSlots[i];
          const periodNum = bookedPeriods.length + i + 1;
          const sampleId = `sample-${deptSlug}-${day}-${periodNum}`;
          samplePeriods.push({
            id: sampleId,
            periodCode: `P${periodNum}`,
            startTime: slot.start,
            endTime: slot.end,
            courseCode: course.code,
            title: course.title,
            room: course.room,
            instructor: course.instructor,
            status: bookedPeriods.length === 0 && i === 0 ? 'now' : 'upcoming',
            reminderEnabled: Boolean(reminderOverrides[sampleId]),
            attended: false,
            topic: course.description,
            credits: course.credits,
          });
        }
      }

      result[day] = {
        ...base,
        day,
        dateLabel: base?.dateLabel || DAY_DATE_LABELS[day],
        breaks: tpl.breaks,
        periods: [...bookedPeriods, ...samplePeriods],
      };
    }
    return result;
  }, [enrolledCourses, selectedDepartment, weeklySchedule, reminderOverrides]);

  const departmentFacultySubjects = useMemo(() => {
    if (!selectedDepartment) return [];
    return facultySubjects.filter((s) => s.department === selectedDepartment);
  }, [facultySubjects, selectedDepartment]);

  // Mandatory Step 1 after Student Login: Select Department
  if (!selectedDepartment) {
    return (
      <StudentDepartmentSelector
        profile={profile}
        bookedCountsByDepartment={bookedCountsByDepartment}
        onSelectDepartment={async (dept) => {
          await onSelectDepartment(dept);
        }}
      />
    );
  }

  const firstName = profile.fullName.split(' ')[0] || 'Student';
  const currentDaySchedule = effectiveWeeklySchedule[selectedDay];
  const dayBreaks = currentDaySchedule.breaks || [];
  const deptSpec = DEPARTMENT_COURSE_SPECS[selectedDepartment];

  const handleICSExport = () => {
    downloadWeeklyICS(effectiveWeeklySchedule, profile.fullName);
    setExportNotice('Calendar (.ics) downloaded for Apple & Google Calendar.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleReminderToggle = (day: DayKey, periodId: string) => {
    setReminderOverrides((prev) => ({
      ...prev,
      [periodId]: !prev[periodId],
    }));
    onTogglePeriodReminder(day, periodId);
  };

  const renderPeriodCard = (period: SchedulePeriod) => {
    const isNow = period.status === 'now';
    const isSample = period.id.startsWith('sample-');

    if (isNow) {
      return (
        <div
          key={period.id}
          onClick={() => onSelectPeriod(period)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectPeriod(period);
            }
          }}
          className="relative overflow-hidden rounded-2xl bg-[#0D4E52] text-white p-3.5 md:p-4 flex items-center justify-between gap-3.5 shadow-md shadow-[#0D4E52]/15 cursor-pointer hover:bg-[#0A4145] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D4E52]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-16 h-13 rounded-xl bg-[#1A6368] text-white flex flex-col items-center justify-center shrink-0 px-1.5">
              <span className="text-[11px] font-mono font-bold leading-none">
                {period.courseCode}
              </span>
              <span className="text-[10px] font-mono tabular-nums mt-1 text-[#C8EFF2] leading-none">
                {period.startTime}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-[#9EE8EE]">
                {period.periodCode} · {isSample ? 'Department Sample Class' : 'Faculty Booked Session'}
              </p>
              <h3 className="font-serif font-semibold text-[16px] md:text-[17px] text-white truncate mt-0.5">
                {period.title}
              </h3>
              <p className="text-xs text-[#CFE5E6] truncate mt-0.5 tabular-nums">
                {period.startTime} – {period.endTime} · {period.room} · {period.instructor}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={
              period.reminderEnabled ? 'Disable class reminder' : 'Enable class reminder'
            }
            onClick={(e) => {
              e.stopPropagation();
              handleReminderToggle(selectedDay, period.id);
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {period.reminderEnabled ? (
              <BellRing className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5 opacity-80" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div
        key={period.id}
        onClick={() => onSelectPeriod(period)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectPeriod(period);
          }
        }}
        className="rounded-2xl bg-white border border-[#E7EFEF] p-3.5 md:p-4 flex items-center justify-between gap-3.5 hover:border-[#C7DBDD] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-16 h-13 rounded-xl bg-[#B9F2F7] text-[#0D4E52] flex flex-col items-center justify-center shrink-0 px-1.5">
            <span className="text-[11px] font-mono font-bold leading-none">
              {period.courseCode}
            </span>
            <span className="text-[10px] font-mono tabular-nums mt-1 leading-none">
              {period.startTime}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-semibold text-[15px] md:text-[16px] text-[#0F1F21] truncate">
              {period.title}
            </h3>
            <p className="text-xs text-[#5A6B6D] truncate mt-0.5 tabular-nums">
              {period.startTime} – {period.endTime} · {period.room} · {period.instructor}
            </p>
          </div>
        </div>

        <div className="shrink-0 pr-1">
          {period.status === 'completed' || period.attended ? (
            <CheckCircle2
              className="w-5 h-5 text-[#1F7A6E]"
              aria-label="Completed session"
            />
          ) : (
            <Clock className="w-5 h-5 text-[#9AA8AA]" aria-label="Upcoming session" />
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-6">
      {/* Department & Greeting Header Banner */}
      <div className="rounded-2xl bg-[#1D5B5F] text-white px-4 py-3.5 md:px-6 md:py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs text-[#BCE6E9] truncate">
            {profile.semester} · Section {profile.section} ·{' '}
            <span className="font-mono tabular-nums">
              ID {profile.registrationNumber}
            </span>
          </p>
          <h1 className="font-serif font-semibold text-lg md:text-2xl text-white truncate mt-0.5">
            Welcome back, {firstName} — {deptSpec.shortLabel}
          </h1>
          <p className="text-[11px] text-[#CFE5E6] tabular-nums mt-0.5">
            {selectedDepartment} · Subject codes: {deptSpec.rangeSummary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectDepartment(null)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Department</span>
          </button>

          <button
            type="button"
            onClick={onNavigateConflicts}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              conflictCount > 0
                ? 'bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]'
                : 'bg-white text-[#0D4E52] hover:bg-[#E4F5F6]'
            }`}
          >
            {conflictCount > 0 ? (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {conflictCount} Conflict{conflictCount > 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#0D4E52] shrink-0" />
                <span>All Clear</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* 3 KPI Stat Cards */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-4">
            <div className="bg-white rounded-2xl border border-[#E7EFEF] p-3.5 md:p-4">
              <div className="flex items-center justify-between text-xs text-[#5A6B6D]">
                <span className="truncate">Attendance</span>
                <UserCheck className="w-4 h-4 text-[#0D4E52] shrink-0" />
              </div>
              <p className="mt-2 font-serif font-bold text-[22px] md:text-[26px] text-[#0F1F21] tabular-nums leading-none">
                {profile.attendancePct}%
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-[#1F7A6E]">Safe Zone</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E7EFEF] p-3.5 md:p-4">
              <div className="flex items-center justify-between text-xs text-[#5A6B6D]">
                <span className="truncate">Chosen Subjects</span>
                <ClipboardCheck className="w-4 h-4 text-[#0D4E52] shrink-0" />
              </div>
              <p className="mt-2 font-serif font-bold text-[22px] md:text-[26px] text-[#0F1F21] tabular-nums leading-none">
                {enrolledCourses.length}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-[#5A6B6D]">
                {selectedDepartment ? deptSpec.shortLabel : 'Active'}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#E7EFEF] p-3.5 md:p-4">
              <div className="flex items-center justify-between text-xs text-[#5A6B6D]">
                <span className="truncate">Credits</span>
                <GraduationCap className="w-4 h-4 text-[#0D4E52] shrink-0" />
              </div>
              <p className="mt-2 font-serif font-bold text-[22px] md:text-[26px] text-[#0F1F21] tabular-nums leading-none">
                {totalCredits.toFixed(1)}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-[#5A6B6D]">Enrolled</p>
            </div>
          </div>

          {/* 3-Digit Subject Code Lookup & Selection */}
          <SubjectCodeLookupPanel
            department={selectedDepartment}
            courses={courses}
            onToggleEnroll={onToggleEnroll}
          />

          {/* Interactive Day Switcher Row */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1.5 md:gap-2">
              {DAYS.map((day) => {
                const active = selectedDay === day;
                const count = effectiveWeeklySchedule[day].periods.length;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[40px] px-3.5 md:px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] ${
                      active
                        ? 'bg-[#0D4E52] text-white shadow-sm'
                        : 'bg-[#E9EFEF] text-[#4A5B5D] hover:bg-[#DCE5E5]'
                    }`}
                  >
                    {day}
                    {count > 0 && (
                      <span
                        className={`ml-1.5 text-[11px] font-mono tabular-nums ${
                          active ? 'text-[#B9F2F7]' : 'text-[#0D4E52]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0D4E52] pl-2 whitespace-nowrap shrink-0 tabular-nums">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{currentDaySchedule.dateLabel}</span>
            </div>
          </div>

          {/* Faculty-Booked Classes for Chosen Department */}
          {departmentFacultySubjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif font-bold text-[19px] md:text-[21px] text-[#0F1F21] flex items-center gap-2">
                  <BookOpenCheck className="w-5 h-5 text-[#0D4E52]" />
                  <span>Faculty-Booked Classes ({deptSpec.shortLabel})</span>
                </h2>
                <span className="text-xs text-[#5A6B6D] tabular-nums">
                  {departmentFacultySubjects.length} Booked Session
                  {departmentFacultySubjects.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2.5">
                {departmentFacultySubjects.map((sub) => {
                  const matchedCourse = courses.find((c) => c.id === sub.id);
                  const isChosen = Boolean(matchedCourse?.enrolled);
                  return (
                    <div
                      key={sub.id}
                      className="rounded-2xl bg-white border border-[#B9E2E5] p-4 flex items-center justify-between gap-3.5 shadow-[0_6px_20px_-14px_rgba(13,78,82,0.18)]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="px-2.5 h-12 rounded-xl bg-[#0D4E52] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {sub.subjectCode}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-serif font-semibold text-[16px] text-[#0F1F21] truncate">
                            {sub.subjectTitle}
                          </h3>
                          <p className="text-xs text-[#5A6B6D] truncate mt-0.5">
                            {sub.facultyName} · {sub.department}
                          </p>
                          <p className="text-[11px] font-medium text-[#0D4E52] truncate mt-0.5 tabular-nums">
                            {sub.blockName} · Floor {sub.floorNumber} · {sub.roomName} ·{' '}
                            {sub.dateKey} · {sub.timeSlot}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleEnroll(sub.id)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                          isChosen
                            ? 'bg-[#0D4E52] text-white hover:bg-[#093B3E]'
                            : 'bg-[#E4F5F6] text-[#0D4E52] hover:bg-[#CBECEF]'
                        }`}
                      >
                        {isChosen ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Chosen</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Choose</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Day Schedule */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="font-serif font-bold text-[19px] md:text-[22px] text-[#0F1F21]">
                  {DAY_DATE_LABELS[selectedDay]} Timetable
                </h2>
                <p className="text-xs text-[#5A6B6D] mt-0.5">
                  Showing {currentDaySchedule.periods.length} {deptSpec.shortLabel} sample classes for {DAY_DATE_LABELS[selectedDay]}.
                </p>
              </div>
              <span className="text-xs text-[#5A6B6D] tabular-nums whitespace-nowrap">
                {currentDaySchedule.periods.length} Class
                {currentDaySchedule.periods.length === 1 ? '' : 'es'}
              </span>
            </div>

            {currentDaySchedule.periods.length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#E7EFEF] p-8 text-center space-y-1.5">
                <p className="font-serif font-semibold text-base text-[#0F1F21]">
                  No classes scheduled for {DAY_DATE_LABELS[selectedDay]}
                </p>
                <p className="text-xs text-[#5A6B6D]">
                  {departmentFacultySubjects.length === 0
                    ? `No faculty has booked a class in ${deptSpec.shortLabel} yet. Booked classes will appear once scheduled by an instructor.`
                    : `Choose a faculty-booked ${deptSpec.shortLabel} subject above to add it to your timetable.`}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentDaySchedule.periods.map((period, idx) => {
                  const breakMatch = dayBreaks.find((b) => b.afterPeriodIndex === idx);
                  return (
                    <React.Fragment key={period.id}>
                      {renderPeriodCard(period)}
                      {breakMatch && (
                        <div className="py-2 flex items-center justify-center">
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#EAEFEF] text-[12px] font-medium text-[#4A5B5D]">
                            <Utensils className="w-3.5 h-3.5 text-[#5A6B6D]" />
                            <span>{breakMatch.label}</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sync & Export + Academic Snapshot */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif font-bold text-[19px] text-[#0F1F21]">
                  Sync &amp; Export
                </h2>
                <p className="text-xs text-[#5A6B6D] mt-0.5">
                  Export clean, conflict-free schedule
                </p>
              </div>
              <span className="w-9 h-9 rounded-xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center shrink-0">
                <Share2 className="w-4 h-4" />
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={handleICSExport}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <CalendarPlus className="w-4 h-4 shrink-0" />
                <span>Add to Apple/Google</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPDF}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F2F5F5] hover:bg-[#E6ECEC] text-[#0F1F21] text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download PDF</span>
              </button>
            </div>

            {exportNotice && (
              <p className="text-xs font-medium text-[#0D4E52] bg-[#E4F5F6] rounded-xl px-3 py-2">
                {exportNotice}
              </p>
            )}
          </div>

          <div className="hidden lg:block bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-2.5">
            <h3 className="font-serif font-semibold text-base text-[#0F1F21]">
              Academic Snapshot
            </h3>
            <div className="text-xs text-[#5A6B6D] space-y-2 pt-1">
              <div className="flex justify-between gap-2">
                <span>Department</span>
                <span className="font-medium text-[#0F1F21] text-right">
                  {selectedDepartment}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Student ID</span>
                <span className="font-mono text-[#0F1F21] tabular-nums">
                  {profile.registrationNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Program Year</span>
                <span className="font-medium text-[#0F1F21]">{profile.year}</span>
              </div>
              <div className="flex justify-between">
                <span>Email</span>
                <span className="font-medium text-[#0F1F21] truncate max-w-[160px]">
                  {profile.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
