import type { Metadata } from 'next';
import { ListingPage } from '@/components/ListingPage';

export const metadata: Metadata = {
  title: 'List Your Token | Assetux Exchange',
  description: 'List your token on Assetux Exchange by paying 1,000,000 ASX. Supports all major networks.',
};

export default function Page() {
  return <ListingPage />;
}
