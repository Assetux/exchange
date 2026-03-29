// LiFi REST API wrapper — no SDK, plain fetch

const BASE = 'https://li.quest/v1';

export interface Chain {
  id: number;
  name: string;
  logoURI: string;
  nativeToken: Token;
  chainType: 'EVM' | 'SVM' | 'UTXO' | 'MVM'; // from LiFi API
}

export function isSolana(chain: Chain | null): boolean {
  return chain?.chainType === 'SVM';
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  chainId: number;
  priceUSD?: string;
}

export interface Quote {
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    gasCosts: { amountUSD: string }[];
    executionDuration: number;
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: Token;
    toToken: Token;
    fromAmount: string;
  };
  transactionRequest?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice?: string;
    from: string;
    chainId: number;
  };
  tool: string;
  toolDetails: { name: string; logoURI: string };
}

export async function getChains(): Promise<Chain[]> {
  const res = await fetch(`${BASE}/chains?chainTypes=EVM,SVM`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error('Failed to fetch chains');
  const data = await res.json();
  return data.chains;
}

// Returns only curated tokens: defaults per chain + tokens listed via /listing page
export async function getTokens(chainId: number): Promise<Token[]> {
  const res = await fetch(`/api/tokens?chainId=${chainId}`);
  if (!res.ok) throw new Error('Failed to fetch tokens');
  return res.json();
}

export async function getQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
}): Promise<Quote> {
  const q = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    ...(params.toAddress ? { toAddress: params.toAddress } : {}),
    integrator: 'assetux',
    order: 'FASTEST',
    slippage: '0.03',
  });
  const res = await fetch(`${BASE}/quote?${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to get quote');
  }
  return res.json();
}

export function formatAmount(amount: string, decimals: number): string {
  const n = Number(BigInt(amount)) / 10 ** decimals;
  // Use plain string (no locale separators) so the value can be fed back into parseUnits
  return parseFloat(n.toFixed(6)).toString();
}
