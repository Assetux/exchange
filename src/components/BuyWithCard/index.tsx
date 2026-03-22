'use client';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { useConnection } from 'wagmi';
import { createWertSession } from '@/lib/wert';

interface BuyWithCardProps {
  toToken?: string;
  toChain?: number;
}

export function BuyWithCard({ toToken, toChain }: BuyWithCardProps) {
  const { address, isConnected } = useConnection();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleBuy = async () => {
    if (!amount || parseFloat(amount) < 10) {
      setError('Minimum amount is $10');
      return;
    }
    if (!isConnected || !address) {
      setError('Connect your EVM wallet first — tokens will be sent there after swap.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { payment_url } = await createWertSession({
        usdAmount: parseFloat(amount),
        toToken: toToken || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        toChain: toChain || 8453,
        toWallet: address,
      });
      const popup = window.open(payment_url, 'WertPayment', 'width=500,height=700,left=400,top=100');
      if (!popup) window.location.href = payment_url;
      setSuccess('Payment window opened. Tokens will arrive in your wallet automatically after payment.');
    } catch (e: any) {
      setError(e.message || 'Failed to open payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, background: '#0f0c26', border: '1px solid rgba(255,255,255,0.07)', maxWidth: 480, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Buy with Card</Typography>
        <Chip label="Visa / Mastercard" size="small" color="primary" />
      </Box>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Pay USD with your card. We receive USDC on BASE, swap to your token, and send it to your wallet.
        Rate: market price minus 5% service fee.
      </Typography>

      {isConnected && address && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
          Tokens → {address.slice(0, 6)}…{address.slice(-4)}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="USD Amount" type="number" fullWidth
          value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="100"
          InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography> }}
          inputProps={{ min: 10, max: 10000 }}
        />

        {amount && parseFloat(amount) >= 10 && (
          <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.15)' }}>
            <Typography variant="caption" color="text.secondary">You receive approximately</Typography>
            <Typography variant="body1" fontWeight={600} color="primary.main">
              ~${(parseFloat(amount) * 0.95).toFixed(2)} worth of tokens
            </Typography>
            <Typography variant="caption" color="text.secondary">After 5% service fee</Typography>
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Button variant="contained" size="large" fullWidth onClick={handleBuy}
          disabled={loading || !amount || !isConnected}
          sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Pay with Card →'}
        </Button>

        {!isConnected && (
          <Typography variant="caption" color="warning.main" textAlign="center">
            Connect your wallet above to enable card purchases
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" textAlign="center">
          Min $10 · Max $10,000 · Powered by Wert
        </Typography>
      </Box>
    </Paper>
  );
}
