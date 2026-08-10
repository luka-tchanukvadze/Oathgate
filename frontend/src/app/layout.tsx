import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Oathgate, crypto payments for merchants',
    template: '%s | Oathgate',
  },
  description:
    'A crypto payment gateway with a double entry ledger, idempotent APIs, signed webhooks and reorg-safe settlement.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
