'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import useSWR from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Spinner from '@/components/Spinner';
import { isAtLeast, type Tier } from '@/lib/tier';

interface BillingData {
  tier: Tier;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  stripe_trial_end: string | null;
}

const KEY = '/api/client/billing';

const TIER_PRICE: Record<Tier, string> = {
  free: '$0/mo',
  premium: '$19/mo',
  elite: '$49/mo',
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function BillingPage() {
  const { data, error, isLoading } = useSWR<BillingData>(KEY, fetcher);
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');

  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectDone, setDisconnectDone] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load billing status.</p>;

  async function handleDisconnectGoogle() {
    setDisconnectError(null);
    setDisconnecting(true);
    try {
      await postJSON('/api/client/account/disconnect-google', {});
      setDisconnectDone(true);
    } catch (err: any) {
      setDisconnectError(err.message ?? 'Could not disconnect Google.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch('/api/client/account', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed to delete account (${res.status})`);
      await signOut({ callbackUrl: '/' });
    } catch (err: any) {
      setDeleteError(err.message ?? 'Could not delete your account.');
      setDeleting(false);
    }
  }

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
  const isTrialing = data.stripe_subscription_status === 'trialing' && !!data.stripe_trial_end;
  const trialDaysLeft = isTrialing ? daysUntil(data.stripe_trial_end!) : null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
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
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-display-sm capitalize text-text">{data.tier}</span>
          <span className="font-mono text-data-sm text-text-2">{TIER_PRICE[data.tier]}</span>
        </div>

        {isTrialing && trialDaysLeft !== null && (
          <p className="mt-1 text-body-sm text-text">
            {trialDaysLeft === 0
              ? 'Your trial ends today.'
              : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your trial.`}{' '}
            You won&apos;t be charged until it ends.
          </p>
        )}
        {!isTrialing && data.stripe_current_period_end && (
          <p className="mt-1 text-body-sm text-text-2">
            Renews {new Date(data.stripe_current_period_end).toLocaleDateString()}.
          </p>
        )}
        {isPremiumOrAbove && (
          <p className="mt-1 text-body-sm text-text-2">
            Cancel any time from the billing portal below. No partial-month refunds.
          </p>
        )}

        {!isPremiumOrAbove && (
          <p className="mt-2 text-body-sm text-text-2">
            Upgrade to Premium (14-day free trial) to unlock custom branding, a custom booking
            link, analytics, and up to 3 team seats, or go straight to Elite for multiple booking
            calendars and unlimited team access too.
          </p>
        )}
        {isPremiumOrAbove && !isElite && (
          <p className="mt-2 text-body-sm text-text-2">
            Want Elite&apos;s multiple booking calendars and unlimited team access? Switching plans
            happens in the billing portal below, not a new checkout.
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
              {redirecting ? 'Opening…' : isElite ? 'Manage billing' : 'Change plan'}
            </Button>
          ) : (
            <>
              <Button
                disabled={redirecting}
                onClick={() => goTo('/api/client/billing/checkout', { tier: 'premium' })}
              >
                {redirecting ? 'Redirecting…' : 'Start Premium trial'}
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

      <div className="rounded-xl border border-rose/30 bg-rose/5 p-4">
        <div className="text-label uppercase text-rose">Danger zone</div>

        <div className="mt-3 flex flex-col gap-2 border-b border-rose/20 pb-4">
          <h2 className="text-body font-medium text-text">Disconnect Google</h2>
          <p className="text-body-sm text-text-2">
            Stops calendar sync on every calendar you own. Existing appointments and rules stay
            exactly as they are; you can reconnect any time by signing in with Google again.
          </p>
          {disconnectError && <p className="text-body-sm text-rose">{disconnectError}</p>}
          {disconnectDone ? (
            <p className="text-body-sm text-jade">Google disconnected.</p>
          ) : (
            <Button
              variant="secondary"
              disabled={disconnecting}
              onClick={handleDisconnectGoogle}
              className="self-start"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Google'}
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <h2 className="text-body font-medium text-text">Delete account</h2>
          <p className="text-body-sm text-text-2">
            Permanently deletes your account: every rule, reason, appointment, and error history
            across all your calendars. Cancels any active subscription and revokes Gather&apos;s
            access to your Google Calendar. Your booking link stops working immediately. This
            can&apos;t be undone.
          </p>
          {deleteError && <p className="text-body-sm text-rose">{deleteError}</p>}
          {confirmingDelete ? (
            <div className="flex flex-col gap-2">
              <Input
                label={`Type ${data.email} to confirm`}
                value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                placeholder={data.email}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={deleting || deleteEmailInput.trim() !== data.email}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? 'Deleting…' : 'Permanently delete my account'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteEmailInput('');
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
              className="self-start"
            >
              Delete account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
