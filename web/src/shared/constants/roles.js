// NOTE: When adding new roles, add them here and update UserRole.java on the backend.
// Active roles in MVP: ADMIN, DEPT_STAFF
// ACCREDITOR_LINK is an external accreditor account: it only sees the evidence links assigned to it.
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
  [ROLES.ACCREDITOR_LINK]: 'Accreditor',
};

// Where a role lands after signing in when no specific page was requested.
export function getHomePath(role, staffDefault = '/activities') {
  if (role === ROLES.ADMIN) return '/admin/users';
  if (role === ROLES.ACCREDITOR_LINK) return '/accreditor';
  return staffDefault;
}

// Where to go after sign-in: the page the user was trying to open, if their role can
// use it, otherwise their home page. Guards against a return path left by a different
// account (e.g. an accreditor's /accreditor page) sending a staff user to Access Denied.
export function getPostLoginPath(role, requestedPath, staffDefault) {
  const home = getHomePath(role, staffDefault);
  if (!requestedPath) return home;
  const isAccreditorPath = requestedPath === '/accreditor' || requestedPath.startsWith('/accreditor/');
  if (isAccreditorPath !== (role === ROLES.ACCREDITOR_LINK)) return home;
  if (requestedPath.startsWith('/admin') && role !== ROLES.ADMIN) return home;
  return requestedPath;
}
