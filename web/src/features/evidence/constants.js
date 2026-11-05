export const EVIDENCE_TYPES = [
  { value: 'REPORT', label: 'Report' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'ATTENDANCE_SHEET', label: 'Attendance Sheet' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'MEMORANDUM', label: 'Memorandum' },
  { value: 'PRESENTATION', label: 'Presentation' },
  { value: 'EVALUATION', label: 'Evaluation' },
  { value: 'OTHER', label: 'Other' },
];

// Metadata tag options mirror the user-management lists (departments, institutional
// offices, service offices) so a unit can be tagged exactly as it can be invited.
// Legacy values (e.g. COLLEGE_OF_EDUCATION) stay valid on the backend and still display
// via formatRelatedOffice, but are no longer offered.
export const RELATED_OFFICES = [
  // Departments
  { value: 'COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE', label: 'College of Engineering and Architecture' },
  { value: 'COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY', label: 'College of Management, Business, and Accountancy' },
  { value: 'COLLEGE_OF_ARTS_AND_SCIENCES', label: 'College of Arts, Sciences, and Education' },
  { value: 'COLLEGE_OF_NURSING', label: 'College of Nursing and Allied Health Sciences' },
  { value: 'COLLEGE_OF_COMPUTER_STUDIES', label: 'College of Computer Studies' },
  { value: 'COLLEGE_OF_CRIMINAL_JUSTICE', label: 'College of Criminal Justice' },

  // Institutional Offices
  { value: 'QUALITY_ASSURANCE_OFFICE', label: 'Quality Assurance Office' },
  { value: 'RESEARCH_OFFICE', label: 'Research and Development Coordinating Office' },
  { value: 'HUMAN_RESOURCE_OFFICE', label: 'Human Resource Department' },
  { value: 'FACILITIES_MANAGEMENT_OFFICE', label: 'Facilities Management Office' },
  { value: 'COMMUNITY_EXTENSION_SERVICE', label: 'Community Extension Services' },
  { value: 'SAFETY_AND_SECURITY_DEPARTMENT', label: 'Safety and Security Department' },

  // Service Offices
  { value: 'STUDENT_SUCCESS_OFFICE', label: 'Student Success Office' },
  { value: 'REGISTRARS_OFFICE', label: 'Registrar’s Office' },
  { value: 'LIBRARY', label: 'Learning Resource and Activity Center' },
  { value: 'GUIDANCE_CENTER', label: 'Guidance Center' },
  { value: 'MEDICAL_DENTAL_CLINIC', label: 'Medical-Dental Clinic' },
  { value: 'TECHNICAL_SUPPORT_GROUP', label: 'Technical Support Group' },
  { value: 'ADMISSIONS_AND_SCHOLARSHIPS', label: 'Admissions & Scholarships' },
  { value: 'NATIONAL_SERVICE_TRAINING_PROGRAM', label: 'National Service Training Program' },
  { value: 'FINANCE_OFFICE', label: 'Finance Office' },
];

// Labels for values that are no longer selectable but may still be stored on old records.
const LEGACY_RELATED_OFFICE_LABELS = {
  EXTENSION_OFFICE: 'Extension Office',
  STUDENT_AFFAIRS_OFFICE: 'Student Affairs Office',
  GUIDANCE_OFFICE: 'Guidance Office',
  CLINIC: 'Clinic',
  SAFETY_AND_SECURITY: 'Safety & Security',
  COLLEGE_OF_EDUCATION: 'College of Education',
};

const DEPARTMENT_TO_RELATED_OFFICE = {
  CCS: 'COLLEGE_OF_COMPUTER_STUDIES',
  CEA: 'COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE',
  CNAHS: 'COLLEGE_OF_NURSING',
  CMBA: 'COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY',
  CASE: 'COLLEGE_OF_ARTS_AND_SCIENCES',
  CCJ: 'COLLEGE_OF_CRIMINAL_JUSTICE',
};

// True when the evidence's related-office tags include the user's own department/office.
export function isUserUnitTagged(user, item) {
  const unit = user?.office;
  if (!unit || !item?.relatedOffices?.length) return false;
  const related = DEPARTMENT_TO_RELATED_OFFICE[unit] || unit;
  return item.relatedOffices.includes(related);
}

// True when the activity belongs to someone else's department/office (admins own nothing, so never foreign).
export function isForeignUnit(user, owner) {
  if (!user || user.role === 'ADMIN' || !owner) return false;
  const unit = (user.office || '').toLowerCase();
  if (!unit) return false;
  return unit !== (owner.office || '').toLowerCase()
    && unit !== (owner.department || '').toLowerCase();
}

export function formatEvidenceType(value) {
  const option = EVIDENCE_TYPES.find((type) => type.value === value);
  return option?.label || '-';
}

export function formatRelatedOffice(value) {
  const option = RELATED_OFFICES.find((office) => office.value === value);
  return option?.label || LEGACY_RELATED_OFFICE_LABELS[value] || value;
}
