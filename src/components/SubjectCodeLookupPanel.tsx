import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import type { Course, FacultyDepartment } from '../types';
import {
  DEPARTMENT_COURSE_SPECS,
  padThreeDigits,
  resolveThreeDigitSubjectCode,
} from '../utils/subjectValidation';

interface SubjectCodeLookupPanelProps {
  department: FacultyDepartment;
  courses: Course[];
  onToggleEnroll: (courseId: string) => void;
  defaultExpanded?: boolean;
}

export const SubjectCodeLookupPanel: React.FC<SubjectCodeLookupPanelProps> = ({
  department,
  courses,
  onToggleEnroll,
  defaultExpanded = false,
}) => {
  const [threeDigitInput, setThreeDigitInput] = useState('');
  const [businessTrack, setBusinessTrack] = useState<'ALL' | 'BBA' | 'MBA'>('ALL');
  const [browseAll, setBrowseAll] = useState(defaultExpanded);

  const spec = DEPARTMENT_COURSE_SPECS[department];
  const isBusiness = department === 'Business department';

  const departmentCourses = useMemo(
    () => courses.filter((c) => c.department === department),
    [courses, department]
  );

  const trackFiltered = useMemo(() => {
    if (!isBusiness || businessTrack === 'ALL') return departmentCourses;
    return departmentCourses.filter((c) => c.trackPrefix === businessTrack);
  }, [departmentCourses, isBusiness, businessTrack]);

  const matchingCourses = useMemo(() => {
    const q = threeDigitInput.trim();
    if (!q) {
      return browseAll ? trackFiltered : [];
    }
    return trackFiltered.filter((c) => {
      const three = c.threeDigitCode || c.code.split('-')[1] || '';
      return three.startsWith(q) || three.includes(q);
    });
  }, [trackFiltered, threeDigitInput, browseAll]);

  const outOfRangeNotice = useMemo(() => {
    const q = threeDigitInput.trim();
    if (q.length !== 3) return null;
    const preferred =
      isBusiness && businessTrack !== 'ALL' ? businessTrack : undefined;
    const res = resolveThreeDigitSubjectCode(department, q, preferred);
    return res.valid ? null : res.error || 'No course matches that 3-digit code.';
  }, [department, threeDigitInput, isBusiness, businessTrack]);

  const placeholderExample = spec.tracks
    .map((t) => `${padThreeDigits(t.min)}–${padThreeDigits(t.max)}`)
    .join(' or ');

  return (
    <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-[19px] text-[#0F1F21] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0D4E52] shrink-0" />
            <span>Enter 3-Digit Subject Code</span>
          </h2>
          <p className="text-xs text-[#5A6B6D] mt-0.5">
            {spec.shortLabel} booked classes ({spec.rangeSummary}) · Only classes booked by faculty appear here
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBrowseAll((prev) => !prev)}
          className="self-start sm:self-auto min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#EEF4F4] hover:bg-[#E1ECEC] text-[#0D4E52] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <span>
            {browseAll
              ? 'Hide Booked List'
              : `Browse Booked (${departmentCourses.length})`}
          </span>
          {browseAll ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#6A7A7C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={threeDigitInput}
            onChange={(e) =>
              setThreeDigitInput(e.target.value.replace(/\D/g, '').slice(0, 3))
            }
            placeholder={`Enter 3-digit code (e.g. ${placeholderExample})`}
            aria-label="3-digit subject code"
            className="w-full h-11 pl-10 pr-16 rounded-xl bg-[#F2F5F5] border border-[#E2E9E9] font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-xs placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
          />
          {threeDigitInput && (
            <button
              type="button"
              onClick={() => setThreeDigitInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#5A6B6D] hover:text-[#0F1F21] px-2 py-1 rounded-md"
            >
              Clear
            </button>
          )}
        </div>

        {isBusiness && (
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAEFEF] self-start">
            {(['ALL', 'BBA', 'MBA'] as const).map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => setBusinessTrack(track)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  businessTrack === track
                    ? 'bg-[#0D4E52] text-white shadow-sm'
                    : 'text-[#4A5B5D] hover:text-[#0F1F21]'
                }`}
              >
                {track === 'ALL'
                  ? 'All Business'
                  : track === 'BBA'
                  ? 'BBA (100–135)'
                  : 'MBA (660–700)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {outOfRangeNotice && (
        <div className="rounded-xl bg-[#FEF3C7]/70 border border-[#FDE68A] px-3.5 py-2.5 text-xs font-medium text-[#92400E] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{outOfRangeNotice}</span>
        </div>
      )}

      {departmentCourses.length === 0 ? (
        <div className="rounded-2xl bg-[#F7FAFA] border border-[#E7EFEF] px-4 py-4 text-xs text-[#5A6B6D] leading-relaxed">
          No classes have been booked by faculty in{' '}
          <strong className="text-[#0F1F21]">{department}</strong> yet. A class will show here only after an instructor books a classroom for that subject and subject code.
        </div>
      ) : threeDigitInput.trim().length > 0 || browseAll ? (
        matchingCourses.length === 0 ? (
          <p className="text-xs text-[#5A6B6D] py-3">
            No faculty has booked a class for subject code{' '}
            <span className="font-mono font-semibold text-[#0F1F21]">
              {threeDigitInput}
            </span>{' '}
            in {spec.shortLabel} yet. Only classes booked by faculty for this department are shown.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#5A6B6D]">
              <span className="tabular-nums">
                Showing <strong className="text-[#0F1F21]">{matchingCourses.length}</strong>{' '}
                matching subject{matchingCourses.length === 1 ? '' : 's'}
              </span>
              <span>Select the subject that belongs to your schedule</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {matchingCourses.map((course) => (
                <div
                  key={course.id}
                  className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    course.enrolled
                      ? 'bg-[#F0F9FA] border-[#9CD8DE]'
                      : 'bg-[#FAFBFB] border-[#E7EFEF]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="px-2.5 h-11 rounded-xl bg-[#B9F2F7] text-[#0D4E52] font-mono text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {course.code}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-serif font-semibold text-sm text-[#0F1F21] truncate">
                        {course.title}
                      </h3>
                      <p className="text-[11px] text-[#5A6B6D] truncate mt-0.5 tabular-nums">
                        {course.instructor} · {course.scheduleSummary} ·{' '}
                        {course.credits.toFixed(1)} Cr
                      </p>
                      <p className="text-[11px] text-[#6A7A7C] truncate tabular-nums">
                        {course.room} ·{' '}
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 inline" />
                          {course.seatsLeft} seats
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleEnroll(course.id)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      course.enrolled
                        ? 'bg-[#0D4E52] text-white hover:bg-[#093B3E]'
                        : 'bg-[#E4F5F6] text-[#0D4E52] hover:bg-[#CBECEF]'
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
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl bg-[#F7FAFA] border border-[#E7EFEF] px-4 py-3.5 text-xs text-[#5A6B6D]">
          Type a 3-digit subject code above (for example{' '}
          <span className="font-mono font-semibold text-[#0D4E52]">
            {departmentCourses[0]?.threeDigitCode || padThreeDigits(spec.tracks[0].min)}
          </span>
          ) or click <strong className="text-[#0F1F21]">Browse Booked</strong> to view classes booked by faculty in{' '}
          <strong className="text-[#0F1F21]">{department}</strong>.
        </div>
      )}
    </div>
  );
};
