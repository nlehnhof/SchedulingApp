'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import { isAtLeast, type Tier } from '@/lib/tier';

interface BillingData {
  tier: Tier;
  stripe_customer_id: string | null;
  stripe_subscription_status: string | null;
}

const KEY = '/api/client/billing';

export default function BillingPage() {
  const { data, error, isLoading } = useSWR<BillingData>(KEY, fetcher);
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');

  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load billing status.</p>;

  async function goTo(path: string, body: Record<string, unknown> = {}) {
    setActionError(null);
    setRedirecting(true);
    try {
      const { url } = await postJSON<{ url: string }>(path, body);
      window.location.href = url;
    } catch (err: any) {
      setActionError(err.message ?? 'Something went wrong.');
      setRedirecting(false);
    }
  }

  const isPremiumOrAbove = isAtLeast(data.tier, 'premium');
  const isElite = data.tier === 'elite';

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-display-md text-text">Billing</h1>

      {checkoutParam === 'success' && (
        <p className="rounded-xl border border-lume/40 bg-lume/25 p-3 text-body-sm text-text">
          Payment received. This can take a few seconds to finish processing. Refresh if your
          plan below still says Free.
        </p>
      )}
      {checkoutParam === 'cancelled' && (
        <p className="rounded-xl border border-hairline bg-surface p-3 text-body-sm text-text-2">
          Checkout was cancelled. No charge was made.
        </p>
      )}

      <div className="rounded-xl border border-hairline bg-surface p-4">
        <div className="text-label uppercase text-text-2">Current plan</div>
        <div className="mt-1 font-display text-display-sm capitalize text-text">{data.tier}</div>
        {data.stripe_subscription_status && (
          <div className="mt-1 text-body-sm capitalize text-text-2">
            Subscription status: {data.stripe_subscription_status}
          </div>
        )}

        {!isPremiumOrAbove && (
          <p className="mt-2 text-body-sm text-text-2">
            Upgrade to Premium to unlock custom branding, a custom booking link, analytics, and
            text reminders, or go straight to Elite for multiple booking calendars and shared
            dashboard access too.
          </p>
        )}
        {isPremiumOrAbove && !isElite && (
          <p className="mt-2 text-body-sm text-text-2">
            Upgrade to Elite to unlock multiple booking calendars and shared dashboard access for
            your team.
          </p>
        )}

        {actionError && <p className="mt-2 text-body-sm text-rose">{actionError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {isPremiumOrAbove ? (
            // Already on a paid tier — checkout/route.ts sends any further
            // upgrade (premium -> elite) through this same portal session
            // rather than a fresh Checkout, so one button covers both
            // "manage" and "upgrade" once a subscription already exists.
            <Button
              variant="secondary"
              disabled={redirecting}
              onClick={() => goTo('/api/client/billing/portal')}
            >
              {redirecting ? 'Opening…' : isElite ? 'Manage billing' : 'Manage billing / upgrade to Elite'}
            </Button>
          ) : (
            <>
              <Button
                disabled={redirecting}
                onClick={() => goTo('/api/client/billing/checkout', { tier: 'premium' })}
              >
                {redirecting ? 'Redirecting…' : 'Upgrade to Premium'}
              </Button>
              <Button
                variant="secondary"
                disabled={redirecting}
                onClick={() => goTo('/api/client/billing/checkout', { tier: 'elite' })}
              >
                {redirecting ? 'Redirecting…' : 'Upgrade to Elite'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
