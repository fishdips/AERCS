import { fireEvent, render, screen } from '@testing-library/react';
import EvidenceMetadataModal from './EvidenceMetadataModal';
import { getEvidenceMetadata, updateEvidenceMetadata } from '../api';

jest.mock('../api', () => ({
  downloadEvidenceBlob: jest.fn(),
  getEvidenceMetadata: jest.fn(),
  updateEvidenceMetadata: jest.fn(),
  viewEvidenceBlob: jest.fn(),
}));
jest.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'DEPT_STAFF', office: 'CCS' } }),
}));
// The real preview and history modal pull in the PDF / Word / Excel libraries, which can't run here.
jest.mock('../../../shared/components/EvidencePreview', () => () => null);
jest.mock('./EvidenceVersionsModal', () => () => null);

const evidence = {
  id: 'e1',
  originalFileName: 'plan.pdf',
  fileType: 'PDF',
  fileSize: 2048,
  currentVersion: 1,
  uploadedAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  getEvidenceMetadata.mockResolvedValue({
    data: {
      evidenceType: 'REPORT',
      relatedOffices: ['LIBRARY'],
      tags: ['attendance'],
      notes: 'Signed copy',
      accreditationArea: 'FACULTY',
      academicYear: '2026-2027',
    },
  });
  updateEvidenceMetadata.mockResolvedValue({});
});

async function open(props = {}) {
  render(<EvidenceMetadataModal evidence={evidence} isOpen onClose={jest.fn()} onSaved={jest.fn()} {...props} />);
  await screen.findByText('Metadata');
}

test('read-only: shows the saved details but cannot be changed or saved', async () => {
  await open({ readOnly: true });

  expect(screen.getByText(/view only/i)).toBeTruthy();
  // The saved values are there to read...
  expect(screen.getByDisplayValue('attendance')).toBeTruthy();
  expect(screen.getByDisplayValue('Signed copy')).toBeTruthy();
  // ...but nothing is editable and there is no Save button.
  expect(screen.getByRole('combobox').disabled).toBe(true);
  expect(screen.getByDisplayValue('attendance').readOnly).toBe(true);
  expect(screen.getByDisplayValue('Signed copy').readOnly).toBe(true);
  screen.getAllByRole('checkbox').forEach((box) => expect(box.disabled).toBe(true));
  expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  // Two Close buttons: the modal's X in the header and the footer one that replaces Cancel / Save.
  expect(screen.getAllByRole('button', { name: /^close$/i })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull();
});

test('read-only: the ticked offices are still shown', async () => {
  await open({ readOnly: true });

  expect(screen.getByRole('checkbox', { name: /learning resource and activity center/i }).checked).toBe(true);
});

test('editable: the form can be changed and saved', async () => {
  await open();

  expect(screen.queryByText(/view only/i)).toBeNull();
  expect(screen.getByRole('combobox').disabled).toBe(false);
  expect(screen.getByDisplayValue('attendance').readOnly).toBe(false);
  expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^cancel$/i })).toBeTruthy();
});

test('read-only: submitting the form (e.g. Enter in a field) never sends an update', async () => {
  await open({ readOnly: true });

  fireEvent.submit(screen.getByDisplayValue('attendance'));

  expect(updateEvidenceMetadata).not.toHaveBeenCalled();
});

describe('last edited by', () => {
  const savedMetadata = (extra) => ({
    data: {
      evidenceType: 'REPORT',
      relatedOffices: [],
      tags: [],
      notes: '',
      accreditationArea: 'FACULTY',
      academicYear: '2026-2027',
      ...extra,
    },
  });

  test('shows who last edited the metadata and when', async () => {
    getEvidenceMetadata.mockResolvedValue(savedMetadata({
      metadataUpdatedByName: 'Cora Chair',
      metadataUpdatedAt: '2026-11-13T09:30:00Z',
    }));
    await open();

    expect(screen.getByText(/last edited by/i).textContent).toMatch(/Cora Chair/);
    expect(screen.getByText(/last edited by/i).textContent).toMatch(/2026/);
  });

  test('is also shown in the view-only form, so staff can see a chairperson changed it', async () => {
    getEvidenceMetadata.mockResolvedValue(savedMetadata({
      metadataUpdatedByName: 'Cora Chair',
      metadataUpdatedAt: '2026-11-13T09:30:00Z',
    }));
    await open({ readOnly: true });

    expect(screen.getByText(/last edited by/i).textContent).toMatch(/Cora Chair/);
  });

  test('says "a former user" when the editor\'s account no longer exists', async () => {
    getEvidenceMetadata.mockResolvedValue(savedMetadata({
      metadataUpdatedByName: null,
      metadataUpdatedAt: '2026-11-13T09:30:00Z',
    }));
    await open();

    expect(screen.getByText(/last edited by/i).textContent).toMatch(/a former user/);
  });

  test('shows nothing for metadata that has never been saved', async () => {
    getEvidenceMetadata.mockResolvedValue(savedMetadata({}));
    await open();

    expect(screen.queryByText(/last edited by/i)).toBeNull();
  });
});
