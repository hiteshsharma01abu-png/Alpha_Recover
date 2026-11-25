import type { OrderStatus, Reconciliation } from '../../lib/adminApi';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  paid: 'Paid',
  refunded: 'Refunded',
  partially_refunded: 'Part refunded',
  created: 'Unpaid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export const ORDER_STATUS_TONE: Record<OrderStatus, 'success' | 'muted' | 'danger' | 'warning' | 'info'> = {
  paid: 'success',
  refunded: 'muted',
  partially_refunded: 'muted',
  created: 'warning',
  failed: 'danger',
  cancelled: 'muted',
};

/** The list's default view (no status filter) shows purchases: orders money moved for. */
export const ORDER_TABS: (OrderStatus | 'purchases' | 'all')[] = ['purchases', 'paid', 'refunded', 'created', 'failed', 'all'];
export const TAB_LABEL: Record<(typeof ORDER_TABS)[number], string> = { purchases: 'Purchases', paid: 'Paid', refunded: 'Refunded', created: 'Unpaid', failed: 'Failed', all: 'All attempts', partially_refunded: 'Part refunded', cancelled: 'Cancelled' };

export const RECONCILE_MESSAGE: Record<Reconciliation, string> = {
  activated: 'Razorpay confirms the payment: the order is now paid and the course access is active.',
  already_paid: 'Already paid: nothing to change.',
  failed: 'Razorpay shows only failed attempts for this order. Nothing was charged.',
  authorized: 'The payment is authorised but not captured yet. It will complete automatically, or capture it in the Razorpay dashboard.',
  nothing_yet: 'Razorpay has no payment for this order yet.',
};

export const methodLabel = (m: string | null) => (m ? (m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)) : '—');
