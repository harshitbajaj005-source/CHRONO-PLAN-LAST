import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ScheduleConflict } from '../types';

interface ConflictsViewProps {
  conflicts: ScheduleConflict[];
  onResolveConflict: (conflict: ScheduleConflict) => void;
  onSimulateConflictCheck: () => void;
  onOpenCourses: () => void;
}

export const ConflictsView: React.FC<ConflictsViewProps> = ({
  conflicts,
  onResolveConflict,
  onSimulateConflictCheck,
  onOpenCourses,
}) => {
  const activeConflicts = conflicts.filter((c) => c.severity === 'action-required');

  const audits = [
    {
      title: 'Period Time-Slot Integrity',
      detail:
        activeConflicts.length === 0
          ? 'No overlapping lecture or laboratory hours across Mon–Fri.'
          : `${activeConflicts.length} overlapping time-slot collision detected.`,
      ok: activeConflicts.length === 0,
    },
    {
      title: 'Campus Room Transitions',
      detail: 'Minimum 15-minute walking buffer preserved between academic wings.',
      ok: true,
    },
    {
      title: 'Instructor Availability Lock',
      detail: 'All assigned faculty timetables and seminar bookings synchronized.',
      ok: true,
    },
    {
      title: 'Credit Load Boundaries',
      detail: 'Enrolled semester credit load falls cleanly within 15.0–22.0 guidelines.',
      ok: true,
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5A6B6D]">
            Smart Conflict Engine · Real-Time Verification
          </p>
          <h1 className="font-serif font-bold text-[26px] md:text-[32px] leading-tight text-[#0F1F21] mt-0.5">
            Schedule Conflicts
          </h1>
        </div>

        <button
          type="button"
          onClick={onSimulateConflictCheck}
          className="self-start sm:self-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#EAEFEF] hover:bg-[#DCE5E5] text-[#0F1F21] text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-[#0D4E52]" />
          <span>Run Full Audit</span>
        </button>
      </div>

      {/* Hero Verification Summary */}
      <div
        className={`rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border ${
          activeConflicts.length === 0
            ? 'bg-[#0D4E52] text-white border-[#0D4E52]'
            : 'bg-[#FFFBEB] text-[#78350F] border-[#FDE68A]'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              activeConflicts.length === 0
                ? 'bg-[#1D676C] text-[#B9F2F7]'
                : 'bg-[#FEF3C7] text-[#B45309]'
            }`}
          >
            {activeConflicts.length === 0 ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl leading-snug">
              {activeConflicts.length === 0
                ? 'All Clear & Optimized'
                : `${activeConflicts.length} Schedule Collision${
                    activeConflicts.length > 1 ? 's' : ''
                  } Detected`}
            </h2>
            <p
              className={`text-xs md:text-sm mt-1 max-w-xl leading-relaxed ${
                activeConflicts.length === 0 ? 'text-[#CFE5E6]' : 'text-[#92400E]'
              }`}
            >
              {activeConflicts.length === 0
                ? 'Every enrolled course, laboratory block, and reserved room fits cleanly into your weekly academic timeline with zero overlaps.'
                : 'Enrolling in multiple sessions at the same hour creates an attendance conflict. Use auto-resolve below to restore a clean timetable.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCourses}
          className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            activeConflicts.length === 0
              ? 'bg-white text-[#0D4E52] hover:bg-[#E4F5F6]'
              : 'bg-[#0D4E52] text-white hover:bg-[#093B3E]'
          }`}
        >
          <span>Manage Courses</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Active Conflict Action Cards */}
      {activeConflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif font-bold text-lg text-[#0F1F21]">
            Action Required
          </h3>
          {activeConflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="bg-white rounded-2xl border border-[#F5D0A9] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#0F1F21]">{conflict.title}</p>
                <p className="text-xs text-[#5A6B6D] leading-relaxed">
                  {conflict.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onResolveConflict(conflict)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold whitespace-nowrap shrink-0"
              >
                {conflict.suggestedActionLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 4-Point Diagnostic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {audits.map((item) => (
          <div
            key={item.title}
            className="bg-white rounded-2xl border border-[#E7EFEF] p-5 flex items-start gap-3.5"
          >
            <span
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                item.ok
                  ? 'bg-[#E4F5F6] text-[#0D4E52]'
                  : 'bg-[#FEF3C7] text-[#B45309]'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <CalendarCheck className="w-5 h-5" />
              )}
            </span>
            <div>
              <h3 className="font-serif font-semibold text-base text-[#0F1F21]">
                {item.title}
              </h3>
              <p className="text-xs text-[#5A6B6D] mt-1 leading-relaxed">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
