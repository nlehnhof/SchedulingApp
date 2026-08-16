import { Space_Grotesk } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

// Nightshift typography per .design/DESIGN.md section 3: Space Grotesk for display,
// Geist Sans for UI/body, Geist Mono for every time, date, duration, and stat value.
// Geist is loaded from the `geist` package rather than next/font/google — this project
// is on Next 14.2, whose bundled Google Fonts data predates Geist's arrival there.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'Gather',
  description: 'Your open hours, and nothing else. Rule-based appointment scheduling.',
};

export const viewport = {
  colorScheme: 'dark',
  themeColor: '#0D0F17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="bg-canvas text-text">{children}</body>
    </html>
  );
}
