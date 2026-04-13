// Space ID Web3 Name SDK wrapper
// https://docs.space.id/developer-guide/web3-name-api-and-sdk

import { createWeb3Name } from '@web3-name-sdk/core';

let web3name: ReturnType<typeof createWeb3Name> | null = null;

function getClient() {
  if (!web3name) web3name = createWeb3Name({ timeout: 5000 });
  return web3name;
}

/**
 * Resolve a Web3 Name (e.g. "alice.bnb", "vitalik.eth") to a wallet address.
 * Returns null if not found or on error.
 */
export async function resolveWeb3Name(domain: string): Promise<string | null> {
  try {
    const client = getClient();
    const address = await client.getAddress(domain);
    return address || null;
  } catch {
    return null;
  }
}

/**
 * Reverse-lookup: wallet address → primary Web3 Name.
 * Checks BNB (.bnb) and Ethereum (.eth) by default.
 * Returns null if not found.
 */
export async function getWeb3Name(address: string, chainId?: number): Promise<string | null> {
  try {
    const client = getClient();
    // Query a broad list of popular chains + fallback to ETH
    const queryChainIdList = chainId
      ? [chainId, 56, 1]  // prefer the connected chain, then BNB, then ETH
      : [56, 1, 42161, 8453, 137];
    const name = await client.getDomainName({
      address,
      queryChainIdList: [...new Set(queryChainIdList)],
    });
    return name || null;
  } catch {
    return null;
  }
}

/** Returns true if the string looks like a Web3 Name domain (has a dot, no 0x prefix, not an IP) */
export function isWeb3Domain(value: string): boolean {
  const v = value.trim();
  if (!v.includes('.')) return false;
  if (v.startsWith('0x')) return false;
  // Solana addresses are base58, 32-44 chars, no dots
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false;
  return true;
}

/** Basic on-chain address format validation (EVM hex or Solana base58) */
export function isValidAddress(address: string, isSolana: boolean): boolean {
  if (isSolana) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
