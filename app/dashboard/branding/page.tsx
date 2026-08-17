'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import PremiumLockCard from '@/components/PremiumLockCard';
import Spinner from '@/components/Spinner';
import { isAtLeast, type Tier } from '@/lib/tier';
import { useCalendar } from '@/components/CalendarContext';
import { contrastRatio, pickInkColor } from '@/lib/brand-color';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface BrandingData {
  id: string;
  display_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
  slug: string | null;
  tier: Tier;
}

const SLUG_RE = /^[a-z0-9-]{3,30}$/;

export default function BrandingPage() {
  const { calendarId, role } = useCalendar();
  const canWrite = role !== 'viewer';
  const KEY = calendarId ? `/api/client/branding?calendarId=${calendarId}` : null;
  const { data, error, isLoading } = useSWR<BrandingData>(KEY, fetcher);

  const [displayName, setDisplayName] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(
    'idle'
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.display_name ?? '');
    setAccentColor(data.accent_color ?? '');
    setLogoUrl(data.logo_url ?? '');
    setSlug(data.slug ?? '');
  }, [data]);

  // Debounced slug availability check (PLAN.md Section 4 feature 2).
  useEffect(() => {
    if (!slug || slug === data?.slug) {
      setSlugStatus('idle');
      return;
    }
    if (!SLUG_RE.test(slug)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const res = await fetcher<{ available: boolean }>(
          `/api/client/slug-available?slug=${encodeURIComponent(slug)}&calendarId=${calendarId}`
        );
        setSlugStatus(res.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [slug, data?.slug, calendarId]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load branding settings.</p>;

  if (!isAtLeast(data.tier, 'premium')) {
    return (
      <PremiumLockCard
        title="Branding"
        description="Upgrade to Premium to customize your booking page with your own business name, accent color, logo, and a short, memorable link (e.g. /visit/your-name instead of a long id)."
      />
    );
  }

  const slugInvalid = slugStatus === 'invalid';
  const slugTaken = slugStatus === 'taken';

  const trimmedAccent = accentColor.trim();
  const accentValid = HEX_RE.test(trimmedAccent);
  const accentContrast = accentValid ? contrastRatio(trimmedAccent, '#0D0F17') : null;
  const accentContrastLow = accentContrast !== null && accentContrast < 4.5;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!KEY) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      // The branding route only accepts PATCH (it's a partial update of an
      // existing calendar row, not a create) — postJSON is hardcoded to POST
      // for the app's create-style routes, so this calls fetch directly,
      // matching the pattern reasons/page.tsx already uses for its own
      // PATCH-by-id route.
      const res = await fetch(KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          accentColor: accentColor.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          slug: slug.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ? JSON.stringify(json.error) : `Failed to save branding (${res.status})`);
      }
      setSaved(true);
      mutate(KEY);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-display-md text-text">Branding</h1>
      <p className="text-body-sm text-text-2">
        These show up on your public booking page instead of the default look.
      </p>

      <Input
        label="Business / display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="e.g. Dr. Smith Family Dentistry"
        disabled={!canWrite}
      />
      <div className="flex flex-col gap-2">
        <Input
          label="Accent color (hex)"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
          placeholder="#C4693A"
          disabled={!canWrite}
        />
        {accentValid && (
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-body-sm font-medium"
              style={{ backgroundColor: trimmedAccent, color: pickInkColor(trimmedAccent) }}
            >
              Aa
            </span>
            <div className="flex flex-col">
              <span className="text-body-sm text-text-2">Preview on your booking page&apos;s canvas</span>
              {accentContrastLow && (
                <span className="text-body-sm text-rose">
                  Contrast is {accentContrast!.toFixed(1)}:1 against the canvas; Gather will
                  lighten it automatically on your booking page to stay readable.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <Input
        label="Logo URL (https only)"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="https://…"
        disabled={!canWrite}
      />

      <div className="flex flex-col gap-1">
        <Input
          label="Custom booking link"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="dr-smith"
          disabled={!canWrite}
          error={
            slugInvalid
              ? '3 to 30 lowercase letters, numbers, hyphens'
              : slugTaken
                ? 'Already taken'
                : undefined
          }
        />
        {slug && (
          <p className="font-mono text-data-sm text-text-2">
            {typeof window !== 'undefined' ? window.location.origin : ''}/visit/{slug}
            {slugStatus === 'checking' && ' (checking availability…)'}
            {slugStatus === 'available' && ' (available)'}
          </p>
        )}
      </div>

      <p className="text-body-sm text-text-2">
        Looking for confirmation emails or text reminders?{' '}
        <Link href="/dashboard/reminders" className="text-lume-bright hover:underline">
          They moved to Reminders &amp; Confirmations
        </Link>
        .
      </p>

      {saveError && <p className="text-body-sm text-rose">{saveError}</p>}
      {saved && <p className="text-body-sm text-jade">Branding saved.</p>}
      {canWrite && (
        <Button type="submit" disabled={saving || slugInvalid || slugTaken}>
          {saving ? 'Saving…' : 'Save branding'}
        </Button>
      )}
    </form>
  );
}
