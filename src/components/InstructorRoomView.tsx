import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  Layers,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  getCoursesByDepartment,
  searchDepartmentCoursesByCode,
} from '../data/courseCatalog';
import {
  FACULTY_DEPARTMENTS,
  FLOORS_PER_BLOCK,
  formatDateKey,
  getDepartmentBlockCount,
  getTimeSlotsForDate,
  isSaturdayDateKey,
  WEEKDAY_TIME_SLOTS,
} from '../data/mockAcademicData';
import {
  cancelFacultyReservationApi,
  fetchFacultyAvailabilityApi,
  scheduleFacultySubjectApi,
  type BlockSummary,
  type RoomAvailabilityItem,
} from '../services/api';
import type {
  ApiAuthSession,
  Course,
  FacultyDepartment,
  FacultySubjectAssignment,
  RoomReservation,
  UserProfile,
} from '../types';
import {
  DEPARTMENT_COURSE_SPECS,
  padThreeDigits,
  resolveThreeDigitSubjectCode,
} from '../utils/subjectValidation';

interface InstructorRoomViewProps {
  session: ApiAuthSession;
  profile: UserProfile;
  onSelectDepartment: (department: FacultyDepartment | null) => Promise<void>;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const InstructorRoomView: React.FC<InstructorRoomViewProps> = ({
  session,
  profile,
  onSelectDepartment,
}) => {
  const selectedDepartment = profile.facultyDepartment ?? null;

  // Single-month calendar locked strictly to the current month
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentMonthLabel = useMemo(
    () =>
      today.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [today]
  );

  const monthDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(currentYear, currentMonth, d));
    }
    return cells;
  }, [currentYear, currentMonth]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return formatDateKey(d);
  });
  const [selectedSlot, setSelectedSlot] = useState<string>(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return getTimeSlotsForDate(formatDateKey(d))[0] || WEEKDAY_TIME_SLOTS[0];
  });
  const [schedulePoppedOut, setSchedulePoppedOut] = useState<boolean>(false);

  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>(1);

  // Step 2: 3-Digit Subject Code Entry & Confirmation BEFORE Place Selection
  const [threeDigitInput, setThreeDigitInput] = useState<string>('');
  const [businessTrack, setBusinessTrack] = useState<'ALL' | 'BBA' | 'MBA'>('ALL');
  const [subjectTitle, setSubjectTitle] = useState<string>('');
  const [subjectConfirmed, setSubjectConfirmed] = useState<boolean>(false);

  // Live backend availability state
  const [blockSummaries, setBlockSummaries] = useState<BlockSummary[]>([]);
  const [blockRooms, setBlockRooms] = useState<RoomAvailabilityItem[]>([]);
  const [reservations, setReservations] = useState<RoomReservation[]>([]);
  const [publishedSubjects, setPublishedSubjects] = useState<
    FacultySubjectAssignment[]
  >([]);
  const [loadingAvailability, setLoadingAvailability] = useState<boolean>(false);

  const [bookingRoom, setBookingRoom] = useState<RoomAvailabilityItem | null>(
    null
  );
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);
  const [bookingToast, setBookingToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deptSpec = selectedDepartment
    ? DEPARTMENT_COURSE_SPECS[selectedDepartment]
    : null;
  const isBusiness = selectedDepartment === 'Business department';

  const subjectValidation = useMemo(() => {
    if (!selectedDepartment) {
      return { valid: false, normalizedCode: '' };
    }
    const preferred =
      isBusiness && businessTrack !== 'ALL' ? businessTrack : undefined;
    return resolveThreeDigitSubjectCode(
      selectedDepartment,
      threeDigitInput,
      preferred
    );
  }, [selectedDepartment, threeDigitInput, isBusiness, businessTrack]);

  const matchingCatalogCourses = useMemo(() => {
    if (!selectedDepartment) return [];
    const trackFilter =
      isBusiness && businessTrack !== 'ALL' ? businessTrack : undefined;
    if (!threeDigitInput.trim()) {
      return getCoursesByDepartment(selectedDepartment)
        .filter((c) => !trackFilter || c.trackPrefix === trackFilter)
        .slice(0, 12);
    }
    return searchDepartmentCoursesByCode(
      selectedDepartment,
      threeDigitInput,
      trackFilter
    );
  }, [selectedDepartment, threeDigitInput, isBusiness, businessTrack]);

  const selectedDateDisplay = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDateKey]);

  const blockCount = selectedDepartment
    ? getDepartmentBlockCount(selectedDepartment)
    : 1;

  const availableSlotsForDate = useMemo(
    () => getTimeSlotsForDate(selectedDateKey),
    [selectedDateKey]
  );

  useEffect(() => {
    if (
      availableSlotsForDate.length > 0 &&
      !availableSlotsForDate.includes(selectedSlot)
    ) {
      setSelectedSlot(availableSlotsForDate[0]);
    }
  }, [availableSlotsForDate, selectedSlot]);

  const loadAvailability = useCallback(async () => {
    if (!selectedDepartment || availableSlotsForDate.length === 0) {
      setBlockRooms([]);
      return;
    }
    const activeSlot = availableSlotsForDate.includes(selectedSlot)
      ? selectedSlot
      : availableSlotsForDate[0];
    setLoadingAvailability(true);
    setErrorMsg(null);
    try {
      const data = await fetchFacultyAvailabilityApi(session, {
        department: selectedDepartment,
        blockNumber: selectedBlock,
        dateKey: selectedDateKey,
        timeSlot: activeSlot,
      });
      setBlockSummaries(data.blockSummaries);
      setBlockRooms(data.rooms);
      setReservations(data.reservations);
      setPublishedSubjects(data.subjects);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load room availability.'
      );
    } finally {
      setLoadingAvailability(false);
    }
  }, [
    session,
    selectedDepartment,
    selectedBlock,
    selectedDateKey,
    selectedSlot,
    availableSlotsForDate,
  ]);

  useEffect(() => {
    if (selectedDepartment) {
      loadAvailability();
    }
  }, [selectedDepartment, loadAvailability]);

  const visibleRooms = useMemo(() => {
    if (selectedFloor === 'all') return blockRooms;
    return blockRooms.filter((r) => r.floorNumber === selectedFloor);
  }, [blockRooms, selectedFloor]);

  const handleSelectCatalogCourse = (course: Course) => {
    const three = course.threeDigitCode || course.code.split('-')[1] || '';
    setThreeDigitInput(three);
    if (isBusiness && (course.trackPrefix === 'BBA' || course.trackPrefix === 'MBA')) {
      setBusinessTrack(course.trackPrefix);
    }
    setSubjectTitle(course.title);
    setErrorMsg(null);
  };

  const handleThreeDigitChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    setThreeDigitInput(digits);
    setErrorMsg(null);
    if (digits.length === 3 && selectedDepartment) {
      const preferred =
        isBusiness && businessTrack !== 'ALL' ? businessTrack : undefined;
      const check = resolveThreeDigitSubjectCode(
        selectedDepartment,
        digits,
        preferred
      );
      if (check.valid) {
        const exact = getCoursesByDepartment(selectedDepartment).find(
          (c) => c.code === check.normalizedCode
        );
        if (exact) {
          setSubjectTitle(exact.title);
        }
      }
    }
  };

  const handleProceedToPlaceSelection = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!subjectValidation.valid) {
      setErrorMsg(
        subjectValidation.error || 'Please enter a valid 3-digit subject code.'
      );
      return;
    }
    if (!subjectTitle.trim()) {
      setErrorMsg('Please select a matching subject or enter the subject title.');
      return;
    }
    setSubjectConfirmed(true);
  };

  const handleOpenBooking = (room: RoomAvailabilityItem) => {
    setErrorMsg(null);
    if (!subjectValidation.valid || !subjectTitle.trim()) {
      setSubjectConfirmed(false);
      setErrorMsg('Please confirm your 3-digit subject code first.');
      return;
    }
    setBookingRoom(room);
  };

  const handleConfirmReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom || !selectedDepartment) return;

    setSubmittingBooking(true);
    setErrorMsg(null);
    try {
      const result = await scheduleFacultySubjectApi(session, {
        department: selectedDepartment,
        blockNumber: bookingRoom.blockNumber,
        floorNumber: bookingRoom.floorNumber,
        classIndex: bookingRoom.classIndex,
        dateKey: selectedDateKey,
        timeSlot: selectedSlot,
        subjectCode: subjectValidation.normalizedCode,
        subjectTitle: subjectTitle.trim(),
      });
      setBookingToast(
        `${result.subject.subjectCode} (${result.subject.subjectTitle}) scheduled in ${result.subject.blockName} · Floor ${result.subject.floorNumber} · ${result.subject.roomName} and published to Student Dashboard.`
      );
      setBookingRoom(null);
      await loadAvailability();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to schedule subject in room.'
      );
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    setErrorMsg(null);
    try {
      await cancelFacultyReservationApi(session, reservationId);
      setBookingToast('Reservation released and removed from student schedule.');
      await loadAvailability();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to release reservation.'
      );
    }
  };

  // STEP 1: Department Selection immediately after Faculty Login
  if (!selectedDepartment) {
    return (
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-24 md:py-10 space-y-6">
        <div className="rounded-2xl bg-[#1D5B5F] text-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-xs text-[#BCE6E9]">
              {profile.fullName} ·{' '}
              <span className="font-mono">
                {profile.facultyCode} · ID {profile.registrationNumber}
              </span>
            </p>
            <h1 className="font-serif font-bold text-xl md:text-2xl text-white mt-0.5">
              Select Your Department
            </h1>
          </div>
          <Building2 className="w-7 h-7 text-[#B9F2F7] shrink-0" />
        </div>

        <p className="text-sm text-[#5A6B6D]">
          Step 1 of 3: Choose your department, then enter your 3-digit subject code before selecting a classroom for {currentMonthLabel}.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FACULTY_DEPARTMENTS.map((dept) => {
            const spec = DEPARTMENT_COURSE_SPECS[dept.name];
            return (
              <button
                key={dept.name}
                type="button"
                onClick={async () => {
                  setSelectedBlock(1);
                  setSelectedFloor(1);
                  setThreeDigitInput('');
                  setSubjectTitle('');
                  setSubjectConfirmed(false);
                  setBusinessTrack('ALL');
                  await onSelectDepartment(dept.name);
                }}
                className="text-left bg-white rounded-3xl border border-[#E7EFEF] p-5 hover:border-[#0D4E52] hover:shadow-md transition-all group flex flex-col justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#E4F5F6] text-[#0D4E52] font-serif font-bold text-base flex items-center justify-center shrink-0 group-hover:bg-[#0D4E52] group-hover:text-white transition-colors tabular-nums">
                      {dept.blocksCount}
                    </span>
                    <span className="text-[11px] font-semibold text-[#0D4E52] tabular-nums">
                      {dept.blocksCount} {dept.blocksCount === 1 ? 'Block' : 'Blocks'}
                    </span>
                  </div>

                  <h2 className="font-serif font-bold text-base text-[#0F1F21] mt-3.5">
                    {dept.name}
                  </h2>
                  <p className="text-xs text-[#5A6B6D] mt-1 tabular-nums">
                    {dept.summary}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[#EFF3F3] text-[11px] font-mono text-[#0D4E52] tabular-nums">
                  {spec.rangeSummary}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const activeBlockSummary = blockSummaries.find(
    (b) => b.blockNumber === selectedBlock
  );

  const rangeHint = deptSpec
    ? deptSpec.tracks
        .map((t) => `${padThreeDigits(t.min)}–${padThreeDigits(t.max)}`)
        .join(' or ')
    : '';

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-5">
      {/* Department Header Banner */}
      <div className="rounded-2xl bg-[#1D5B5F] text-white px-4 py-3.5 md:px-6 md:py-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs text-[#BCE6E9] truncate">
            {profile.fullName} ·{' '}
            <span className="font-mono">
              {profile.facultyCode} · ID {profile.registrationNumber}
            </span>
          </p>
          <h1 className="font-serif font-semibold text-base md:text-xl text-white truncate mt-0.5">
            {selectedDepartment}
          </h1>
          <p className="text-[11px] text-[#CFE5E6] tabular-nums mt-0.5">
            {blockCount} {blockCount === 1 ? 'Block' : 'Blocks'} · 9 Floors/Block · 10 Classes/Floor · Codes: {deptSpec?.rangeSummary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSubjectConfirmed(false);
            setThreeDigitInput('');
            setSubjectTitle('');
            onSelectDepartment(null);
          }}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Department</span>
        </button>
      </div>

      {/* 3-Step Workflow Indicator */}
      <div className="bg-white rounded-2xl border border-[#E7EFEF] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#1F7A6E] font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>1. {deptSpec?.shortLabel} Department</span>
        </div>
        <span className="text-[#CBD5D6]" aria-hidden="true">/</span>
        <div
          className={`flex items-center gap-2 font-semibold ${
            subjectConfirmed
              ? 'text-[#1F7A6E]'
              : 'text-[#0D4E52]'
          }`}
        >
          {subjectConfirmed ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <Hash className="w-4 h-4 shrink-0" />
          )}
          <span>2. Enter 3-Digit Subject Code</span>
        </div>
        <span className="text-[#CBD5D6]" aria-hidden="true">/</span>
        <div
          className={`flex items-center gap-2 font-semibold ${
            subjectConfirmed ? 'text-[#0D4E52]' : 'text-[#8C9B9D]'
          }`}
        >
          {subjectConfirmed ? (
            <Building2 className="w-4 h-4 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 shrink-0" />
          )}
          <span>3. Select Place to Teach</span>
        </div>
      </div>

      {bookingToast && (
        <div className="rounded-2xl bg-[#DCF6E8] border border-[#B3E8CB] text-[#175B3A] px-4 py-3 text-xs md:text-sm font-semibold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {bookingToast}
          </span>
          <button
            type="button"
            onClick={() => setBookingToast(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 2: Mandatory 3-Digit Subject Code Entry BEFORE Place Selection */}
      {!subjectConfirmed ? (
        <form
          onSubmit={handleProceedToPlaceSelection}
          className="bg-white rounded-3xl border border-[#E7EFEF] p-5 md:p-6 space-y-5 shadow-[0_6px_24px_-12px_rgba(13,78,82,0.08)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-serif font-bold text-lg md:text-xl text-[#0F1F21]">
                  Enter 3-Digit Subject Code
                </h2>
                <p className="text-xs text-[#5A6B6D]">
                  Required before selecting your place to teach · {deptSpec?.shortLabel} valid codes:{' '}
                  <span className="font-mono text-[#0D4E52] font-semibold">
                    {deptSpec?.rangeSummary}
                  </span>
                </p>
              </div>
            </div>

            {subjectValidation.valid && (
              <span className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-[#B9F2F7] text-[#0D4E52] font-mono text-xs font-bold whitespace-nowrap tabular-nums">
                {subjectValidation.normalizedCode}
              </span>
            )}
          </div>

          {isBusiness && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#5A6B6D]">
                Program Track:
              </span>
              {(['ALL', 'BBA', 'MBA'] as const).map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setBusinessTrack(track)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    businessTrack === track
                      ? 'bg-[#0D4E52] text-white'
                      : 'bg-[#EEF4F4] text-[#495B5D] hover:bg-[#DFE8E8]'
                  }`}
                >
                  {track === 'ALL'
                    ? 'Auto-detect (BBA / MBA)'
                    : track === 'BBA'
                    ? 'BBA (100–135)'
                    : 'MBA (660–700)'}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label
                htmlFor="faculty-three-digit-code"
                className="block text-xs font-semibold text-[#0F1F21] mb-1.5"
              >
                3-Digit Subject Code ({rangeHint})
              </label>
              <div className="flex items-center h-11 rounded-xl bg-[#F2F5F5] border border-[#E2E9E9] overflow-hidden focus-within:border-[#0D4E52] focus-within:bg-white">
                <span className="px-3.5 h-full flex items-center bg-[#E4F5F6] text-[#0D4E52] font-mono font-bold text-xs whitespace-nowrap">
                  {subjectValidation.valid
                    ? subjectValidation.normalizedCode.split('-')[0]
                    : isBusiness && businessTrack !== 'ALL'
                    ? businessTrack
                    : deptSpec?.tracks[0].prefix}
                </span>
                <input
                  id="faculty-three-digit-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={threeDigitInput}
                  onChange={(e) => handleThreeDigitChange(e.target.value)}
                  placeholder={`e.g. ${padThreeDigits(deptSpec?.tracks[0].min || 300)}`}
                  className="w-full h-full px-3 bg-transparent font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-7">
              <label
                htmlFor="teaching-subject-title"
                className="block text-xs font-semibold text-[#0F1F21] mb-1.5"
              >
                Subject Title (Auto-filled from catalog or editable)
              </label>
              <input
                id="teaching-subject-title"
                type="text"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="Select a matching course below or enter subject title"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-[#E2E9E9] text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
              />
            </div>
          </div>

          {!subjectValidation.valid && threeDigitInput.length === 3 && (
            <p className="text-xs font-medium text-[#B45309]">
              {subjectValidation.error}
            </p>
          )}

          {/* Matching Department Courses List to Pick From */}
          <div className="space-y-2.5 pt-2 border-t border-[#EFF3F3]">
            <div className="flex items-center justify-between text-xs text-[#5A6B6D]">
              <span>
                {threeDigitInput.trim()
                  ? `Matching ${deptSpec?.shortLabel} subjects for "${threeDigitInput}"`
                  : `Sample ${deptSpec?.shortLabel} subjects (enter 3-digit code to filter)`}
              </span>
              <span className="tabular-nums">
                {matchingCatalogCourses.length} shown
              </span>
            </div>

            {matchingCatalogCourses.length === 0 ? (
              <p className="text-xs text-[#5A6B6D] py-2">
                No catalog course matches {threeDigitInput}. Valid range: {deptSpec?.rangeSummary}.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {matchingCatalogCourses.map((course) => {
                  const selected =
                    subjectValidation.valid &&
                    subjectValidation.normalizedCode === course.code;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => handleSelectCatalogCourse(course)}
                      className={`text-left rounded-2xl border p-3 flex items-center justify-between gap-3 transition-colors ${
                        selected
                          ? 'bg-[#E4F5F6] border-[#0D4E52]'
                          : 'bg-[#FAFBFB] border-[#E7EFEF] hover:border-[#9CD8DE]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-1.5 rounded-lg bg-[#B9F2F7] text-[#0D4E52] font-mono text-xs font-bold shrink-0 tabular-nums">
                          {course.code}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0F1F21] truncate">
                            {course.title}
                          </p>
                          <p className="text-[11px] text-[#5A6B6D] truncate">
                            {course.credits.toFixed(1)} Credits · {course.scheduleSummary}
                          </p>
                        </div>
                      </div>
                      {selected && (
                        <Check className="w-4 h-4 text-[#0D4E52] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EFF3F3]">
            <p className="text-xs text-[#5A6B6D]">
              Once confirmed, you can select your date, time slot, block, floor, and classroom.
            </p>
            <button
              type="submit"
              disabled={!subjectValidation.valid || !subjectTitle.trim()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Continue to Select Place to Teach</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Confirmed Teaching Subject Summary Banner */}
          <div className="bg-white rounded-3xl border border-[#B9E2E5] p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 shadow-[0_6px_24px_-12px_rgba(13,78,82,0.08)]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="px-3 h-11 rounded-xl bg-[#0D4E52] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                {subjectValidation.normalizedCode}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#1F7A6E]">
                  Confirmed Teaching Subject
                </p>
                <h2 className="font-serif font-bold text-base md:text-lg text-[#0F1F21] truncate">
                  {subjectTitle}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSubjectConfirmed(false)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EEF4F4] hover:bg-[#DFE8E8] text-[#0D4E52] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Change Subject Code
            </button>
          </div>

          {/* STEP 3: Pop-Out Schedule Area Trigger & Single-Month Calendar Drawer */}
          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-4 md:p-5 shadow-[0_6px_24px_-12px_rgba(13,78,82,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#5A6B6D] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#0D4E52]" />
                    <span>{currentMonthLabel} (Current Month Only)</span>
                  </p>
                  <p className="font-serif font-bold text-base md:text-lg text-[#0F1F21] truncate tabular-nums">
                    {selectedDateDisplay} · {selectedSlot}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSchedulePoppedOut((prev) => !prev)}
                aria-expanded={schedulePoppedOut}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-sm"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Schedule</span>
                {schedulePoppedOut ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {schedulePoppedOut && (
              <div className="mt-5 pt-5 border-t border-[#E8EFEF] space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Single-Month Calendar Grid */}
                  <div className="lg:col-span-7 bg-[#F7FAFA] rounded-2xl p-4 border border-[#E5EDED]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="font-serif font-bold text-base text-[#0F1F21]">
                        {currentMonthLabel}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setSchedulePoppedOut(false)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Done
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                      {WEEKDAY_HEADERS.map((wd) => (
                        <span
                          key={wd}
                          className="text-[11px] font-semibold text-[#6A7A7C] py-1"
                        >
                          {wd}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                      {monthDays.map((dateObj, idx) => {
                        if (!dateObj) {
                          return <div key={`empty-${idx}`} className="h-10" />;
                        }
                        const key = formatDateKey(dateObj);
                        const isSelected = key === selectedDateKey;
                        const isToday = key === formatDateKey(today);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedDateKey(key);
                              setSchedulePoppedOut(false);
                            }}
                            className={`h-10 rounded-xl text-xs font-semibold tabular-nums flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] ${
                              isSelected
                                ? 'bg-[#0D4E52] text-white shadow-sm'
                                : isToday
                                ? 'bg-[#B9F2F7] text-[#0D4E52] hover:bg-[#9CEAF1]'
                                : 'bg-white text-[#0F1F21] border border-[#E6ECEC] hover:border-[#0D4E52]'
                            }`}
                          >
                            {dateObj.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Slot Selector */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#0D4E52]" />
                          <h3 className="font-serif font-bold text-base text-[#0F1F21]">
                            Select Time Slot
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-[#5A6B6D]">
                          {isSaturdayDateKey(selectedDateKey)
                            ? 'Saturday Schedule (5 Slots)'
                            : availableSlotsForDate.length === 0
                            ? 'Sunday Holiday'
                            : 'Mon–Fri Evening Slot'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {availableSlotsForDate.length === 0 ? (
                          <p className="rounded-xl bg-[#F2F5F5] px-4 py-3 text-xs text-[#5A6B6D]">
                            No classes scheduled on Sunday. Please select Monday–Saturday.
                          </p>
                        ) : (
                          availableSlotsForDate.map((slot, idx) => {
                            const active = selectedSlot === slot;
                            const isSat = isSaturdayDateKey(selectedDateKey);
                            return (
                              <React.Fragment key={slot}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold tabular-nums text-left flex items-center justify-between transition-colors ${
                                    active
                                      ? 'bg-[#0D4E52] text-white shadow-sm'
                                      : 'bg-[#F2F5F5] text-[#0F1F21] hover:bg-[#E4ECEC]'
                                  }`}
                                >
                                  <span>{slot}</span>
                                  {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                </button>
                                {isSat && idx === 1 && (
                                  <div className="text-[11px] font-medium text-[#5A6B6D] bg-[#EEF4F4] rounded-lg px-3 py-1.5 text-center">
                                    12:00 PM – 12:30 PM · 30-Min Midday Break
                                  </div>
                                )}
                                {isSat && idx === 2 && (
                                  <div className="text-[11px] font-medium text-[#5A6B6D] bg-[#EEF4F4] rounded-lg px-3 py-1.5 text-center">
                                    02:00 PM – 02:50 PM · 50-Min Lunch Break
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSchedulePoppedOut(false)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold transition-colors"
                    >
                      Schedule Selected Date &amp; Time
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Block Selection — Faculty sees ONLY the block they select */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif font-bold text-lg md:text-xl text-[#0F1F21]">
                Select Department Block ({blockCount})
              </h2>
              <span className="text-xs text-[#5A6B6D] tabular-nums">
                Showing Block {selectedBlock} for {selectedDateDisplay}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {blockSummaries.map((blk) => {
                const active = selectedBlock === blk.blockNumber;
                const blockAvailable = blk.availableRooms > 0;
                return (
                  <button
                    key={blk.blockNumber}
                    type="button"
                    onClick={() => setSelectedBlock(blk.blockNumber)}
                    className={`text-left rounded-2xl p-4 border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] ${
                      active
                        ? 'bg-[#0D4E52] text-white border-[#0D4E52] shadow-md'
                        : 'bg-white text-[#0F1F21] border-[#E7EFEF] hover:border-[#0D4E52]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif font-bold text-base">
                        {blk.blockName}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                          active
                            ? 'bg-[#1F6B70] text-[#B9F2F7]'
                            : blockAvailable
                            ? 'bg-[#E4F5F6] text-[#0D4E52]'
                            : 'bg-[#FEE2E2] text-[#991B1B]'
                        }`}
                      >
                        {blockAvailable ? 'Available' : 'Full'}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-2 tabular-nums ${
                        active ? 'text-[#D6EEF0]' : 'text-[#5A6B6D]'
                      }`}
                    >
                      {blk.availableRooms} / {blk.totalRooms} classes free
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ONLY the Selected Block's 9 Floors & 10 Classes per Floor */}
          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#EEF3F3]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#0D4E52] shrink-0" />
                <div>
                  <h2 className="font-serif font-bold text-lg text-[#0F1F21]">
                    Block {selectedBlock} Classrooms
                  </h2>
                  <p className="text-xs text-[#5A6B6D] tabular-nums">
                    {activeBlockSummary
                      ? `${activeBlockSummary.availableRooms} available · ${activeBlockSummary.occupiedRooms} occupied across 9 floors (90 classes)`
                      : '9 floors · 10 classes per floor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => setSelectedFloor('all')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    selectedFloor === 'all'
                      ? 'bg-[#0D4E52] text-white'
                      : 'bg-[#EEF2F2] text-[#495B5D] hover:bg-[#E1E8E8]'
                  }`}
                >
                  All 9 Floors
                </button>
                {Array.from({ length: FLOORS_PER_BLOCK }, (_, idx) => idx + 1).map(
                  (floorNum) => (
                    <button
                      key={floorNum}
                      type="button"
                      onClick={() => setSelectedFloor(floorNum)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                        selectedFloor === floorNum
                          ? 'bg-[#0D4E52] text-white'
                          : 'bg-[#EEF2F2] text-[#495B5D] hover:bg-[#E1E8E8]'
                      }`}
                    >
                      F{floorNum}
                    </button>
                  )
                )}
              </div>
            </div>

            {loadingAvailability ? (
              <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#5A6B6D]">
                <Loader2 className="w-4 h-4 animate-spin text-[#0D4E52]" />
                <span>Checking live Block {selectedBlock} room availability...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {visibleRooms.map((room) => {
                  const userBooking = room.booking;
                  const isOwnBooking =
                    userBooking && userBooking.facultyCode === profile.facultyCode;
                  const isAvailable = room.available;

                  return (
                    <article
                      key={room.id}
                      className="rounded-2xl border border-[#E7EFEF] bg-[#FAFBFB] p-4 flex items-center justify-between gap-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl font-mono font-bold text-sm flex items-center justify-center shrink-0 tabular-nums ${
                            isAvailable
                              ? 'bg-[#276D71] text-white'
                              : 'bg-[#E5EBEB] text-[#5A6B6D]'
                          }`}
                        >
                          {room.roomCode}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif font-bold text-base text-[#0F1F21] truncate">
                              {room.name}
                            </h3>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                                isAvailable
                                  ? 'bg-[#B9F2F7] text-[#0D4E52]'
                                  : isOwnBooking
                                  ? 'bg-[#DCF6E8] text-[#175B3A]'
                                  : 'bg-[#FEF3C7] text-[#92400E]'
                              }`}
                            >
                              {isAvailable
                                ? 'Available'
                                : isOwnBooking
                                ? `${userBooking.subjectCode}`
                                : 'Slot Occupied'}
                            </span>
                          </div>
                          <p className="text-xs text-[#5A6B6D] mt-0.5 truncate tabular-nums">
                            Floor {room.floorNumber} · Class {room.classIndex}/10 · {room.capacity}
                          </p>
                          <p className="text-[11px] text-[#6A7A7C] mt-0.5 truncate">
                            {isOwnBooking
                              ? `${userBooking.courseTitle} · ${userBooking.instructorName}`
                              : room.equipment}
                          </p>
                        </div>
                      </div>

                      {isOwnBooking && userBooking ? (
                        <button
                          type="button"
                          onClick={() => handleCancelReservation(userBooking.id)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EEF2F2] hover:bg-[#E1E7E7] text-[#0F1F21] text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          Release
                        </button>
                      ) : isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleOpenBooking(room)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          Teach Here
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-[#6A7A7C] whitespace-nowrap shrink-0 px-2">
                          Booked
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Subjects You Are Teaching (Published to Student Dashboard) */}
      {publishedSubjects.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0D4E52]" />
            <h3 className="font-serif font-bold text-base text-[#0F1F21]">
              Subjects You Are Teaching ({publishedSubjects.length})
            </h3>
          </div>
          <div className="divide-y divide-[#EEF3F3]">
            {publishedSubjects.map((sub) => {
              const resMatch = reservations.find(
                (r) => r.id === sub.reservationId
              );
              return (
                <div
                  key={sub.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F1F21] truncate">
                      <span className="font-mono text-[#0D4E52] mr-1.5">
                        {sub.subjectCode}
                      </span>
                      {sub.subjectTitle}
                    </p>
                    <p className="text-[11px] text-[#5A6B6D] tabular-nums mt-0.5">
                      {sub.department} · {sub.blockName} · Floor {sub.floorNumber} ·{' '}
                      {sub.roomName} · {sub.dateKey} · {sub.timeSlot}
                    </p>
                  </div>
                  {resMatch && (
                    <button
                      type="button"
                      onClick={() => handleCancelReservation(resMatch.id)}
                      aria-label={`Cancel ${sub.subjectCode}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#6A7A7C] hover:text-[#B91C1C] hover:bg-[#FEE2E2]/50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {bookingRoom && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={`Schedule ${subjectValidation.normalizedCode} in ${bookingRoom.name}`}
        >
          <div className="absolute inset-0" onClick={() => setBookingRoom(null)} />
          <form
            onSubmit={handleConfirmReserve}
            className="relative w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 shadow-2xl border border-[#E6ECEC] space-y-4"
          >
            <div className="w-10 h-1.5 bg-[#D8E0E0] rounded-full mx-auto md:hidden" />
            <div>
              <p className="text-xs font-medium text-[#5A6B6D] tabular-nums">
                {selectedDateDisplay} · {selectedSlot}
              </p>
              <h3 className="font-serif font-bold text-xl text-[#0F1F21] mt-0.5">
                Assign {subjectValidation.normalizedCode} to {bookingRoom.name}
              </h3>
              <p className="text-xs text-[#5A6B6D] mt-1">
                {selectedDepartment} · {bookingRoom.blockName} · Floor{' '}
                {bookingRoom.floorNumber}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F6F8F8] p-3.5 text-xs space-y-1">
              <p className="text-[#5A6B6D]">
                Instructor:{' '}
                <strong className="text-[#0F1F21]">{profile.fullName}</strong>
              </p>
              <p className="text-[#5A6B6D]">
                Subject:{' '}
                <strong className="text-[#0F1F21]">
                  {subjectValidation.normalizedCode} — {subjectTitle.trim()}
                </strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBookingRoom(null)}
                className="min-h-[44px] rounded-xl bg-[#F2F5F5] text-xs font-semibold text-[#495B5D] hover:bg-[#E6ECEC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingBooking}
                className="min-h-[44px] rounded-xl bg-[#0D4E52] text-xs font-semibold text-white hover:bg-[#093B3E] flex items-center justify-center gap-2"
              >
                {submittingBooking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Publish & Reserve'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
