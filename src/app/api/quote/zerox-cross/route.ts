import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for 0x Cross-Chain API (beta)
// https://0x-docs.gitbook.io/0x-cross-chain-api-beta/api-reference/cross-chain
export async function GET(req: NextRequest) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ZEROX_API_KEY not configured' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const originChain      = searchParams.get('originChain');
  const destinationChain = searchParams.get('destinationChain');
  const sellToken        = searchParams.get('sellToken');
  const buyToken         = searchParams.get('buyToken');
  const sellAmount       = searchParams.get('sellAmount');
  const originAddress    = searchParams.get('originAddress');
  const destinationAddress = searchParams.get('destinationAddress');
  const slippageBps      = searchParams.get('slippageBps') ?? '300';

  if (!originChain || !destinationChain || !sellToken || !buyToken || !sellAmount || !originAddress) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  const params = new URLSearchParams({
    originChain,
    destinationChain,
    sellToken,
    buyToken,
    sellAmount,
    originAddress,
    sortQuotesBy: 'price',  // best rate, not speed
    slippageBps,
    maxNumQuotes: '1',
    ...(destinationAddress ? { destinationAddress } : {}),
  });

  try {
    const res = await fetch(`https://api.0x.org/cross-chain/quotes?${params}`, {
      headers: {
        '0x-api-key': apiKey,
        '0x-version': 'v2',
      },
      next: { revalidate: 0 },
    });

    const data = await res.json();

    if (!res.ok || !data.liquidityAvailable || !data.quotes?.length) {
      // Return null (not an error) so the client falls back to LiFi silently
      return NextResponse.json(null);
    }

    const best = data.quotes[0];
    return NextResponse.json({
      buyAmount:           best.buyAmount,
      minBuyAmount:        best.minBuyAmount,
      allowanceTarget:     data.allowanceTarget ?? null,
      estimatedTimeSeconds: best.estimatedTimeSeconds ?? null,
      steps:               best.steps ?? [],
      transaction:         best.transaction,
    });
  } catch {
    return NextResponse.json(null);
  }
}
