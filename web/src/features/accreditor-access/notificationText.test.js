import { describeNotification, timeAgo, timeLeft } from './notificationText';

const NOW = new Date('2026-11-13T08:00:00Z').getTime();
const at = (hours, minutes = 0) => new Date(NOW + (hours * 60 + minutes) * 60000).toISOString();

describe('timeLeft', () => {
  test.each([
    [at(0, 0.5), 'less than a minute'],
    [at(0, 1), '1 minute'],
    [at(0, 45), '45 minutes'],
    [at(1), '1 hour'],
    [at(3, 20), '3 hours 20 minutes'],
    [at(4), '4 hours'],
    [at(23, 59), '23 hours 59 minutes'],
    [at(24), '1 day'],
    [at(50), '2 days 2 hours'],
  ])('%s -> %s', (expiresAt, expected) => {
    expect(timeLeft(expiresAt, NOW)).toBe(expected);
  });

  test('is null once the time has passed, or for nonsense', () => {
    expect(timeLeft(at(0), NOW)).toBeNull();
    expect(timeLeft(at(-2), NOW)).toBeNull();
    expect(timeLeft('not a date', NOW)).toBeNull();
  });
});

describe('timeAgo', () => {
  test.each([
    [at(0, -0.5), 'Just now'],
    [at(0, -1), '1 minute ago'],
    [at(0, -59), '59 minutes ago'],
    [at(-1), '1 hour ago'],
    [at(-5), '5 hours ago'],
    [at(-24), '1 day ago'],
    [at(-72), '3 days ago'],
  ])('%s -> %s', (value, expected) => {
    expect(timeAgo(value, NOW)).toBe(expected);
  });

  test('a time slightly in the future (clock skew) reads as just now', () => {
    expect(timeAgo(at(0, 2), NOW)).toBe('Just now');
  });
});

describe('describeNotification', () => {
  const base = { linkName: 'Area VII', activityName: 'Research Colloquium', sharedByName: 'Cora Chair' };

  test('a shared link says who shared it, what it is, and until when', () => {
    const view = describeNotification({ ...base, type: 'SHARED', expiresAt: at(100) }, NOW);
    expect(view.tone).toBe('info');
    expect(view.title).toBe('Evidence shared with you');
    expect(view.body).toContain('Cora Chair shared “Area VII” (Research Colloquium)');
    expect(view.body).toContain('Available until');
    expect(view.canOpen).toBe(true);
  });

  test('the activity name is left out when it is the same as the link name', () => {
    const view = describeNotification(
      { ...base, linkName: 'Research Colloquium', type: 'SHARED', expiresAt: at(100) }, NOW);
    expect(view.body).not.toContain('(Research Colloquium)');
  });

  test('a shared link without a sharer still reads naturally', () => {
    const view = describeNotification({ ...base, sharedByName: null, type: 'SHARED', expiresAt: at(100) }, NOW);
    expect(view.body).toContain('You were given access to “Area VII”');
  });

  test('the 24-hour warning is a warning and counts down', () => {
    const view = describeNotification({ ...base, type: 'EXPIRING_24H', expiresAt: at(20) }, NOW);
    expect(view.tone).toBe('warning');
    expect(view.title).toBe('Access ending soon');
    expect(view.body).toContain('expires in 20 hours');
    expect(view.canOpen).toBe(true);
  });

  test('the 4-hour warning is urgent', () => {
    const view = describeNotification({ ...base, type: 'EXPIRING_4H', expiresAt: at(3, 20) }, NOW);
    expect(view.tone).toBe('urgent');
    expect(view.title).toBe('Access ends very soon');
    expect(view.body).toContain('expires in 3 hours 20 minutes');
  });

  test('the countdown follows the clock, not the moment the notice was made', () => {
    const notice = { ...base, type: 'EXPIRING_24H', expiresAt: at(20) };
    expect(describeNotification(notice, NOW).body).toContain('20 hours');
    expect(describeNotification(notice, NOW + 17 * 3600000).body).toContain('3 hours');
  });

  test('once the link has expired a warning turns into an expired notice that cannot be opened', () => {
    const view = describeNotification({ ...base, type: 'EXPIRING_4H', expiresAt: at(-1) }, NOW);
    expect(view.tone).toBe('expired');
    expect(view.title).toBe('Access expired');
    expect(view.body).toContain('expired on');
    expect(view.canOpen).toBe(false);
  });

  test('a shared notice for a link that has since expired says so and cannot be opened', () => {
    const view = describeNotification({ ...base, type: 'SHARED', expiresAt: at(-1) }, NOW);
    expect(view.body).toContain('This link has expired.');
    expect(view.canOpen).toBe(false);
  });
});
