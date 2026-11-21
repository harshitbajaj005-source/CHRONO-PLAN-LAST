import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  IdCard,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import {
  bootstrapAdminApi,
  getAuthStatusApi,
  registerFacultyApi,
  registerStudentApi,
  type LoginPayload,
} from '../services/api';
import { UserRole } from '../types';
import {
  validateAlphabeticFullName,
  validateFacultyPassword,
  validateSingleAlphabeticName,
  validateStudentPassword,
  validateStudentSection,
} from '../utils/subjectValidation';

interface PortalWelcomeViewProps {
  defaultRole: UserRole;
  authNotice?: string | null;
  onLogin: (payload: LoginPayload) => Promise<void>;
  onOpenSupport: () => void;
}

export const PortalWelcomeView: React.FC<PortalWelcomeViewProps> = ({
  defaultRole,
  authNotice,
  onLogin,
  onOpenSupport,
}) => {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);

  // Student fields
  const [fullName, setFullName] = useState('');
  const [section, setSection] = useState('');
  const [year, setYear] = useState('3rd Year');
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Faculty fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facultyCode, setFacultyCode] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');

  // Admin fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [studentNameError, setStudentNameError] = useState<string | null>(null);
  const [studentSectionError, setStudentSectionError] = useState<string | null>(null);
  const [facultyNameError, setFacultyNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Student / Faculty Registration Modal State
  const [registerModalMode, setRegisterModalMode] = useState<'student' | 'faculty' | null>(null);
  const [regErrorMsg, setRegErrorMsg] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // New Student ID fields
  const [regStudentName, setRegStudentName] = useState('');
  const [regStudentNameErr, setRegStudentNameErr] = useState<string | null>(null);
  const [regStudentSection, setRegStudentSection] = useState('');
  const [regStudentSectionErr, setRegStudentSectionErr] = useState<string | null>(null);
  const [regStudentYear, setRegStudentYear] = useState('3rd Year');
  const [regStudentId, setRegStudentId] = useState('');
  const [regRfId, setRegRfId] = useState('');
  const [regSpecialCode, setRegSpecialCode] = useState('');
  const [regStudentEmail, setRegStudentEmail] = useState('');
  const [regStudentPassword, setRegStudentPassword] = useState('');

  // New Faculty ID fields
  const [regFacFirst, setRegFacFirst] = useState('');
  const [regFacMiddle, setRegFacMiddle] = useState('');
  const [regFacLast, setRegFacLast] = useState('');
  const [regFacNameErr, setRegFacNameErr] = useState<string | null>(null);
  const [regFacCode, setRegFacCode] = useState('');
  const [regFacId, setRegFacId] = useState('');
  const [regFacPassword, setRegFacPassword] = useState('');

  useEffect(() => {
    getAuthStatusApi()
      .then((res) => setNeedsAdminSetup(Boolean(res.needsAdminSetup)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!registerModalMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRegisterModalMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registerModalMode]);

  const openRegisterModal = (mode: 'student' | 'faculty') => {
    setRegErrorMsg(null);
    setRegStudentNameErr(null);
    setRegStudentSectionErr(null);
    setRegFacNameErr(null);
    setRegisterModalMode(mode);
  };

  const handleRegStudentNameChange = (value: string) => {
    setRegStudentName(value);
    if (value && /\d/.test(value)) {
      setRegStudentNameErr('Student name must contain only alphabets (numbers are not allowed).');
    } else if (value.trim() && !/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(value.trim())) {
      setRegStudentNameErr('Student name must contain only alphabets.');
    } else {
      setRegStudentNameErr(null);
    }
  };

  const handleRegStudentSectionChange = (value: string) => {
    setRegStudentSection(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setRegStudentSectionErr(null);
      return;
    }
    if (/[^A-Za-z0-9]/.test(trimmed) || trimmed.length > 2) {
      setRegStudentSectionErr('Section must be 2 alphabets or 1 alphabet and 1 digit.');
    } else if (trimmed.length === 2 && validateStudentSection(trimmed)) {
      setRegStudentSectionErr('Section must be 2 alphabets or 1 alphabet and 1 digit.');
    } else {
      setRegStudentSectionErr(null);
    }
  };

  const handleRegFacultyNameChange = (
    part: 'first' | 'middle' | 'last',
    value: string
  ) => {
    if (part === 'first') setRegFacFirst(value);
    else if (part === 'middle') setRegFacMiddle(value);
    else setRegFacLast(value);

    const nextFirst = part === 'first' ? value : regFacFirst;
    const nextMiddle = part === 'middle' ? value : regFacMiddle;
    const nextLast = part === 'last' ? value : regFacLast;

    const firstErr = nextFirst.trim()
      ? validateSingleAlphabeticName(nextFirst, 'First name', true)
      : null;
    const middleErr = nextMiddle.trim()
      ? validateSingleAlphabeticName(nextMiddle, 'Middle name', false)
      : null;
    const lastErr = nextLast.trim()
      ? validateSingleAlphabeticName(nextLast, 'Last name', true)
      : null;

    setRegFacNameErr(firstErr || middleErr || lastErr || null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrorMsg(null);

    if (registerModalMode === 'student') {
      const cleanName = regStudentName.trim();
      const cleanSection = regStudentSection.trim();
      const cleanId = regStudentId.trim();
      const cleanRfId = regRfId.trim().toUpperCase();
      const cleanSpecialCode = regSpecialCode.trim().toUpperCase();
      const cleanEmail = regStudentEmail.trim().toLowerCase();

      const nameErr = validateAlphabeticFullName(cleanName, 'Student name');
      if (nameErr) {
        setRegStudentNameErr(nameErr);
        setRegErrorMsg(nameErr);
        return;
      }
      const sectionErr = validateStudentSection(cleanSection);
      if (sectionErr) {
        setRegStudentSectionErr(sectionErr);
        setRegErrorMsg(sectionErr);
        return;
      }
      if (!/^\d{7}$/.test(cleanId)) {
        setRegErrorMsg('Student ID must be exactly 7 digits.');
        return;
      }
      if (!/^[A-Za-z0-9-]{4,24}$/.test(cleanRfId)) {
        setRegErrorMsg('Special RF ID must be 4–24 alphanumeric characters.');
        return;
      }
      if (!/^[A-Za-z0-9-]{4,20}$/.test(cleanSpecialCode)) {
        setRegErrorMsg('Special Code must be 4–20 alphanumeric characters.');
        return;
      }
      if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(cleanEmail)) {
        setRegErrorMsg('LPU email must end with @lpu.in.');
        return;
      }
      const pwErr = validateStudentPassword(regStudentPassword);
      if (pwErr) {
        setRegErrorMsg(pwErr);
        return;
      }

      setRegSubmitting(true);
      try {
        const res = await registerStudentApi({
          fullName: cleanName,
          section: cleanSection,
          year: regStudentYear || '3rd Year',
          registrationNumber: cleanId,
          rfId: cleanRfId,
          specialCode: cleanSpecialCode,
          email: cleanEmail,
          password: regStudentPassword,
        });

        setRole('student');
        setErrorMsg(null);
        setStudentNameError(null);
        setStudentSectionError(null);
        setFullName(cleanName);
        setSection(cleanSection);
        setYear(regStudentYear || '3rd Year');
        setStudentId(cleanId);
        setStudentEmail(cleanEmail);
        setStudentPassword('');
        setSuccessMsg(`${res.message} Enter your password below to log in.`);
        setRegisterModalMode(null);

        setRegStudentName('');
        setRegStudentSection('');
        setRegStudentId('');
        setRegRfId('');
        setRegSpecialCode('');
        setRegStudentEmail('');
        setRegStudentPassword('');
      } catch (err) {
        setRegErrorMsg(err instanceof Error ? err.message : 'Unable to register student ID.');
      } finally {
        setRegSubmitting(false);
      }
    } else if (registerModalMode === 'faculty') {
      const cleanFirst = regFacFirst.trim();
      const cleanMiddle = regFacMiddle.trim();
      const cleanLast = regFacLast.trim();
      const cleanCode = regFacCode.trim().toUpperCase();
      const cleanFacId = regFacId.trim();

      const firstErr = validateSingleAlphabeticName(cleanFirst, 'First name', true);
      if (firstErr) {
        setRegFacNameErr(firstErr);
        setRegErrorMsg(firstErr);
        return;
      }
      const middleErr = validateSingleAlphabeticName(cleanMiddle, 'Middle name', false);
      if (middleErr) {
        setRegFacNameErr(middleErr);
        setRegErrorMsg(middleErr);
        return;
      }
      const lastErr = validateSingleAlphabeticName(cleanLast, 'Last name', true);
      if (lastErr) {
        setRegFacNameErr(lastErr);
        setRegErrorMsg(lastErr);
        return;
      }
      if (!/^[A-Za-z]{3}\d{3}$/.test(cleanCode)) {
        setRegErrorMsg('Faculty Login ID must be 3 alphabets followed by 3 digits.');
        return;
      }
      if (!/^\d{5}$/.test(cleanFacId)) {
        setRegErrorMsg('Faculty ID must be exactly 5 digits.');
        return;
      }
      const pwErr = validateFacultyPassword(regFacPassword);
      if (pwErr) {
        setRegErrorMsg(pwErr);
        return;
      }

      setRegSubmitting(true);
      try {
        const res = await registerFacultyApi({
          firstName: cleanFirst,
          middleName: cleanMiddle,
          lastName: cleanLast,
          facultyCode: cleanCode,
          registrationNumber: cleanFacId,
          password: regFacPassword,
        });

        setRole('faculty');
        setErrorMsg(null);
        setFacultyNameError(null);
        setFirstName(cleanFirst);
        setMiddleName(cleanMiddle);
        setLastName(cleanLast);
        setFacultyCode(cleanCode);
        setFacultyId(cleanFacId);
        setFacultyPassword('');
        setSuccessMsg(`${res.message} Enter your password below to log in.`);
        setRegisterModalMode(null);

        setRegFacFirst('');
        setRegFacMiddle('');
        setRegFacLast('');
        setRegFacCode('');
        setRegFacId('');
        setRegFacPassword('');
      } catch (err) {
        setRegErrorMsg(err instanceof Error ? err.message : 'Unable to register faculty ID.');
      } finally {
        setRegSubmitting(false);
      }
    }
  };

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setErrorMsg(null);
    setSuccessMsg(null);
    setStudentNameError(null);
    setStudentSectionError(null);
    setFacultyNameError(null);
  };

  const handleStudentNameChange = (value: string) => {
    setFullName(value);
    if (value && /\d/.test(value)) {
      setStudentNameError('Student name must contain only alphabets (numbers are not allowed).');
    } else if (value.trim() && !/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(value.trim())) {
      setStudentNameError('Student name must contain only alphabets.');
    } else {
      setStudentNameError(null);
    }
  };

  const handleStudentSectionChange = (value: string) => {
    setSection(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setStudentSectionError(null);
      return;
    }
    if (/[^A-Za-z0-9]/.test(trimmed) || trimmed.length > 2) {
      setStudentSectionError('Section must be 2 alphabets or 1 alphabet and 1 digit.');
    } else if (trimmed.length === 2 && validateStudentSection(trimmed)) {
      setStudentSectionError('Section must be 2 alphabets or 1 alphabet and 1 digit.');
    } else {
      setStudentSectionError(null);
    }
  };

  const handleFacultyNamePartChange = (
    part: 'first' | 'middle' | 'last',
    value: string
  ) => {
    if (part === 'first') setFirstName(value);
    else if (part === 'middle') setMiddleName(value);
    else setLastName(value);

    const nextFirst = part === 'first' ? value : firstName;
    const nextMiddle = part === 'middle' ? value : middleName;
    const nextLast = part === 'last' ? value : lastName;

    const firstErr = nextFirst.trim()
      ? validateSingleAlphabeticName(nextFirst, 'First name', true)
      : null;
    const middleErr = nextMiddle.trim()
      ? validateSingleAlphabeticName(nextMiddle, 'Middle name', false)
      : null;
    const lastErr = nextLast.trim()
      ? validateSingleAlphabeticName(nextLast, 'Last name', true)
      : null;

    setFacultyNameError(firstErr || middleErr || lastErr || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (role === 'student') {
      const cleanName = fullName.trim();
      const cleanSection = section.trim();
      const cleanId = studentId.trim();
      const cleanEmail = studentEmail.trim().toLowerCase();

      const nameError = validateAlphabeticFullName(cleanName, 'Student name');
      if (nameError) {
        setStudentNameError(nameError);
        setErrorMsg(nameError);
        return;
      }
      const sectionError = validateStudentSection(cleanSection);
      if (sectionError) {
        setStudentSectionError(sectionError);
        setErrorMsg(sectionError);
        return;
      }
      if (!/^\d{7}$/.test(cleanId)) {
        setErrorMsg('Student ID must be exactly 7 digits.');
        return;
      }
      if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(cleanEmail)) {
        setErrorMsg(
          'Student email must end with @lpu.in. Personal @gmail.com addresses are not accepted.'
        );
        return;
      }
      const pwError = validateStudentPassword(studentPassword);
      if (pwError) {
        setErrorMsg(pwError);
        return;
      }

      setSubmitting(true);
      try {
        await onLogin({
          role: 'student',
          fullName: cleanName,
          section: cleanSection,
          year: year || '3rd Year',
          registrationNumber: cleanId,
          email: cleanEmail,
          password: studentPassword,
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      } finally {
        setSubmitting(false);
      }
    } else if (role === 'admin') {
      setSubmitting(true);
      try {
        if (needsAdminSetup) {
          const res = await bootstrapAdminApi({
            username: adminUsername.trim(),
            fullName: adminFullName.trim(),
            email: adminEmail.trim().toLowerCase(),
            password: adminPassword,
          });
          setNeedsAdminSetup(false);
          setSuccessMsg(res.message);
        } else {
          await onLogin({
            role: 'admin',
            identifier: adminUsername.trim(),
            registrationNumber: adminUsername.trim(),
            password: adminPassword,
          });
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      } finally {
        setSubmitting(false);
      }
    } else {
      const cleanFirst = firstName.trim();
      const cleanMiddle = middleName.trim();
      const cleanLast = lastName.trim();
      const cleanCode = facultyCode.trim();
      const cleanFacId = facultyId.trim();

      const firstErr = validateSingleAlphabeticName(cleanFirst, 'First name', true);
      if (firstErr) {
        setFacultyNameError(firstErr);
        setErrorMsg(firstErr);
        return;
      }
      const middleErr = validateSingleAlphabeticName(cleanMiddle, 'Middle name', false);
      if (middleErr) {
        setFacultyNameError(middleErr);
        setErrorMsg(middleErr);
        return;
      }
      const lastErr = validateSingleAlphabeticName(cleanLast, 'Last name', true);
      if (lastErr) {
        setFacultyNameError(lastErr);
        setErrorMsg(lastErr);
        return;
      }
      if (!/^[A-Za-z]{3}\d{3}$/.test(cleanCode)) {
        setErrorMsg('Invalid Faculty Login ID. Please check your assigned credentials.');
        return;
      }
      if (!/^\d{5}$/.test(cleanFacId)) {
        setErrorMsg('Faculty ID must be exactly 5 digits.');
        return;
      }

      const pwError = validateFacultyPassword(facultyPassword);
      if (pwError) {
        setErrorMsg(pwError);
        return;
      }

      setSubmitting(true);
      try {
        await onLogin({
          role: 'faculty',
          firstName: cleanFirst,
          middleName: cleanMiddle,
          lastName: cleanLast,
          facultyCode: cleanCode.toUpperCase(),
          registrationNumber: cleanFacId,
          password: facultyPassword,
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-10">
      {/* Top-Right New Student ID & New Faculty ID Registration Triggers */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 mb-6">
        <button
          type="button"
          onClick={() => openRegisterModal('student')}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-[#E4F5F6] text-[#0D4E52] border border-[#CBE1E2] text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
        >
          <UserPlus className="w-3.5 h-3.5 shrink-0" />
          <span>New Student ID</span>
        </button>

        <button
          type="button"
          onClick={() => openRegisterModal('faculty')}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52]"
        >
          <UserPlus className="w-3.5 h-3.5 shrink-0" />
          <span>New Faculty ID</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left / Mobile Header Intro */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="w-16 h-16 rounded-2xl bg-[#1E6367] text-[#B9F2F7] flex items-center justify-center shadow-lg shadow-[#0D4E52]/15 mb-5">
            <CalendarDays className="w-8 h-8" strokeWidth={1.9} />
          </div>

          <h1 className="font-serif font-bold text-[28px] md:text-[38px] leading-tight text-[#0F1F21] tracking-tight">
            Welcome to ChronoPlan
          </h1>
          <p className="mt-2.5 text-[15px] md:text-base text-[#5A6B6D] max-w-md leading-relaxed">
            Your intelligent academic sanctuary for seamless scheduling and pristine timelines.
          </p>

          <div className="hidden lg:grid grid-cols-1 gap-4 mt-8 pt-6 border-t border-[#E2E9E9] w-full max-w-md">
            <div>
              <p className="text-sm font-semibold text-[#0F1F21]">
                Strict Role-Isolated Portals
              </p>
              <p className="text-xs text-[#5A6B6D] mt-0.5">
                Student accounts access timetables and courses; Faculty accounts select their department, block, and teaching subject.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1F21]">
                Live Faculty-to-Student Sync
              </p>
              <p className="text-xs text-[#5A6B6D] mt-0.5">
                Subjects assigned by professors appear directly on the student dashboard via authenticated API endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* Right / Mobile Form Column */}
        <div className="lg:col-span-7 w-full max-w-md mx-auto lg:max-w-lg">
          {authNotice && (
            <div className="mb-4 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] px-4 py-3 text-xs font-medium text-[#92400E] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authNotice}</span>
            </div>
          )}

          {/* Role Segmented Toggle */}
          <div
            role="tablist"
            aria-label="Select portal access mode"
            className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EAEFEF] rounded-2xl mb-5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={role === 'student'}
              onClick={() => handleRoleSwitch('student')}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                role === 'student'
                  ? 'bg-[#0D4E52] text-white shadow-sm'
                  : 'text-[#495B5D] hover:text-[#0F1F21]'
              }`}
            >
              <GraduationCap className="w-[18px] h-[18px] shrink-0" />
              <span>Student Portal</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={role === 'faculty'}
              onClick={() => handleRoleSwitch('faculty')}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                role === 'faculty'
                  ? 'bg-[#0D4E52] text-white shadow-sm'
                  : 'text-[#495B5D] hover:text-[#0F1F21]'
              }`}
            >
              <IdCard className="w-[18px] h-[18px] shrink-0" />
              <span>Faculty Access</span>
            </button>
          </div>

          {/* Sign-In Card */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative overflow-hidden bg-white rounded-3xl p-6 md:p-7 shadow-[0_12px_36px_-12px_rgba(13,78,82,0.12)] border border-[#E7EFEF] space-y-4"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#D9F4F7]/65 blur-2xl"
            />

            {errorMsg && (
              <div
                role="alert"
                className="relative rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-xs font-medium text-[#991B1B] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="relative rounded-xl bg-[#DCF6E8] border border-[#A7F3D0] px-3.5 py-2.5 text-xs font-medium text-[#175B3A] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {role === 'student' ? (
              <div className="relative space-y-4">
                <div>
                  <label
                    htmlFor="student-fullname"
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                    <span>Full Name</span>
                  </label>
                  <input
                    id="student-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => handleStudentNameChange(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className={`w-full h-12 px-4 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                      studentNameError
                        ? 'border-[#DC2626] focus:border-[#DC2626]'
                        : 'border-transparent focus:border-[#0D4E52]'
                    }`}
                  />
                  {studentNameError && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-[#B91C1C]">
                      {studentNameError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="student-section"
                      className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Section</span>
                    </label>
                    <input
                      id="student-section"
                      type="text"
                      required
                      value={section}
                      onChange={(e) => handleStudentSectionChange(e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border text-sm text-[#0F1F21] focus:bg-white focus:outline-none transition-colors ${
                        studentSectionError
                          ? 'border-[#DC2626] focus:border-[#DC2626]'
                          : 'border-transparent focus:border-[#0D4E52]'
                      }`}
                    />
                    {studentSectionError && (
                      <p role="alert" className="mt-1.5 text-[11px] font-medium text-[#B91C1C]">
                        {studentSectionError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="student-year"
                      className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Year</span>
                    </label>
                    <select
                      id="student-year"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full h-12 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="student-id"
                    className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <IdCard className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Student ID</span>
                    </span>
                    <span className="text-[11px] font-normal text-[#5A6B6D]">
                      7 digits
                    </span>
                  </label>
                  <input
                    id="student-id"
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1220456"
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-email"
                    className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>University Email</span>
                    </span>
                    <span className="text-[11px] font-normal text-[#5A6B6D]">
                      Must end with @lpu.in
                    </span>
                  </label>
                  <input
                    id="student-email"
                    type="email"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@lpu.in"
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="student-password"
                    className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Password</span>
                    </span>
                    <span className="text-[11px] font-normal text-[#5A6B6D]">
                      8–10 chars, letters &amp; digits only
                    </span>
                  </label>
                  <input
                    id="student-password"
                    type="password"
                    minLength={8}
                    maxLength={10}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="8–10 characters (letters & digits only)"
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] disabled:opacity-60 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#0D4E52]/15 transition-all whitespace-nowrap"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Launch Student Timetable</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            ) : role === 'admin' ? (
              <div className="relative space-y-4">
                <p className="text-xs text-[#5A6B6D]">
                  {needsAdminSetup
                    ? 'Create the initial Administrator account to manage timetables and accounts.'
                    : 'Sign in with your Administrator username or email.'}
                </p>

                <div>
                  <label
                    htmlFor="admin-username"
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                    <span>{needsAdminSetup ? 'Username' : 'Username or Email'}</span>
                  </label>
                  <input
                    id="admin-username"
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder={needsAdminSetup ? 'e.g. admin01' : 'admin01 or admin@lpu.in'}
                    className="w-full h-12 px-4 rounded-xl bg-[#EEF4F4] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                {needsAdminSetup && (
                  <>
                    <div>
                      <label
                        htmlFor="admin-fullname"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Full Name</span>
                      </label>
                      <input
                        id="admin-fullname"
                        type="text"
                        required
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="e.g. Dr. Eleanor Vance"
                        className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="admin-email"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Email</span>
                      </label>
                      <input
                        id="admin-email"
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@lpu.in"
                        className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="admin-password"
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#0D4E52]" />
                    <span>Password</span>
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder={
                      needsAdminSetup
                        ? 'At least 8 chars with letters & digits'
                        : 'Enter your password'
                    }
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] disabled:opacity-60 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#0D4E52]/15 transition-all whitespace-nowrap"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {needsAdminSetup
                          ? 'Create Administrator Account'
                          : 'Sign In to Administration'}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="relative space-y-4">
                <div className="space-y-1.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="faculty-firstname"
                        className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>First Name</span>
                      </label>
                      <input
                        id="faculty-firstname"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => handleFacultyNamePartChange('first', e.target.value)}
                        placeholder="Required"
                        className={`w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                          facultyNameError
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-transparent focus:border-[#0D4E52]'
                        }`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="faculty-middlename"
                        className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <span>Middle</span>
                        <span className="text-[10px] font-normal text-[#5A6B6D]">
                          Optional
                        </span>
                      </label>
                      <input
                        id="faculty-middlename"
                        type="text"
                        value={middleName}
                        onChange={(e) => handleFacultyNamePartChange('middle', e.target.value)}
                        placeholder="Optional"
                        className={`w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                          facultyNameError
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-transparent focus:border-[#0D4E52]'
                        }`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="faculty-lastname"
                        className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <span>Last Name</span>
                      </label>
                      <input
                        id="faculty-lastname"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => handleFacultyNamePartChange('last', e.target.value)}
                        placeholder="Required"
                        className={`w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                          facultyNameError
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-transparent focus:border-[#0D4E52]'
                        }`}
                      />
                    </div>
                  </div>
                  {facultyNameError && (
                    <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                      {facultyNameError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="faculty-code"
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#0D4E52]" />
                    <span>Faculty Login ID</span>
                  </label>
                  <input
                    id="faculty-code"
                    type="text"
                    maxLength={6}
                    required
                    value={facultyCode}
                    onChange={(e) =>
                      setFacultyCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
                    }
                    placeholder="Enter Faculty Login ID"
                    className="w-full h-12 px-4 rounded-xl bg-[#EEF4F4] border border-transparent font-mono uppercase tracking-wider text-sm text-[#0F1F21] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="faculty-id"
                    className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <IdCard className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Faculty ID</span>
                    </span>
                    <span className="text-[11px] font-normal text-[#5A6B6D]">
                      5 digits
                    </span>
                  </label>
                  <input
                    id="faculty-id"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    required
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 5-digit Faculty ID"
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="faculty-password"
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#0D4E52]" />
                    <span>Password</span>
                  </label>
                  <input
                    id="faculty-password"
                    type="password"
                    minLength={5}
                    required
                    value={facultyPassword}
                    onChange={(e) => setFacultyPassword(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] disabled:opacity-60 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#0D4E52]/15 transition-all whitespace-nowrap"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Launch Instructor Portal</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          <p className="mt-5 text-center text-[13px] text-[#5A6B6D] space-x-2">
            <span>Need assistance with your schedule?</span>
            <button
              type="button"
              onClick={onOpenSupport}
              className="font-semibold text-[#0D4E52] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] rounded"
            >
              Contact Academic Support
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() =>
                handleRoleSwitch(role === 'admin' ? 'student' : 'admin')
              }
              className="font-semibold text-[#0D4E52] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4E52] rounded"
            >
              {role === 'admin' ? 'Back to Student Portal' : 'Administrator Sign In'}
            </button>
          </p>
        </div>
      </div>

      {/* Registration Modal for New Student ID / New Faculty ID */}
      {registerModalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={
            registerModalMode === 'student'
              ? 'Register New Student ID'
              : 'Register New Faculty ID'
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRegisterModalMode(null);
            }
          }}
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-[#E6ECEC] p-6 md:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#E4F5F6] text-[#0D4E52] flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-serif font-semibold text-xl text-[#0F1F21]">
                    {registerModalMode === 'student'
                      ? 'Register New Student ID'
                      : 'Register New Faculty ID'}
                  </h2>
                  <p className="text-xs text-[#5A6B6D]">
                    Saved directly to the university database for portal login.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalMode(null)}
                aria-label="Close registration modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5A6B6D] hover:bg-[#F1F5F5] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Mode Switcher */}
            <div
              role="tablist"
              aria-label="Choose new account type"
              className="grid grid-cols-2 gap-1.5 p-1 bg-[#EAEFEF] rounded-xl mb-5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={registerModalMode === 'student'}
                onClick={() => openRegisterModal('student')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  registerModalMode === 'student'
                    ? 'bg-[#0D4E52] text-white shadow-sm'
                    : 'text-[#495B5D] hover:text-[#0F1F21]'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>New Student ID</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={registerModalMode === 'faculty'}
                onClick={() => openRegisterModal('faculty')}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  registerModalMode === 'faculty'
                    ? 'bg-[#0D4E52] text-white shadow-sm'
                    : 'text-[#495B5D] hover:text-[#0F1F21]'
                }`}
              >
                <IdCard className="w-4 h-4 shrink-0" />
                <span>New Faculty ID</span>
              </button>
            </div>

            {regErrorMsg && (
              <div
                role="alert"
                className="mb-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-xs font-medium text-[#991B1B] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{regErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              {registerModalMode === 'student' ? (
                <>
                  <div>
                    <label
                      htmlFor="reg-student-fullname"
                      className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Full Name</span>
                    </label>
                    <input
                      id="reg-student-fullname"
                      type="text"
                      required
                      value={regStudentName}
                      onChange={(e) => handleRegStudentNameChange(e.target.value)}
                      placeholder="e.g. Aarav Sharma"
                      className={`w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                        regStudentNameErr
                          ? 'border-[#DC2626] focus:border-[#DC2626]'
                          : 'border-transparent focus:border-[#0D4E52]'
                      }`}
                    />
                    {regStudentNameErr && (
                      <p role="alert" className="mt-1 text-xs font-medium text-[#B91C1C]">
                        {regStudentNameErr}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="reg-student-section"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Section</span>
                      </label>
                      <input
                        id="reg-student-section"
                        type="text"
                        required
                        value={regStudentSection}
                        onChange={(e) => handleRegStudentSectionChange(e.target.value)}
                        className={`w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border text-sm text-[#0F1F21] focus:bg-white focus:outline-none transition-colors ${
                          regStudentSectionErr
                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                            : 'border-transparent focus:border-[#0D4E52]'
                        }`}
                      />
                      {regStudentSectionErr && (
                        <p role="alert" className="mt-1 text-[11px] font-medium text-[#B91C1C]">
                          {regStudentSectionErr}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="reg-student-year"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Year</span>
                      </label>
                      <select
                        id="reg-student-year"
                        value={regStudentYear}
                        onChange={(e) => setRegStudentYear(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-student-id"
                      className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <span className="flex items-center gap-2">
                        <IdCard className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Student ID</span>
                      </span>
                      <span className="text-[11px] font-normal text-[#5A6B6D]">
                        7 digits
                      </span>
                    </label>
                    <input
                      id="reg-student-id"
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      required
                      value={regStudentId}
                      onChange={(e) => setRegStudentId(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 1220456"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="reg-student-rfid"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <Radio className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Special RF ID</span>
                      </label>
                      <input
                        id="reg-student-rfid"
                        type="text"
                        maxLength={24}
                        required
                        value={regRfId}
                        onChange={(e) =>
                          setRegRfId(e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase())
                        }
                        placeholder="e.g. RF904218"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border border-transparent font-mono uppercase tracking-wider text-sm text-[#0F1F21] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-student-special-code"
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Special Code</span>
                      </label>
                      <input
                        id="reg-student-special-code"
                        type="text"
                        maxLength={20}
                        required
                        value={regSpecialCode}
                        onChange={(e) =>
                          setRegSpecialCode(
                            e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
                          )
                        }
                        placeholder="e.g. LPU2026"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border border-transparent font-mono uppercase tracking-wider text-sm text-[#0F1F21] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-student-email"
                      className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>LPU Email</span>
                      </span>
                      <span className="text-[11px] font-normal text-[#5A6B6D]">
                        Must end with @lpu.in
                      </span>
                    </label>
                    <input
                      id="reg-student-email"
                      type="email"
                      required
                      value={regStudentEmail}
                      onChange={(e) => setRegStudentEmail(e.target.value)}
                      placeholder="student@lpu.in"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-student-password"
                      className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <span className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Password</span>
                      </span>
                      <span className="text-[11px] font-normal text-[#5A6B6D]">
                        8–10 chars, letters &amp; digits only
                      </span>
                    </label>
                    <input
                      id="reg-student-password"
                      type="password"
                      minLength={8}
                      maxLength={10}
                      required
                      value={regStudentPassword}
                      onChange={(e) => setRegStudentPassword(e.target.value)}
                      placeholder="8–10 characters (letters & digits only)"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label
                          htmlFor="reg-fac-firstname"
                          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                        >
                          <User className="w-3.5 h-3.5 text-[#0D4E52]" />
                          <span>First Name</span>
                        </label>
                        <input
                          id="reg-fac-firstname"
                          type="text"
                          required
                          value={regFacFirst}
                          onChange={(e) => handleRegFacultyNameChange('first', e.target.value)}
                          placeholder="Required"
                          className={`w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                            regFacNameErr
                              ? 'border-[#DC2626] focus:border-[#DC2626]'
                              : 'border-transparent focus:border-[#0D4E52]'
                          }`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reg-fac-middlename"
                          className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                        >
                          <span>Middle</span>
                          <span className="text-[10px] font-normal text-[#5A6B6D]">
                            Optional
                          </span>
                        </label>
                        <input
                          id="reg-fac-middlename"
                          type="text"
                          value={regFacMiddle}
                          onChange={(e) => handleRegFacultyNameChange('middle', e.target.value)}
                          placeholder="Optional"
                          className={`w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                            regFacNameErr
                              ? 'border-[#DC2626] focus:border-[#DC2626]'
                              : 'border-transparent focus:border-[#0D4E52]'
                          }`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reg-fac-lastname"
                          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                        >
                          <span>Last Name</span>
                        </label>
                        <input
                          id="reg-fac-lastname"
                          type="text"
                          required
                          value={regFacLast}
                          onChange={(e) => handleRegFacultyNameChange('last', e.target.value)}
                          placeholder="Required"
                          className={`w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border text-sm text-[#0F1F21] placeholder:text-[#7E8F91] focus:bg-white focus:outline-none transition-colors ${
                            regFacNameErr
                              ? 'border-[#DC2626] focus:border-[#DC2626]'
                              : 'border-transparent focus:border-[#0D4E52]'
                          }`}
                        />
                      </div>
                    </div>
                    {regFacNameErr && (
                      <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                        {regFacNameErr}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reg-fac-code"
                      className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Faculty Login ID</span>
                    </label>
                    <input
                      id="reg-fac-code"
                      type="text"
                      maxLength={6}
                      required
                      value={regFacCode}
                      onChange={(e) =>
                        setRegFacCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
                      }
                      placeholder="Enter Faculty Login ID"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#EEF4F4] border border-transparent font-mono uppercase tracking-wider text-sm text-[#0F1F21] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-fac-id"
                      className="flex items-center justify-between text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <span className="flex items-center gap-2">
                        <IdCard className="w-3.5 h-3.5 text-[#0D4E52]" />
                        <span>Faculty ID</span>
                      </span>
                      <span className="text-[11px] font-normal text-[#5A6B6D]">
                        5 digits
                      </span>
                    </label>
                    <input
                      id="reg-fac-id"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      required
                      value={regFacId}
                      onChange={(e) => setRegFacId(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 5-digit Faculty ID"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent font-mono tabular-nums text-sm text-[#0F1F21] placeholder:font-sans placeholder:text-[#7E8F91] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-fac-password"
                      className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1F21] mb-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#0D4E52]" />
                      <span>Password</span>
                    </label>
                    <input
                      id="reg-fac-password"
                      type="password"
                      minLength={5}
                      required
                      value={regFacPassword}
                      onChange={(e) => setRegFacPassword(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F2F4F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRegisterModalMode(null)}
                  className="h-11 px-4 rounded-xl bg-[#F2F5F5] hover:bg-[#E5ECEC] text-[#0F1F21] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="h-11 px-5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
                >
                  {regSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {registerModalMode === 'student'
                          ? 'Save New Student ID'
                          : 'Save New Faculty ID'}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
