import React from 'react';
import { Bell, BellOff, BookOpen, CheckCircle2, Clock, MapPin, UserCheck, X } from 'lucide-react';
import { SchedulePeriod } from '../types';

interface PeriodDetailModalProps {
  period: SchedulePeriod | null;
  onClose: () => void;
  onToggleReminder: (periodId: string) => void;
  onToggleAttendance: (periodId: string) => void;
}

export const PeriodDetailModal: React.FC<PeriodDetailModalProps> = ({
  period,
  onClose,
  onToggleReminder,
  onToggleAttendance,
}) => {
  if (!period) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={period.title}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-[#E6ECEC] p-6 space-y-5">
        <div className="w-10 h-1.5 bg-[#D8E0E0] rounded-full mx-auto md:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#B9F2F7] text-[#0D4E52] flex flex-col items-center justify-center shrink-0">
              <span className="text-xs font-bold leading-none">{period.periodCode}</span>
              <span className="text-[11px] font-mono tabular-nums mt-1 leading-none">
                {period.startTime}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-[#5A6B6D]">
                {period.courseCode} · {period.credits.toFixed(1)} Credits
              </p>
              <h2 className="font-serif font-semibold text-xl text-[#0F1F21] leading-snug mt-0.5">
                {period.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session details"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5A6B6D] hover:bg-[#F1F5F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#F6F8F8] rounded-2xl p-4 space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5 text-[#0F1F21]">
            <Clock className="w-4 h-4 text-[#0D4E52] shrink-0" />
            <span className="tabular-nums font-medium">
              {period.startTime} – {period.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[#0F1F21]">
            <MapPin className="w-4 h-4 text-[#0D4E52] shrink-0" />
            <span>
              {period.room} · {period.instructor}
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-[#5A6B6D]">
            <BookOpen className="w-4 h-4 text-[#0D4E52] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#0F1F21] font-medium">Today&apos;s Topic:</strong>{' '}
              {period.topic}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onToggleReminder(period.id)}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              period.reminderEnabled
                ? 'bg-[#E4F5F6] text-[#0D4E52] border border-[#B9E2E5]'
                : 'bg-[#F3F6F6] text-[#415355] hover:bg-[#E9EFEF]'
            }`}
          >
            {period.reminderEnabled ? (
              <>
                <Bell className="w-4 h-4" />
                Reminder Active
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4" />
                Set Reminder
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onToggleAttendance(period.id)}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              period.attended
                ? 'bg-[#0D4E52] text-white'
                : 'bg-[#0D4E52] text-white hover:bg-[#093B3E]'
            }`}
          >
            {period.attended ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Marked Present
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                Check In
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
