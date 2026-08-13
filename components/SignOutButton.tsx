'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="text-sm text-text-secondary hover:text-text-primary"
    >
      Sign out
    </button>
  );
}
