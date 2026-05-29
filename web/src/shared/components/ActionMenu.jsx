import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function ActionMenu({ items = [], label = 'More actions', align = 'right' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const visibleItems = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  const handleItemClick = (item) => {
    if (item.disabled) return;
    setOpen(false);
    item.onClick?.();
  };

  return (
    <div className="ui-action-menu" ref={menuRef}>
      <button
        className="ui-action-menu-trigger"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        ⋮
      </button>

      {open && (
        <div className={`ui-action-menu-popover ui-action-menu-${align}`} role="menu">
          {visibleItems.map((item, index) => {
            const className = [
              'ui-action-menu-item',
              item.danger ? 'ui-action-menu-danger' : '',
              item.disabled ? 'ui-action-menu-disabled' : '',
            ].filter(Boolean).join(' ');

            if (item.render) {
              return (
                <div key={item.key || item.label || index} role="none" onClick={(event) => event.stopPropagation()}>
                  {item.render({ className, close: () => setOpen(false) })}
                </div>
              );
            }

            if (item.to) {
              return (
                <Link
                  className={className}
                  key={item.key || item.label || index}
                  role="menuitem"
                  to={item.to}
                  aria-disabled={item.disabled || undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.disabled) event.preventDefault();
                    else setOpen(false);
                  }}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                className={className}
                disabled={item.disabled}
                key={item.key || item.label || index}
                role="menuitem"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleItemClick(item);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
