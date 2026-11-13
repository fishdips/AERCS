import { fireEvent, render, screen } from '@testing-library/react';
import EvidencePanel from './EvidencePanel';
import { listEvidence } from '../api';
import { getActivity } from '../../activities/api';
import { useAuth } from '../../../shared/hooks/useAuth';

// react-router-dom can't be resolved by this project's Jest (same workaround as App.test.js); the
// panel only needs <Link>.
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock('../api', () => ({
  createLinkEvidence: jest.fn(),
  deleteEvidence: jest.fn(),
  downloadEvidenceBlob: jest.fn(),
  getEvidenceViewUrl: jest.fn(),
  listEvidence: jest.fn(),
  replaceEvidence: jest.fn(),
  updateLinkEvidence: jest.fn(),
  uploadEvidence: jest.fn(),
}));
jest.mock('../../activities/api', () => ({ getActivity: jest.fn() }));
jest.mock('../../../shared/hooks/useAuth', () => ({ useAuth: jest.fn() }));
// The two modals are replaced by stubs so the tests can see how the details modal was opened.
jest.mock('./EvidenceMetadataModal', () => {
  const React = require('react');
  return ({ isOpen, readOnly }) => (isOpen
    ? React.createElement('div', { 'data-testid': 'details-modal' }, readOnly ? 'read-only' : 'editable')
    : null);
});
jest.mock('./EvidenceVersionsModal', () => () => null);

const evidenceItem = {
  id: 'e1',
  originalFileName: 'plan.pdf',
  fileType: 'PDF',
  fileSize: 2048,
  currentVersion: 1,
  uploadedById: 'u-owner',
  uploadedByName: 'The Owner',
  uploadedAt: '2026-11-01T00:00:00Z',
  relatedOffices: [],
  tags: [],
};

async function showPanel({ user, item = evidenceItem, activity = { department: 'CCS', office: null }, props = {} }) {
  useAuth.mockReturnValue({ user });
  listEvidence.mockResolvedValue({ data: [item] });
  getActivity.mockResolvedValue({ data: activity });
  render(<EvidencePanel activityId="a1" canManageEvidence {...props} />);
  await screen.findByText('plan.pdf');
  fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
}

const colleague = { id: 'u-colleague', role: 'DEPT_STAFF', office: 'CCS' };
const owner = { id: 'u-owner', role: 'DEPT_STAFF', office: 'CCS' };

test('staff of the same department can open the details of a colleague\'s evidence, view-only', async () => {
  await showPanel({ user: colleague });

  fireEvent.click(screen.getByRole('menuitem', { name: /view details/i }));

  expect(screen.getByTestId('details-modal').textContent).toBe('read-only');
});

test('they still do not get the management actions on it', async () => {
  await showPanel({ user: colleague });

  expect(screen.getByRole('menuitem', { name: /view details/i })).toBeTruthy();
  expect(screen.getByRole('menuitem', { name: /download/i })).toBeTruthy();
  expect(screen.queryByRole('menuitem', { name: /delete/i })).toBeNull();
  expect(screen.queryByText(/upload new version/i)).toBeNull();
});

test('the uploader gets the editable details form and the management actions', async () => {
  await showPanel({ user: owner });

  expect(screen.getByRole('menuitem', { name: /delete/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem', { name: /view details/i }));

  expect(screen.getByTestId('details-modal').textContent).toBe('editable');
});

test('an admin gets the editable form for anyone\'s evidence', async () => {
  await showPanel({ user: { id: 'u-admin', role: 'ADMIN', office: null } });

  fireEvent.click(screen.getByRole('menuitem', { name: /view details/i }));

  expect(screen.getByTestId('details-modal').textContent).toBe('editable');
});

test('another department\'s activity still hides the details unless the evidence tags your unit', async () => {
  await showPanel({ user: { id: 'u-cea', role: 'DEPT_STAFF', office: 'CEA' } });

  expect(screen.queryByRole('menuitem', { name: /view details/i })).toBeNull();
});

test('while creating an activity the details action stays hidden', async () => {
  await showPanel({ user: owner, props: { hideMetadataActions: true } });

  expect(screen.queryByRole('menuitem', { name: /view details/i })).toBeNull();
});

test('a chairperson of the department gets the editable form for staff evidence', async () => {
  await showPanel({ user: { id: 'u-chair', role: 'ACCRED_COORDINATOR', office: 'CCS' } });

  // The chairperson is not the uploader, but may manage evidence in their own department.
  expect(screen.getByRole('menuitem', { name: /delete/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem', { name: /view details/i }));

  expect(screen.getByTestId('details-modal').textContent).toBe('editable');
});

test('a chairperson of another department only gets the view-only form, if they can open it at all', async () => {
  await showPanel({
    user: { id: 'u-cea-chair', role: 'ACCRED_COORDINATOR', office: 'CEA' },
    item: { ...evidenceItem, relatedOffices: ['COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE'] },
  });

  // Tagged for their department, so they may look, but it is not theirs to change.
  fireEvent.click(screen.getByRole('menuitem', { name: /view details/i }));
  expect(screen.getByTestId('details-modal').textContent).toBe('read-only');
  expect(screen.queryByRole('menuitem', { name: /delete/i })).toBeNull();
});
