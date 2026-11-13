import { describeActivityLoadError } from './loadError';

const failedWith = (status) => ({ response: { status } });

test('403 means the activity exists but you have no access to it', () => {
  expect(describeActivityLoadError(failedWith(403))).toEqual({
    kind: 'noAccess',
    message: "You don't have access to this activity.",
  });
});

test('404 means there is no such activity', () => {
  expect(describeActivityLoadError(failedWith(404))).toEqual({
    kind: 'notFound',
    message: 'Activity not found.',
  });
});

test.each([
  ['a server error', failedWith(500)],
  ['no response at all (offline)', new Error('Network Error')],
  ['nothing', undefined],
])('%s is reported as a load failure, not as a missing or forbidden activity', (_label, error) => {
  const result = describeActivityLoadError(error);
  expect(result.kind).toBe('failed');
  expect(result.message).toMatch(/could not be loaded/i);
});
