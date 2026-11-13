import { useEffect, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './Dialog.css';

/**
 * Centred modal on a native <dialog> (focus trap, Escape to cancel). The body is a form, so Enter
 * submits; `tone="danger"` styles the confirm button for destructive actions.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <dialog ref={ref} className="adm-dialog" aria-label={title} onClose={onCancel}>
      {open ? (
        <form onSubmit={submit}>
          <h2>{title}</h2>
          <div className="adm-dialog-body">{children}</div>
          {error ? (
            <p className="adm-dialog-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="adm-dialog-actions">
            <button type="button" className="adm-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={`adm-btn ${tone === 'danger' ? 'adm-btn-danger' : 'adm-btn-primary'}`} disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
