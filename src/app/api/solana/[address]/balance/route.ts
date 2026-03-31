import { NextRequest, NextResponse } from 'next/server';

const SOL_RPC = process.env.SOLANA_RPC_URL ?? 'https://sol.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: mint } = await params;
  const wallet = req.nextUrl.searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 });
  }

  let rpcData: any;
  try {
    const res = await fetch(SOL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [wallet, { mint }, { encoding: 'jsonParsed' }],
      }),
      next: { revalidate: 30 },
    });
    rpcData = await res.json();
  } catch {
    return NextResponse.json({ error: 'Solana RPC request failed' }, { status: 502 });
  }

  if (rpcData.error) {
    return NextResponse.json({ error: rpcData.error.message ?? 'RPC error' }, { status: 400 });
  }

  const accounts: any[] = rpcData.result?.value ?? [];
  const balance = accounts.length > 0
    ? (accounts[0].account.data.parsed.info.tokenAmount.uiAmountString ?? '0')
    : '0';

  return NextResponse.json(
    { wallet, mint, balance },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10' } },
  );
}
