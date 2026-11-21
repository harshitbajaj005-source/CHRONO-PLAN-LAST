import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationsDrawerProps {
  open: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  notifications,
  onClose,
  onMarkAllRead,
  onMarkRead,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Academic notifications"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-[#E6ECEC] flex flex-col">
        <div className="px-5 py-4 border-b border-[#E6ECEC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-serif font-semibold text-lg text-[#0F1F21]">
                Academic Alerts
              </h2>
              <p className="text-xs text-[#5A6B6D]">
                Timetable updates and room confirmations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5A6B6D] hover:bg-[#F1F5F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-2.5 border-b border-[#F0F4F4] flex items-center justify-between bg-[#F9FBFB]">
          <span className="text-xs font-medium text-[#5A6B6D] tabular-nums">
            {notifications.filter((n) => !n.read).length} unread updates
          </span>
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4E52] hover:underline py-1.5 whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#EFF3F3]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#5A6B6D]">
              You are all caught up.
            </div>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onMarkRead(item.id)}
                className={`w-full text-left px-5 py-4 transition-colors hover:bg-[#F7FAFA] ${
                  item.read ? 'bg-white' : 'bg-[#F0F9FA]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#0F1F21] leading-snug">
                    {item.title}
                  </p>
                  <span className="text-[11px] text-[#6A7A7C] whitespace-nowrap shrink-0 tabular-nums">
                    {item.time}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5A6B6D] leading-relaxed">
                  {item.detail}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
