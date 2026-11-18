import { DEPARTMENTS, OFFICES, SERVICE_OFFICES } from '../activities/constants';
import { ROLES } from '../../shared/constants/roles';

// Which role may belong to which kind of unit (mirrors UserService.validateRoleOffice):
//   Department                      -> Department Staff or Chairperson
//   Institutional / Service office  -> Institutional Staff only
//   System Administrator, Accreditor -> no department or office at all

const DEPARTMENT_VALUES = new Set(DEPARTMENTS.map((d) => d.value));
const OFFICE_VALUES = new Set(
  [...OFFICES, ...SERVICE_OFFICES].filter((o) => o.value !== 'OTHER').map((o) => o.value),
);

export const NO_OFFICE_ROLES = [ROLES.ADMIN, ROLES.ACCREDITOR_LINK];
const DEPARTMENT_ROLES = [ROLES.DEPT_STAFF, ROLES.ACCRED_COORDINATOR];

export const isDepartmentValue = (office) => DEPARTMENT_VALUES.has(office);
export const isOfficeValue = (office) => OFFICE_VALUES.has(office);
export const roleHasNoOffice = (role) => NO_OFFICE_ROLES.includes(role);

// Roles that may be chosen once a department/office is selected. With nothing selected any
// candidate is allowed (the office-less roles are fine, the others still need one).
export function rolesForOffice(office, candidateRoles) {
  if (isDepartmentValue(office)) return candidateRoles.filter((r) => DEPARTMENT_ROLES.includes(r));
  if (isOfficeValue(office)) return candidateRoles.filter((r) => r === ROLES.INSTITUTIONAL_OFFICE);
  return candidateRoles;
}

// Picking a department/office sets the role automatically when the current one doesn't fit.
export function applyOfficeChange({ role }, office, candidateRoles) {
  if (!office) return { office: '', role };
  const allowed = rolesForOffice(office, candidateRoles);
  return { office, role: allowed.includes(role) ? role : (allowed[0] ?? role) };
}

// Picking a role clears a department/office that no longer fits (always cleared for
// administrators and accreditors). `lockedOffice` is the chairperson's own department.
export function applyRoleChange({ office }, role, lockedOffice = '') {
  if (roleHasNoOffice(role)) return { role, office: '' };
  if (lockedOffice) return { role, office: lockedOffice };
  return { role, office: rolesForOffice(office, [role]).length ? office : '' };
}

// Client-side check matching the backend; returns an error message or ''.
export function roleOfficeError({ role, office }) {
  if (roleHasNoOffice(role)) return '';
  if (!office) return 'Choose a department or office for this role.';
  return '';
}
