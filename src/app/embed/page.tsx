'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import { SwapWidget, DEFAULT_WIDGET_THEME } from '@/components/SwapWidget';

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

  const theme = {
    pageBg:      params.get('c_page')   ? `#${params.get('c_page')}`   : DEFAULT_WIDGET_THEME.pageBg,
    cardBg:      params.get('c_card')   ? `#${params.get('c_card')}`   : DEFAULT_WIDGET_THEME.cardBg,
    inputBg:     params.get('c_input')  ? `#${params.get('c_input')}`  : DEFAULT_WIDGET_THEME.inputBg,
    fontColor:   params.get('c_font')   ? `#${params.get('c_font')}`   : DEFAULT_WIDGET_THEME.fontColor,
    borderColor: params.get('c_border') ? `#${params.get('c_border')}` : DEFAULT_WIDGET_THEME.borderColor,
  };

  return (
    <Box sx={{ minHeight: '100vh', background: theme.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <SwapWidget allowedChainIds={allowedChainIds} allowedSymbols={allowedSymbols} theme={theme} />
    </Box>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={null}>
      <EmbedWidget />
    </Suspense>
  );
}
