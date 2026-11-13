import { fireEvent, render, screen } from '@testing-library/react';
import AccreditorNotifications from './AccreditorNotifications';
import { AccreditorNotificationsProvider } from '../context/AccreditorNotificationsContext';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';

const mockNavigate = jest.fn();
// react-router-dom can't be resolved by this project's Jest (same workaround as App.test.js).
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  getMyNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

const HOUR = 3600000;
const inHours = (hours) => new Date(Date.now() + hours * HOUR).toISOString();
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();

const notice = (overrides) => ({
  id: 'n1',
  type: 'SHARED',
  createdAt: ago(1),
  read: false,
  linkId: 'l1',
  linkName: 'Area VII',
  activityName: 'Research Colloquium',
  sharedByName: 'Cora Chair',
  expiresAt: inHours(100),
  ...overrides,
});

function show(notifications) {
  getMyNotifications.mockResolvedValue({
    data: { unreadCount: notifications.filter((n) => !n.read).length, notifications },
  });
  useAuth.mockReturnValue({ user: { id: 'acc-1', role: 'ACCREDITOR_LINK' } });
  render(
    <AccreditorNotificationsProvider>
      <AccreditorNotifications />
    </AccreditorNotificationsProvider>,
  );
}

beforeEach(() => {
  markNotificationRead.mockResolvedValue({});
  markAllNotificationsRead.mockResolvedValue({});
});

test('says so when there is nothing yet', async () => {
  show([]);

  expect(await screen.findByText(/no notifications yet/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /mark all as read/i })).toBeNull();
});

test('lists a shared link and the two kinds of expiry warning, with the unread count', async () => {
  show([
    notice({ id: 'a', type: 'EXPIRING_4H', linkName: 'Area I', expiresAt: inHours(3) }),
    notice({ id: 'b', type: 'EXPIRING_24H', linkName: 'Area II', expiresAt: inHours(20) }),
    notice({ id: 'c', type: 'SHARED', linkName: 'Area III' }),
  ]);

  expect(await screen.findByText('Access ends very soon')).toBeTruthy();
  expect(screen.getByText('Access ending soon')).toBeTruthy();
  expect(screen.getByText('Evidence shared with you')).toBeTruthy();
  expect(screen.getByText(/Area I”.*expires in 2 hours/)).toBeTruthy();
  expect(screen.getByText(/Area II”.*expires in 19 hours/)).toBeTruthy();
  expect(screen.getByText('3 unread')).toBeTruthy();
});

test('every notification is listed, with no cap', async () => {
  show(Array.from({ length: 12 }, (_, i) => notice({ id: `n${i}`, linkName: `Link ${i}`, read: true })));

  await screen.findByText('All caught up');
  expect(screen.getAllByRole('button', { name: /evidence shared with you/i })).toHaveLength(12);
});

test('opening an unread notice marks it read and goes to the link', async () => {
  show([notice({ id: 'n1', linkId: 'link-9' })]);

  fireEvent.click(await screen.findByRole('button', { name: /evidence shared with you/i }));

  expect(markNotificationRead).toHaveBeenCalledWith('n1');
  expect(mockNavigate).toHaveBeenCalledWith('/accreditor/links/link-9');
  expect(screen.getByText('All caught up')).toBeTruthy(); // updated straight away
});

test('opening one that is already read just goes to the link', async () => {
  show([notice({ read: true })]);

  fireEvent.click(await screen.findByRole('button', { name: /evidence shared with you/i }));

  expect(markNotificationRead).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

test('an expired link is marked read but is not opened', async () => {
  show([notice({ type: 'EXPIRING_4H', expiresAt: ago(1) })]);

  fireEvent.click(await screen.findByRole('button', { name: /access expired/i }));

  expect(markNotificationRead).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('"Mark all as read" clears the unread count', async () => {
  show([notice({ id: 'a' }), notice({ id: 'b', linkName: 'Area II' })]);
  await screen.findByText('2 unread');

  fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }));

  expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
  expect(screen.getByText('All caught up')).toBeTruthy();
  expect(screen.getByRole('button', { name: /mark all as read/i }).disabled).toBe(true);
});

test('"Mark all as read" is disabled when nothing is unread', async () => {
  show([notice({ read: true })]);
  await screen.findByText('Evidence shared with you');

  expect(screen.getByRole('button', { name: /mark all as read/i }).disabled).toBe(true);
});

test('shows a quiet message if the notices cannot be loaded', async () => {
  getMyNotifications.mockRejectedValue(new Error('offline'));
  useAuth.mockReturnValue({ user: { id: 'acc-1', role: 'ACCREDITOR_LINK' } });
  render(
    <AccreditorNotificationsProvider>
      <AccreditorNotifications />
    </AccreditorNotificationsProvider>,
  );

  expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
});
