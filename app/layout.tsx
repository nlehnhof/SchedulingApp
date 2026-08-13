import { Inter, Fraunces } from 'next/font/google';
import './globals.css';

// Brand typography per theme_brand.md: warm serif (Fraunces) for headings/wordmark,
// clean sans (Inter) for UI/body text. Exposed as CSS variables so Tailwind's
// fontFamily.sans/serif (tailwind.config.js) can reference them.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata = {
  title: 'Gather',
  description: 'Time, set aside for you. Rule-based appointment scheduling.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-background text-text-primary">{children}</body>
    </html>
  );
}
