import type { FacultyDepartment } from '../types.ts';

export interface SubjectValidationResult {
  valid: boolean;
  normalizedCode: string;
  error?: string;
}

export interface DepartmentTrackSpec {
  prefix: string;
  min: number;
  max: number;
  label: string;
}

export interface DepartmentCourseSpec {
  department: FacultyDepartment;
  shortLabel: string;
  tracks: DepartmentTrackSpec[];
  rangeSummary: string;
  courseCount: number;
}

export const DEPARTMENT_COURSE_SPECS: Record<
  FacultyDepartment,
  DepartmentCourseSpec
> = {
  'BTech CSE department': {
    department: 'BTech CSE department',
    shortLabel: 'CSE',
    tracks: [
      { prefix: 'CSE', min: 300, max: 350, label: 'CSE-300 to CSE-350' },
    ],
    rangeSummary: 'CSE-300 to CSE-350',
    courseCount: 51,
  },
  'Business department': {
    department: 'Business department',
    shortLabel: 'Business',
    tracks: [
      { prefix: 'BBA', min: 100, max: 135, label: 'BBA-100 to BBA-135' },
      { prefix: 'MBA', min: 660, max: 700, label: 'MBA-660 to MBA-700' },
    ],
    rangeSummary: 'BBA-100 to BBA-135 · MBA-660 to MBA-700',
    courseCount: 77,
  },
  'Architecture department': {
    department: 'Architecture department',
    shortLabel: 'Architecture',
    tracks: [
      { prefix: 'ACH', min: 200, max: 240, label: 'ACH-200 to ACH-240' },
    ],
    rangeSummary: 'ACH-200 to ACH-240',
    courseCount: 41,
  },
  'Agriculture department': {
    department: 'Agriculture department',
    shortLabel: 'Agriculture Department',
    tracks: [
      { prefix: 'AGC', min: 500, max: 540, label: 'AGC-500 to AGC-540' },
    ],
    rangeSummary: 'AGC-500 to AGC-540',
    courseCount: 41,
  },
  'Law department': {
    department: 'Law department',
    shortLabel: 'Law',
    tracks: [
      { prefix: 'LAW', min: 550, max: 590, label: 'LAW-550 to LAW-590' },
    ],
    rangeSummary: 'LAW-550 to LAW-590',
    courseCount: 41,
  },
  'MBBS department': {
    department: 'MBBS department',
    shortLabel: 'MBBS Department',
    tracks: [
      { prefix: 'MBS', min: 520, max: 600, label: 'MBS-520 to MBS-600' },
    ],
    rangeSummary: 'MBS-520 to MBS-600',
    courseCount: 81,
  },
  'Civil department': {
    department: 'Civil department',
    shortLabel: 'Civil Department',
    tracks: [
      { prefix: 'CIV', min: 920, max: 945, label: 'CIV-920 to CIV-945' },
    ],
    rangeSummary: 'CIV-920 to CIV-945',
    courseCount: 26,
  },
  Others: {
    department: 'Others',
    shortLabel: 'Others',
    tracks: [
      { prefix: 'PEL', min: 50, max: 200, label: 'PEL-050 to PEL-200' },
    ],
    rangeSummary: 'PEL-050 to PEL-200',
    courseCount: 151,
  },
};

export function padThreeDigits(num: number): string {
  return String(num).padStart(3, '0');
}

export function resolveThreeDigitSubjectCode(
  department: FacultyDepartment,
  rawDigits: string,
  preferredPrefix?: string
): SubjectValidationResult {
  const digits = rawDigits.trim().replace(/\D/g, '');
  const spec = DEPARTMENT_COURSE_SPECS[department];
  if (!digits || digits.length !== 3) {
    return {
      valid: false,
      normalizedCode: digits,
      error: `Enter a 3-digit subject code (${spec.rangeSummary}).`,
    };
  }

  const num = parseInt(digits, 10);
  const candidateTracks = preferredPrefix
    ? spec.tracks.filter((t) => t.prefix === preferredPrefix)
    : spec.tracks;

  for (const track of candidateTracks) {
    if (num >= track.min && num <= track.max) {
      return {
        valid: true,
        normalizedCode: `${track.prefix}-${padThreeDigits(num)}`,
      };
    }
  }

  return {
    valid: false,
    normalizedCode: digits,
    error: `Code ${digits} is outside ${spec.shortLabel} range (${spec.rangeSummary}).`,
  };
}

export function validateDepartmentSubjectCode(
  department: FacultyDepartment,
  rawCode: string
): SubjectValidationResult {
  const compact = rawCode.trim().toUpperCase().replace(/[\s-]+/g, '');
  const spec = DEPARTMENT_COURSE_SPECS[department];

  // Allow pure 3-digit code entry (resolves automatically within department)
  if (/^\d{3}$/.test(compact)) {
    return resolveThreeDigitSubjectCode(department, compact);
  }

  const match = /^([A-Z]{3})(\d{3})$/.exec(compact);
  if (!match) {
    return {
      valid: false,
      normalizedCode: compact,
      error: `${spec.shortLabel} requires ${spec.rangeSummary} (e.g. ${spec.tracks[0].prefix}-${padThreeDigits(spec.tracks[0].min)}).`,
    };
  }

  const prefix = match[1];
  const digits = match[2];
  const num = parseInt(digits, 10);

  const track = spec.tracks.find((t) => t.prefix === prefix);
  if (!track) {
    return {
      valid: false,
      normalizedCode: compact,
      error: `${spec.shortLabel} requires prefix ${spec.tracks.map((t) => t.prefix).join(' or ')} (${spec.rangeSummary}).`,
    };
  }

  if (num < track.min || num > track.max) {
    return {
      valid: false,
      normalizedCode: `${prefix}-${digits}`,
      error: `${prefix} subject code number must be between ${padThreeDigits(track.min)} and ${padThreeDigits(track.max)}.`,
    };
  }

  return { valid: true, normalizedCode: `${prefix}-${digits}` };
}

export function validateFacultyPassword(password: string): string | null {
  if (!password) {
    return 'Password is required for Faculty Access.';
  }
  if (!/^\d{4,}[A-Za-z]$/.test(password)) {
    return 'Faculty password must have at least 4 digits first followed by 1 alphabet at the end (uppercase or lowercase, minimum 5 characters).';
  }
  return null;
}

export function validateStudentPassword(password: string): string | null {
  if (!password) {
    return 'Password is required to sign in.';
  }
  if (password.length < 8 || password.length > 10) {
    return 'Student password must be between 8 and 10 characters long.';
  }
  if (!/^[A-Za-z0-9]+$/.test(password)) {
    return 'Student password must include alphabets and digits only (no symbols or spaces).';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Student password must include both alphabets and digits.';
  }
  return null;
}

export function validateAlphabeticFullName(
  rawName: string,
  label = 'Full name'
): string | null {
  const name = rawName.trim();
  if (!name) {
    return `Please enter your ${label.toLowerCase()}.`;
  }
  if (/\d/.test(name)) {
    return `${label} must contain only alphabets (numbers are not allowed).`;
  }
  if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(name)) {
    return `${label} must contain only alphabets.`;
  }
  return null;
}

export function validateSingleAlphabeticName(
  rawName: string,
  label: string,
  required = true
): string | null {
  const name = rawName.trim();
  if (!name) {
    return required ? `${label} is required.` : null;
  }
  if (/\d/.test(name)) {
    return `${label} must contain only alphabets (numbers are not allowed).`;
  }
  if (!/^[A-Za-z]{1,40}$/.test(name)) {
    return `${label} must contain only alphabets.`;
  }
  return null;
}

export function validateStudentSection(rawSection: string): string | null {
  const section = rawSection.trim();
  if (!section) {
    return 'Please enter your section.';
  }
  if (!/^(?:[A-Za-z]{2}|[A-Za-z]\d|\d[A-Za-z])$/.test(section)) {
    return 'Section must be 2 alphabets or 1 alphabet and 1 digit.';
  }
  return null;
}
