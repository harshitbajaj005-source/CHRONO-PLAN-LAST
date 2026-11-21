import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ConflictsView } from './components/ConflictsView';
import { CoursesView } from './components/CoursesView';
import { InstructorRoomView } from './components/InstructorRoomView';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { PeriodDetailModal } from './components/PeriodDetailModal';
import { PortalWelcomeView } from './components/PortalWelcomeView';
import { ProfileView } from './components/ProfileView';
import { StudentScheduleView } from './components/StudentScheduleView';
import { SupportModal } from './components/SupportModal';
import { TimetableResolverView } from './components/TimetableResolverView';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_STUDENT_PROFILE,
  INITIAL_NOTIFICATIONS,
  WEEKLY_SCHEDULE,
} from './data/mockAcademicData';
import {
  fetchStudentDashboard,
  loginWithApi,
  logoutWithApi,
  selectFacultyDepartmentApi,
  selectStudentDepartmentApi,
  toggleStudentCourseApi,
  updateStudentProfileApi,
  type LoginPayload,
} from './services/api';
import type {
  ActiveTab,
  ApiAuthSession,
  AppNotification,
  Course,
  DayKey,
  DaySchedule,
  FacultyDepartment,
  FacultySubjectAssignment,
  ScheduleConflict,
  SchedulePeriod,
  UserProfile,
} from './types';

export default function App() {
  // Auth session kept strictly in React memory (never localStorage)
  const [session, setSession] = useState<ApiAuthSession | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('schedule');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_STUDENT_PROFILE);
  const [weeklySchedule, setWeeklySchedule] =
    useState<Record<DayKey, DaySchedule>>(WEEKLY_SCHEDULE);
  const [courses, setCourses] = useState<Course[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [totalCredits, setTotalCredits] = useState<number>(0);
  const [facultySubjects, setFacultySubjects] = useState<
    FacultySubjectAssignment[]
  >([]);
  const [bookedCountsByDepartment, setBookedCountsByDepartment] = useState<
    Record<string, number>
  >({});
  const [notifications, setNotifications] =
    useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(null);

  const isSignedIn = session !== null;
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!selectedPeriod) return;
    for (const day of Object.keys(weeklySchedule) as DayKey[]) {
      const found = weeklySchedule[day].periods.find((p) => p.id === selectedPeriod.id);
      if (found) {
        setSelectedPeriod(found);
        break;
      }
    }
  }, [weeklySchedule, selectedPeriod]);

  const loadStudentDashboard = async (activeSession: ApiAuthSession) => {
    const data = await fetchStudentDashboard(activeSession);
    setProfile(data.profile);
    setCourses(data.courses);
    setConflicts(data.conflicts);
    setTotalCredits(data.totalCredits);
    setFacultySubjects(data.facultySubjects);
    if (data.bookedCountsByDepartment) {
      setBookedCountsByDepartment(data.bookedCountsByDepartment);
    }
  };

  const handleLogin = async (payload: LoginPayload) => {
    const nextSession = await loginWithApi(payload);
    setSession(nextSession);
    setProfile(nextSession.profile);
    setAuthNotice(null);
    setActiveTab('schedule');

    if (nextSession.role === 'student') {
      await loadStudentDashboard(nextSession);
    }
  };

  const handleSelectTab = async (tab: ActiveTab) => {
    if (!session) {
      setAuthNotice('Please sign in with your Student or Faculty credentials first.');
      return;
    }
    // Faculty & Admin never access student Courses or Conflicts
    if (
      (session.role === 'faculty' || session.role === 'admin') &&
      (tab === 'courses' || tab === 'conflicts')
    ) {
      setActiveTab('schedule');
      return;
    }
    setAuthNotice(null);
    setActiveTab(tab);

    if (session.role === 'student' && (tab === 'schedule' || tab === 'courses' || tab === 'conflicts')) {
      await loadStudentDashboard(session);
    }
  };

  const handleSignOut = async () => {
    if (session) {
      try {
        await logoutWithApi(session);
      } catch {
        // Ignore logout network error during sign-out cleanup
      }
    }
    setSession(null);
    setAuthNotice(null);
    setCourses([]);
    setConflicts([]);
    setTotalCredits(0);
    setFacultySubjects([]);
    setBookedCountsByDepartment({});
    setActiveTab('schedule');
  };

  const handleSelectStudentDepartment = async (dept: FacultyDepartment | null) => {
    if (!session || session.role !== 'student') return;
    const res = await selectStudentDepartmentApi(session, dept);
    setProfile(res.profile);
    setSession({ ...session, profile: res.profile });
    setCourses(res.courses);
    setConflicts(res.conflicts);
    setTotalCredits(res.totalCredits);
    setFacultySubjects(res.facultySubjects);
    if (res.bookedCountsByDepartment) {
      setBookedCountsByDepartment(res.bookedCountsByDepartment);
    }
  };

  const handleSelectFacultyDepartment = async (dept: FacultyDepartment | null) => {
    if (!session || session.role !== 'faculty') return;
    const res = await selectFacultyDepartmentApi(session, dept);
    setProfile(res.profile);
    setSession({ ...session, profile: res.profile });
  };

  const handleTogglePeriodReminder = (day: DayKey, periodId: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        periods: prev[day].periods.map((p) =>
          p.id === periodId ? { ...p, reminderEnabled: !p.reminderEnabled } : p
        ),
      },
    }));
  };

  const handleToggleAttendance = (periodId: string) => {
    setWeeklySchedule((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DayKey[]).forEach((day) => {
        next[day] = {
          ...next[day],
          periods: next[day].periods.map((p) =>
            p.id === periodId ? { ...p, attended: !p.attended } : p
          ),
        };
      });
      return next;
    });
  };

  const handleToggleEnrollCourse = async (courseId: string) => {
    if (!session || session.role !== 'student') return;
    const data = await toggleStudentCourseApi(session, courseId);
    setCourses(data.courses);
    setConflicts(data.conflicts);
    setTotalCredits(data.totalCredits);
  };

  const handleResolveConflict = async (conflict: ScheduleConflict) => {
    if (!session || session.role !== 'student' || !conflict.affectedCourseId) return;
    const data = await toggleStudentCourseApi(session, conflict.affectedCourseId);
    setCourses(data.courses);
    setConflicts(data.conflicts);
    setTotalCredits(data.totalCredits);
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Schedule Conflict Resolved',
        detail: 'Timetable restored to 100% conflict-free status.',
        time: 'Just now',
        read: false,
        category: 'system',
      },
      ...prev,
    ]);
  };

  const handleRunConflictAudit = () => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title:
          conflicts.length === 0
            ? 'Smart Engine Audit Passed'
            : `${conflicts.length} Conflict Flagged`,
        detail:
          conflicts.length === 0
            ? `Verified ${totalCredits.toFixed(1)} credits across 5 weekdays with zero overlaps.`
            : 'Open Conflicts tab to review and auto-resolve overlapping slots.',
        time: 'Just now',
        read: false,
        category: 'system',
      },
      ...prev,
    ]);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!session) return;
    if (session.role === 'student') {
      const res = await updateStudentProfileApi(session, {
        fullName: updates.fullName || profile.fullName,
        section: updates.section || profile.section,
        year: updates.year || profile.year,
        email: updates.email || profile.email,
        studentDepartment:
          updates.studentDepartment !== undefined
            ? updates.studentDepartment
            : profile.studentDepartment,
      });
      setProfile(res.profile);
      setSession({ ...session, profile: res.profile });
      await loadStudentDashboard({ ...session, profile: res.profile });
    } else if (updates.facultyDepartment !== undefined) {
      await handleSelectFacultyDepartment(updates.facultyDepartment);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8F8] text-[#0F1F21]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isSignedIn={isSignedIn}
        userRole={profile.role}
        unreadCount={unreadCount}
        conflictCount={conflicts.length}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onSignOut={handleSignOut}
        onOpenPortal={() => setSession(null)}
      />

      <main className="flex-1">
        {!session ? (
          <PortalWelcomeView
            defaultRole={profile.role}
            authNotice={authNotice}
            onLogin={handleLogin}
            onOpenSupport={() => setSupportOpen(true)}
          />
        ) : activeTab === 'schedule' ? (
          session.role === 'student' ? (
            <StudentScheduleView
              profile={profile}
              courses={courses}
              weeklySchedule={weeklySchedule}
              facultySubjects={facultySubjects}
              bookedCountsByDepartment={bookedCountsByDepartment}
              totalCredits={totalCredits}
              conflictCount={conflicts.length}
              onSelectDepartment={handleSelectStudentDepartment}
              onToggleEnroll={handleToggleEnrollCourse}
              onSelectPeriod={(p) => setSelectedPeriod(p)}
              onTogglePeriodReminder={handleTogglePeriodReminder}
              onNavigateConflicts={() => handleSelectTab('conflicts')}
            />
          ) : session.role === 'admin' ? (
            <TimetableResolverView session={session} />
          ) : (
            <InstructorRoomView
              session={session}
              profile={profile}
              onSelectDepartment={handleSelectFacultyDepartment}
            />
          )
        ) : activeTab === 'courses' && session.role === 'student' ? (
          <CoursesView
            profile={profile}
            courses={courses}
            bookedCountsByDepartment={bookedCountsByDepartment}
            onSelectDepartment={handleSelectStudentDepartment}
            onToggleEnroll={handleToggleEnrollCourse}
          />
        ) : activeTab === 'conflicts' && session.role === 'student' ? (
          <ConflictsView
            conflicts={conflicts}
            onResolveConflict={handleResolveConflict}
            onSimulateConflictCheck={handleRunConflictAudit}
            onOpenCourses={() => handleSelectTab('courses')}
          />
        ) : (
          <ProfileView
            profile={profile}
            reservations={[]}
            onUpdateProfile={handleUpdateProfile}
            onReturnToPortal={handleSignOut}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isSignedIn={isSignedIn}
        userRole={profile.role}
        conflictCount={conflicts.length}
      />

      <NotificationsDrawer
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        onMarkRead={(id) =>
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
          )
        }
      />

      <SupportModal
        open={supportOpen}
        defaultEmail={profile.email}
        onClose={() => setSupportOpen(false)}
      />

      <PeriodDetailModal
        period={selectedPeriod}
        onClose={() => setSelectedPeriod(null)}
        onToggleReminder={(periodId) => {
          (Object.keys(weeklySchedule) as DayKey[]).forEach((day) => {
            if (weeklySchedule[day].periods.some((p) => p.id === periodId)) {
              handleTogglePeriodReminder(day, periodId);
            }
          });
        }}
        onToggleAttendance={handleToggleAttendance}
      />
    </div>
  );
}
