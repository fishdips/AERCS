import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import ActionMenu from '../../../shared/components/ActionMenu';
import { getDashboardSummary } from '../api';
import { extendAccreditorAccess, deleteAccreditorAccess } from '../../accreditor-access/api';
import { formatActivityType, formatDepartment } from '../../activities/constants';
import { formatEvidenceType } from '../../evidence/constants';
import { copyToClipboard } from '../../../shared/utils/clipboard';
import './DashboardPage.css';

function formatDateOnly(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function EmptyRow({ text }) {
  return <p className="am-empty am-empty-plain">{text}</p>;
}

function EvidenceRow({ item, to }) {
  return (
    <Link className="am-recent-item" to={to}>
      <span>{item.originalFileName}</span>
      <small>
        {formatEvidenceType(item.evidenceType)} · {item.activityName}
        {item.referenceCount > 0 ? ` · ${item.referenceCount} reference${item.referenceCount === 1 ? '' : 's'}` : ''}
        {' · '}{formatDateTime(item.uploadedAt)}
      </small>
    </Link>
  );
}

function ActivityRow({ item, to }) {
  return (
    <Link className="am-recent-item" to={to}>
      <span>{item.activityName}</span>
      <small>
        {formatActivityType(item.activityType)} · {formatDepartment(item.department)} · {item.evidenceCount} evidence · {formatDateOnly(item.activityDate)}
      </small>
    </Link>
  );
}

function defaultExtendedExpiry(currentExpiresAt) {
  const base = currentExpiresAt ? new Date(currentExpiresAt) : new Date();
  base.setDate(base.getDate() + 7);
  base.setMinutes(base.getMinutes() - base.getTimezoneOffset());
  return base.toISOString().slice(0, 16);
}

function AccessRow({ item, onChanged }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newExpiry, setNewExpiry] = useState(() => defaultExtendedExpiry(item.expiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const copyLink = async () => {
    const succeeded = await copyToClipboard(item.accessUrl);
    setCopyFailed(!succeeded);
    if (succeeded) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExtend = async () => {
    if (!newExpiry) return;
    setSaving(true);
    setError('');
    try {
      await extendAccreditorAccess(item.id, new Date(newExpiry).toISOString());
      setEditing(false);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extend expiry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this accreditor access link? Anyone with the link will lose access immediately.')) return;
    setSaving(true);
    setError('');
    try {
      await deleteAccreditorAccess(item.id);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete access link.');
      setSaving(false);
    }
  };

  return (
    <div className="dash-access-row">
      <div className="dash-access-info">
        <span>{item.activityName || 'Evidence-only access link'}</span>
        <small>Expires {formatDateTime(item.expiresAt)}</small>
        {copyFailed && <small>Could not copy automatically — copy the link manually: {item.accessUrl}</small>}
        {error && <small className="dash-access-error">{error}</small>}
        {editing && (
          <div className="dash-access-edit">
            <input
              type="datetime-local"
              className="am-input"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              disabled={saving}
            />
            <button className="am-btn-primary am-btn-sm" type="button" onClick={handleExtend} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="am-btn-secondary am-btn-sm" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="dash-row-meta">
        <span className="dash-badge-warning">Expiring Soon</span>
        <ActionMenu
          items={[
            { label: copied ? 'Copied' : 'Copy Link', onClick: copyLink },
            { label: 'Extend Expiry', disabled: saving, onClick: () => setEditing(true) },
            { label: 'Delete', danger: true, disabled: saving, onClick: handleDelete },
          ]}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(() => {
    setError('');
    return getDashboardSummary()
      .then(({ data }) => setSummary(data))
      .catch(() => setError('Failed to load dashboard.'));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSummary().finally(() => setLoading(false));
  }, [loadSummary]);

  return (
    <ActivityShell>
      <p className="am-breadcrumb">Workspace / Dashboard</p>
      <div className="am-page-header">
        <h1 className="am-page-title">Dashboard</h1>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}
      {loading && <EmptyRow text="Loading dashboard..." />}

      {!loading && summary && (
        <>
          <div className="dash-stats-grid">
            <div className="dash-stat-card">
              <span className="dash-stat-num">{summary.overview.totalActivities}</span>
              <span className="dash-stat-lbl">Total Activities</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-num">{summary.overview.uploadedEvidence}</span>
              <span className="dash-stat-lbl">Uploaded Evidence</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-num">{summary.overview.evidenceNeedingMetadata}</span>
              <span className="dash-stat-lbl">Needs Metadata</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-num">{summary.overview.expiringAccreditorAccess}</span>
              <span className="dash-stat-lbl">Access Links Expiring</span>
            </div>
          </div>

          <p className="am-section-label">Evidence Insights</p>
          <div className="dash-grid-2 dash-section">
            <section className="am-panel">
              <p className="am-section-label">Most Referenced Evidence</p>
              {summary.mostReferencedEvidence.length === 0
                ? <EmptyRow text="No evidence has been referenced yet." />
                : (
                  <div className="am-recent-list">
                    {summary.mostReferencedEvidence.map((item) => (
                      <EvidenceRow key={item.id} item={item} to={`/activities/${item.activityId}`} />
                    ))}
                  </div>
                )}
            </section>
            <section className="am-panel">
              <p className="am-section-label">Recommended For You</p>
              {summary.recommendedEvidence.length === 0
                ? <EmptyRow text="No recommended evidence right now." />
                : (
                  <div className="am-recent-list">
                    {summary.recommendedEvidence.map((item) => (
                      <EvidenceRow key={item.id} item={item} to={`/activities/${item.activityId}`} />
                    ))}
                  </div>
                )}
            </section>
          </div>

          <p className="am-section-label dash-section">Activity Progress</p>
          <div className="dash-grid-3 dash-section">
            <section className="am-panel">
              <p className="am-section-label">Recent Activities</p>
              {summary.recentActivities.length === 0
                ? <EmptyRow text="No activities yet." />
                : (
                  <div className="am-recent-list">
                    {summary.recentActivities.map((item) => (
                      <ActivityRow key={item.id} item={item} to={`/activities/${item.id}`} />
                    ))}
                  </div>
                )}
            </section>
            <section className="am-panel">
              <p className="am-section-label">No Evidence Uploaded</p>
              {summary.activitiesWithNoEvidence.length === 0
                ? <EmptyRow text="Every activity has evidence uploaded." />
                : (
                  <div className="am-recent-list">
                    {summary.activitiesWithNoEvidence.map((item) => (
                      <ActivityRow key={item.id} item={item} to={`/activities/${item.id}/evidence`} />
                    ))}
                  </div>
                )}
            </section>
            <section className="am-panel">
              <p className="am-section-label">Missing Metadata</p>
              {summary.activitiesWithEvidenceMissingMetadata.length === 0
                ? <EmptyRow text="All evidence is fully tagged." />
                : (
                  <div className="am-recent-list">
                    {summary.activitiesWithEvidenceMissingMetadata.map((item) => (
                      <ActivityRow key={item.id} item={item} to={`/activities/${item.id}/metadata`} />
                    ))}
                  </div>
                )}
            </section>
          </div>

          <section className="am-panel dash-section">
            <p className="am-section-label">
              Metadata Tasks <span className="am-count">{summary.evidenceNeedingMetadata.length} shown</span>
            </p>
            {summary.evidenceNeedingMetadata.length === 0
              ? <EmptyRow text="No evidence is missing metadata." />
              : (
                <div className="am-recent-list">
                  {summary.evidenceNeedingMetadata.map((item) => (
                    <EvidenceRow key={item.id} item={item} to={`/activities/${item.activityId}/metadata`} />
                  ))}
                </div>
              )}
          </section>

          <section className="am-panel dash-section">
            <p className="am-section-label">Accreditor Access Expiring Within 7 Days</p>
            {summary.expiringAccreditorAccess.length === 0
              ? <EmptyRow text="No active access links are expiring soon." />
              : summary.expiringAccreditorAccess.map((item) => (
                <AccessRow key={item.id} item={item} onChanged={loadSummary} />
              ))}
          </section>
        </>
      )}
    </ActivityShell>
  );
}
