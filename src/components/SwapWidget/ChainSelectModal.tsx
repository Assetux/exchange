'use client';
import { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Chain } from '@/lib/lifi';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (chain: Chain) => void;
  chains: Chain[];
  title?: string;
  showUSD?: boolean; // show "USD (Card)" option
}

export function ChainSelectModal({ open, onClose, onSelect, chains, title = 'Select network', showUSD }: Props) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (open) setSearch(''); }, [open]);

  const filtered = useMemo(() => {
    if (!search) return chains;
    return chains.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [chains, search]);

  const USD_CHAIN = { id: -1, name: 'USD (Card)', logoURI: '', nativeToken: {} } as Chain;

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
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle component="div" sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={700} flex={1} textAlign="center">{title}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 2, pb: 1 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          background: 'rgba(255,255,255,0.06)', borderRadius: 2,
          px: 1.5, py: 0.75, border: '1px solid rgba(255,255,255,0.08)',
          '&:focus-within': { borderColor: 'primary.main' },
        }}>
          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <InputBase autoFocus fullWidth placeholder="Search network" value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ fontSize: 14, '& input::placeholder': { color: 'text.secondary' } }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1 }}>
        {/* USD option at top if allowed */}
        {showUSD && !search && (
          <Box
            onClick={() => { onSelect(USD_CHAIN); onClose(); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer', mb: 0.5,
              background: 'rgba(72,158,255,0.07)', border: '1px solid rgba(72,158,255,0.15)',
              '&:hover': { background: 'rgba(72,158,255,0.12)' },
            }}
          >
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(255,255,255,0.05)' }}>
              🇺🇸
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>USD</Typography>
              <Typography variant="caption" color="primary.main">Pay with Visa / Mastercard</Typography>
            </Box>
          </Box>
        )}

        {filtered.map(chain => (
          <Box
            key={chain.id}
            onClick={() => { onSelect(chain); onClose(); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer',
              '&:hover': { background: 'rgba(255,255,255,0.05)' },
              transition: 'background 0.15s',
            }}
          >
            <Avatar src={chain.logoURI} sx={{ width: 38, height: 38, background: 'rgba(145,102,255,0.15)', fontSize: 14 }}>
              {chain.name[0]}
            </Avatar>
            <Typography variant="body2" fontWeight={600}>{chain.name}</Typography>
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}
