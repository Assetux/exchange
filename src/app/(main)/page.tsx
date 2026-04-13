import { Suspense } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SwapWidgetWithParams } from '@/components/SwapWidget/SwapWidgetWithParams';
import { SEOLanding } from '@/components/SEOLanding';

export default function Home() {
  return (
    <>
      <Box sx={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, py: 6 }}>
        <Typography variant="h3" fontWeight={900} textAlign="center" mb={1}
          sx={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Swap Anything
        </Typography>
        <Typography variant="h6" color="text.secondary" textAlign="center" mb={5}>
          Best rates across Uniswap, Jupiter, Meteora &amp; more. Buy with card in seconds.
        </Typography>
        <Suspense fallback={null}>
          <SwapWidgetWithParams />
        </Suspense>
      </Box>
      <SEOLanding />
    </>
  );
}
