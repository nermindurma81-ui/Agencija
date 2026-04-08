import type {Metadata} from 'next';
import { IBM_Plex_Sans, Syne } from 'next/font/google';
import './globals.css'; // Global styles

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Agencija OS',
  description: 'Mobile-first AI orchestration studio powered by Agency Agents workflows and real provider routing.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
