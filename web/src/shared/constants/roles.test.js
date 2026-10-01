import { getPostLoginPath, ROLES } from './roles';

describe('getPostLoginPath', () => {
  it('ignores an accreditor return path for a staff login', () => {
    expect(getPostLoginPath(ROLES.DEPT_STAFF, '/accreditor')).toBe('/activities');
    expect(getPostLoginPath(ROLES.ADMIN, '/accreditor/links/abc')).toBe('/admin/users');
  });

  it('ignores a staff return path for an accreditor login', () => {
    expect(getPostLoginPath(ROLES.ACCREDITOR_LINK, '/dashboard')).toBe('/accreditor');
  });

  it('ignores an admin return path for a non-admin login', () => {
    expect(getPostLoginPath(ROLES.ACCRED_COORDINATOR, '/admin/users')).toBe('/activities');
  });

  it('follows a return path the role can use', () => {
    expect(getPostLoginPath(ROLES.ACCREDITOR_LINK, '/accreditor/links/abc')).toBe('/accreditor/links/abc');
    expect(getPostLoginPath(ROLES.DEPT_STAFF, '/repository')).toBe('/repository');
  });

  it('falls back to the role home without a return path', () => {
    expect(getPostLoginPath(ROLES.ACCREDITOR_LINK, undefined)).toBe('/accreditor');
    expect(getPostLoginPath(ROLES.DEPT_STAFF, undefined)).toBe('/activities');
  });
});
