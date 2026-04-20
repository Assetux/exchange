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
const _poolConfigCache  = new Map<string, unknown>();         // configAddress → poolConfigState

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

  // virtualPoolState changes with every swap, must be fresh
  const virtualPoolState = await withRetry(() =>
    client.state.getPool(new PublicKey(params.poolAddress))
  );

  // poolConfig is immutable — cache it to save an RPC call on repeat quotes
  const configKey = virtualPoolState.config.toBase58();
  if (!_poolConfigCache.has(configKey)) {
    const cfg = await withRetry(() => client.state.getPoolConfig(virtualPoolState.config));
    _poolConfigCache.set(configKey, cfg);
  }
  const poolConfigState = _poolConfigCache.get(configKey) as typeof virtualPoolState;

  const currentPoint = await withRetry(() =>
    getCurrentPoint(params.connection, poolConfigState.activationType)
  );

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
