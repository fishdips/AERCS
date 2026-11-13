import { render, screen } from '@testing-library/react';
import ActivityShell from './ActivityShell';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useAccreditorNotifications } from '../../accreditor-access/context/AccreditorNotificationsContext';

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

function show(user, unreadCount = 0, path = '/accreditor') {
  mockPath = path;
  useAuth.mockReturnValue({ user, logout: jest.fn() });
  useAccreditorNotifications.mockReturnValue({ unreadCount });
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

test('staff do not get a Notifications tab', () => {
  show({ id: 's1', name: 'A Staff', role: 'DEPT_STAFF', office: 'CCS' }, 5, '/dashboard');

  expect(screen.queryByRole('link', { name: /notifications/i })).toBeNull();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
});
