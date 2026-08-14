'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface BrandingData {
  id: string;
  display_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
  slug: string | null;
  tier: 'free' | 'premium';
  sms_reminders_enabled: boolean;
}

const KEY = '/api/client/branding';
const SLUG_RE = /^[a-z0-9-]{3,30}$/;

export default function BrandingPage() {
  const { data, error, isLoading } = useSWR<BrandingData>(KEY, fetcher);

  const [displayName, setDisplayName] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [smsRemindersEnabled, setSmsRemindersEnabled] = useState(false);
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
    setSmsRemindersEnabled(data.sms_reminders_enabled);
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
          `/api/client/slug-available?slug=${encodeURIComponent(slug)}`
        );
        setSlugStatus(res.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [slug, data?.slug]);

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Failed to load branding settings.</p>;

  if (data.tier !== 'premium') {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="font-serif text-xl font-semibold text-text-primary">Branding</h1>
        <div className="rounded-lg border border-accent-soft bg-accent-soft/15 p-6">
          <p className="text-sm font-medium text-text-primary">This is a premium feature.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Upgrade to Premium to customize your booking page with your own business name, accent
            color, logo, and a short, memorable link (e.g. /visit/your-name instead of a long id) —
            plus SMS appointment reminders to cut down on no-shows.
          </p>
        </div>
      </div>
    );
  }

  const slugInvalid = slugStatus === 'invalid';
  const slugTaken = slugStatus === 'taken';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await postJSON(KEY, {
        displayName: displayName.trim() || undefined,
        accentColor: accentColor.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        slug: slug.trim() || undefined,
        smsRemindersEnabled,
      });
      setSaved(true);
      mutate(KEY);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Branding</h1>
      <p className="text-sm text-text-secondary">
        These show up on your public booking page instead of the default look.
      </p>

      <Input
        label="Business / display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="e.g. Dr. Smith Family Dentistry"
      />
      <Input
        label="Accent color (hex)"
        value={accentColor}
        onChange={(e) => setAccentColor(e.target.value)}
        placeholder="#C4693A"
      />
      <Input
        label="Logo URL (https only)"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="https://…"
      />

      <div className="flex flex-col gap-1">
        <Input
          label="Custom booking link"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="dr-smith"
          error={
            slugInvalid
              ? '3–30 lowercase letters, numbers, hyphens'
              : slugTaken
                ? 'Already taken'
                : undefined
          }
        />
        {slug && (
          <p className="text-xs text-text-secondary">
            {typeof window !== 'undefined' ? window.location.origin : ''}/visit/{slug}
            {slugStatus === 'checking' && ' — checking availability…'}
            {slugStatus === 'available' && ' — available'}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          checked={smsRemindersEnabled}
          onChange={(e) => setSmsRemindersEnabled(e.target.checked)}
        />
        <span>
          SMS appointment reminders
          <span className="block text-xs text-text-secondary">
            Not yet live in this deployment — this saves your preference now so reminders start as
            soon as SMS sending is wired up, with no further action from you.
          </span>
        </span>
      </label>

      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      {saved && <p className="text-sm text-success">Branding saved.</p>}
      <Button type="submit" disabled={saving || slugInvalid || slugTaken}>
        {saving ? 'Saving…' : 'Save branding'}
      </Button>
    </form>
  );
}
