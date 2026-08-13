'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Button from './Button';
import Input from './Input';

// Only rendered when ALLOW_ADMIN_LOGIN=true (see app/dashboard/layout.tsx). This is a
// testing-only bypass for clicking through the dashboard before real Google OAuth
// credentials exist — never expose this in a real client-facing deployment.
export default function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn('admin', {
      username,
      password,
      redirect: false,
      callbackUrl: '/dashboard',
    });
    setLoading(false);
    if (result?.error) {
      setError('Incorrect username or password.');
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in as admin (testing)'}
      </Button>
    </form>
  );
}
