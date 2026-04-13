import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy — keeps the 0x API key out of the client bundle
export async function GET(req: NextRequest) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ZEROX_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const chainId    = searchParams.get('chainId');
  const sellToken  = searchParams.get('sellToken');
  const buyToken   = searchParams.get('buyToken');
  const sellAmount = searchParams.get('sellAmount');
  const taker      = searchParams.get('taker');
  const recipient  = searchParams.get('recipient');
  const slippageBps = searchParams.get('slippageBps') ?? '300';

  if (!chainId || !sellToken || !buyToken || !sellAmount || !taker) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  const params = new URLSearchParams({
    chainId,
    sellToken,
    buyToken,
    sellAmount,
    taker,
    slippageBps,
    ...(recipient ? { recipient } : {}),
  });

  try {
    const res = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
      headers: {
        '0x-api-key': apiKey,
        '0x-version': 'v2',
      },
      next: { revalidate: 0 }, // never cache — quotes are time-sensitive
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Normalize gas field to string for consistent client handling
    const normalized = {
      ...data,
      transaction: data.transaction
        ? {
            ...data.transaction,
            gas: data.transaction.gas
              ? typeof data.transaction.gas === 'object'
                ? String(data.transaction.gas.estimate ?? data.transaction.gas)
                : String(data.transaction.gas)
              : null,
          }
        : null,
    };

    return NextResponse.json(normalized);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
