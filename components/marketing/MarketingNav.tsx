'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMotionValueEvent, useScroll } from 'motion/react';

/**
 * Single-line nav, hairline border appears only once the page has scrolled.
 * Uses Motion's scroll tracking rather than a raw `window.addEventListener`
 * (DESIGN.md section 6 bans the latter).
 */
export default function MarketingNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 8);
  });

  return (
    <nav
      className={`sticky top-0 z-40 flex h-16 items-center justify-between bg-canvas px-6 transition-colors duration-200 sm:px-10 ${
        scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
      }`}
    >
      <span className="font-display text-display-sm text-text">Gather</span>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-lume px-4 py-2 text-body-sm font-medium text-lume-ink transition-colors hover:bg-lume-bright"
      >
        Client sign in
      </Link>
    </nav>
  );
}
