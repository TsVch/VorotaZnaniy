import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KnowledgeVault SaaS',
  description:
    'Secure document delivery and interactive learning platform. Turn your PDFs into protected, AI-enhanced digital assets.',
  keywords: [
    'DRM',
    'digital rights management',
    'secure document viewer',
    'AI learning',
    'e-book protection',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
