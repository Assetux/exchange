'use client';
import { useState, useEffect } from 'react';

const ASX_MINT = 'cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma';

export interface SolanaTokenStats {
  mint: string;
  treasuryBalance: string | null;
  priceUsd: string | null;
  volume24h: number | null;
  priceChange24h: number | null;
  liquidity: number | null;
  dex: string | null;
  pairAddress: string | null;
}

/** Fetch on-chain stats (price, volume, treasury balance) for any Solana mint. */
export function useSolanaTokenStats(mint: string): { stats: SolanaTokenStats | null; loading: boolean; error: string | null } {
  const [stats, setStats] = useState<SolanaTokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setLoading(true);
    setError(null);
    fetch(`/api/solana/${encodeURIComponent(mint)}/stats`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setStats(data); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message ?? 'Failed to load token stats'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mint]);

  return { stats, loading, error };
}

/** Fetch the balance of any Solana SPL token for a given wallet. */
export function useSolanaTokenBalance(
  mint: string | null,
  wallet: string | null,
): { balance: string | null; loading: boolean } {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mint || !wallet) { setBalance(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/solana/${encodeURIComponent(mint)}/balance?wallet=${encodeURIComponent(wallet)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setBalance(data.balance ?? null); setLoading(false); } })
      .catch(() => { if (!cancelled) { setBalance(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mint, wallet]);

  return { balance, loading };
}

// Convenience wrappers scoped to the ASX mint
export const useAsxStats = () => useSolanaTokenStats(ASX_MINT);
export const useAsxBalance = (wallet: string | null) => useSolanaTokenBalance(ASX_MINT, wallet);
