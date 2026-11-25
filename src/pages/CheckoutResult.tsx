import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { company } from '../data/content';
import { useAuth } from '../lib/auth';
import { getOrder, type OrderDetail } from '../lib/checkout';
import './SimplePages.css';

/** How long to keep checking while Razorpay confirms a payment (the webhook usually lands within seconds). */
const POLL_MS = 3000;
const POLL_TRIES = 20;

const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);

/**
 * /checkout/success?order=… and /checkout/failed?order=…&reason=… after Razorpay Checkout.
 * Success reads the order back from the API (the server, not the browser, decides it's paid).
 */
export function CheckoutResult({ outcome }: { outcome: 'success' | 'failed' }) {
  const auth = useAuth();
  const [params] = useSearchParams();
  const orderNumber = params.get('order') ?? '';
  const reason = params.get('reason');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const userId = auth.user?.id;

  useEffect(() => {
    if (!userId || !orderNumber) return;
    let live = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getOrder(orderNumber)
        .then((o) => {
          if (!live) return;
          setOrder(o);
          // Still waiting for Razorpay to confirm: check again shortly
          if (outcome === 'success' && o.status === 'created') {
            tries += 1;
            if (tries < POLL_TRIES) timer = setTimeout(load, POLL_MS);
            else setGaveUp(true);
          }
        })
        .catch(() => {
          if (live) setLoadError(true);
        });
    };
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [userId, orderNumber, outcome]);

  if (auth.loaded && !auth.user) return <Navigate to="/account" replace />;

  const paid = order?.status === 'paid';
  const title = paid ? 'Payment successful' : outcome === 'failed' ? 'Payment not completed' : 'Confirming your payment';
  const help = (
    <p className="checkout-help">
      Need help? WhatsApp us at <a href={company.whatsapp}>{company.phoneDisplay}</a> or email{' '}
      <a href={`mailto:${company.email}`}>{company.email}</a>
      {orderNumber ? ` with your order number ${orderNumber}` : ''}.
    </p>
  );

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/pricing">Pricing</Link>
            <span>/</span>
            <span>Checkout</span>
          </div>
          <h1>{title}</h1>
        </div>
      </div>
      <section className="section">
        <div className="container narrow">
          <div className="panel checkout-panel" aria-live="polite">
            {!orderNumber ? <p className="form-error">No order to show.</p> : null}
            {loadError ? <p className="form-error">We couldn&apos;t load this order. Refresh the page to try again.</p> : null}

            {paid && order ? (
              <>
                <p className="form-success">✓ Thank you! Your {order.planName} is active.</p>
                <dl className="checkout-summary">
                  <dt>Order</dt>
                  <dd>{order.orderNumber}</dd>
                  <dt>Amount paid</dt>
                  <dd>{inr(order.amountPaise)}</dd>
                  {order.lastPayment?.method ? (
                    <>
                      <dt>Paid with</dt>
                      <dd>{order.lastPayment.method.toUpperCase()}</dd>
                    </>
                  ) : null}
                </dl>
                <p>We&apos;ve emailed your receipt. Your courses are unlocked now.</p>
                <div className="checkout-actions">
                  <Link className="btn btn-primary" to="/dashboard">
                    Start learning
                  </Link>
                  <Link className="btn btn-ghost" to="/account/settings#purchases">
                    View purchases
                  </Link>
                </div>
              </>
            ) : null}

            {!paid && outcome === 'success' && orderNumber && !loadError ? (
              gaveUp ? (
                <>
                  <p>Your payment is still being confirmed by the bank. This can take a few minutes.</p>
                  <p>You don&apos;t need to pay again: we&apos;ll email you as soon as it&apos;s confirmed, and your courses will unlock automatically.</p>
                  {help}
                </>
              ) : (
                <p>Please wait while we confirm your payment with Razorpay. Don&apos;t close this page…</p>
              )
            ) : null}

            {!paid && outcome === 'failed' ? (
              <>
                <p className="form-error">{reason || 'The payment did not go through.'}</p>
                <p>No money was taken for this attempt. If your account was debited, the bank reverses it automatically within 5–7 working days.</p>
                <div className="checkout-actions">
                  <Link className="btn btn-primary" to="/pricing#pricing-plans">
                    Try again
                  </Link>
                </div>
                {help}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
