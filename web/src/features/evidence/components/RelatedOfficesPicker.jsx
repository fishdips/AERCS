import { useMemo, useState } from 'react';
import { RELATED_OFFICES } from '../constants';

// Checkbox list of related offices with a quick search box. Every word typed must appear
// somewhere in the office name, in any order ("nursing health", "qa office").
// Offices that are ticked stay ticked while a search hides them; the count shows how many.
// With `disabled` the selection is shown but can't be changed (the search still works).
export default function RelatedOfficesPicker({ selected = [], onToggle, disabled = false }) {
  const [search, setSearch] = useState('');

  const visibleOffices = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return RELATED_OFFICES;
    return RELATED_OFFICES.filter((office) => {
      const label = office.label.toLowerCase();
      return words.every((word) => label.includes(word));
    });
  }, [search]);

  return (
    <div className="am-office-picker">
      <div className="am-office-search-row">
        <input
          className="am-input am-office-search"
          type="search"
          placeholder="Search offices..."
          aria-label="Search related offices"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            // Enter would otherwise submit the surrounding form.
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === 'Escape' && search) {
              event.stopPropagation();
              setSearch('');
            }
          }}
        />
        <span className="am-office-count">{selected.length} selected</span>
      </div>

      <div className="am-office-options">
        {visibleOffices.map((office) => (
          <label key={office.value}>
            <input
              type="checkbox"
              checked={selected.includes(office.value)}
              disabled={disabled}
              onChange={() => onToggle(office.value)}
            />
            {office.label}
          </label>
        ))}
        {visibleOffices.length === 0 && (
          <p className="am-office-empty">No offices match &ldquo;{search.trim()}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
