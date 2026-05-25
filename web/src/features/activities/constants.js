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

export const DEPARTMENTS = ['CEA', 'CMBA', 'CASE', 'CNAHS', 'CCS', 'CCJ'];

export const OFFICES = [
  'Quality Assurance Office',
  'Research Office',
  'Extension Office',
  'Registrar\u2019s Office',
  'Library',
  'Student Affairs Office',
  'Facilities Management Office',
  'Human Resource Office',
];

export function formatActivityType(value) {
  const option = ACTIVITY_TYPES.find((type) => type.value === value);
  if (option) return option.label;
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
