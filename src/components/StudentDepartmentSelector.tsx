import React, { useState } from 'react';
import { ArrowRight, Building2, GraduationCap, Loader2 } from 'lucide-react';
import { FACULTY_DEPARTMENTS } from '../data/mockAcademicData';
import type { FacultyDepartment, UserProfile } from '../types';
import { DEPARTMENT_COURSE_SPECS } from '../utils/subjectValidation';

interface StudentDepartmentSelectorProps {
  profile: UserProfile;
  bookedCountsByDepartment?: Record<string, number>;
  onSelectDepartment: (department: FacultyDepartment) => Promise<void>;
}

export const StudentDepartmentSelector: React.FC<StudentDepartmentSelectorProps> = ({
  profile,
  bookedCountsByDepartment,
  onSelectDepartment,
}) => {
  const [selecting, setSelecting] = useState<FacultyDepartment | null>(null);

  const handleChoose = async (dept: FacultyDepartment) => {
    setSelecting(dept);
    try {
      await onSelectDepartment(dept);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-24 md:py-10 space-y-6">
      <div className="rounded-2xl bg-[#0D4E52] text-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs text-[#BCE6E9] truncate">
            {profile.fullName} ·{' '}
            <span className="font-mono tabular-nums">
              ID {profile.registrationNumber}
            </span>{' '}
            · Section {profile.section} · {profile.year}
          </p>
          <h1 className="font-serif font-bold text-xl md:text-2xl text-white mt-0.5">
            Select Your Department
          </h1>
        </div>
        <GraduationCap className="w-7 h-7 text-[#B9F2F7] shrink-0" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-[#5A6B6D]">
          Choose your academic department to view classes booked by faculty and select your subjects.
        </p>
        <span className="text-xs font-medium text-[#5A6B6D] tabular-nums whitespace-nowrap">
          8 Departments Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FACULTY_DEPARTMENTS.map((dept) => {
          const spec = DEPARTMENT_COURSE_SPECS[dept.name];
          const isBusy = selecting === dept.name;
          const bookedCount = bookedCountsByDepartment?.[dept.name] ?? 0;
          return (
            <button
              key={dept.name}
              type="button"
              disabled={selecting !== null}
              onClick={() => handleChoose(dept.name)}
              className="text-left bg-white rounded-2xl border border-[#E7EFEF] p-5 hover:border-[#0D4E52] hover:shadow-md transition-all group flex flex-col justify-between gap-4 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-10 h-10 rounded-xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center shrink-0 group-hover:bg-[#0D4E52] group-hover:text-white transition-colors">
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#0D4E52] tabular-nums">
                    {bookedCount} Booked
                  </span>
                </div>

                <div>
                  <h2 className="font-serif font-bold text-[17px] text-[#0F1F21] leading-snug">
                    {spec.shortLabel}
                  </h2>
                  <p className="text-xs text-[#5A6B6D] mt-0.5">
                    {dept.name}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EFF3F3] flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-[#0D4E52] tabular-nums truncate">
                  {spec.rangeSummary}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5A6B6D] group-hover:text-[#0D4E52] group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
