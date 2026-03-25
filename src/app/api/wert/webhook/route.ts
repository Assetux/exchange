import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createWalletClient, createPublicClient, http, parseUnits, erc20Abi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const EXCHANGE_WALLET = process.env.EXCHANGE_WALLET_ADDRESS as Hex;
const _pk = process.env.EXCHANGE_WALLET_PRIVATE_KEY || '';
const PRIVATE_KEY = (_pk.startsWith('0x') ? _pk : `0x${_pk}`) as Hex;
const LIFI_API = 'https://li.quest/v1';
const ORDERS_FILE = join(process.cwd(), 'data', 'wert-orders.json');

async function readOrders() {
  try { return JSON.parse(await readFile(ORDERS_FILE, 'utf-8')); }
  catch { return {}; }
}

async function updateOrder(id: string, patch: any) {
  const orders = await readOrders();
  if (!orders[id]) return;
  orders[id] = { ...orders[id], ...patch };
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

async function executeSwap(order: any, usdcReceived: number) {
  if (!PRIVATE_KEY) throw new Error('EXCHANGE_WALLET_PRIVATE_KEY not set');

  const account = privateKeyToAccount(PRIVATE_KEY);
  const rpc = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

  // 5% fee — swap 95% to user
  const swapAmount = parseUnits((usdcReceived * 0.95).toFixed(6), 6);
  const isPassthrough = order.toChain === 8453 && order.toToken.toLowerCase() === order.fromToken.toLowerCase();

  if (isPassthrough) {
    const hash = await walletClient.writeContract({
      address: order.fromToken as Hex, abi: erc20Abi,
      functionName: 'transfer', args: [order.toWallet as Hex, swapAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // LiFi quote
  const q = new URLSearchParams({
    fromChain: String(order.fromChain), toChain: String(order.toChain),
    fromToken: order.fromToken, toToken: order.toToken,
    fromAmount: swapAmount.toString(),
    fromAddress: EXCHANGE_WALLET, toAddress: order.toWallet,
    integrator: 'assetux', order: 'FASTEST', slippage: '0.03',
  });
  const quoteRes = await fetch(`${LIFI_API}/quote?${q}`);
  if (!quoteRes.ok) throw new Error(`LiFi: ${await quoteRes.text()}`);

  const { transactionRequest: tx, estimate } = await quoteRes.json();
  if (!tx) throw new Error('No tx from LiFi');

  // Approve
  const spender = (estimate.approvalAddress || tx.to) as Hex;
  const approveHash = await walletClient.writeContract({
    address: order.fromToken as Hex, abi: erc20Abi,
    functionName: 'approve', args: [spender, swapAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Swap
  const hash = await walletClient.sendTransaction({
    to: tx.to as Hex, data: tx.data as Hex,
    value: tx.value ? BigInt(tx.value) : 0n,
    gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function POST(req: NextRequest) {
  try {
    const { click_id, type, quote_amount, transaction_id } = await req.json();
    if (type !== 'order_complete') return NextResponse.json({ ok: true });

    const orders = await readOrders();
    const order = orders[click_id];
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (order.status !== 'pending') return NextResponse.json({ ok: true });

    await updateOrder(click_id, { status: 'processing', wertTxId: transaction_id });

    try {
      const hash = await executeSwap(order, parseFloat(quote_amount));
      await updateOrder(click_id, { status: 'completed', swapTxHash: hash });
    } catch (e: any) {
      console.error('Swap failed:', e.message);
      await updateOrder(click_id, { status: 'swap_failed', swapError: e.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
