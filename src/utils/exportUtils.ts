import { DayKey, DaySchedule } from '../types';

const DAY_OFFSETS: Record<DayKey, string> = {
  Mon: '20241021',
  Tue: '20241022',
  Wed: '20241023',
  Thu: '20241024',
  Fri: '20241025',
  Sat: '20241026',
};

function to24HourICS(timeStr: string, periodIndex: number): string {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return '090000';
  let hh = parseInt(match[1], 10);
  const mm = match[2];
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hh < 12) {
    hh += 12;
  } else if (meridiem === 'AM' && hh === 12) {
    hh = 0;
  } else if (!meridiem && hh >= 1 && hh <= 6 && periodIndex >= 2) {
    hh += 12;
  }
  return `${String(hh).padStart(2, '0')}${mm}00`;
}

export function downloadWeeklyICS(
  weeklySchedule: Record<DayKey, DaySchedule>,
  studentName: string
): void {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChronoPlan//Academic Timetable//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:ChronoPlan — ${studentName}`,
  ];

  (Object.keys(weeklySchedule) as DayKey[]).forEach((dayKey) => {
    const daySchedule = weeklySchedule[dayKey];
    const dateStamp = DAY_OFFSETS[dayKey];

    daySchedule.periods.forEach((period, idx) => {
      const dtStart = `${dateStamp}T${to24HourICS(period.startTime, idx)}`;
      const dtEnd = `${dateStamp}T${to24HourICS(period.endTime, idx)}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${period.id}@chronoplan.edu`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${period.courseCode}: ${period.title}`,
        `LOCATION:${period.room}`,
        `DESCRIPTION:Instructor: ${period.instructor}\\nTopic: ${period.topic}`,
        'END:VEVENT'
      );
    });
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ChronoPlan_${studentName.replace(/\s+/g, '_')}_Timetable.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
