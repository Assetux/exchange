import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXCHANGE_WALLET = process.env.EXCHANGE_WALLET_ADDRESS || '';
const WERT_API_KEY = process.env.WERT_API_KEY || '';
const WERT_PARTNER_ID = process.env.NEXT_PUBLIC_WERT_PARTNER_ID || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://exchange.assetux.com';
const ORDERS_FILE = join(process.cwd(), 'data', 'wert-orders.json');

async function readOrders() {
  try { return JSON.parse(await readFile(ORDERS_FILE, 'utf-8')); }
  catch { return {}; }
}

async function saveOrder(id: string, order: any) {
  const orders = await readOrders();
  orders[id] = order;
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const { usdAmount, toToken, toChain, toWallet } = await req.json();

    if (!usdAmount || usdAmount < 10) return NextResponse.json({ error: 'Minimum $10' }, { status: 400 });
    if (!toWallet) return NextResponse.json({ error: 'toWallet required' }, { status: 400 });
    if (!EXCHANGE_WALLET) return NextResponse.json({ error: 'Exchange wallet not configured' }, { status: 500 });

    const orderId = randomUUID();

    const res = await fetch('https://partner.wert.io/api/external/hpp/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WERT_API_KEY },
      body: JSON.stringify({
        flow_type: 'simple_full_restrict',
        commodity: 'USDC',
        network: 'base',
        wallet_address: EXCHANGE_WALLET,
        currency_amount: usdAmount,
        currency: 'USD',
        click_id: orderId,
        commodities: JSON.stringify([{ commodity: 'USDC', network: 'base' }]),
      }),
    });

    if (!res.ok) {
      console.error('Wert error:', await res.text());
      return NextResponse.json({ error: 'Payment provider error' }, { status: 502 });
    }

    const data = await res.json();

    await saveOrder(orderId, {
      orderId, sessionId: data.sessionId,
      usdAmount, toChain, toToken, toWallet,
      fromChain: 8453,
      fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on BASE
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const payment_url = `https://widget.wert.io/${WERT_PARTNER_ID}/widget?session_id=${data.sessionId}`;

    return NextResponse.json({ orderId, payment_url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
