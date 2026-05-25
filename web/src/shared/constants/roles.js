// NOTE: When adding new roles, add them here and update UserRole.java on the backend.
// Active roles in MVP: ADMIN, DEPT_STAFF
// Defined for future use: ACCRED_COORDINATOR, INSTITUTIONAL_OFFICE, ACCREDITOR_LINK
export const ROLES = {
  ADMIN: 'ADMIN',
  DEPT_STAFF: 'DEPT_STAFF',
  ACCRED_COORDINATOR: 'ACCRED_COORDINATOR',
  INSTITUTIONAL_OFFICE: 'INSTITUTIONAL_OFFICE',
  ACCREDITOR_LINK: 'ACCREDITOR_LINK',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'System Administrator',
  [ROLES.DEPT_STAFF]: 'Department Staff',
  [ROLES.ACCRED_COORDINATOR]: 'Accred. Coordinator',
  [ROLES.INSTITUTIONAL_OFFICE]: 'Institutional Office',
  [ROLES.ACCREDITOR_LINK]: 'Accreditor (Link)',
};
