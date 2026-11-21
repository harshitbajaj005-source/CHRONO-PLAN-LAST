import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  IdCard,
  KeyRound,
  LogOut,
  Mail,
  Radio,
  Save,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { FACULTY_DEPARTMENTS } from '../data/mockAcademicData';
import { FacultyDepartment, RoomReservation, UserProfile } from '../types';
import {
  validateAlphabeticFullName,
  validateStudentSection,
} from '../utils/subjectValidation';

interface ProfileViewProps {
  profile: UserProfile;
  reservations: RoomReservation[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onReturnToPortal: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  reservations,
  onUpdateProfile,
  onReturnToPortal,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [section, setSection] = useState(profile.section);
  const [year, setYear] = useState(profile.year);
  const [email, setEmail] = useState(profile.email);
  const [studentDept, setStudentDept] = useState<FacultyDepartment | ''>(
    profile.studentDepartment || ''
  );
  const [facultyDept, setFacultyDept] = useState<FacultyDepartment | ''>(
    profile.facultyDepartment || ''
  );
  const [savedToast, setSavedToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isStudent = profile.role === 'student';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isStudent) {
      const nameError = validateAlphabeticFullName(fullName, 'Student name');
      if (nameError) {
        setErrorMsg(nameError);
        return;
      }
      const sectionError = validateStudentSection(section);
      if (sectionError) {
        setErrorMsg(sectionError);
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[a-z0-9._%+-]+@lpu\.in$/i.test(cleanEmail)) {
        setErrorMsg('Student email must end with @lpu.in (not @gmail.com).');
        return;
      }
      onUpdateProfile({
        fullName: fullName.trim(),
        section: section.trim(),
        year,
        email: cleanEmail,
        studentDepartment: studentDept || null,
      });
    } else if (facultyDept) {
      onUpdateProfile({
        facultyDepartment: facultyDept,
        department: facultyDept,
      });
    }

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pt-5 pb-24 md:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5A6B6D]">
            {isStudent ? 'Student Account' : 'Faculty Account'} · Role-Locked Session
          </p>
          <h1 className="font-serif font-bold text-[26px] md:text-[32px] leading-tight text-[#0F1F21] mt-0.5">
            Academic Profile
          </h1>
        </div>

        <button
          type="button"
          onClick={onReturnToPortal}
          className="self-start sm:self-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Identity Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0D4E52] text-white flex items-center justify-center shrink-0">
                <User className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif font-bold text-xl text-[#0F1F21] truncate">
                  {isStudent ? profile.fullName : profile.facultyCode || profile.fullName}
                </h2>
                <p className="text-xs text-[#5A6B6D] mt-0.5 truncate">
                  {isStudent
                    ? `Student · ${
                        profile.studentDepartment || 'Select Department'
                      } · Section ${profile.section}`
                    : profile.facultyDepartment
                    ? `Faculty · ${profile.facultyDepartment}`
                    : 'Faculty · Select Department in Schedule'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EFF3F3] space-y-2.5 text-xs">
              {!isStudent && profile.facultyCode && (
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6B6D] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#0D4E52]" />
                    Faculty Login ID
                  </span>
                  <span className="font-mono font-semibold text-[#0F1F21]">
                    {profile.facultyCode}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#5A6B6D] flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-[#0D4E52]" />
                  {isStudent ? 'Student ID (7 Digits)' : 'Faculty ID (5 Digits)'}
                </span>
                <span className="font-mono font-semibold text-[#0F1F21] tabular-nums">
                  {profile.registrationNumber}
                </span>
              </div>

              {isStudent && (
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6B6D] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#0D4E52]" />
                    University Email
                  </span>
                  <span className="font-medium text-[#0F1F21] truncate max-w-[190px]">
                    {profile.email}
                  </span>
                </div>
              )}

              {isStudent && profile.rfId && (
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6B6D] flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#0D4E52]" />
                    Special RF ID
                  </span>
                  <span className="font-mono font-semibold text-[#0F1F21]">
                    {profile.rfId}
                  </span>
                </div>
              )}

              {isStudent && profile.specialCode && (
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6B6D] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0D4E52]" />
                    Special Code
                  </span>
                  <span className="font-mono font-semibold text-[#0F1F21]">
                    {profile.specialCode}
                  </span>
                </div>
              )}

              {!isStudent && (
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6B6D] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#0D4E52]" />
                    Scheduled Bookings
                  </span>
                  <span className="font-semibold text-[#0D4E52] tabular-nums">
                    {reservations.length} Active
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E7EFEF] p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F1F21]">
              <Shield className="w-4 h-4 text-[#0D4E52]" />
              <span>Portal Isolation Active</span>
            </div>
            <p className="text-xs text-[#5A6B6D] leading-relaxed">
              {isStudent
                ? 'You are signed in to the Student Portal. Instructor scheduling tools require signing out and authenticating with Faculty credentials.'
                : 'You are signed in to the Faculty Portal. Student accounts require separate student sign-in.'}
            </p>
          </div>
        </div>

        {/* Right Profile Editor */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white rounded-3xl border border-[#E7EFEF] p-6 space-y-4"
        >
          <h3 className="font-serif font-bold text-lg text-[#0F1F21]">
            {isStudent ? 'Edit Student Details' : 'Faculty Department & Session'}
          </h3>

          {errorMsg && (
            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-xs font-medium text-[#991B1B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isStudent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Academic Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Academic Department
                </label>
                <select
                  value={studentDept}
                  onChange={(e) =>
                    setStudentDept(e.target.value as FacultyDepartment | '')
                  }
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                >
                  <option value="">Select department</option>
                  {FACULTY_DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  University Email (@lpu.in)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Faculty Login ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={profile.facultyCode || profile.fullName}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#EEF3F3] border border-transparent font-mono text-sm text-[#415355] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Faculty ID (5 Digits)
                </label>
                <input
                  type="text"
                  readOnly
                  value={profile.registrationNumber}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#EEF3F3] border border-transparent font-mono tabular-nums text-sm text-[#415355] cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0F1F21] mb-1.5">
                  Assigned Department
                </label>
                <select
                  value={facultyDept}
                  onChange={(e) =>
                    setFacultyDept(e.target.value as FacultyDepartment | '')
                  }
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F2F5F5] border border-transparent text-sm text-[#0F1F21] focus:bg-white focus:border-[#0D4E52] focus:outline-none"
                >
                  <option value="">Select department</option>
                  {FACULTY_DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.blocksCount} {d.blocksCount === 1 ? 'Block' : 'Blocks'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {savedToast ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F7A6E]">
                <Check className="w-4 h-4" />
                Profile changes saved
              </span>
            ) : (
              <span className="text-xs text-[#5A6B6D]">
                {isStudent
                  ? 'Synced across your timetable & calendar exports'
                  : 'Update your active academic department above'}
              </span>
            )}

            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D4E52] hover:bg-[#093B3E] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
