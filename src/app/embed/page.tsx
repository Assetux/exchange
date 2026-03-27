'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import { SwapWidget } from '@/components/SwapWidget';

function EmbedWidget() {
  const params = useSearchParams();
  const chainParam = params.get('chains');
  const tokenParam = params.get('tokens');

  const allowedChainIds = chainParam
    ? chainParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
    : undefined;
  const allowedSymbols = tokenParam
    ? tokenParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : undefined;

  return <SwapWidget allowedChainIds={allowedChainIds} allowedSymbols={allowedSymbols} />;
}

export default function EmbedPage() {
  return (
    <Box sx={{
      minHeight: '100vh', background: '#08061a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
    }}>
      <Suspense fallback={null}>
        <EmbedWidget />
      </Suspense>
    </Box>
  );
}
