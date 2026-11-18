import { describeStaffNotification } from './notificationText';

const base = {
  id: 'n1',
  actorName: 'Sam Staff',
  actorUnit: 'CCS',
  activityId: 'act-1',
  activityName: 'Curriculum Review',
  evidenceId: 'ev-1',
  evidenceName: 'Minutes.pdf',
  versionNumber: null,
  count: 1,
  read: false,
  activityAvailable: true,
  evidenceAvailable: true,
};

test('one upload names the file, the person and the activity, and opens the activity', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_UPLOADED' });

  expect(view.title).toBe('New evidence uploaded');
  expect(view.body).toBe('Sam Staff uploaded “Minutes.pdf” to “Curriculum Review”.');
  expect(view.path).toBe('/activities/act-1');
  expect(view.kind).toBe('upload');
});

test('a burst of uploads is described by its count', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_UPLOADED', count: 5 });

  expect(view.title).toBe('5 new files uploaded');
  expect(view.body).toBe('Sam Staff uploaded 5 files to “Curriculum Review”.');
});

test('a tag says who tagged which file for your unit and opens the evidence', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_TAGGED' });

  expect(view.title).toBe('Evidence tagged for you');
  expect(view.body).toBe('Sam Staff tagged “Minutes.pdf” for your department or office in “Curriculum Review”.');
  expect(view.path).toBe('/shared-evidence/ev-1/references');
  expect(view.kind).toBe('tag');
});

test('several files tagged at once are described by their count', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_TAGGED', count: 4 });

  expect(view.title).toBe('4 files tagged for you');
  expect(view.body).toBe('Sam Staff tagged 4 files for your department or office in “Curriculum Review”.');
});

test('a new version says which version and opens the evidence', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_NEW_VERSION', versionNumber: 3 });

  expect(view.title).toBe('New version uploaded');
  expect(view.body).toBe('Sam Staff uploaded version 3 of “Minutes.pdf”.');
  expect(view.path).toBe('/shared-evidence/ev-1/references');
});

test('a reference names the referencing office in words and the activity that cites it', () => {
  const view = describeStaffNotification({
    ...base, type: 'EVIDENCE_REFERENCED', actorName: 'Eli Engineer', actorUnit: 'CEA', activityName: 'Design Studio Visit',
  });

  expect(view.title).toBe('Your evidence was referenced');
  expect(view.body).toBe(
    'Eli Engineer (College of Engineering and Architecture) referenced “Minutes.pdf” in “Design Studio Visit”.',
  );
  expect(view.path).toBe('/shared-evidence/ev-1/references');
  expect(view.kind).toBe('reference');
});

test('an office value with no label is made readable', () => {
  const view = describeStaffNotification({ ...base, type: 'EVIDENCE_REFERENCED', actorUnit: 'SOME_NEW_OFFICE' });

  expect(view.body).toContain('Sam Staff (Some New Office)');
});

test('a removed reference is quiet and still opens the evidence', () => {
  const view = describeStaffNotification({ ...base, type: 'REFERENCE_REMOVED' });

  expect(view.title).toBe('Reference removed');
  expect(view.tone).toBe('expired');
  expect(view.body).toBe(
    'Sam Staff (College of Computer Studies) removed their reference to “Minutes.pdf” from “Curriculum Review”.',
  );
  expect(view.path).toBe('/shared-evidence/ev-1/references');
});

test('deleted items say so and cannot be opened', () => {
  const upload = describeStaffNotification({ ...base, type: 'EVIDENCE_UPLOADED', activityAvailable: false });
  expect(upload.path).toBeNull();
  expect(upload.body).toMatch(/It has since been deleted\.$/);

  const reference = describeStaffNotification({ ...base, type: 'EVIDENCE_REFERENCED', evidenceAvailable: false });
  expect(reference.path).toBeNull();
  expect(reference.body).toMatch(/It has since been deleted\.$/);
});

test('missing names fall back to plain words', () => {
  const view = describeStaffNotification({
    ...base, type: 'EVIDENCE_UPLOADED', actorName: null, evidenceName: null, activityName: null,
  });

  expect(view.body).toBe('Someone uploaded “a file” to “an activity”.');
});
