import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  Hash,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import type { Course, FacultyDepartment, UserProfile } from '../types';
import {
  DEPARTMENT_COURSE_SPECS,
  padThreeDigits,
  resolveThreeDigitSubjectCode,
} from '../utils/subjectValidation';
import { StudentDepartmentSelector } from './StudentDepartmentSelector';

interface CoursesViewProps {
  profile: UserProfile;
  courses: Course[];
  bookedCountsByDepartment?: Record<string, number>;
  onSelectDepartment: (department: FacultyDepartment | null) => Promise<void>;
  onToggleEnroll: (courseId: string) => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  profile,
  courses,
  bookedCountsByDepartment,
  onSelectDepartment,
  onToggleEnroll,
}) => {
  const [codeDigits, setCodeDigits] = useState('');
  const [query, setQuery] = useState('');
  const [businessTrack, setBusinessTrack] = useState<'ALL' | 'BBA' | 'MBA'>('ALL');
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'available'>('all');

  const selectedDepartment = profile.studentDepartment ?? null;

  const departmentCourses = useMemo(() => {
    if (!selectedDepartment) return [];
    return courses.filter((c) => c.department === selectedDepartment);
  }, [courses, selectedDepartment]);

  const enrolledCount = courses.filter((c) => c.enrolled).length;
  const totalCredits = courses
    .filter((c) => c.enrolled)
    .reduce((sum, c) => sum + c.credits, 0);

  const isBusiness = selectedDepartment === 'Business department';

  const outOfRangeNotice = useMemo(() => {
    if (!selectedDepartment) return null;
    const digits = codeDigits.trim();
    if (digits.length !== 3) return null;
    const preferred =
      isBusiness && businessTrack !== 'ALL' ? businessTrack : undefined;
    const res = resolveThreeDigitSubjectCode(selectedDepartment, digits, preferred);
    return res.valid ? null : res.error || null;
  }, [selectedDepartment, codeDigits, isBusiness, businessTrack]);

  const filtered = useMemo(() => {
    return departmentCourses.filter((course) => {
      if (isBusiness && businessTrack !== 'ALL' && course.trackPrefix !== businessTrack) {
        return false;
      }

      const matchesFilter =
        filter === 'all' ||
        (filter === 'enrolled' && course.enrolled) ||
        (filter === 'available' && !course.enrolled);

      const d = codeDigits.trim();
      const three = course.threeDigitCode || course.code.split('-')[1] || '';
      const matchesCode = !d || three.startsWith(d) || three.includes(d);

      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.instructor.toLowerCase().includes(q);

      return matchesFilter && matchesCode && matchesQuery;
    });
  }, [departmentCourses, isBusiness, businessTrack, filter, codeDigits, query]);

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

  const spec = DEPARTMENT_COURSE_SPECS[selectedDepartment];
  const exampleRange = spec.tracks
    .map((t) => `${padThreeDigits(t.min)}–${padThreeDigits(t.max)}`)
    .join(' / ');

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5A6B6D]">
            {selectedDepartment} · {spec.rangeSummary}
          </p>
          <h1 className="font-serif font-bold text-[26px] md:text-[32px] leading-tight text-[#0F1F21] mt-0.5">
            {spec.shortLabel} Courses &amp; Electives
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-[#5A6B6D] tabular-nums">
            <span>
              <strong className="text-[#0F1F21] font-semibold">{enrolledCount}</strong> Chosen
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-[#0D4E52] font-semibold">
                {totalCredits.toFixed(1)}
              </strong>{' '}
              Credits
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectDepartment(null)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#EEF4F4] hover:bg-[#DFE8E8] text-[#0D4E52] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Department</span>
          </button>
        </div>
      </div>

      {/* 3-Digit Subject Code & Filter Controls */}
      <div className="bg-white rounded-3xl border border-[#E7EFEF] p-4 md:p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Hash className="w-4 h-4 text-[#0D4E52] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={codeDigits}
              onChange={(e) =>
                setCodeDigits(e.target.value.replace(/\D/g, '').slice(0, 3))
              }
              placeholder={`Enter 3-digit subject code (${exampleRange})`}
              aria-label="Enter 3-digit subject code"
              className="w-full h-11 pl-10 pr-14 rounded-xl bg-[#F2F5F5] border border-[#E2E9E9] font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-xs placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
            />
            {codeDigits && (
              <button
                type="button"
                onClick={() => setCodeDigits('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#5A6B6D] hover:text-[#0F1F21] px-1.5 py-1"
              >
                Clear
              </button>
            )}
          </div>

          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-[#6A7A7C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by title or professor..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F2F5F5] border border-[#E2E9E9] text-sm text-[#0F1F21] placeholder:text-xs placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAEFEF] justify-self-start md:justify-self-end">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'enrolled', label: 'Chosen' },
                { id: 'available', label: 'Available' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-[#0D4E52] text-white shadow-sm'
                    : 'text-[#4A5B5D] hover:text-[#0F1F21]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isBusiness && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-[#5A6B6D]">Track:</span>
            {(['ALL', 'BBA', 'MBA'] as const).map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setBusinessTrack(track)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  businessTrack === track
                    ? 'bg-[#0D4E52] text-white'
                    : 'bg-[#EEF4F4] text-[#495B5D] hover:bg-[#DFE8E8]'
                }`}
              >
                {track === 'ALL'
                  ? `All Business (${departmentCourses.length})`
                  : track === 'BBA'
                  ? `BBA 100–135 (${departmentCourses.filter((c) => c.trackPrefix === 'BBA').length})`
                  : `MBA 660–700 (${departmentCourses.filter((c) => c.trackPrefix === 'MBA').length})`}
              </button>
            ))}
          </div>
        )}

        {outOfRangeNotice && (
          <div className="rounded-xl bg-[#FEF3C7]/70 border border-[#FDE68A] px-3.5 py-2.5 text-xs font-medium text-[#92400E] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{outOfRangeNotice}</span>
          </div>
        )}
      </div>

      {/* Course Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E7EFEF] p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-[#0D4E52] mx-auto opacity-70" />
          <h2 className="font-serif font-semibold text-lg text-[#0F1F21]">
            {departmentCourses.length === 0
              ? `No faculty-booked classes in ${spec.shortLabel} yet`
              : `No matching ${spec.shortLabel} booked classes`}
          </h2>
          <p className="text-xs text-[#5A6B6D]">
            {departmentCourses.length === 0
              ? 'Only classes booked by faculty for your chosen department and subject code appear here.'
              : `Enter a booked 3-digit subject code within ${spec.rangeSummary} or clear the active filter.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((course) => (
            <article
              key={course.id}
              className="bg-white rounded-3xl border border-[#E7EFEF] p-5 flex flex-col justify-between gap-4 shadow-[0_6px_24px_-14px_rgba(13,78,82,0.08)]"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#5A6B6D] tabular-nums">
                      {course.code} · {course.department} · {course.credits.toFixed(1)} Credits
                    </p>
                    <h2 className="font-serif font-bold text-[18px] text-[#0F1F21] mt-0.5">
                      {course.title}
                    </h2>
                  </div>

                  <span className="w-11 h-10 rounded-xl bg-[#B9F2F7] text-[#0D4E52] font-mono text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    {course.threeDigitCode || course.code.split('-')[1]}
                  </span>
                </div>

                <p className="text-xs text-[#5A6B6D] leading-relaxed">
                  {course.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#EFF3F3] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F1F21] truncate">
                    {course.instructor}
                  </p>
                  <p className="text-[11px] text-[#5A6B6D] flex items-center gap-1.5 mt-0.5 truncate">
                    <span>{course.scheduleSummary}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users className="w-3 h-3" />
                      {course.seatsLeft} seats
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleEnroll(course.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    course.enrolled
                      ? 'bg-[#E4F5F6] text-[#0D4E52] hover:bg-[#D1EDF0]'
                      : 'bg-[#0D4E52] text-white hover:bg-[#093B3E]'
                  }`}
                >
                  {course.enrolled ? (
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
