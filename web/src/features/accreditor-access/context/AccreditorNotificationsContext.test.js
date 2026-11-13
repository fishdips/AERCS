import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccreditorNotificationsProvider, useAccreditorNotifications } from './AccreditorNotificationsContext';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';

jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  getMyNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

const accreditor = (id = 'acc-1') => ({ id, role: 'ACCREDITOR_LINK' });
const notice = (id, read = false) => ({ id, read, type: 'SHARED', linkId: `link-${id}`, createdAt: new Date().toISOString() });

function serve(notifications) {
  getMyNotifications.mockResolvedValue({
    data: { unreadCount: notifications.filter((n) => !n.read).length, notifications },
  });
}

// Shows what the provider holds, the way the sidebar badge and the Notifications page both will.
function Probe({ name }) {
  const { unreadCount, notifications, markRead, markAllRead } = useAccreditorNotifications();
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
    <AccreditorNotificationsProvider pollMs={pollMs}>
      <Probe name="badge" />
      <Probe name="page" />
    </AccreditorNotificationsProvider>
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
  markNotificationRead.mockResolvedValue({});
  markAllNotificationsRead.mockResolvedValue({});
});

test('loads an accreditor\'s notifications and shares them with everything inside it', async () => {
  serve([notice('a'), notice('b'), notice('c', true)]);
  mount(accreditor());

  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));
  expect(screen.getByTestId('page-unread').textContent).toBe('2');
  expect(screen.getByTestId('page-total').textContent).toBe('3');
});

test.each([
  ['a staff account', { id: 's1', role: 'DEPT_STAFF' }],
  ['a chairperson', { id: 'c1', role: 'ACCRED_COORDINATOR' }],
  ['nobody signed in', null],
])('makes no requests for %s', async (_label, user) => {
  mount(user);
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(getMyNotifications).not.toHaveBeenCalled();
  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
});

test('marking one read updates the badge and the page together', async () => {
  serve([notice('a'), notice('b')]);
  mount(accreditor());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));

  fireEvent.click(screen.getByText('page read a'));

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
  expect(screen.getByTestId('page-unread').textContent).toBe('1');
  expect(markNotificationRead).toHaveBeenCalledWith('a');
});

test('marking one that is already read does nothing', async () => {
  serve([notice('a', true), notice('b')]);
  mount(accreditor());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  fireEvent.click(screen.getByText('badge read a'));

  expect(markNotificationRead).not.toHaveBeenCalled();
  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
});

test('marking all read clears the count everywhere', async () => {
  serve([notice('a'), notice('b')]);
  mount(accreditor());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('2'));

  fireEvent.click(screen.getByText('badge read all'));

  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-total').textContent).toBe('2'); // still listed, just read
  expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
});

test('reloads from the server if it could not record that something was read', async () => {
  serve([notice('a')]);
  markNotificationRead.mockRejectedValue(new Error('offline'));
  mount(accreditor());
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
  const callsBefore = getMyNotifications.mock.calls.length;

  fireEvent.click(screen.getByText('badge read a'));

  await waitFor(() => expect(getMyNotifications.mock.calls.length).toBeGreaterThan(callsBefore));
  // the server still says unread, and that is what is shown again
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
});

test('keeps checking, so expiry warnings appear without anyone doing anything', async () => {
  serve([]);
  mount(accreditor(), 30);
  await waitFor(() => expect(getMyNotifications).toHaveBeenCalled());

  serve([notice('late')]);

  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));
});

test('a failed check keeps what was already shown', async () => {
  serve([notice('a')]);
  mount(accreditor(), 30);
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  getMyNotifications.mockRejectedValue(new Error('offline'));
  const callsBefore = getMyNotifications.mock.calls.length;
  await waitFor(() => expect(getMyNotifications.mock.calls.length).toBeGreaterThan(callsBefore));

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
});

test('signing out clears the notifications and stops checking', async () => {
  serve([notice('a')]);
  const view = mount(accreditor(), 30);
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  view.signInAs(null);
  expect(screen.getByTestId('badge-unread').textContent).toBe('0');
  expect(screen.getByTestId('page-total').textContent).toBe('0');

  const callsAfterSignOut = getMyNotifications.mock.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(getMyNotifications.mock.calls.length).toBe(callsAfterSignOut);
});

test('a slow answer for the previous accreditor is never shown to the next one', async () => {
  let answerFirst;
  getMyNotifications.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }));
  const view = mount(accreditor('first'));

  // The second accreditor signs in before the first one's request has come back.
  serve([notice('b')]);
  view.signInAs(accreditor('second'));
  await waitFor(() => expect(screen.getByTestId('badge-unread').textContent).toBe('1'));

  await act(async () => {
    answerFirst({ data: { unreadCount: 5, notifications: [notice('x'), notice('y'), notice('z')] } });
  });

  expect(screen.getByTestId('badge-unread').textContent).toBe('1');
  expect(screen.getByTestId('page-total').textContent).toBe('1');
});

test('stops checking once it is no longer on screen', async () => {
  serve([]);
  const view = mount(accreditor(), 20);
  await waitFor(() => expect(getMyNotifications).toHaveBeenCalled());
  view.unmount();
  const callsAtUnmount = getMyNotifications.mock.calls.length;

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(getMyNotifications.mock.calls.length).toBe(callsAtUnmount);
});

test('outside the provider (staff screens) everything is simply empty', () => {
  render(<Probe name="solo" />);

  expect(screen.getByTestId('solo-unread').textContent).toBe('0');
  expect(screen.getByTestId('solo-total').textContent).toBe('0');
  fireEvent.click(screen.getByText('solo read all')); // does nothing, does not throw
});
