import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import './DataTable.css';

/** Coloured pill for a status value; `tone` maps to the theme's semantic colours. */
export function StatusBadge({ tone, children }: { tone: 'info' | 'warning' | 'success' | 'danger' | 'muted' | 'accent'; children: ReactNode }) {
  return <span className={`adm-badge adm-badge--${tone}`}>{children}</span>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="adm-pagination" aria-label="Pagination">
      <span>
        {first.toLocaleString('en-IN')}–{last.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}
      </span>
      <div>
        <button type="button" className="adm-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Previous
        </button>
        <button type="button" className="adm-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </nav>
  );
}

/**
 * Right-hand panel on a native modal <dialog>: focus is trapped, Escape closes, and focus returns
 * to the opener when it closes. Full screen on phones.
 */
export function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adm-drawer"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="adm-drawer-body">
          <button type="button" className="adm-btn adm-btn-icon adm-drawer-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
