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

/** Find Meteora DBC pool for a given token mint. Returns null if not found. */
export async function findMeteoraDbcPool(
  tokenMint: string,
  connection: Connection,
): Promise<string | null> {
  const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const result = await client.state.getPoolByBaseMint(new PublicKey(tokenMint));
  return result ? result.publicKey.toBase58() : null;
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

  const virtualPoolState = await client.state.getPool(new PublicKey(params.poolAddress));
  const poolConfigState  = await client.state.getPoolConfig(virtualPoolState.config);
  const currentPoint     = await getCurrentPoint(params.connection, poolConfigState.activationType);

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
