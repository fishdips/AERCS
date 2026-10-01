import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ActivityShell from '../../activities/components/ActivityShell';
import { getMyAccreditorLinks } from '../api';
import '../AccreditorAccess.css';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function expiresSoon(value) {
  return new Date(value).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
}

// Home page for an accreditor account: every link assigned to them that is still open.
export default function AccreditorLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMyAccreditorLinks()
      .then(({ data }) => setLinks(data))
      .catch(() => setError('Failed to load your evidence links.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return links;
    return links.filter((l) =>
      l.name.toLowerCase().includes(term)
      || (l.notes || '').toLowerCase().includes(term)
      || (l.sharedBy || '').toLowerCase().includes(term));
  }, [links, search]);

  return (
    <ActivityShell>
      <div className="am-page-header">
        <div className="am-page-header-left">
          <h1 className="am-page-title">Evidence Links</h1>
          <p className="am-description">Accreditation evidence shared with you for review. Links close automatically when they expire.</p>
        </div>
      </div>

      {error && <p className="am-alert am-alert-error">{error}</p>}

      {links.length > 0 && (
        <div className="am-filters">
          <input
            className="am-search"
            type="search"
            placeholder="Search links by name, notes, or who shared them"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading && <p className="am-empty am-empty-plain">Loading your evidence links...</p>}

      {!loading && !error && links.length === 0 && (
        <p className="am-empty am-empty-plain">No evidence links have been shared with you yet.</p>
      )}

      {!loading && links.length > 0 && filtered.length === 0 && (
        <p className="am-empty am-empty-plain">No links match "{search}".</p>
      )}

      <div className="aa-link-grid">
        {filtered.map((link) => (
          <Link key={link.id} to={`/accreditor/links/${link.id}`} className="aa-link-card">
            <div className="aa-link-card-head">
              <strong>{link.name}</strong>
              <span className={`aa-link-expiry ${expiresSoon(link.expiresAt) ? 'aa-link-expiry-soon' : ''}`}>
                Expires {formatDateTime(link.expiresAt)}
              </span>
            </div>
            {link.notes && <p className="aa-link-notes">{link.notes}</p>}
            <div className="aa-link-meta">
              <span>{link.evidenceCount} evidence file{link.evidenceCount === 1 ? '' : 's'}</span>
              {link.sharedBy && <span>Shared by {link.sharedBy}</span>}
              <span>Shared {formatDateTime(link.createdAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </ActivityShell>
  );
}
