import React from 'react';
import { BookOpen, CalendarDays, ShieldCheck, User } from 'lucide-react';
import { ActiveTab, UserRole } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isSignedIn: boolean;
  userRole: UserRole;
  conflictCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  isSignedIn,
  userRole,
  conflictCount,
}) => {
  const isStaff = isSignedIn && (userRole === 'faculty' || userRole === 'admin');

  const items: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = isStaff
    ? [
        { id: 'schedule', label: 'Schedule', icon: CalendarDays },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : [
        { id: 'schedule', label: 'Schedule', icon: CalendarDays },
        { id: 'courses', label: 'Courses', icon: BookOpen },
        { id: 'conflicts', label: 'Conflicts', icon: ShieldCheck },
        { id: 'profile', label: 'Profile', icon: User },
      ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6ECEC] no-print"
    >
      <div
        className={`grid items-center h-16 px-2 ${
          isStaff ? 'grid-cols-2' : 'grid-cols-4'
        }`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] ${
                isActive ? 'text-[#0D4E52]' : 'text-[#6A7A7C] hover:text-[#0F1F21]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.75} />
                {item.id === 'conflicts' && conflictCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#B45309] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {conflictCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] leading-none whitespace-nowrap ${
                  isActive ? 'font-semibold text-[#0D4E52]' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
