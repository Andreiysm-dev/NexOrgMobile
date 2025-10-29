export interface DropdownOption {
  value: string;
  label: string;
}

export type YearLevel = '1st Year' | '2nd Year' | '3rd Year' | '4th Year' | 'Graduate';
export type UserType = 'student' | 'faculty' | 'staff';
export type Course = string; // Will be dynamic based on department

// User Types
export const USER_TYPES: DropdownOption[] = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty Member' },
];

// Year Levels
export const YEAR_LEVELS: DropdownOption[] = [
  { value: '1st Year', label: '1st Year' },
  { value: '2nd Year', label: '2nd Year' },
  { value: '3rd Year', label: '3rd Year' },
  { value: '4th Year', label: '4th Year' },
  { value: 'Graduate', label: 'Graduate Student' }
];

// DEPRECATED: These will be replaced by dynamic data from API
// Keeping as fallback in case API fails
export const FALLBACK_DEPARTMENTS: DropdownOption[] = [
  { value: 'CCMS', label: 'College of Computer and Multimedia Studies' },
  { value: 'CED', label: 'College of Education' },
  { value: 'CEng', label: 'College of Engineering' },
  { value: 'CBA', label: 'College of Business and Accountancy' },
  { value: 'CNAHS', label: 'College of Nursing and Allied Health Sciences' },
  { value: 'CCJC', label: 'College of Criminal Justice and Criminology' },
  { value: 'CAFA', label: 'College of Architecture and Fine Arts' },
  { value: 'CAS', label: 'College of Arts and Sciences' },
  { value: 'CIHTM', label: 'College of Hospitality and Tourism Management' },
  { value: 'CME', label: 'College of Maritime Education' },
];

// DEPRECATED: These will be replaced by dynamic data from API
// Keeping as fallback in case API fails
export const FALLBACK_COURSES_BY_DEPARTMENT: Record<string, DropdownOption[]> = {
  CCMS: [
    { value: 'BSCS', label: 'BS Computer Science' },
    { value: 'BSIT', label: 'BS Information Technology' },
    { value: 'BSEMC', label: 'BS Entertainment and Multimedia Computing' },
  ],
  CED: [
    { value: 'BSED', label: 'BS Secondary Education' },
    { value: 'BEED', label: 'BS Elementary Education' },
    { value: 'BPE', label: 'Bachelor of Physical Education' },
    { value: 'BSE-Math', label: 'BS Education Major in Mathematics' },
    { value: 'BSE-English', label: 'BS Education Major in English' }
  ],
  CEng: [
    { value: 'BSCE', label: 'BS Civil Engineering' },
    { value: 'BSEE', label: 'BS Electrical Engineering' },
    { value: 'BSME', label: 'BS Mechanical Engineering' },
    { value: 'BSChE', label: 'BS Chemical Engineering' }
  ],
  CBA: [
    { value: 'BSA', label: 'BS Accountancy' },
    { value: 'BSBA-MM', label: 'BS Business Administration - Marketing Management' },
    { value: 'BSBA-FM', label: 'BS Business Administration - Financial Management' },
    { value: 'BSBA-HRM', label: 'BS Business Administration - Human Resource Management' }
  ],
  CNAHS: [
    { value: 'BSN', label: 'BS Nursing' },
    { value: 'BSM', label: 'BS Midwifery' }
  ]
};

// User Interests - Add more as needed
export const INTERESTS: DropdownOption[] = [
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'reading', label: '📚 Reading' },
  { value: 'spelling', label: '📝 Spelling & Writing' },
  { value: 'sports', label: '⚽ Sports' },
  { value: 'music', label: '🎵 Music' },
  { value: 'art', label: '🎨 Art & Design' },
  { value: 'technology', label: '💻 Technology' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'cooking', label: '🍳 Cooking' },
  { value: 'photography', label: '📷 Photography' },
  { value: 'fitness', label: '💪 Fitness' },
  { value: 'dancing', label: '💃 Dancing' },
  { value: 'volunteer', label: '🤝 Volunteering' },
  { value: 'debate', label: '🗣️ Debate & Public Speaking' },
  { value: 'science', label: '🔬 Science' },
  { value: 'environment', label: '🌱 Environmental Issues' },
  { value: 'business', label: '💼 Business & Entrepreneurship' },
  { value: 'movies', label: '🎬 Movies & Film' },
  { value: 'anime', label: '🎌 Anime & Manga' },
  { value: 'coding', label: '👨‍💻 Programming' }
];
