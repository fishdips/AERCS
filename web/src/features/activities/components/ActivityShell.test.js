import { render, screen } from '@testing-library/react';
import ActivityShell from './ActivityShell';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useAccreditorNotifications } from '../../accreditor-access/context/AccreditorNotificationsContext';
import { useStaffNotifications } from '../../notifications/context/StaffNotificationsContext';

let mockPath = '/accreditor';
// react-router-dom can't be resolved by this project's Jest (same workaround as App.test.js).
jest.mock('react-router-dom', () => ({
  // Like the real one: a link is active for its own path and anything below it.
  NavLink: ({ children, to, className }) => {
    const isActive = mockPath === to || mockPath.startsWith(`${to}/`);
    return <a href={to} className={typeof className === 'function' ? className({ isActive }) : className}>{children}</a>;
  },
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: mockPath }),
}), { virtual: true });
jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../accreditor-access/context/AccreditorNotificationsContext', () => ({
  useAccreditorNotifications: jest.fn(),
}));
jest.mock('../../notifications/context/StaffNotificationsContext', () => ({
  useStaffNotifications: jest.fn(),
}));

function show(user, unreadCount = 0, path = '/accreditor', staffUnread = 0) {
  mockPath = path;
  useAuth.mockReturnValue({ user, logout: jest.fn() });
  useAccreditorNotifications.mockReturnValue({ unreadCount });
  useStaffNotifications.mockReturnValue({ unreadCount: staffUnread });
  render(<ActivityShell><p>page</p></ActivityShell>);
}

const accreditor = { id: 'acc-1', name: 'An Accreditor', role: 'ACCREDITOR_LINK' };

test('accreditors get an Evidence Links tab and a Notifications tab', () => {
  show(accreditor);

  expect(screen.getByRole('link', { name: 'Evidence Links' }).getAttribute('href')).toBe('/accreditor');
  expect(screen.getByRole('link', { name: 'Notifications' }).getAttribute('href')).toBe('/accreditor/notifications');
});

test('the Notifications tab shows how many are unread', () => {
  show(accreditor, 3);

  expect(screen.getByRole('link', { name: 'Notifications 3 unread' })).toBeTruthy();
});

test('no badge when everything has been read', () => {
  show(accreditor, 0);

  expect(screen.getByRole('link', { name: 'Notifications' })).toBeTruthy();
  expect(screen.queryByLabelText(/unread/i)).toBeNull();
});

test('a very large count is shown as 99+', () => {
  show(accreditor, 250);

  expect(screen.getByRole('link', { name: 'Notifications 250 unread' }).textContent).toContain('99+');
});

test('on the Notifications page only the Notifications tab is highlighted', () => {
  show(accreditor, 0, '/accreditor/notifications');

  expect(screen.getByRole('link', { name: 'Notifications' }).className).toContain('am-nav-active');
  expect(screen.getByRole('link', { name: 'Evidence Links' }).className).not.toContain('am-nav-active');
});

test('while viewing a link, Evidence Links stays highlighted and Notifications does not', () => {
  show(accreditor, 0, '/accreditor/links/abc');

  expect(screen.getByRole('link', { name: 'Evidence Links' }).className).toContain('am-nav-active');
  expect(screen.getByRole('link', { name: 'Notifications' }).className).not.toContain('am-nav-active');
});

test.each([
  ['department staff', 'DEPT_STAFF'],
  ['chairpersons', 'ACCRED_COORDINATOR'],
  ['institutional staff', 'INSTITUTIONAL_OFFICE'],
])('%s get their own Notifications tab, first in the workspace', (_label, role) => {
  show({ id: 's1', name: 'A Staff', role, office: 'CCS' }, 0, '/dashboard');

  const tab = screen.getByRole('link', { name: 'Notifications' });
  expect(tab.getAttribute('href')).toBe('/notifications');
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
  // First link in the rail, ahead of the Dashboard.
  expect(screen.getAllByRole('link')[0]).toBe(tab);
});

test('a staff member sees their own unread count, not the accreditor one', () => {
  show({ id: 's1', name: 'A Staff', role: 'DEPT_STAFF', office: 'CCS' }, 9, '/dashboard', 4);

  expect(screen.getByRole('link', { name: 'Notifications 4 unread' })).toBeTruthy();
  expect(screen.queryByLabelText('9 unread')).toBeNull();
});

test('no staff badge when everything has been read', () => {
  show({ id: 's1', name: 'A Staff', role: 'DEPT_STAFF', office: 'CCS' }, 0, '/dashboard', 0);

  expect(screen.queryByLabelText(/unread/i)).toBeNull();
});

test('administrators have no Notifications tab', () => {
  show({ id: 'a1', name: 'An Admin', role: 'ADMIN' }, 0, '/admin/users', 3);

  expect(screen.queryByRole('link', { name: /notifications/i })).toBeNull();
});
