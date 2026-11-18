import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaffNotificationsProvider, useStaffNotifications } from './StaffNotificationsContext';
import { getStaffNotifications, markAllStaffNotificationsRead, markStaffNotificationRead } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';

jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  getStaffNotifications: jest.fn(),
  markStaffNotificationRead: jest.fn(),
  markAllStaffNotificationsRead: jest.fn(),
}));

const staff = (id = 's-1', role = 'DEPT_STAFF') => ({ id, role });
const notice = (id, read = false) => ({
  id, read, type: 'EVIDENCE_UPLOADED', activityId: `act-${id}`, createdAt: new Date().toISOString(),
});

function serve(notifications) {
  getStaffNotifications.mockResolvedValue({
    data: { unreadCount: notifications.filter((n) => !n.read).length, notifications },
  });
}

// Shows what the provider holds, the way the rail badge and the Notifications page both will.
function Probe({ name }) {
  const { unreadCount, notifications, markRead, markAllRead } = useStaffNotifications();
  return (
    <div>
      <span data-testid={`${name}-unread`}>{unreadCount}</span>
      <span data-testid={`${name}-total`}>{notifications.length}</span>
      <button type="button" onClick={() => markRead('a')}>{`${name} read a`}</button>
      <button type="button" onClick={markAllRead}>{`${name} read all`}</button>
    </div>
  );
}

function mount(user, pollMs = 60000) {
  useAuth.mockReturnValue({ user });
  // A new element each time: re-rendering with the very same element would be skipped by React.
  const tree = () => (
    <StaffNotificationsProvider pollMs={pollMs}>
      <Probe name="badge" />
      <Probe name="page" />
    </StaffNotificationsProvider>
  );
  const view = render(tree());
  return {
    ...view,
    signInAs: (next) => {
      useAuth.mockReturnValue({ user: next });
      view.rerender(tree());
    },
  };
}

beforeEach(() => {
  markStaffNotificationRead.mockResolvedValue({});
  markAllStaffNotificationsRead.mockResolvedValue({});
});

test.each([
  ['department staff', 'DEPT_STAFF'],
  ['a chairperson', 'ACCRED_COORDINATOR'],
  ['institutional staff', 'INSTITUTIONAL_OFFICE'],
])('loads %s notifications and shares them with everything inside it', async (_label, role) => {
  serve([notice('a'), notice('b'), notice('c', true)]);
  mount(staff('s-1', role));

  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));
  expect(screen.getByTestId('page-unread').textContent).toBe('2');
  expect(screen.getByTestId('page-total').textContent).toBe('3');
});

test.each([
  ['an administrator', { id: 'a1', role: 'ADMIN' }],
  ['an accreditor', { id: 'acc1', role: 'ACCREDITOR_LINK' }],
  ['nobody signed in', null],
])('makes no requests for %s', async (_label, user) => {
  mount(user);
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(getStaffNotifications).not.toHaveBeenCalled();
  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
});

test('marking one read updates the badge and the page together', async () => {
  serve([notice('a'), notice('b')]);
  mount(staff());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));

  fireEvent.click(screen.getByText('page read a'));

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
  expect(screen.getByTestId('page-unread').textContent).toBe('1');
  expect(markStaffNotificationRead).toHaveBeenCalledWith('a');
});

test('marking one that is already read does nothing', async () => {
  serve([notice('a', true), notice('b')]);
  mount(staff());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  fireEvent.click(screen.getByText('badge read a'));

  expect(markStaffNotificationRead).not.toHaveBeenCalled();
  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
});

test('marking all read clears the count everywhere but keeps them listed', async () => {
  serve([notice('a'), notice('b')]);
  mount(staff());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));

  fireEvent.click(screen.getByText('badge read all'));

  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-total').textContent).toBe('2');
  expect(markAllStaffNotificationsRead).toHaveBeenCalledTimes(1);
});

test('reloads from the server if it could not record that something was read', async () => {
  serve([notice('a')]);
  markStaffNotificationRead.mockRejectedValue(new Error('offline'));
  mount(staff());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
  const callsBefore = getStaffNotifications.mock.calls.length;

  fireEvent.click(screen.getByText('badge read a'));

  await waitFor(() => expect(getStaffNotifications.mock.calls.length).toBeGreaterThan(callsBefore));
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
});

test('keeps checking, so new activity appears without anyone doing anything', async () => {
  serve([]);
  mount(staff(), 30);
  await waitFor(() => expect(getStaffNotifications).toHaveBeenCalled());

  serve([notice('late')]);

  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
});

test('a failed check keeps what was already shown', async () => {
  serve([notice('a')]);
  mount(staff(), 30);
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  getStaffNotifications.mockRejectedValue(new Error('offline'));
  const callsBefore = getStaffNotifications.mock.calls.length;
  await waitFor(() => expect(getStaffNotifications.mock.calls.length).toBeGreaterThan(callsBefore));

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
});

test('signing out clears the notifications and stops checking', async () => {
  serve([notice('a')]);
  const view = mount(staff(), 30);
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  view.signInAs(null);
  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-total').textContent).toBe('0');

  const callsAfterSignOut = getStaffNotifications.mock.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(getStaffNotifications.mock.calls.length).toBe(callsAfterSignOut);
});

test('a slow answer for the previous user is never shown to the next one', async () => {
  let answerFirst;
  getStaffNotifications.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }));
  const view = mount(staff('first'));

  // The second person signs in before the first one's request has come back.
  serve([notice('b')]);
  view.signInAs(staff('second'));
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  await act(async () => {
    answerFirst({ data: { unreadCount: 5, notifications: [notice('x'), notice('y'), notice('z')] } });
  });

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
  expect(screen.getByTestId('page-total').textContent).toBe('1');
});

test('stops checking once it is no longer on screen', async () => {
  serve([]);
  const view = mount(staff(), 20);
  await waitFor(() => expect(getStaffNotifications).toHaveBeenCalled());
  view.unmount();
  const callsAtUnmount = getStaffNotifications.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(getStaffNotifications.mock.calls.length).toBe(callsAtUnmount);
});

test('outside the provider everything is simply empty', () => {
  render(<Probe name="solo" />);

  expect(screen.getByTestId('solo-unread').textContent).toBe('0');
  expect(screen.getByTestId('solo-total').textContent).toBe('0');
  fireEvent.click(screen.getByText('solo read all')); // does nothing, does not throw
});
