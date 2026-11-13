import { findNewVersionTargets, hasMultipleVersions, isIdenticalContentError } from './constants';

describe('hasMultipleVersions', () => {
  test('a freshly uploaded file (v1) gets no version label', () => {
    expect(hasMultipleVersions({ currentVersion: 1 })).toBe(false);
  });

  test('a missing or zero version counts as v1', () => {
    expect(hasMultipleVersions({})).toBe(false);
    expect(hasMultipleVersions({ currentVersion: 0 })).toBe(false);
    expect(hasMultipleVersions(null)).toBe(false);
    expect(hasMultipleVersions(undefined)).toBe(false);
  });

  test('v2 and later are labelled', () => {
    expect(hasMultipleVersions({ currentVersion: 2 })).toBe(true);
    expect(hasMultipleVersions({ currentVersion: 7 })).toBe(true);
  });
});

describe('findNewVersionTargets', () => {
  const file = (name) => ({ name });
  const evidence = [
    { id: '1', originalFileName: 'Report.pdf', fileType: 'PDF', currentVersion: 1 },
    { id: '2', originalFileName: 'photo.jpg', fileType: 'JPG', currentVersion: 3 },
    { id: '3', originalFileName: 'Drive link', fileType: 'LINK', linkUrl: 'https://example.com' },
  ];

  test('files that share a name with existing evidence are returned with their match', () => {
    const matches = findNewVersionTargets([file('photo.jpg'), file('new-file.pdf')], evidence);
    expect(matches).toHaveLength(1);
    expect(matches[0].file.name).toBe('photo.jpg');
    expect(matches[0].existing.id).toBe('2');
  });

  test('the name match ignores letter case', () => {
    const matches = findNewVersionTargets([file('REPORT.PDF')], evidence);
    expect(matches.map((m) => m.existing.id)).toEqual(['1']);
  });

  test('links are never matched, even when the name is the same', () => {
    expect(findNewVersionTargets([file('Drive link')], evidence)).toEqual([]);
  });

  test('brand-new files need no confirmation', () => {
    expect(findNewVersionTargets([file('a.pdf'), file('b.docx')], evidence)).toEqual([]);
  });

  test('when two records share a name the first (newest) one is used, like the server does', () => {
    const duplicates = [
      { id: 'new', originalFileName: 'x.pdf', fileType: 'PDF' },
      { id: 'old', originalFileName: 'x.pdf', fileType: 'PDF' },
    ];
    expect(findNewVersionTargets([file('x.pdf')], duplicates)[0].existing.id).toBe('new');
  });

  test('handles empty input', () => {
    expect(findNewVersionTargets([], evidence)).toEqual([]);
    expect(findNewVersionTargets(undefined, undefined)).toEqual([]);
    expect(findNewVersionTargets([file('a.pdf')], [])).toEqual([]);
  });
});

describe('isIdenticalContentError', () => {
  test.each([
    'Duplicate file content: "IBM Skillsbuildd.docx" has identical content to "IBM Skillsbuild.docx" (v2) already in this activity.',
    'This file has identical content to the current version (v3). Upload a modified file to create a new version.',
    'This file has identical content to version v1. Use Restore in Version History to switch back to v1.',
  ])('recognises the server message: %s', (message) => {
    expect(isIdenticalContentError(message)).toBe(true);
  });

  test.each([
    'Unsupported file type. Allowed types: PDF, DOCX, XLSX, JPG, JPEG, PNG',
    'Evidence file must not exceed 10 MB',
    '',
    undefined,
    null,
  ])('leaves other errors as banners: %s', (message) => {
    expect(isIdenticalContentError(message)).toBe(false);
  });
});
