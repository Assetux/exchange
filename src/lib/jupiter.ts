// Solana DEX aggregator — Jupiter (primary) + Raydium (fallback) + Meteora DBC (tertiary)
// Jupiter migrated from quote-api.jup.ag/v6 to api.jup.ag/swap/v1 in Dec 2024.
// Meteora DBC is used for SOL-paired bonding curve pools (pre-graduation tokens like ASX, HOTPOT).

import type { Connection } from '@solana/web3.js';

const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
const JUPITER_BASE = JUPITER_API_KEY
  ? 'https://api.jup.ag/swap/v1'
  : 'https://lite-api.jup.ag/swap/v1';
const RAYDIUM_BASE = 'https://transaction-v1.raydium.io';

export const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_SOLANA_DECIMALS = 6;
export const WSOL = 'So11111111111111111111111111111111111111112';

// ── Normalized quote returned by getSolanaQuote ───────────────────────────────
export interface SolanaSwapQuote {
  source: 'jupiter' | 'raydium' | 'meteora-dbc';
  inputMint: string;   // USDC_SOLANA for jupiter/raydium; WSOL for meteora-dbc
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string; // min out after slippage
  priceImpactPct: string;
  routeLabel: string;           // human-readable DEX name(s)
  // raw response kept for tx building
  _raw: JupiterQuoteResponse | RaydiumComputeData | import('./meteora').MeteoraDbcQuote;
}

// ── Jupiter types ─────────────────────────────────────────────────────────────
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label?: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

// ── Raydium types ─────────────────────────────────────────────────────────────
export interface RaydiumComputeData {
  swapType: string;
  inputMint: string;
  inputAmount: string;
  outputMint: string;
  outputAmount: string;
  otherAmountThreshold: string;
  routePlan: Array<{
    poolId: string;
    inputMint: string;
    outputMint: string;
    feeMint: string;
    feeRate: number;
    feeAmount: string;
    remainingAccounts?: string[];
    lastPoolPriceX64?: string;
    poolType?: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const jupHeaders = (): Record<string, string> =>
  JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {};

// ── Jupiter ───────────────────────────────────────────────────────────────────
async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}): Promise<JupiterQuoteResponse> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: String(params.slippageBps ?? 300),
  });
  const res = await fetch(`${JUPITER_BASE}/quote?${q}`, { headers: jupHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Jupiter: no route found');
  }
  return res.json();
}

async function getJupiterSwapTx(quoteResponse: JupiterQuoteResponse, userPublicKey: string): Promise<string[]> {
  const res = await fetch(`${JUPITER_BASE}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...jupHeaders() },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Jupiter: failed to build swap transaction');
  }
  const data = await res.json();
  return [data.swapTransaction]; // Jupiter returns a single tx
}

// ── Raydium ───────────────────────────────────────────────────────────────────
async function getRaydiumQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}): Promise<RaydiumComputeData> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: String(params.slippageBps ?? 300),
    txVersion: 'V0',
  });
  const res = await fetch(`${RAYDIUM_BASE}/compute/swap-base-in?${q}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.msg || 'Raydium: no route found');
  return json.data as RaydiumComputeData;
}

async function getRaydiumSwapTx(computeData: RaydiumComputeData, userPublicKey: string): Promise<string[]> {
  const res = await fetch(`${RAYDIUM_BASE}/transaction/swap-base-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: 'auto',
      swapResponse: computeData,
      txVersion: 'V0',
      wallet: userPublicKey,
      wrapSol: false,
      unwrapSol: false,
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.msg || 'Raydium: failed to build swap transaction');
  // Raydium may return multiple txs (e.g. setup + swap)
  return (json.data as Array<{ transaction: string }>).map(d => d.transaction);
}

// ── Unified public API ────────────────────────────────────────────────────────

/**
 * Try Jupiter → Raydium → Meteora DBC (WSOL-paired pools only, requires connection).
 * Throws only if all fail.
 */
export async function getSolanaQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  /** Required for Meteora DBC fallback (only used when inputMint === WSOL) */
  connection?: Connection;
}): Promise<SolanaSwapQuote> {
  // ── Jupiter ───────────────────────────────────────────────────────────────
  try {
    const jup = await getJupiterQuote(params);
    return {
      source: 'jupiter',
      inputMint: jup.inputMint,
      outputMint: jup.outputMint,
      inAmount: jup.inAmount,
      outAmount: jup.outAmount,
      otherAmountThreshold: jup.otherAmountThreshold,
      priceImpactPct: jup.priceImpactPct,
      routeLabel: jup.routePlan.map(r => r.swapInfo.label || 'Jupiter').join(' + '),
      _raw: jup,
    };
  } catch (jupErr) {
    console.warn('[Assetux] Jupiter failed:', (jupErr as Error).message, '— trying Raydium…');
  }

  // ── Raydium fallback ──────────────────────────────────────────────────────
  try {
    const ray = await getRaydiumQuote(params);
    const priceIn = Number(ray.inputAmount);
    const priceOut = Number(ray.outputAmount);
    const impact = priceIn > 0 ? Math.abs(1 - priceOut / priceIn) * 100 : 0;
    return {
      source: 'raydium',
      inputMint: ray.inputMint,
      outputMint: ray.outputMint,
      inAmount: ray.inputAmount,
      outAmount: ray.outputAmount,
      otherAmountThreshold: ray.otherAmountThreshold,
      priceImpactPct: impact.toFixed(4),
      routeLabel: ray.routePlan.map(r => r.poolType || 'Raydium').join(' + ') || 'Raydium',
      _raw: ray,
    };
  } catch (rayErr) {
    console.warn('[Assetux] Raydium failed:', (rayErr as Error).message, '— trying Meteora DBC…');
  }

  // ── Meteora DBC fallback (SOL/WSOL→token only) ────────────────────────────
  if (params.inputMint === WSOL && params.connection) {
    const { findMeteoraDbcPool, getMeteoraDbcQuote } = await import('./meteora');
    const poolAddress = await findMeteoraDbcPool(params.outputMint, params.connection);
    if (!poolAddress) throw new Error('No route found: token not on Jupiter, Raydium, or Meteora DBC');
    const dbcQ = await getMeteoraDbcQuote({
      tokenMint: params.outputMint,
      poolAddress,
      amountInLamports: params.amount,
      slippageBps: params.slippageBps,
      connection: params.connection,
    });
    return {
      source: 'meteora-dbc',
      inputMint: WSOL,
      outputMint: params.outputMint,
      inAmount: dbcQ.inAmount,
      outAmount: dbcQ.outAmount,
      otherAmountThreshold: dbcQ.minAmountOut,
      priceImpactPct: '0',
      routeLabel: 'Meteora DBC',
      _raw: dbcQ,
    };
  }

  throw new Error('No route found: Jupiter and Raydium both failed (pass connection for Meteora DBC fallback)');
}

/** Build swap transaction(s) for a SolanaSwapQuote. Returns base64-encoded txs in execution order. */
export async function getSolanaSwapTxs(
  quote: SolanaSwapQuote,
  userPublicKey: string,
  connection?: Connection,
): Promise<string[]> {
  if (quote.source === 'jupiter') {
    return getJupiterSwapTx(quote._raw as JupiterQuoteResponse, userPublicKey);
  }
  if (quote.source === 'raydium') {
    return getRaydiumSwapTx(quote._raw as RaydiumComputeData, userPublicKey);
  }
  // Meteora DBC
  if (!connection) throw new Error('Solana connection required for Meteora DBC swap');
  const { getMeteoraDbcSwapTx } = await import('./meteora');
  const { PublicKey } = await import('@solana/web3.js');
  const dbcQuote = quote._raw as import('./meteora').MeteoraDbcQuote;
  const tx = await getMeteoraDbcSwapTx({ owner: userPublicKey, quote: dbcQuote, connection });
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(userPublicKey);
  const serialized = tx.serialize({ requireAllSignatures: false });
  const b64 = btoa(new Uint8Array(serialized).reduce((s, b) => s + String.fromCharCode(b), ''));
  return [b64];
}
