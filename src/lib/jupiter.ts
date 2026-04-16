// Jupiter Aggregator — quote + swap transaction builder

// Jupiter migrated from quote-api.jup.ag/v6 to api.jup.ag/swap/v1 in Dec 2024.
// lite-api.jup.ag/swap/v1 is the free tier (no key). Use api.jup.ag with JUPITER_API_KEY for higher rate limits.
const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
const JUPITER_QUOTE_API = JUPITER_API_KEY
  ? 'https://api.jup.ag/swap/v1'
  : 'https://lite-api.jup.ag/swap/v1';

export const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_SOLANA_DECIMALS = 6;
// Wrapped SOL mint — used by Jupiter for native SOL swaps
export const WSOL = 'So11111111111111111111111111111111111111112';

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string; // min out after slippage
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

const authHeaders = (): Record<string, string> =>
  JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {};

export async function getJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: string; // in smallest units of inputMint
  slippageBps?: number;
}): Promise<JupiterQuoteResponse> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: String(params.slippageBps ?? 300),
  });
  const res = await fetch(`${JUPITER_QUOTE_API}/quote?${q}`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Jupiter: no route found');
  }
  return res.json();
}

export async function getJupiterSwapTx(params: {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
}): Promise<{ swapTransaction: string }> {
  const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Jupiter: failed to build swap transaction');
  }
  return res.json();
}
