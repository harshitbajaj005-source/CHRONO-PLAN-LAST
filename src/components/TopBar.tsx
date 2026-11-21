import React from 'react';
import { Bell, CalendarDays, LogOut, User } from 'lucide-react';
import { ActiveTab, UserRole } from '../types';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isSignedIn: boolean;
  userRole: UserRole;
  unreadCount: number;
  conflictCount: number;
  onOpenNotifications: () => void;
  onSignOut: () => void;
  onOpenPortal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isSignedIn,
  userRole,
  unreadCount,
  conflictCount,
  onOpenNotifications,
  onSignOut,
  onOpenPortal,
}) => {
  const mobileTitle = !isSignedIn
    ? 'Schedule'
    : activeTab === 'schedule'
    ? 'Schedule'
    : activeTab === 'courses'
    ? 'Courses'
    : activeTab === 'conflicts'
    ? 'Conflicts'
    : 'Profile';

  // Faculty and Admin do not see student Courses or Conflicts tabs
  const navItems: { id: ActiveTab; label: string }[] =
    isSignedIn && (userRole === 'faculty' || userRole === 'admin')
      ? [
          { id: 'schedule', label: 'Schedule' },
          { id: 'profile', label: 'Profile' },
        ]
      : [
          { id: 'schedule', label: 'Schedule' },
          { id: 'courses', label: 'Courses' },
          {
            id: 'conflicts',
            label: conflictCount > 0 ? `Conflicts (${conflictCount})` : 'Conflicts',
          },
          { id: 'profile', label: 'Profile' },
        ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E6ECEC] no-print">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand / Mobile Section Title */}
        <button
          type="button"
          onClick={() => {
            if (!isSignedIn) {
              onOpenPortal();
            } else {
              onSelectTab('schedule');
            }
          }}
          className="flex items-center gap-2.5 text-left min-h-[44px] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] rounded-lg px-1"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E4F5F6] text-[#0D4E52] shrink-0">
            <CalendarDays className="w-[18px] h-[18px]" strokeWidth={2} />
          </span>
          <span className="flex flex-col leading-tight md:hidden">
            <span className="font-serif font-semibold text-[16px] text-[#0F1F21] whitespace-nowrap">
              {mobileTitle}
            </span>
            {isSignedIn && userRole === 'faculty' && activeTab === 'schedule' && (
              <span className="text-[11px] text-[#5A6B6D] whitespace-nowrap">
                Instructor Portal
              </span>
            )}
          </span>
          <span className="hidden md:inline font-serif font-bold text-[19px] tracking-tight text-[#0F1F21] whitespace-nowrap">
            ChronoPlan
          </span>
        </button>

        {/* Zone 2: Desktop Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id && isSignedIn;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] rounded ${
                  active
                    ? 'text-[#0D4E52] font-semibold'
                    : 'text-[#5A6B6D] hover:text-[#0F1F21]'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-[17px] h-[2px] bg-[#0D4E52] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Utility Triggers */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Open academic notifications"
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#415355] hover:bg-[#EDF3F3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
          >
            <Bell className="w-[19px] h-[19px]" strokeWidth={1.9} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#0D4E52] ring-2 ring-white" />
            )}
          </button>

          {isSignedIn ? (
            <>
              <button
                type="button"
                onClick={onSignOut}
                className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#0D4E52] text-white text-xs font-semibold hover:bg-[#093B3E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D4E52]"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                aria-label="Open profile"
                className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none"
              >
                <span className="w-9 h-9 rounded-full bg-[#0D4E52] text-white flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4" strokeWidth={2} />
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenPortal}
              aria-label="Portal sign in"
              className="w-9 h-9 rounded-full bg-[#0D4E52] text-white flex items-center justify-center shadow-sm hover:bg-[#093B3E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
            >
              <User className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
