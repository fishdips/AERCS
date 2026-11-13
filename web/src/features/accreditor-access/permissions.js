import { ROLES } from '../../shared/constants/roles';

// Who may generate accreditor access: administrators, chairpersons and institutional staff.
// Department staff can see their department's links but cannot create or change them.
// (The backend enforces this too; these helpers just keep the screens from offering what it will refuse.)
export const ACCREDITOR_ACCESS_ROLES = [ROLES.ADMIN, ROLES.ACCRED_COORDINATOR, ROLES.INSTITUTIONAL_OFFICE];

export function canGenerateAccreditorAccess(user) {
  return Boolean(user) && ACCREDITOR_ACCESS_ROLES.includes(user.role);
}

// Whether this user may share what belongs to `unit`. Administrators and institutional staff work
// across departments, so they can share anything; a chairperson can only share her own department's
// or office's. `unit` is anything that carries ownership: an activity ({ department, office }) or a
// repository row ({ department, office, uploadedByOffice }).
export function canShareFromUnit(user, unit) {
  if (!canGenerateAccreditorAccess(user)) return false;
  if (user.role !== ROLES.ACCRED_COORDINATOR) return true;

  const mine = (user.office || '').toLowerCase();
  if (!mine) return false;
  return [unit?.department, unit?.office, unit?.uploadedByOffice]
    .some((value) => (value || '').toLowerCase() === mine);
}
