'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';

interface BillingData {
  tier: 'free' | 'premium';
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

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Failed to load billing status.</p>;

  async function goTo(path: string) {
    setActionError(null);
    setRedirecting(true);
    try {
      const { url } = await postJSON<{ url: string }>(path, {});
      window.location.href = url;
    } catch (err: any) {
      setActionError(err.message ?? 'Something went wrong.');
      setRedirecting(false);
    }
  }

  const isPremium = data.tier === 'premium';

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Billing</h1>

      {checkoutParam === 'success' && (
        <p className="rounded-md border border-accent/40 bg-accent-soft/25 p-3 text-sm text-text-primary">
          Payment received — this can take a few seconds to finish processing. Refresh if your
          plan below still says Free.
        </p>
      )}
      {checkoutParam === 'cancelled' && (
        <p className="rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">
          Checkout was cancelled — no charge was made.
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs uppercase tracking-wide text-text-secondary">Current plan</div>
        <div className="mt-1 text-lg font-semibold capitalize text-text-primary">{data.tier}</div>
        {data.stripe_subscription_status && (
          <div className="mt-1 text-xs text-text-secondary capitalize">
            Subscription status: {data.stripe_subscription_status}
          </div>
        )}

        {!isPremium && (
          <p className="mt-2 text-sm text-text-secondary">
            Upgrade to unlock custom branding, a custom booking link, analytics, and text
            reminders.
          </p>
        )}

        {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}

        <div className="mt-4">
          {isPremium ? (
            <Button
              variant="secondary"
              disabled={redirecting}
              onClick={() => goTo('/api/client/billing/portal')}
            >
              {redirecting ? 'Opening…' : 'Manage billing'}
            </Button>
          ) : (
            <Button disabled={redirecting} onClick={() => goTo('/api/client/billing/checkout')}>
              {redirecting ? 'Redirecting…' : 'Upgrade to Premium'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
