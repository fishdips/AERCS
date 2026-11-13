import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EvidenceVersionsModal from './EvidenceVersionsModal';
import { deleteEvidenceVersion, listEvidenceVersions, restoreEvidenceVersion } from '../api';

jest.mock('../api', () => ({
  listEvidenceVersions: jest.fn(),
  deleteEvidenceVersion: jest.fn(),
  restoreEvidenceVersion: jest.fn(),
  downloadEvidenceVersionBlob: jest.fn(),
}));
// The real preview pulls in the PDF / Word / Excel libraries, which can't run under Jest.
jest.mock('../../../shared/components/EvidencePreview', () => () => null);

const evidence = { id: 'e1', originalFileName: 'report.pdf' };
const version = (id, number, isCurrent) => ({
  id,
  versionNumber: number,
  isCurrent,
  originalFileName: 'report.pdf',
  fileType: 'PDF',
  fileSize: 2048,
  versionNote: `note ${number}`,
  uploadedByName: 'Ana',
  uploadedAt: '2026-11-01T08:00:00Z',
});

beforeEach(() => {
  listEvidenceVersions.mockResolvedValue({ data: [version('b', 2, true), version('a', 1, false)] });
  deleteEvidenceVersion.mockResolvedValue({});
  restoreEvidenceVersion.mockResolvedValue({});
});

function open(props = {}) {
  return render(
    <EvidenceVersionsModal evidence={evidence} isOpen onClose={jest.fn()} canManage {...props} />,
  );
}

test('Delete asks for confirmation first and only deletes after "Yes, delete"', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

  expect(screen.getByText('Delete v1 permanently?')).toBeTruthy();
  expect(deleteEvidenceVersion).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
  await waitFor(() => expect(deleteEvidenceVersion).toHaveBeenCalledWith('e1', 'a'));
  expect(deleteEvidenceVersion).toHaveBeenCalledTimes(1);
});

test('Cancel backs out of the delete without calling the server', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

  expect(screen.queryByText('Delete v1 permanently?')).toBeNull();
  expect(screen.getByRole('button', { name: /restore/i })).toBeTruthy();
  expect(deleteEvidenceVersion).not.toHaveBeenCalled();
});

test('the current version has no Restore or Delete', async () => {
  open();
  await screen.findByRole('button', { name: /^delete$/i });
  // Two versions are listed but only the older one can be restored or deleted.
  expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1);
});

test('people who cannot manage the file see no Restore or Delete at all', async () => {
  open({ canManage: false });
  await screen.findByText(/All Versions/);
  expect(screen.queryByRole('button', { name: /restore/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
});

test('only the version being deleted shows the confirmation; the others keep their buttons', async () => {
  listEvidenceVersions.mockResolvedValue({
    data: [version('c', 3, true), version('b', 2, false), version('a', 1, false)],
  });
  open();
  const deleteButtons = await screen.findAllByRole('button', { name: /^delete$/i });
  fireEvent.click(deleteButtons[0]); // v2 is now waiting for confirmation

  expect(screen.getByText('Delete v2 permanently?')).toBeTruthy();
  expect(screen.queryByText('Delete v1 permanently?')).toBeNull();
  // v1 still has its own Restore and Delete; v2's were replaced by the confirmation.
  expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1);
});
