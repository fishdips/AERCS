import { ROLES } from '../../shared/constants/roles';

export const ACTIVITY_WRITE_ROLES = [
  ROLES.DEPT_STAFF,
  ROLES.INSTITUTIONAL_OFFICE,
  ROLES.ACCRED_COORDINATOR,
  ROLES.ADMIN,
];

export const ACTIVITY_TYPES = [
  { value: 'SEMINAR', label: 'Seminar' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'EXTENSION', label: 'Extension' },
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'WEBINAR', label: 'Webinar' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
  { value: 'OTHER', label: 'Other' },
];

export const ACCREDITATION_AREAS = [
  { value: 'FACULTY', label: 'Faculty' },
  { value: 'INSTRUCTION', label: 'Instruction' },
  { value: 'LIBRARY', label: 'Library' },
  { value: 'LABORATORIES', label: 'Laboratories' },
  { value: 'FACILITIES', label: 'Facilities' },
  { value: 'STUDENT_SERVICES', label: 'Student Services' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'EXTENSION', label: 'Extension' },
  { value: 'ADMINISTRATION', label: 'Administration' },
];

export function formatAccreditationArea(value) {
  const option = ACCREDITATION_AREAS.find((area) => area.value === value);
  if (option) return option.label;
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const DEPARTMENTS = [
  { value: 'CEA', label: 'CEA' },
  { value: 'CMBA', label: 'CMBA' },
  { value: 'CASE', label: 'CASE' },
  { value: 'CNAHS', label: 'CNAHS' },
  { value: 'CCS', label: 'CCS' },
  { value: 'CCJ', label: 'CCJ' },
];

export const OFFICES = [
  { value: 'QUALITY_ASSURANCE_OFFICE', label: 'Quality Assurance Office' },
  { value: 'RESEARCH_OFFICE', label: 'Research Office' },
  { value: 'EXTENSION_OFFICE', label: 'Extension Office' },
  { value: 'REGISTRARS_OFFICE', label: 'Registrar\u2019s Office' },
  { value: 'LIBRARY', label: 'Library' },
  { value: 'STUDENT_AFFAIRS_OFFICE', label: 'Student Affairs Office' },
  { value: 'FACILITIES_MANAGEMENT_OFFICE', label: 'Facilities Management Office' },
  { value: 'HUMAN_RESOURCE_OFFICE', label: 'Human Resource Office' },
];

export function formatDepartment(value) {
  const option = DEPARTMENTS.find((d) => d.value === value);
  return option ? option.label : (value || '-');
}

export function formatOffice(value) {
  const option = OFFICES.find((o) => o.value === value);
  return option ? option.label : (value || '-');
}

export function formatDeptOrOffice(department, office) {
  if (office) return formatOffice(office);
  if (department) return formatDepartment(department);
  return '-';
}

export function formatActivityType(value, customValue = '') {
  if (value === 'OTHER' && customValue) return customValue;
  const option = ACTIVITY_TYPES.find((type) => type.value === value);
  if (option) return option.label;
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
