// Meteora Dynamic Bonding Curve (DBC) — quote + swap transaction builder
// Used for SOL-paired bonding curve pools (pre-graduation tokens)

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';

export interface MeteoraDbcQuote {
  poolAddress: string;
  tokenMint: string;          // base token (the custom token)
  inAmount: string;           // SOL lamports in
  outAmount: string;          // token out (base units)
  minAmountOut: string;       // after slippage
  swapBaseForQuote: boolean;  // false = SOL→token (buy)
}

// ── Stable-data cache (pool address + config never change per token) ──────────
const _poolAddressCache = new Map<string, string>();          // tokenMint → poolAddress
const _poolConfigCache  = new Map<string, any>();             // configAddress → poolConfigState

// ── Short-TTL cache (reduces RPC calls on rapid re-quotes) ───────────────────
interface TtlEntry<T> { value: T; expiresAt: number }
const _poolStateCache    = new Map<string, TtlEntry<any>>(); // poolAddress → virtualPoolState (1s TTL)
const _currentPointCache = new Map<number, TtlEntry<any>>(); // activationType → currentPoint (2s TTL)

function ttlGet<T>(cache: Map<any, TtlEntry<T>>, key: any): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.value;
}
function ttlSet<T>(cache: Map<any, TtlEntry<T>>, key: any, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Retry an async fn up to maxRetries times on 429 / rate-limit errors. */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const is429 = msg.includes('429') || msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('compute units');
      if (!is429 || attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  // unreachable
  throw new Error('withRetry: exhausted');
}

/** Find Meteora DBC pool for a given token mint. Returns null if not found. */
export async function findMeteoraDbcPool(
  tokenMint: string,
  connection: Connection,
): Promise<string | null> {
  if (_poolAddressCache.has(tokenMint)) return _poolAddressCache.get(tokenMint)!;
  const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const result = await withRetry(() => client.state.getPoolByBaseMint(new PublicKey(tokenMint)));
  const address = result ? result.publicKey.toBase58() : null;
  if (address) _poolAddressCache.set(tokenMint, address);
  return address;
}

/** Get a swap quote from Meteora DBC. amountIn is SOL in lamports (9 decimals). */
export async function getMeteoraDbcQuote(params: {
  tokenMint: string;
  poolAddress: string;
  amountInLamports: string;   // SOL lamports
  swapBaseForQuote?: boolean; // false = buy token with SOL (default)
  slippageBps?: number;
  connection: Connection;
}): Promise<MeteoraDbcQuote> {
  const { DynamicBondingCurveClient, getCurrentPoint } =
    await import('@meteora-ag/dynamic-bonding-curve-sdk');

  const client = new DynamicBondingCurveClient(params.connection, 'confirmed');
  const swapBaseForQuote = params.swapBaseForQuote ?? false;

  // virtualPoolState: fresh every ~1s — avoids per-keystroke RPC spam
  let virtualPoolState = ttlGet(_poolStateCache, params.poolAddress);
  if (!virtualPoolState) {
    virtualPoolState = await withRetry(() =>
      client.state.getPool(new PublicKey(params.poolAddress))
    );
    ttlSet(_poolStateCache, params.poolAddress, virtualPoolState, 1_000);
  }

  // poolConfig is immutable — cache indefinitely
  const configKey = virtualPoolState.config.toBase58();
  if (!_poolConfigCache.has(configKey)) {
    const cfg = await withRetry(() => client.state.getPoolConfig(virtualPoolState.config));
    _poolConfigCache.set(configKey, cfg);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poolConfigState: any = _poolConfigCache.get(configKey);

  // currentPoint = slot or blockTime — refresh every 2s (getSlot costs 20 CU, getBlockTime 40 CU)
  let currentPoint = ttlGet(_currentPointCache, poolConfigState.activationType);
  if (!currentPoint) {
    currentPoint = await withRetry(() =>
      getCurrentPoint(params.connection, poolConfigState.activationType)
    );
    ttlSet(_currentPointCache, poolConfigState.activationType, currentPoint, 2_000);
  }

  const quote = await client.pool.swapQuote({
    virtualPool: virtualPoolState,
    config: poolConfigState,
    swapBaseForQuote,
    amountIn: new BN(params.amountInLamports),
    slippageBps: params.slippageBps ?? 300,
    hasReferral: false,
    currentPoint,
    eligibleForFirstSwapWithMinFee: false,
  });

  return {
    poolAddress: params.poolAddress,
    tokenMint: params.tokenMint,
    inAmount: params.amountInLamports,
    outAmount: quote.outputAmount.toString(),
    minAmountOut: quote.minimumAmountOut.toString(),
    swapBaseForQuote,
  };
}

/** Build a Meteora DBC swap transaction. */
export async function getMeteoraDbcSwapTx(params: {
  owner: string;
  quote: MeteoraDbcQuote;
  connection: Connection;
}): Promise<Transaction> {
  const { DynamicBondingCurveClient } =
    await import('@meteora-ag/dynamic-bonding-curve-sdk');

  const client = new DynamicBondingCurveClient(params.connection, 'confirmed');

  return client.pool.swap({
    owner: new PublicKey(params.owner),
    amountIn: new BN(params.quote.inAmount),
    minimumAmountOut: new BN(params.quote.minAmountOut),
    swapBaseForQuote: params.quote.swapBaseForQuote,
    pool: new PublicKey(params.quote.poolAddress),
    referralTokenAccount: null,
  });
}
