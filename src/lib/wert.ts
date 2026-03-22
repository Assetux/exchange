export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN_ID = 8453;

export async function createWertSession(params: {
  usdAmount: number;
  toToken: string;
  toChain: number;
  toWallet: string;
}): Promise<{ orderId: string; payment_url: string }> {
  const res = await fetch('/api/wert/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create payment session');
  }
  return res.json();
}
