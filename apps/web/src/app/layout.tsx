import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: 'AegisPay — Useful data. Bounded spending.',
  description:
    'Bounded agent payments on Stellar Testnet: Noir authority, Velo sponsorship, fictional reports and independently verified payment evidence.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
