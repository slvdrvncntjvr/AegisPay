import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'AegisPay — Useful data. Bounded spending.',
  description:
    'Explore recorded AegisPay proof: bounded Noir authority, the same authorization through Velo, and independently matched evidence on Stellar Testnet.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
