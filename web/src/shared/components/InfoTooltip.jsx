import { useState } from 'react';
import './InfoTooltip.css';

export default function InfoTooltip({ text, label = 'More info' }) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  return (
    <span
      className="info-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="info-tooltip-bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
