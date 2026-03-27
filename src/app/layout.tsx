import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Assetux Exchange — Buy Crypto with Card, Swap Tokens',
  description: 'Buy crypto with Visa or Mastercard. Swap tokens across Ethereum, Base, Polygon, Solana and more via Uniswap, Jupiter, Meteora. Best rates, non-custodial.',
  keywords: ['buy crypto with visa', 'buy crypto with credit card', 'buy crypto with fiat', 'swap uniswap', 'swap jupiter', 'swap meteora'],
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, background: '#08061a', minHeight: '100vh' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
