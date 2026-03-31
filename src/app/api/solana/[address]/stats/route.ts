import { NextRequest, NextResponse } from 'next/server';

const TREASURY = '6bvB3PTz48wozyPJeuTB77axexWu9MfUSjBYbQzEgK88';
const SOL_RPC = process.env.SOLANA_RPC_URL ?? 'https://sol.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4';

async function getTreasuryBalance(mint: string): Promise<string> {
  const res = await fetch(SOL_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [TREASURY, { mint }, { encoding: 'jsonParsed' }],
    }),
    cache: 'no-store',
  });
  const data = await res.json();
  const accounts: any[] = data.result?.value ?? [];
  if (accounts.length === 0) return '0';
  return accounts[0].account.data.parsed.info.tokenAmount.uiAmountString ?? '0';
}

async function getDexScreenerStats(mint: string) {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const pairs: any[] = (data.pairs ?? []).filter((p: any) => p.chainId === 'solana');
  if (pairs.length === 0) return null;
  pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
  const top = pairs[0];
  return {
    priceUsd: top.priceUsd ?? null,
    volume24h: top.volume?.h24 ?? null,
    priceChange24h: top.priceChange?.h24 ?? null,
    liquidity: top.liquidity?.usd ?? null,
    dex: top.dexId ?? null,
    pairAddress: top.pairAddress ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  const [treasuryResult, dexResult] = await Promise.allSettled([
    getTreasuryBalance(address),
    getDexScreenerStats(address),
  ]);

  const treasury = treasuryResult.status === 'fulfilled' ? treasuryResult.value : null;
  const dex = dexResult.status === 'fulfilled' ? dexResult.value : null;

  return NextResponse.json(
    {
      mint: address,
      treasuryBalance: treasury,
      priceUsd: dex?.priceUsd ?? null,
      volume24h: dex?.volume24h ?? null,
      priceChange24h: dex?.priceChange24h ?? null,
      liquidity: dex?.liquidity ?? null,
      dex: dex?.dex ?? null,
      pairAddress: dex?.pairAddress ?? null,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
}
