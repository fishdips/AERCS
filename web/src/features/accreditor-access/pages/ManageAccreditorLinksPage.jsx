import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import ActionMenu from '../../../shared/components/ActionMenu';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { deleteAccreditorAccess, getAccreditorAccessLinks } from '../api';
import EditAccreditorLinkModal from '../components/EditAccreditorLinkModal';
import BulkAssignAccreditorsModal from '../components/BulkAssignAccreditorsModal';
import '../AccreditorAccess.css';
import { Pencil, Trash2 } from 'lucide-react';
import Icon from '../../../shared/components/Icon';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Staff view of every accreditor link they can manage (their own, or all for
// Admin / Accreditation Coordinator), with single-link editing and bulk assignment.
export default function ManageAccreditorLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showExpired, setShowExpired] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [bulkLinks, setBulkLinks] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadLinks = useCallback(() => {
    setError('');
    return getAccreditorAccessLinks()
      .then(({ data }) => setLinks(data))
      .catch(() => setError('Failed to load accreditor links.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return links.filter((l) => {
      if (!showExpired && l.expired) return false;
      if (!term) return true;
      return l.name.toLowerCase().includes(term)
        || (l.activityName || '').toLowerCase().includes(term)
        || l.accreditors.some((a) => a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term));
    });
  }, [links, search, showExpired]);

  const visibleIds = filtered.map((l) => l.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelected = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]));
  };

  const toggleAllVisible = () => {
    setSelectedIds((ids) => (allVisibleSelected
      ? ids.filter((id) => !visibleIds.includes(id))
      : [...new Set([...ids, ...visibleIds])]));
  };

  const reportSaved = (message, emailFailures) => {
    setNotice(emailFailures.length > 0
      ? `${message} Notification email could not be sent to: ${emailFailures.join(', ')}.`
      : message);
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteAccreditorAccess(deleting.id);
      setSelectedIds((ids) => ids.filter((id) => id !== deleting.id));
      setDeleting(null);
      setNotice('Access link deleted.');
      await loadLinks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete the access link.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const selectedLinks = links.filter((l) => selectedIds.includes(l.id));

  return (
    <ActivityShell>
      <div className="am-page-header">
        <div className="am-page-header-left">
          <h1 className="am-page-title">Accreditor Links</h1>
          <p className="am-description">
            Evidence shared with registered accreditor accounts. Create new links from an activity,
            the Repository, or Shared Evidence.
          </p>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}
      {notice && <p className="am-alert am-alert-success">{notice}</p>}

      <div className="am-filters">
        <input
          className="am-search"
          type="search"
          placeholder="Search by link name, activity, or accreditor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="aa-inline-check">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} />
          Show expired
        </label>
      </div>

      <div className="am-table-section">
        <div className="am-table-header-row">
          <p className="am-section-label">
            Links <span className="am-count">{filtered.length} shown</span>
          </p>
          <button
            className="am-btn-primary am-btn-sm"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => { setNotice(''); setBulkLinks(selectedLinks); }}
          >
            Assign Accreditors{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
        </div>

        <div className="aa-table-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th className="am-th aa-th-check">
                  <input
                    type="checkbox"
                    aria-label="Select all shown links"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    disabled={visibleIds.length === 0}
                  />
                </th>
                <th className="am-th">Link Name</th>
                <th className="am-th">Accreditors</th>
                <th className="am-th">Evidence</th>
                <th className="am-th">Expires</th>
                <th className="am-th">Created By</th>
                <th className="am-th am-th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="am-td" colSpan={7}>Loading accreditor links...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td className="am-td" colSpan={7}>No accreditor links to show.</td></tr>
              )}
              {filtered.map((link) => (
                <tr key={link.id}>
                  <td className="am-td aa-th-check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${link.name}`}
                      checked={selectedIds.includes(link.id)}
                      onChange={() => toggleSelected(link.id)}
                    />
                  </td>
                  <td className="am-td am-td-title">
                    {link.name}
                    {link.activityName && (
                      <small className="aa-cell-sub">
                        Activity: <Link to={`/activities/${link.activityId}`}>{link.activityName}</Link>
                      </small>
                    )}
                  </td>
                  <td className="am-td">
                    {link.accreditors.length === 0
                      ? <span className="aa-warning">None assigned</span>
                      : (
                        <div className="aa-chip-list">
                          {link.accreditors.map((a) => (
                            <span key={a.id} className="aa-chip" title={a.email}>{a.name}</span>
                          ))}
                        </div>
                      )}
                  </td>
                  <td className="am-td">{link.evidenceCount}</td>
                  <td className="am-td">
                    {formatDateTime(link.expiresAt)}
                    {link.expired && <small className="aa-cell-sub aa-warning">Expired</small>}
                  </td>
                  <td className="am-td">{link.createdByName || '-'}</td>
                  <td className="am-td am-td-action">
                    <ActionMenu
                      items={[
                        { icon: Pencil, label: 'Edit / Accreditors', onClick: () => { setNotice(''); setEditing(link); } },
                        { icon: Trash2, label: 'Delete', danger: true, onClick: () => setDeleting(link) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EditAccreditorLinkModal
        link={editing}
        onClose={() => setEditing(null)}
        onSaved={(emailFailures) => {
          setEditing(null);
          reportSaved('Link updated.', emailFailures);
          loadLinks();
        }}
      />

      <BulkAssignAccreditorsModal
        links={bulkLinks}
        onClose={() => setBulkLinks([])}
        onSaved={(emailFailures) => {
          setBulkLinks([]);
          setSelectedIds([]);
          reportSaved('Accreditors assigned.', emailFailures);
          loadLinks();
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Access Link"
        message={`Delete "${deleting?.name}"? Assigned accreditors will lose access immediately.`}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
      />
    </ActivityShell>
  );
}
