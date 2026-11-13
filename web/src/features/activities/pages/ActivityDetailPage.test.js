import { fireEvent, render, screen } from '@testing-library/react';
import ActivityDetailPage from './ActivityDetailPage';
import { getActivity } from '../api';
import { useAuth } from '../../../shared/hooks/useAuth';

const mockNavigate = jest.fn();
let mockLocation = { key: 'abc123', state: null };
// react-router-dom can't be resolved by this project's Jest (same workaround as App.test.js).
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'activity-1' }),
}), { virtual: true });
jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({
  deleteActivity: jest.fn(),
  getActivity: jest.fn(),
  updateActivity: jest.fn(),
}));
// The page's own panels are not under test here; the real ones load their own data.
jest.mock('../components/ActivityShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../evidence/components/EvidencePanel', () => () => <div>evidence panel</div>);
jest.mock('../../evidence/components/BatchMetadataPanel', () => () => <div>batch panel</div>);
jest.mock('../../evidence/components/ReferencedEvidencePanel', () => () => <div>referenced panel</div>);
jest.mock('../../accreditor-access/components/GenerateAccreditorAccessModal', () => () => null);

const ceaStaff = { id: 'u1', name: 'CEA Staff', role: 'DEPT_STAFF', office: 'CEA' };

const activity = {
  id: 'activity-1',
  activityName: 'CCS Colloquium',
  activityType: 'SEMINAR',
  activityDate: '2026-11-01',
  department: 'CCS',
  office: null,
  accreditationArea: 'FACULTY',
  academicYear: '2026-2027',
  createdById: 'someone-else',
  createdByName: 'CCS Staff',
};

beforeEach(() => {
  mockLocation = { key: 'abc123', state: null };
  useAuth.mockReturnValue({ user: ceaStaff });
});

test('an activity of another department says you have no access, not "not found"', async () => {
  getActivity.mockRejectedValue({ response: { status: 403, data: { error: "You don't have access to this activity." } } });
  render(<ActivityDetailPage />);

  expect(await screen.findByText("You don't have access to this activity")).toBeTruthy();
  expect(screen.queryByText(/activity not found/i)).toBeNull();
  // none of the activity's contents are shown
  expect(screen.queryByText('evidence panel')).toBeNull();
});

test('"Go back" returns to the page the link was followed from', async () => {
  getActivity.mockRejectedValue({ response: { status: 403 } });
  render(<ActivityDetailPage />);

  fireEvent.click(await screen.findByRole('button', { name: /go back/i }));

  expect(mockNavigate).toHaveBeenCalledWith(-1);
});

test('if the page was opened directly there is no history to go back to, so it goes to the activities list', async () => {
  mockLocation = { key: 'default', state: null };
  getActivity.mockRejectedValue({ response: { status: 403 } });
  render(<ActivityDetailPage />);

  fireEvent.click(await screen.findByRole('button', { name: /go back/i }));

  expect(mockNavigate).toHaveBeenCalledWith('/activities');
});

test('an activity that does not exist still says "not found"', async () => {
  getActivity.mockRejectedValue({ response: { status: 404 } });
  render(<ActivityDetailPage />);

  expect(await screen.findByText('Activity not found.')).toBeTruthy();
  expect(screen.queryByText(/don't have access/i)).toBeNull();
});

test('a network or server problem says it could not be loaded', async () => {
  getActivity.mockRejectedValue(new Error('Network Error'));
  render(<ActivityDetailPage />);

  expect(await screen.findByText(/could not be loaded/i)).toBeTruthy();
  expect(screen.queryByText(/don't have access/i)).toBeNull();
  expect(screen.queryByText('Activity not found.')).toBeNull();
});

test('an activity you can open still shows normally, with no access message', async () => {
  getActivity.mockResolvedValue({ data: { ...activity, department: 'CEA' } });
  render(<ActivityDetailPage />);

  expect(await screen.findByText('CCS Colloquium')).toBeTruthy();
  expect(screen.getByText('evidence panel')).toBeTruthy();
  expect(screen.queryByText(/don't have access/i)).toBeNull();
});
