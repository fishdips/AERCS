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

export const RELATED_OFFICES = [
  { value: 'QUALITY_ASSURANCE_OFFICE', label: 'Quality Assurance Office' },
  { value: 'RESEARCH_OFFICE', label: 'Research Office' },
  { value: 'EXTENSION_OFFICE', label: 'Extension Office' },
  { value: 'REGISTRARS_OFFICE', label: 'Registrar Office' },
  { value: 'LIBRARY', label: 'Library' },
  { value: 'STUDENT_AFFAIRS_OFFICE', label: 'Student Affairs Office' },
  { value: 'GUIDANCE_OFFICE', label: 'Guidance Office' },
  { value: 'HUMAN_RESOURCE_OFFICE', label: 'Human Resource Office' },
  { value: 'FACILITIES_MANAGEMENT_OFFICE', label: 'Facilities Management Office' },
  { value: 'FINANCE_OFFICE', label: 'Finance Office' },
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'COLLEGE_OF_COMPUTER_STUDIES', label: 'College of Computer Studies' },
  { value: 'COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE', label: 'College of Engineering and Architecture' },
  { value: 'COLLEGE_OF_NURSING', label: 'College of Nursing' },
  { value: 'COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY', label: 'College of Management, Business and Accountancy' },
  { value: 'COLLEGE_OF_ARTS_AND_SCIENCES', label: 'College of Arts and Sciences' },
  { value: 'COLLEGE_OF_EDUCATION', label: 'College of Education' },
];

export function formatEvidenceType(value) {
  const option = EVIDENCE_TYPES.find((type) => type.value === value);
  return option?.label || '-';
}

export function formatRelatedOffice(value) {
  const option = RELATED_OFFICES.find((office) => office.value === value);
  return option?.label || value;
}
