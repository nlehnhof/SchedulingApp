'use client';

import { useState } from 'react';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { postJSON } from '@/lib/fetcher';

function lastNMonths(n: number): { value: string; label: string }[] {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

export default function ExportPage() {
  const months = lastNMonths(12);
  const [month, setMonth] = useState(months[0].value);
  const [status, setStatus] = useState<'idle' | 'queued' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleExport() {
    setStatus('idle');
    try {
      await postJSON('/api/client/export', { month });
      setStatus('queued');
      setMessage(`Sent to your account email for ${month}.`);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message ?? 'Export failed.');
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Export</h1>
      <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      <Button onClick={handleExport}>Export this month</Button>
      {status === 'queued' && <p className="text-sm text-success">Sent — {message}</p>}
      {status === 'error' && <p className="text-sm text-danger">{message}</p>}
    </div>
  );
}
