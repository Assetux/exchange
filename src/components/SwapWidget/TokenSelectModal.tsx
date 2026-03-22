'use client';
import { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Token } from '@/lib/lifi';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  tokens: Token[];
  loading?: boolean;
  title?: string;
}

export function TokenSelectModal({ open, onClose, onSelect, tokens, loading, title = 'Select token' }: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) setSearch(''); }, [open]);

  const filtered = useMemo(() => {
    if (!search) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          background: '#0f0c26',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      {/* component="div" prevents MUI from rendering DialogTitle as <h2>, avoiding invalid nesting with Typography inside */}
      <DialogTitle component="div" sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={700} flex={1} textAlign="center">
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Search */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          background: 'rgba(255,255,255,0.06)', borderRadius: 2,
          px: 1.5, py: 0.75, border: '1px solid rgba(255,255,255,0.08)',
          '&:focus-within': { borderColor: 'primary.main' },
        }}>
          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Search by token or address"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ fontSize: 14, color: 'text.primary', '& input::placeholder': { color: 'text.secondary' } }}
          />
        </Box>
      </Box>

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" pt={4} fontSize={14}>
            No tokens found
          </Typography>
        ) : (
          filtered.map(token => (
            <Box
              key={token.address}
              onClick={() => { onSelect(token); onClose(); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer',
                '&:hover': { background: 'rgba(255,255,255,0.05)' },
                transition: 'background 0.15s',
              }}
            >
              <Avatar
                src={token.logoURI}
                sx={{ width: 38, height: 38, background: 'rgba(72,158,255,0.15)', fontSize: 14 }}
              >
                {token.symbol[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{token.symbol}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">{token.name}</Typography>
              </Box>
              {token.priceUSD && (
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">
                    ${parseFloat(token.priceUSD).toFixed(4)}
                  </Typography>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </Dialog>
  );
}
