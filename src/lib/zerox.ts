// 0x Swap API v2 wrapper — single-chain EVM only
// https://docs.0x.org/api-reference/api-overview
// Cross-chain and Solana swaps are handled by LiFi; 0x is used for same-chain EVM
// to compare rates and pick the best one.

export interface ZeroxQuote {
  liquidityAvailable: boolean;
  buyAmount: string;         // raw, base units
  minBuyAmount: string;
  sellAmount: string;
  allowanceTarget: string | null;
  transaction: {
    to: string;
    data: string;
    value: string;            // wei
    gas: string | null;       // estimated gas units
    gasPrice: string;
  };
  route: {
    fills: Array<{ source: string; proportionBps: number }>;
  } | null;
}

export async function getZeroxQuote(params: {
  chainId: number;
  sellToken: string;    // token address (use '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' for native)
  buyToken: string;
  sellAmount: string;   // base units
  taker: string;        // wallet executing the swap
  recipient?: string;   // if different from taker
  slippageBps?: number; // default 300 = 3%
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

// 0x uses '0xeeee…' for native tokens; LiFi uses '0x0000…'
export const ZEROX_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const LIFI_NATIVE  = '0x0000000000000000000000000000000000000000';

export function toZeroxTokenAddress(address: string): string {
  return address === LIFI_NATIVE ? ZEROX_NATIVE : address;
}

// 0x supports these chain IDs for the swap API
const ZEROX_SUPPORTED_CHAINS = new Set([
  1, 8453, 42161, 10, 137, 56, 43114, 534352, 59144, 81457, 34443, 5000, 1301, 80094, 57073, 999999999,
]);

export function zeroxSupportsChain(chainId: number): boolean {
  return ZEROX_SUPPORTED_CHAINS.has(chainId);
}
