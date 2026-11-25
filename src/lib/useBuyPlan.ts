import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from './api';
import { payForPlan } from './checkout';

/** Only same-site paths are allowed as a post-login destination (no open redirects). */
export const safeNext = (next: string | null) => (next && /^\/(?!\/)[\w\-/?=&#%.]*$/.test(next) ? next : null);

/**
 * Buy Now for any plan. Signed out → the login page, then back to pricing. Otherwise Razorpay Checkout,
 * then the checkout result page. `busy` is the plan being paid for; `error` is a message to show.
 */
export function useBuyPlan() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ plan: string; message: string; owned: boolean } | null>(null);

  async function buy(planSlug: string) {
    setError(null);
    setBusy(planSlug);
    try {
      const outcome = await payForPlan(planSlug);
      if (outcome.kind === 'done') navigate(`/checkout/success?order=${encodeURIComponent(outcome.orderNumber)}`);
      if (outcome.kind === 'failed') navigate(`/checkout/failed?order=${encodeURIComponent(outcome.orderNumber)}&reason=${encodeURIComponent(outcome.message)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate(`/account?mode=register&next=${encodeURIComponent('/pricing#pricing-plans')}`);
        return;
      }
      setError({ plan: planSlug, message: err instanceof Error ? err.message : 'Something went wrong. Please try again.', owned: err instanceof ApiError && err.status === 409 });
    } finally {
      setBusy(null);
    }
  }

  return { buy, busy, error };
}
