import { api } from './api';

/** Server response for POST /checkout/orders (docs/API.md §7). The price is decided on the server. */
export type CheckoutSession = {
  orderNumber: string;
  amountPaise: number;
  currency: string;
  planName: string;
  razorpay: { keyId: string; orderId: string; prefill: { name: string; email: string; contact: string } };
};

export type OrderStatus = 'created' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
export type Order = {
  orderNumber: string;
  status: OrderStatus;
  planSlug: string;
  planName: string;
  amountPaise: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
};
export type OrderDetail = Order & { lastPayment: { status: string; method: string | null; errorDescription: string | null } | null };
type VerifyResult = Omit<Order, 'status'> & { status: OrderStatus | 'processing' };

type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayFailure = { error: { description?: string; reason?: string } };
type RazorpayInstance = { open: () => void; on: (event: 'payment.failed', cb: (r: RazorpayFailure) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoad: Promise<void> | null = null;

/** Razorpay's script, loaded on the first Buy click only (it isn't needed on any other page view). */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_JS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoad = null;
      s.remove();
      reject(new Error('The payment window could not load. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

export const getOrders = () => api.get<Order[]>('/me/orders').then((r) => r.data);
export const getOrder = (orderNumber: string) => api.get<OrderDetail>(`/me/orders/${encodeURIComponent(orderNumber)}`).then((r) => r.data);

export type CheckoutOutcome =
  | { kind: 'done'; orderNumber: string; status: VerifyResult['status'] }
  | { kind: 'dismissed' }
  | { kind: 'failed'; orderNumber: string; message: string };

/**
 * Buy flow: our server creates the order → Razorpay Checkout takes the payment → our server verifies
 * the signature and asks Razorpay before unlocking anything. The webhook covers a closed tab.
 */
export async function payForPlan(planSlug: string): Promise<CheckoutOutcome> {
  const [session] = await Promise.all([api.post<CheckoutSession>('/checkout/orders', { planSlug }).then((r) => r.data), loadRazorpay()]);
  if (!window.Razorpay) throw new Error('The payment window could not load. Please try again.');
  const Razorpay = window.Razorpay;

  return new Promise<CheckoutOutcome>((resolve, reject) => {
    let failure: string | null = null;
    const rzp = new Razorpay({
      key: session.razorpay.keyId,
      order_id: session.razorpay.orderId,
      amount: session.amountPaise,
      currency: session.currency,
      name: 'Alpha Recovery',
      description: session.planName,
      image: `${window.location.origin}/assets/brand/favicon-192x192.png`,
      prefill: session.razorpay.prefill,
      notes: { orderNumber: session.orderNumber },
      theme: { color: '#06251B' },
      handler: (r: RazorpayHandlerResponse) => {
        api
          .post<VerifyResult>('/checkout/verify', { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature })
          .then((res) => resolve({ kind: 'done', orderNumber: session.orderNumber, status: res.data.status }), reject);
      },
      modal: {
        // Closing after a failed attempt reports the failure; closing without paying is just a cancel.
        ondismiss: () => resolve(failure ? { kind: 'failed', orderNumber: session.orderNumber, message: failure } : { kind: 'dismissed' }),
        confirm_close: true,
      },
    });
    // Razorpay keeps the window open so the buyer can retry with another method; remember why it failed.
    rzp.on('payment.failed', (r) => {
      failure = r.error.description || 'The payment did not go through.';
    });
    rzp.open();
  });
}
