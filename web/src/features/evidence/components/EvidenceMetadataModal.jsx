import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { formatAccreditationArea, isServiceOfficeValue } from '../../activities/constants';
import { useAuth } from '../../../shared/hooks/useAuth';
import { downloadEvidenceBlob, getEvidenceMetadata, updateEvidenceMetadata, viewEvidenceBlob } from '../api';
import { EVIDENCE_TYPES, formatEvidenceType, formatRelatedOffice } from '../constants';
import RelatedOfficesPicker from './RelatedOfficesPicker';
import { Globe, History } from 'lucide-react';
import Icon from '../../../shared/components/Icon';
import Alert from '../../../shared/components/Alert';
import EvidencePreview from '../../../shared/components/EvidencePreview';
import EvidenceVersionsModal from './EvidenceVersionsModal';

const initialForm = {
  evidenceType: '',
  relatedOffices: [],
  tags: '',
  notes: '',
};

const PREVIEW_TYPES = ['PDF', 'JPG', 'JPEG', 'PNG'];

function formatFileSize(size) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EvidenceMetadataModal({ evidence, isOpen, onClose, onSaved }) {
  const { user: currentUser } = useAuth();
  const [metadata, setMetadata] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const canPreview = PREVIEW_TYPES.includes(evidence?.fileType);

  useEffect(() => {
    if (!isOpen || !evidence) return;

    const loadMetadata = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await getEvidenceMetadata(evidence.id);
        setMetadata(data);
        setForm({
          evidenceType: data.evidenceType || '',
          relatedOffices: data.relatedOffices || [],
          tags: (data.tags || []).join(', '),
          notes: data.notes || '',
        });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load metadata.');
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [evidence, isOpen]);

  // Fetched only when "Open Preview" is clicked, not on every open of the modal.
  const handleOpenPreview = async () => {
    if (!evidence || openingPreview) return;
    // Open the tab synchronously so popup blockers allow it, then point it at the file.
    const tab = window.open('', '_blank');
    setOpeningPreview(true);
    try {
      const { data } = await viewEvidenceBlob(evidence.id);
      const objectUrl = URL.createObjectURL(data);
      if (tab) tab.location.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      if (tab) tab.close();
      setError(err.response?.data?.error || 'Preview is not available.');
    } finally {
      setOpeningPreview(false);
    }
  };

  const toggleOffice = (office) => {
    setForm((current) => {
      const exists = current.relatedOffices.includes(office);
      return {
        ...current,
        relatedOffices: exists
          ? current.relatedOffices.filter((value) => value !== office)
          : [...current.relatedOffices, office],
      };
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    if (!evidence) return;
    if (!form.evidenceType) {
      setError('Evidence type is required.');
      return;
    }

    setSaving(true);
    try {
      await updateEvidenceMetadata(evidence.id, {
        evidenceType: form.evidenceType,
        relatedOffices: form.relatedOffices,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: form.notes.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save metadata.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!evidence) return;

    setError('');
    try {
      const { data } = await downloadEvidenceBlob(evidence.id);
      saveBlob(data, evidence.originalFileName || 'evidence');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download evidence.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Evidence Details" size="wide">
      {loading && <p className="am-empty am-empty-plain">Loading metadata...</p>}
      {!loading && (
        <form className="am-metadata-form am-metadata-workspace" onSubmit={handleSave} noValidate>
          <Alert type="error" message={error} onDismiss={() => setError('')} />

          <div className="am-evidence-detail-layout">
            <section className="am-evidence-file-panel">
              <p className="am-section-label">File</p>
              <div className="am-evidence-preview-box">
                <EvidencePreview
                  evidenceId={evidence?.id}
                  fileType={evidence?.fileType}
                  linkUrl={evidence?.linkUrl}
                  fileName={evidence?.originalFileName}
                />
              </div>
              <dl className="am-evidence-file-details">
                <div>
                  <dt>File</dt>
                  <dd>{evidence?.originalFileName || '-'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{evidence?.fileType || '-'}</dd>
                </div>
                {evidence?.fileType !== 'LINK' && (
                  <div>
                    <dt>Version</dt>
                    <dd>v{evidence?.currentVersion || 1}</dd>
                  </div>
                )}
                <div>
                  <dt>Size</dt>
                  <dd>{formatFileSize(evidence?.fileSize)}</dd>
                </div>
                <div>
                  <dt>Uploaded</dt>
                  <dd>{formatDate(evidence?.uploadedAt)}</dd>
                </div>
              </dl>
              <div className="am-evidence-file-actions">
                {canPreview && (
                  <button
                    className="am-btn-secondary"
                    type="button"
                    onClick={handleOpenPreview}
                    disabled={openingPreview}
                  >
                    {openingPreview ? 'Opening...' : 'Open Preview'}
                  </button>
                )}
                <button className="am-btn-secondary" type="button" onClick={handleDownload}>
                  Download
                </button>
                {evidence?.fileType !== 'LINK' && (
                  <button
                    className="am-btn-secondary"
                    type="button"
                    onClick={() => setVersionsModalOpen(true)}
                  >
                    <Icon as={History} /> Version History (v{evidence?.currentVersion || 1})
                  </button>
                )}
              </div>
            </section>

            <section className="am-metadata-edit-panel">
              <div className="am-metadata-panel-header">
                <p className="am-section-label">Metadata</p>
                {metadata?.evidenceType && (
                  <span className="am-type-badge">{formatEvidenceType(metadata.evidenceType)}</span>
                )}
              </div>

              <label className="am-form-field">
                <span className="am-form-label">Evidence Type <span className="am-required">*</span></span>
                <select
                  className="am-select"
                  value={form.evidenceType}
                  onChange={(event) => setForm((current) => ({ ...current, evidenceType: event.target.value }))}
                >
                  <option value="">Select type</option>
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>

              <div className="am-form-field">
                <span className="am-form-label">Referencing Offices / Visibility</span>
                {isServiceOfficeValue(currentUser?.office) || isServiceOfficeValue(evidence?.uploadedByOffice) ? (
                  <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', color: '#60a5fa', fontSize: '0.85rem' }}>
                    <Icon as={Globe} /> <strong>Service Office Common Post</strong>
                    <p style={{ margin: '0.25rem 0 0 0', opacity: 0.85, fontSize: '0.78rem' }}>
                      As content created under a Service Office, this evidence is automatically visible to academic departments and users within your office.
                    </p>
                  </div>
                ) : (
                  <RelatedOfficesPicker selected={form.relatedOffices} onToggle={toggleOffice} />
                )}
              </div>

              <label className="am-form-field">
                <span className="am-form-label">Tags</span>
                <input
                  className="am-input"
                  placeholder="research, attendance, faculty"
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                />
              </label>

              <label className="am-form-field">
                <span className="am-form-label">Notes</span>
                <textarea
                  className="am-textarea"
                  rows={5}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </section>

            <aside className="am-metadata-side-panel">
              <section>
                <p className="am-section-label">Activity Context</p>
                <dl className="am-evidence-file-details">
                  <div>
                    <dt>Accreditation Area</dt>
                    <dd>{formatAccreditationArea(metadata?.accreditationArea)}</dd>
                  </div>
                  <div>
                    <dt>Academic Year</dt>
                    <dd>{metadata?.academicYear || '-'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <p className="am-section-label">Selected Offices</p>
                {form.relatedOffices.length > 0 ? (
                  <div className="am-selected-office-list">
                    {form.relatedOffices.map((office) => (
                      <span key={office}>{formatRelatedOffice(office)}</span>
                    ))}
                  </div>
                ) : (
                  <p className="am-empty-inline">No offices selected.</p>
                )}
              </section>
            </aside>
          </div>

          <div className="am-form-actions am-metadata-actions">
            <button className="am-btn-secondary" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="am-btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}
      <EvidenceVersionsModal
        evidence={evidence}
        isOpen={versionsModalOpen}
        onClose={() => setVersionsModalOpen(false)}
        canRestore={false}
        onRestored={() => {
          if (onSaved) onSaved();
        }}
      />
    </Modal>
  );
}
