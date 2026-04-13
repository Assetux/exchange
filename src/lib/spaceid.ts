// Space ID Web3 Name — REST API wrapper (no SDK, avoids viem BigInt overflow)
// Docs: https://docs.space.id/developer-guide/web3-name-api-and-sdk/web3-name-api

const API = 'https://nameapi.space.id';

/**
 * Resolve a Web3 Name (e.g. "alice.bnb", "vitalik.eth") to a wallet address.
 * Returns null if not found or on error.
 */
export async function resolveWeb3Name(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/getAddress?domain=${encodeURIComponent(domain)}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // code 0 = success, address present
    if (data.code === 0 && data.address) return data.address as string;
    return null;
  } catch {
    return null;
  }
}

// Chain IDs to try for reverse lookup (most popular Web3 Name chains)
const REVERSE_CHAIN_IDS = [56, 1, 42161, 8453, 137];

/**
 * Reverse-lookup: wallet address → primary Web3 Name.
 * Tries the provided chainId first, then falls back through popular chains.
 * Returns null if not found.
 */
export async function getWeb3Name(address: string, chainId?: number): Promise<string | null> {
  const chains = chainId
    ? [chainId, ...REVERSE_CHAIN_IDS.filter(c => c !== chainId)]
    : REVERSE_CHAIN_IDS;

  // Query all chains in parallel, take the first hit
  const results = await Promise.allSettled(
    chains.map(cid =>
      fetch(`${API}/getName?chainid=${cid}&address=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(5000),
      })
        .then(r => r.json())
        .then(d => (d.code === 0 && d.data?.name ? (d.data.name as string) : null))
        .catch(() => null)
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

/** Returns true if the string looks like a Web3 Name domain (has a dot, not an address) */
export function isWeb3Domain(value: string): boolean {
  const v = value.trim();
  if (!v.includes('.')) return false;
  if (v.startsWith('0x')) return false;
  // Solana base58 addresses are 32-44 chars with no dots
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false;
  return true;
}

/** Basic address format validation — EVM hex or Solana base58 */
export function isValidAddress(address: string, isSolana: boolean): boolean {
  if (isSolana) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
