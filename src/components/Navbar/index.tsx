'use client';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Navbar() {
  return (
    <AppBar position="sticky" elevation={0} sx={{ background: 'rgba(8,6,26,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Image src="/logo.png" alt="Assetux" width={140} height={30} style={{ objectFit: 'contain' }} priority />
        </Link>

        <Box sx={{ flex: 1 }} />

        <Button component={Link} href="/" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
          Swap
        </Button>
        <Button component={Link} href="/listing" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
          List Token
        </Button>
        <Button component={Link} href="/widget" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
          Widget
        </Button>

        <ConnectButton chainStatus="none" showBalance={false} />
      </Toolbar>
    </AppBar>
  );
}
