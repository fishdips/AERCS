import { canGenerateAccreditorAccess, canShareFromUnit } from './permissions';

const user = (role, office) => ({ id: 'u1', role, office });
const ADMIN = user('ADMIN', null);
const CHAIR_CCS = user('ACCRED_COORDINATOR', 'CCS');
const INSTITUTIONAL = user('INSTITUTIONAL_OFFICE', 'QUALITY_ASSURANCE_OFFICE');
const STAFF_CCS = user('DEPT_STAFF', 'CCS');
const ACCREDITOR = user('ACCREDITOR_LINK', null);

describe('canGenerateAccreditorAccess', () => {
  test('admins, chairpersons and institutional staff can', () => {
    expect(canGenerateAccreditorAccess(ADMIN)).toBe(true);
    expect(canGenerateAccreditorAccess(CHAIR_CCS)).toBe(true);
    expect(canGenerateAccreditorAccess(INSTITUTIONAL)).toBe(true);
  });

  test('department staff, accreditors and signed-out visitors cannot', () => {
    expect(canGenerateAccreditorAccess(STAFF_CCS)).toBe(false);
    expect(canGenerateAccreditorAccess(ACCREDITOR)).toBe(false);
    expect(canGenerateAccreditorAccess(null)).toBe(false);
    expect(canGenerateAccreditorAccess(undefined)).toBe(false);
  });
});

describe('canShareFromUnit', () => {
  const ccsActivity = { department: 'CCS', office: null };
  const ceaActivity = { department: 'CEA', office: null };

  test('a chairperson can share her own department\'s activity or evidence', () => {
    expect(canShareFromUnit(CHAIR_CCS, ccsActivity)).toBe(true);
  });

  test('a chairperson cannot share another department\'s', () => {
    expect(canShareFromUnit(CHAIR_CCS, ceaActivity)).toBe(false);
  });

  test('the match ignores letter case and also counts the uploader\'s office', () => {
    expect(canShareFromUnit(user('ACCRED_COORDINATOR', 'ccs'), { department: 'CCS' })).toBe(true);
    expect(canShareFromUnit(CHAIR_CCS, { department: 'CEA', uploadedByOffice: 'CCS' })).toBe(true);
  });

  test('a chairperson of an office is matched on the activity\'s office', () => {
    const libraryChair = user('ACCRED_COORDINATOR', 'LIBRARY');
    expect(canShareFromUnit(libraryChair, { department: null, office: 'LIBRARY' })).toBe(true);
    expect(canShareFromUnit(libraryChair, { department: null, office: 'REGISTRARS_OFFICE' })).toBe(false);
  });

  test('a chairperson with no department or office can share nothing', () => {
    expect(canShareFromUnit(user('ACCRED_COORDINATOR', null), ccsActivity)).toBe(false);
    expect(canShareFromUnit(user('ACCRED_COORDINATOR', ''), { department: '' })).toBe(false);
  });

  test('admins and institutional staff can share any department\'s', () => {
    expect(canShareFromUnit(ADMIN, ceaActivity)).toBe(true);
    expect(canShareFromUnit(INSTITUTIONAL, ceaActivity)).toBe(true);
    expect(canShareFromUnit(INSTITUTIONAL, undefined)).toBe(true);
  });

  test('department staff can share nothing, not even their own department\'s', () => {
    expect(canShareFromUnit(STAFF_CCS, ccsActivity)).toBe(false);
  });
});
