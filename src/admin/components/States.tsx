import type { ReactNode } from 'react';
import './States.css';

export function ErrorState({ message, requestId, onRetry }: { message: string; requestId?: string; onRetry?: () => void }) {
  return (
    <div className="adm-state adm-state--error" role="alert">
      <p>{message}</p>
      {requestId ? <code>Reference: {requestId}</code> : null}
      {onRetry ? (
        <button type="button" className="adm-btn" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="adm-state">{children}</div>;
}

export function Skeleton({ height = 96 }: { height?: number }) {
  return <div className="adm-skeleton" style={{ height }} aria-hidden />;
}
