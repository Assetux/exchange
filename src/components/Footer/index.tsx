'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import XIcon from '@mui/icons-material/X';
import TelegramIcon from '@mui/icons-material/Telegram';

const LINKS = [
  { href: 'https://github.com/assetux/exchange', label: 'GitHub',   icon: <GitHubIcon sx={{ fontSize: 17 }} /> },
  { href: 'https://assetux.com',                 label: 'Website',  icon: <LanguageIcon sx={{ fontSize: 17 }} /> },
  { href: 'https://x.com/assetux',               label: 'X',        icon: <XIcon sx={{ fontSize: 17 }} /> },
  { href: 'https://t.me/assetux_en',             label: 'Telegram', icon: <TelegramIcon sx={{ fontSize: 17 }} /> },
];

export function Footer() {
  return (
    <Box component="footer" sx={{
      mt: 'auto', py: 3, px: 2,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
      alignItems: 'center', justifyContent: 'space-between', gap: 2,
    }}>
      <Typography variant="caption" color="text.secondary">
        © {new Date().getFullYear()} Assetux Exchange
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
        {LINKS.map(({ href, label, icon }) => (
          <Link
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            underline="none"
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
              transition: 'color 0.15s',
              fontSize: 13,
            }}
          >
            {icon}
            {label}
          </Link>
        ))}
      </Box>
    </Box>
  );
}
