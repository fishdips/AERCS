import { useEffect, useMemo, useState } from 'react';
import { getAccreditors } from '../api';

// Checkbox list of registered accreditor accounts. `value` is an array of user ids.
export default function AccreditorPicker({ value, onChange, disabled = false }) {
  const [accreditors, setAccreditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAccreditors()
      .then(({ data }) => setAccreditors(data))
      .catch(() => setError('Could not load accreditor accounts.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accreditors;
    return accreditors.filter((a) =>
      a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term));
  }, [accreditors, search]);

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => value.includes(a.id));
  const toggleAllFiltered = () => {
    const ids = filtered.map((a) => a.id);
    onChange(allFilteredSelected
      ? value.filter((v) => !ids.includes(v))
      : [...new Set([...value, ...ids])]);
  };

  if (loading) return <p className="aa-picker-empty">Loading accreditors...</p>;
  if (error) return <p className="am-alert am-alert-error">{error}</p>;
  if (accreditors.length === 0) {
    return (
      <p className="aa-picker-empty">
        No accreditor accounts yet. Ask a system administrator to create users with the Accreditor role.
      </p>
    );
  }

  return (
    <div className="aa-picker">
      <div className="aa-picker-tools">
        <input
          className="am-input"
          type="search"
          placeholder="Search accreditors by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
        <button type="button" className="am-btn-secondary am-btn-sm" onClick={toggleAllFiltered} disabled={disabled || filtered.length === 0}>
          {allFilteredSelected ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="aa-picker-list" role="group" aria-label="Accreditors">
        {filtered.length === 0 && <p className="aa-picker-empty">No accreditors match "{search}".</p>}
        {filtered.map((a) => (
          <label key={a.id} className="aa-picker-item">
            <input
              type="checkbox"
              checked={value.includes(a.id)}
              onChange={() => toggle(a.id)}
              disabled={disabled}
            />
            <span>
              <strong>{a.name}</strong>
              <small>{a.email}</small>
            </span>
          </label>
        ))}
      </div>
      <small className="aa-picker-count">{value.length} accreditor{value.length === 1 ? '' : 's'} selected</small>
    </div>
  );
}
