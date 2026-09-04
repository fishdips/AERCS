import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listEvidence, updateEvidenceMetadataBatch } from '../api';
import { EVIDENCE_TYPES, RELATED_OFFICES } from '../constants';

const initialForm = {
  evidenceType: '',
  relatedOffices: [],
  tags: '',
  notes: '',
};

function hasMetadata(item) {
  return Boolean(item.evidenceType || item.relatedOffices?.length || item.tags?.length || item.notes);
}

export default function BatchMetadataPanel({
  activityId,
  evidence: externalEvidence = null,
  hideEvidenceSelection = false,
  selectedIds: controlledSelectedIds = null,
  onSelectedIdsChange,
  onSaved,
}) {
  const [evidence, setEvidence] = useState([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(!externalEvidence);
  const [saving, setSaving] = useState(false);

  const effectiveEvidence = externalEvidence || evidence;
  const selectedIds = controlledSelectedIds || internalSelectedIds;
  const setSelectedIds = onSelectedIdsChange || setInternalSelectedIds;

  const prefilledForId = useRef(null);

  // Re-selecting a single evidence file that already has metadata loads its
  // current values into the form instead of leaving it blank, so saving adds
  // to what's there rather than silently wiping it out.
  useEffect(() => {
    if (selectedIds.length !== 1) {
      prefilledForId.current = null;
      return;
    }
    const id = selectedIds[0];
    if (prefilledForId.current === id) return;
    const item = effectiveEvidence.find((candidate) => candidate.id === id);
    if (!item || !hasMetadata(item)) return;
    setForm({
      evidenceType: item.evidenceType || '',
      relatedOffices: item.relatedOffices || [],
      tags: (item.tags || []).join(', '),
      notes: item.notes || '',
    });
    prefilledForId.current = id;
  }, [selectedIds, effectiveEvidence]);

  const loadEvidence = useCallback(async () => {
    if (externalEvidence) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await listEvidence(activityId);
      const files = data || [];
      setEvidence(files);
      setInternalSelectedIds(files.filter((item) => !hasMetadata(item)).map((item) => item.id));
    } catch {
      setError('Evidence could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [activityId, externalEvidence]);

  useEffect(() => {
    if (activityId) loadEvidence();
  }, [activityId, loadEvidence]);

  const selectableEvidence = useMemo(() => effectiveEvidence.filter((item) => !hasMetadata(item)), [effectiveEvidence]);
  const selectedCount = selectedIds.length;
  const allSelected = useMemo(
    () => selectableEvidence.length > 0 && selectableEvidence.every((item) => selectedIds.includes(item.id)),
    [selectableEvidence, selectedIds]
  );

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

  const toggleEvidence = (evidenceId) => {
    const item = effectiveEvidence.find((candidate) => candidate.id === evidenceId);
    if (!item) return;

    const nextIds = selectedIds.includes(evidenceId)
      ? selectedIds.filter((idValue) => idValue !== evidenceId)
      : [...selectedIds, evidenceId];
    setSelectedIds(nextIds);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (selectedIds.length === 0) {
      setError('Select at least one evidence file.');
      return;
    }
    if (!form.evidenceType) {
      setError('Evidence type is required.');
      return;
    }

    setSaving(true);
    try {
      await updateEvidenceMetadataBatch({
        evidenceIds: selectedIds,
        evidenceType: form.evidenceType,
        relatedOffices: form.relatedOffices,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: form.notes.trim(),
      });
      setSuccess('Metadata saved.');
      setForm(initialForm);
      if (!externalEvidence) await loadEvidence();
      setSelectedIds([]);
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save metadata.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="am-batch-metadata-panel" onSubmit={handleSave} noValidate>
      {error && <p className="am-alert am-alert-error">{error}</p>}
      {success && <p className="am-alert am-alert-success">{success}</p>}
      {loading && <p className="am-empty am-empty-plain">Loading evidence...</p>}

      {!loading && (
        <>
          {!hideEvidenceSelection && (
            <section className="am-panel">
              <div className="am-table-header-row">
                <div>
                  <p className="am-section-label">Evidence Files <span className="am-count">{selectedCount} selected</span></p>
                  <p className="am-helper-text">Assign metadata to selected evidence files.</p>
                </div>
                <button
                  className="am-btn-secondary am-btn-sm"
                  type="button"
                  onClick={() => setSelectedIds(allSelected ? [] : selectableEvidence.map((item) => item.id))}
                  disabled={selectableEvidence.length === 0}
                >
                  Select All Selectable
                </button>
              </div>

              {effectiveEvidence.length === 0 ? (
                <div className="am-evidence-placeholder"><span>No evidence uploaded yet.</span></div>
              ) : (
                <div className="am-batch-file-list">
                  {effectiveEvidence.map((item) => {
                    const assigned = hasMetadata(item);
                    return (
                      <label className="am-batch-file" key={item.id}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleEvidence(item.id)}
                        />
                        <span>{item.originalFileName}</span>
                        <small>{assigned ? 'Metadata Assigned — select to edit' : item.fileType}</small>
                      </label>
                    );
                  })}
                </div>
              )}

              {selectedIds.length > 0 && (
                <div className="am-selection-tools">
                  <button className="am-tertiary-danger" type="button" onClick={() => setSelectedIds([])}>
                    Clear Selection
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="am-panel">
            <p className="am-section-label">Metadata <span className="am-count">{selectedCount} selected</span></p>
            <div className="am-form-grid am-metadata-batch-grid">
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

              <label className="am-form-field">
                <span className="am-form-label">Tags</span>
                <input
                  className="am-input"
                  placeholder="research, attendance, faculty"
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                />
              </label>

              <div className="am-form-field am-form-field-wide">
                <span className="am-form-label">Related Offices</span>
                <div className="am-office-options">
                  {RELATED_OFFICES.map((office) => (
                    <label key={office.value}>
                      <input
                        type="checkbox"
                        checked={form.relatedOffices.includes(office.value)}
                        onChange={() => toggleOffice(office.value)}
                      />
                      {office.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="am-form-field am-form-field-wide">
                <span className="am-form-label">Notes</span>
                <textarea
                  className="am-textarea"
                  rows={5}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <div className="am-form-actions am-workflow-actions">
            {hideEvidenceSelection && selectedIds.length > 0 && (
              <button className="am-tertiary-danger" type="button" onClick={() => setSelectedIds([])}>
                Clear Selection
              </button>
            )}
            <button className="am-btn-primary" type="submit" disabled={saving || effectiveEvidence.length === 0 || selectedIds.length === 0}>
              {saving ? 'Saving...' : 'Assign Metadata'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
