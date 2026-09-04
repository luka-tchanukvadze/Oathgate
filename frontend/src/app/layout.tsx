import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

// viewportFit cover is what makes env(safe-area-inset-bottom) report a real
// number. Without it it is always 0, and the phone tab bar sits underneath the
// home indicator on an iPhone
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

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
