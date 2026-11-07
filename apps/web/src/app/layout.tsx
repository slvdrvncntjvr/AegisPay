import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AegisPay · Testnet proof console',
  description:
    'AegisPay public Testnet proof console: verified same-transaction Noir authorization sponsored by Velo on Stellar Testnet.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
