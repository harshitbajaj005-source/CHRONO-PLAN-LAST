import type { Course, DayKey, FacultyDepartment } from '../types.ts';
import { padThreeDigits } from '../utils/subjectValidation.ts';

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SAT_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:45 AM - 12:00 PM',
  '12:30 PM - 02:00 PM',
  '02:50 PM - 03:40 PM',
  '04:00 PM - 04:50 PM',
];
const WEEKDAY_SLOT = '04:30 PM - 06:00 PM';

const CSE_TITLES = [
  'Data Structures & Problem Solving',
  'Discrete Mathematical Structures',
  'Computer Organization & Architecture',
  'Object-Oriented Programming in C++',
  'Operating Systems & Concurrency',
  'Database Management Systems',
  'Design & Analysis of Algorithms',
  'Formal Languages & Automata Theory',
  'Computer Networks & Protocols',
  'Software Engineering Methodologies',
  'Compiler Design & Parsing',
  'Artificial Intelligence Foundations',
  'Machine Learning & Pattern Recognition',
  'Web Engineering & Full-Stack Systems',
  'Distributed Computing & Consensus',
  'Cloud Architecture & Virtualization',
  'Cybersecurity & Network Defense',
  'Applied Cryptography & Zero-Knowledge',
  'Microprocessors & Embedded Interfacing',
  'Digital Signal & Image Processing',
  'Computer Graphics & Shader Pipelines',
  'Human-Computer Interaction Studio',
  'Big Data Analytics & Spark',
  'Deep Learning & Neural Architectures',
  'Natural Language Processing',
  'Reinforcement Learning Systems',
  'Mobile Application Engineering',
  'DevOps, Containers & CI/CD',
  'Blockchain & Smart Contracts',
  'Internet of Things & Edge Computing',
  'Parallel & GPU Computing',
  'Information Retrieval & Search Engines',
  'Software Testing & Quality Assurance',
  'Agile Product & Release Engineering',
  'Quantum Computing Fundamentals',
  'Bioinformatics Algorithms',
  'Computer Vision & 3D Perception',
  'Edge AI & TinyML Systems',
  'Real-Time Operating Systems',
  'High-Performance Computing',
  'Data Warehousing & Lakehouse Design',
  'Ethical Hacking & Penetration Testing',
  'Digital Forensics & Incident Response',
  'UI Systems & Design Engineering',
  'Robotics Kinematics & Path Planning',
  'Autonomous Systems Simulation',
  'Graph Mining & Network Science',
  'Explainable AI & Model Governance',
  'Site Reliability Engineering',
  'Low-Latency Systems Programming',
  'BTech CSE Capstone Seminar',
];

const BBA_TITLES = [
  'Principles of Management & Leadership',
  'Financial Accounting Foundations',
  'Microeconomics for Managers',
  'Business Statistics & Probability',
  'Business Communication & Rhetoric',
  'Marketing Management Fundamentals',
  'Organizational Behavior & Culture',
  'Macroeconomic Policy & Markets',
  'Cost & Management Accounting',
  'Business Law & Corporate Compliance',
  'Human Resource Management',
  'Operations & Process Management',
  'Corporate Finance Essentials',
  'Consumer Behavior & Insights',
  'Management Information Systems',
  'Entrepreneurship & Venture Creation',
  'International Business Environment',
  'Digital Marketing & Growth Analytics',
  'Supply Chain & Logistics Basics',
  'Business Ethics & Governance',
  'Retail & Merchandising Management',
  'Brand Management & Positioning',
  'Sales Strategy & Key Accounts',
  'Investment Analysis & Markets',
  'Banking & Financial Services',
  'Taxation Principles for Business',
  'E-Commerce Operations & Strategy',
  'Business Analytics with Spreadsheets',
  'Project Planning & Execution',
  'Negotiation & Conflict Resolution',
  'Service Operations Excellence',
  'Small Business & Family Enterprise',
  'Public Relations & Corporate Media',
  'Customer Relationship Management',
  'Design Thinking for Business',
  'BBA Applied Business Practicum',
];

const MBA_TITLES = [
  'Executive Managerial Economics',
  'Corporate Financial Reporting',
  'Strategic Marketing Architecture',
  'Organizational Leadership & Change',
  'Quantitative Methods for Decision Making',
  'Corporate Valuation & M&A',
  'Global Supply Chain Strategy',
  'Competitive Strategy & Industry Analysis',
  'Investment Banking & Capital Markets',
  'Private Equity & Venture Capital',
  'Derivatives & Risk Engineering',
  'Behavioral Finance & Portfolio Theory',
  'Enterprise Digital Transformation',
  'Product Management & Go-To-Market',
  'B2B Growth & Enterprise Sales',
  'Consumer Neuroscience & Market Research',
  'People Analytics & Talent Strategy',
  'Compensation & Performance Systems',
  'International Trade & Geopolitics',
  'Cross-Cultural Executive Management',
  'Predictive Analytics & Decision Modeling',
  'Operations Research & Optimization',
  'Lean Six Sigma & Quality Systems',
  'Procurement & Strategic Sourcing',
  'FinTech & Digital Payments',
  'ESG, Sustainability & Impact Finance',
  'Healthcare Management & Policy',
  'Technology & Innovation Strategy',
  'Corporate Restructuring & Turnaround',
  'Real Estate Finance & Investment',
  'Pricing Strategy & Revenue Management',
  'Luxury & Global Brand Strategy',
  'Omnichannel Retail Leadership',
  'AI Strategy for Business Leaders',
  'Platform Economics & Network Effects',
  'Corporate Governance & Board Dynamics',
  'Entrepreneurial Finance & Pitching',
  'Crisis Leadership & Resilience',
  'Management Consulting Frameworks',
  'Global Macroeconomics Seminar',
  'MBA Integrative Strategy Capstone',
];

const ACH_TITLES = [
  'Architectural Design Studio I',
  'History of World Architecture',
  'Building Materials & Construction I',
  'Architectural Graphics & Drafting',
  'Descriptive Geometry & Perspective',
  'Theory of Architecture & Form',
  'Structural Mechanics for Architects',
  'Climatology & Passive Solar Design',
  'Vernacular & Regional Architecture',
  'Building Services: Water & Plumbing',
  'Acoustic & Lighting Design',
  'CAD, BIM & Parametric Modeling',
  'Urban Design & Public Realm',
  'Landscape Architecture Principles',
  'Sustainable & Net-Zero Buildings',
  'Interior Space Planning & Detailing',
  'Steel & Timber Structural Systems',
  'Reinforced Concrete Architecture',
  'Housing & Community Typologies',
  'Heritage Conservation & Adaptive Reuse',
  'High-Rise & Long-Span Structures',
  'HVAC & Mechanical Building Systems',
  'Electrical & Smart Building Integration',
  'Construction Project Management',
  'Quantity Surveying & Estimation',
  'Architectural Photography & Representation',
  'Computational Fabrication & Robotics',
  'Hospital & Healthcare Facility Design',
  'Civic & Cultural Institution Design',
  'Transit-Oriented Urban Development',
  'Disaster-Resilient Architecture',
  'Green Rating Systems & LEED Studio',
  'Real Estate & Architectural Practice',
  'Building Codes & Municipal Bylaws',
  'Furniture & Industrial Craft Design',
  'Exhibition & Spatial Scenography',
  'Bio-Inspired Structural Tectonics',
  'Coastal & Waterfront Architecture',
  'Low-Cost & Modular Housing Lab',
  'Professional Ethics in Architecture',
  'Architectural Thesis Pre-Design',
];

const AGC_TITLES = [
  'Principles of Agronomy & Crop Science',
  'Soil Physics & Fertility Management',
  'Agricultural Meteorology & Climate',
  'Plant Physiology & Stress Biology',
  'Genetics & Crop Improvement',
  'Principles of Horticulture',
  'Agricultural Microbiology',
  'Plant Pathology & Disease Control',
  'Agricultural Entomology & IPM',
  'Irrigation & Water Resource Engineering',
  'Seed Technology & Certification',
  'Weed Science & Herbicide Management',
  'Farm Machinery & Precision Power',
  'Organic Farming & Agroecology',
  'Agricultural Economics & Farm Management',
  'Post-Harvest Handling & Storage',
  'Dairy & Livestock Production',
  'Poultry Science & Nutrition',
  'Soil Chemistry & Nutrient Cycling',
  'Protected Cultivation & Greenhouses',
  'Plant Biotechnology & Tissue Culture',
  'Agribusiness Marketing & Cooperatives',
  'Agricultural Extension & Rural Policy',
  'Dryland & Rainfed Agriculture',
  'Fruit Science & Orchard Management',
  'Vegetable Crop Production Systems',
  'Floriculture & Ornamental Landscaping',
  'Spices, Medicinal & Aromatic Crops',
  'GIS & Remote Sensing in Agriculture',
  'Drone & Sensor Precision Farming',
  'Food Processing & Preservation Tech',
  'Fisheries & Aquaculture Management',
  'Apiculture & Sericulture Systems',
  'Watershed & Soil Conservation',
  'Biofertilizers & Microbial Inoculants',
  'Agricultural Finance & Crop Insurance',
  'Climate-Smart Cropping Systems',
  'Hydroponics & Vertical Farming',
  'Seed Pathology & Quarantine',
  'Sustainable Agroforestry Systems',
  'Rural Agricultural Work Practicum',
];

const LAW_TITLES = [
  'Jurisprudence & Legal Theory',
  'Constitutional Law I: Fundamental Rights',
  'Constitutional Law II: Federalism',
  'Law of Contracts I: General Principles',
  'Law of Contracts II: Specific Relief',
  'Law of Torts & Consumer Protection',
  'Criminal Law I: Substantive Offences',
  'Criminal Procedure & Investigation',
  'Civil Procedure & Limitation',
  'Law of Evidence & Forensics',
  'Family Law I: Marriage & Succession',
  'Family Law II: Property & Guardianship',
  'Property Law & Easements',
  'Administrative Law & Tribunals',
  'Company & Corporate Governance Law',
  'Public International Law',
  'Human Rights & Humanitarian Law',
  'Environmental & Climate Law',
  'Labour & Industrial Relations Law',
  'Intellectual Property Rights',
  'Patent Law & Technology Transfer',
  'Copyright & Media Regulation',
  'Trademark & Brand Protection',
  'Cyber Law & Data Privacy',
  'Banking, Insolvency & Bankruptcy Law',
  'Taxation Law: Direct & Indirect',
  'Competition & Antitrust Law',
  'Securities & Capital Market Law',
  'Mergers, Acquisitions & Private Equity Law',
  'International Trade & WTO Law',
  'Maritime & Admiralty Law',
  'Space & Aviation Law',
  'Alternative Dispute Resolution & Arbitration',
  'Mediation & Negotiation Clinic',
  'Drafting, Pleading & Conveyancing',
  'Professional Ethics & Bar Advocacy',
  'Medical Jurisprudence & Bioethics',
  'White-Collar Crime & Compliance',
  'AI Governance & Algorithmic Liability',
  'Moot Court & Appellate Advocacy',
  'Legal Aid & Clinical Practicum',
];

const CIV_TITLES = [
  'Engineering Mechanics & Statics',
  'Strength of Materials & Elasticity',
  'Surveying & Geomatics Engineering',
  'Building Materials & Concrete Tech',
  'Fluid Mechanics & Open Channel Flow',
  'Structural Analysis I: Determinate',
  'Structural Analysis II: Indeterminate',
  'Geotechnical Engineering I: Soil Mechanics',
  'Geotechnical Engineering II: Foundations',
  'Reinforced Concrete Design',
  'Steel Structure Design',
  'Hydrology & Water Resources',
  'Irrigation & Hydraulic Structures',
  'Transportation & Highway Engineering',
  'Traffic Engineering & Urban Mobility',
  'Environmental Engineering I: Water Supply',
  'Environmental Engineering II: Wastewater',
  'Construction Planning & Scheduling',
  'Estimation, Costing & Valuation',
  'Earthquake-Resistant Structural Design',
  'Bridge & Tunnel Engineering',
  'Prestressed Concrete Structures',
  'Remote Sensing & GIS for Civil Works',
  'Solid & Hazardous Waste Management',
  'Green Infrastructure & Smart Cities',
  'Civil Engineering Capstone Design',
];

const MBS_TITLES = [
  'Human Gross Anatomy: Upper & Lower Limb',
  'Human Gross Anatomy: Thorax & Abdomen',
  'Neuroanatomy & Special Senses',
  'Human Histology & Microscopic Anatomy',
  'Medical Embryology & Development',
  'General & Cellular Physiology',
  'Cardiovascular Physiology',
  'Respiratory & Acid-Base Physiology',
  'Renal & Fluid Physiology',
  'Gastrointestinal & Hepatic Physiology',
  'Endocrine & Reproductive Physiology',
  'Neurophysiology & Motor Control',
  'Biochemistry of Biomolecules',
  'Metabolism & Clinical Enzymology',
  'Molecular Genetics & Medical Genomics',
  'Nutrition & Metabolic Disorders',
  'General Pathology & Cell Injury',
  'Hematopathology & Coagulation',
  'Systemic Pathology: Cardiopulmonary',
  'Systemic Pathology: GI & Renal',
  'Systemic Pathology: Endocrine & CNS',
  'General Microbiology & Sterilization',
  'Clinical Bacteriology',
  'Medical Virology & Emerging Pathogens',
  'Medical Mycology & Parasitology',
  'Clinical Immunology & Hypersensitivity',
  'General Pharmacology & Pharmacokinetics',
  'Autonomic & Cardiovascular Pharmacology',
  'CNS & Psychopharmacology',
  'Antimicrobial & Chemotherapy Agents',
  'Endocrine & GI Pharmacology',
  'Forensic Medicine & Medical Ethics',
  'Clinical Toxicology & Poisoning',
  'Community Medicine & Epidemiology',
  'Biostatistics & Clinical Trials',
  'Maternal & Child Health Systems',
  'Communicable Disease Surveillance',
  'Non-Communicable Disease Prevention',
  'Clinical Examination & History Taking',
  'Internal Medicine: Cardiology',
  'Internal Medicine: Pulmonology',
  'Internal Medicine: Gastroenterology',
  'Internal Medicine: Nephrology',
  'Internal Medicine: Endocrinology',
  'Internal Medicine: Neurology',
  'Internal Medicine: Rheumatology',
  'Internal Medicine: Infectious Diseases',
  'General Surgery: Wound & Trauma Care',
  'General Surgery: GI & Hepatobiliary',
  'General Surgery: Endocrine & Breast',
  'Vascular & Cardiothoracic Surgery',
  'Neurosurgery Fundamentals',
  'Urology & Renal Transplantation',
  'Orthopedics: Fractures & Trauma',
  'Orthopedics: Spine & Joint Reconstruction',
  'Obstetrics: Antenatal & Normal Labor',
  'Obstetrics: High-Risk Pregnancy',
  'Gynecology & Reproductive Health',
  'Neonatology & Newborn Resuscitation',
  'Pediatrics: Growth & Immunization',
  'Pediatrics: Acute & Critical Care',
  'Ophthalmology: Anterior Segment',
  'Ophthalmology: Retina & Neuro-Vision',
  'Otorhinolaryngology (ENT) & Audiology',
  'Dermatology, Venereology & Leprology',
  'Clinical Psychiatry & Behavioral Health',
  'Anesthesiology & Airway Management',
  'Critical Care & Intensive Medicine',
  'Emergency Medicine & Triage Protocols',
  'Diagnostic Radiology & CT/MRI',
  'Interventional Radiology & Ultrasound',
  'Nuclear Medicine & PET Imaging',
  'Physical Medicine & Rehabilitation',
  'Oncology & Palliative Care',
  'Geriatric Medicine & Polypharmacy',
  'Blood Banking & Transfusion Medicine',
  'Hospital Infection Control',
  'Clinical Skills & Simulation Lab',
  'Medical Research & Evidence Appraisal',
  'Patient Safety & Quality Care',
  'MBBS Integrated Clinical Clerkship',
];

const PEL_SUBJECT_BASES = [
  'Analytical Reasoning & Quantitative Aptitude',
  'Academic Writing & Rhetoric',
  'Verbal Ability & Comprehension',
  'Critical Thinking & Logic',
  'Professional Communication Studio',
  'Ethics, Values & Civic Leadership',
  'Environmental Awareness & Climate Literacy',
  'Applied Statistics & Data Literacy',
  'Foreign Language: German Communication',
  'Foreign Language: French Communication',
  'Foreign Language: Japanese Communication',
  'Foreign Language: Spanish Communication',
  'Soft Skills & Interview Readiness',
  'Public Speaking & Presentation Craft',
  'Personal Finance & Wealth Literacy',
  'Digital Productivity & Information Systems',
  'Creative Thinking & Innovation Lab',
  'Indian Heritage & Global Culture',
  'Psychology of Well-Being & Resilience',
  'Media Literacy & Digital Citizenship',
  'Research Methodology & Citation',
  'Design Aesthetics & Visual Storytelling',
  'Leadership & Team Dynamics',
  'Community Engagement & Social Impact',
  'Health, Nutrition & Mindful Living',
  'Problem Solving with Computational Logic',
];

const PEL_LEVELS = [
  'Foundation',
  'Intermediate',
  'Applied',
  'Practice',
  'Studio',
  'Seminar',
];

function buildPelTitle(index: number): string {
  const base = PEL_SUBJECT_BASES[index % PEL_SUBJECT_BASES.length];
  const levelIdx = Math.floor(index / PEL_SUBJECT_BASES.length);
  if (levelIdx === 0) return base;
  const suffix = PEL_LEVELS[levelIdx % PEL_LEVELS.length];
  return `${base} — ${suffix} ${Math.floor(index / PEL_SUBJECT_BASES.length) + 1}`;
}

const INSTRUCTOR_POOLS: Record<FacultyDepartment, string[]> = {
  'BTech CSE department': [
    'Prof. Evelyn Vance',
    'Dr. Marcus Chen',
    'Prof. Sarah Jenkins',
    'Dr. Alan Turing',
    'Dr. Leslie Lamport',
    'Prof. Whitfield Diffie',
    'Dr. Barbara Liskov',
  ],
  'Business department': [
    'Prof. Clayton Vance',
    'Dr. Indra Kapoor',
    'Prof. Vikram Malhotra',
    'Dr. Helena Meyer',
    'Prof. Daniel Kahn',
  ],
  'Architecture department': [
    'Ar. Maya Lin',
    'Prof. Norman Foster',
    'Ar. Ananya Rao',
    'Prof. Santiago Cruz',
  ],
  'Agriculture department': [
    'Dr. Norman Borlaug',
    'Prof. Kavita Deshmukh',
    'Dr. Rajeshwar Nair',
    'Prof. Emily Swaminathan',
  ],
  'Law department': [
    'Prof. Upendra Baxi',
    'Adv. Meera Krishnan',
    'Dr. Ronald Dworkin',
    'Prof. Nivedita Sen',
  ],
  'MBBS department': [
    'Dr. Siddhartha Mukherjee',
    'Dr. Priya Venkataraman',
    'Prof. Atul Gawande',
    'Dr. Rohan Kulkarni',
    'Dr. Farah Al-Mansoor',
  ],
  'Civil department': [
    'Prof. Karl Terzaghi',
    'Dr. Amitabh Sinha',
    'Prof. Elena Petrova',
    'Dr. Suresh Iyengar',
  ],
  Others: [
    'Prof. Claire Moreau',
    'Dr. Arjun Chatterjee',
    'Prof. Hannah Lindqvist',
    'Dr. Kenji Sato',
    'Prof. Sonia Verma',
  ],
};

function generateTrackCourses(params: {
  department: FacultyDepartment;
  prefix: string;
  start: number;
  end: number;
  titles: string[] | ((idx: number) => string);
  blockCount: number;
}): Course[] {
  const { department, prefix, start, end, titles, blockCount } = params;
  const instructors = INSTRUCTOR_POOLS[department];
  const courses: Course[] = [];

  for (let num = start; num <= end; num++) {
    const idx = num - start;
    const threeDigit = padThreeDigits(num);
    const code = `${prefix}-${threeDigit}`;
    const title = typeof titles === 'function' ? titles(idx) : titles[idx] || `${prefix} Special Topics ${threeDigit}`;
    const instructor = instructors[num % instructors.length];
    const day = DAYS[(num + idx) % DAYS.length];
    const timeSlot =
      day === 'Sat' ? SAT_SLOTS[num % SAT_SLOTS.length] : WEEKDAY_SLOT;
    const blockNum = (num % blockCount) + 1;
    const floorNum = ((num + 2) % 9) + 1;
    const roomIndex = ((num + 4) % 10) + 1;
    const roomCode = `${floorNum}${String(roomIndex).padStart(2, '0')}`;
    const credits = num % 4 === 0 ? 4.0 : num % 3 === 0 ? 2.0 : 3.0;
    const seatsLeft = 4 + ((num * 7) % 22);

    courses.push({
      id: code,
      code,
      threeDigitCode: threeDigit,
      trackPrefix: prefix,
      title,
      instructor,
      department,
      credits,
      scheduleSummary: `${day} · ${timeSlot}`,
      day,
      timeSlot,
      room: `Block ${blockNum} · Room ${roomCode}`,
      enrolled: false,
      seatsLeft,
      description: `${title} (${code}) offered under ${department}. Covers structured modules, guided assessments, and applied studio or lab sessions.`,
    });
  }

  return courses;
}

export const ALL_CATALOG_COURSES: Course[] = [
  // 1. BTech CSE: CSE-300 to CSE-350 (51 courses)
  ...generateTrackCourses({
    department: 'BTech CSE department',
    prefix: 'CSE',
    start: 300,
    end: 350,
    titles: CSE_TITLES,
    blockCount: 5,
  }),
  // 2a. Business BBA: BBA-100 to BBA-135 (36 courses)
  ...generateTrackCourses({
    department: 'Business department',
    prefix: 'BBA',
    start: 100,
    end: 135,
    titles: BBA_TITLES,
    blockCount: 3,
  }),
  // 2b. Business MBA: MBA-660 to MBA-700 (41 courses)
  ...generateTrackCourses({
    department: 'Business department',
    prefix: 'MBA',
    start: 660,
    end: 700,
    titles: MBA_TITLES,
    blockCount: 3,
  }),
  // 3. Architecture: ACH-200 to ACH-240 (41 courses)
  ...generateTrackCourses({
    department: 'Architecture department',
    prefix: 'ACH',
    start: 200,
    end: 240,
    titles: ACH_TITLES,
    blockCount: 1,
  }),
  // 4. Agriculture: AGC-500 to AGC-540 (41 courses)
  ...generateTrackCourses({
    department: 'Agriculture department',
    prefix: 'AGC',
    start: 500,
    end: 540,
    titles: AGC_TITLES,
    blockCount: 1,
  }),
  // 5. Law: LAW-550 to LAW-590 (41 courses)
  ...generateTrackCourses({
    department: 'Law department',
    prefix: 'LAW',
    start: 550,
    end: 590,
    titles: LAW_TITLES,
    blockCount: 1,
  }),
  // 6. MBBS: MBS-520 to MBS-600 (81 courses)
  ...generateTrackCourses({
    department: 'MBBS department',
    prefix: 'MBS',
    start: 520,
    end: 600,
    titles: MBS_TITLES,
    blockCount: 1,
  }),
  // 7. Civil: CIV-920 to CIV-945 (26 courses)
  ...generateTrackCourses({
    department: 'Civil department',
    prefix: 'CIV',
    start: 920,
    end: 945,
    titles: CIV_TITLES,
    blockCount: 1,
  }),
  // 8. Others: PEL-050 to PEL-200 (151 courses)
  ...generateTrackCourses({
    department: 'Others',
    prefix: 'PEL',
    start: 50,
    end: 200,
    titles: buildPelTitle,
    blockCount: 1,
  }),
];

export function getCoursesByDepartment(
  department: FacultyDepartment,
  source: Course[] = ALL_CATALOG_COURSES
): Course[] {
  return source.filter((c) => c.department === department);
}

export function searchDepartmentCoursesByCode(
  department: FacultyDepartment,
  rawQuery: string,
  trackPrefix?: string,
  source: Course[] = ALL_CATALOG_COURSES
): Course[] {
  const deptCourses = getCoursesByDepartment(department, source);
  const filteredTrack = trackPrefix
    ? deptCourses.filter((c) => c.trackPrefix === trackPrefix)
    : deptCourses;

  const trimmed = rawQuery.trim().toUpperCase();
  if (!trimmed) return filteredTrack;

  const digitsOnly = trimmed.replace(/\D/g, '');
  const compact = trimmed.replace(/[\s-]+/g, '');

  return filteredTrack.filter((c) => {
    const three = c.threeDigitCode || c.code.split('-')[1] || '';
    const fullCompact = c.code.replace('-', '');
    if (/^\d+$/.test(trimmed)) {
      return three.startsWith(trimmed) || three.includes(trimmed);
    }
    return (
      fullCompact.includes(compact) ||
      c.code.includes(trimmed) ||
      (digitsOnly.length > 0 && three.includes(digitsOnly)) ||
      c.title.toLowerCase().includes(rawQuery.trim().toLowerCase())
    );
  });
}

export function findCatalogCourseByCode(code: string): Course | undefined {
  const compact = code.trim().toUpperCase().replace(/[\s-]+/g, '');
  return ALL_CATALOG_COURSES.find(
    (c) => c.code.replace('-', '').toUpperCase() === compact
  );
}
