// 0x Swap API v2 — single-chain + cross-chain wrappers
// Single-chain:  https://docs.0x.org/api-reference/api-overview
// Cross-chain:   https://0x-docs.gitbook.io/0x-cross-chain-api-beta/api-reference/cross-chain

// ── Single-chain ─────────────────────────────────────────────────────────────

export interface ZeroxQuote {
  liquidityAvailable: boolean;
  buyAmount: string;
  minBuyAmount: string;
  sellAmount: string;
  allowanceTarget: string | null;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string | null;
    gasPrice: string;
  };
  route: {
    fills: Array<{ source: string; proportionBps: number }>;
  } | null;
}

export async function getZeroxQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
  recipient?: string;
  slippageBps?: number;
}): Promise<ZeroxQuote | null> {
  try {
    const res = await fetch(
      `/api/quote/zerox?${new URLSearchParams({
        chainId: String(params.chainId),
        sellToken: params.sellToken,
        buyToken: params.buyToken,
        sellAmount: params.sellAmount,
        taker: params.taker,
        ...(params.recipient ? { recipient: params.recipient } : {}),
        slippageBps: String(params.slippageBps ?? 300),
      })}`,
    );
    if (!res.ok) return null;
    const data: ZeroxQuote = await res.json();
    if (!data.liquidityAvailable) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Cross-chain ───────────────────────────────────────────────────────────────

export interface ZeroxCrossChainStep {
  type: 'wrap' | 'unwrap' | 'swap' | 'bridge' | string;
  provider: string;
  estimatedTimeSeconds: number | null;
}

export interface ZeroxCrossChainQuote {
  buyAmount: string;
  minBuyAmount: string;
  allowanceTarget: string | null;
  estimatedTimeSeconds: number | null;
  steps: ZeroxCrossChainStep[];
  transaction: {
    chainType: 'evm' | 'svm' | string;
    details: {
      to: string;
      data: string;
      gas: string | null;
      gasPrice: string | null;
      value: string;
    };
  };
}

export async function getZeroxCrossChainQuote(params: {
  originChain: number;
  destinationChain: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  originAddress: string;
  destinationAddress?: string;
  slippageBps?: number;
}): Promise<ZeroxCrossChainQuote | null> {
  try {
    const res = await fetch(
      `/api/quote/zerox-cross?${new URLSearchParams({
        originChain: String(params.originChain),
        destinationChain: String(params.destinationChain),
        sellToken: params.sellToken,
        buyToken: params.buyToken,
        sellAmount: params.sellAmount,
        originAddress: params.originAddress,
        ...(params.destinationAddress ? { destinationAddress: params.destinationAddress } : {}),
        slippageBps: String(params.slippageBps ?? 300),
      })}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export const ZEROX_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const LIFI_NATIVE  = '0x0000000000000000000000000000000000000000';

export function toZeroxTokenAddress(address: string): string {
  return address === LIFI_NATIVE ? ZEROX_NATIVE : address;
}

// Chains supported by 0x single-chain swap API
const ZEROX_SWAP_CHAINS = new Set([
  1, 8453, 42161, 10, 137, 56, 43114, 534352, 59144, 81457, 34443, 5000, 1301, 80094, 57073,
]);

export function zeroxSupportsChain(chainId: number): boolean {
  return ZEROX_SWAP_CHAINS.has(chainId);
}
