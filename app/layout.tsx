import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agency Agents Web',
  description: 'A web interface for the agency-agents repository, providing free-tier AI agent workflows.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={inter.className}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
