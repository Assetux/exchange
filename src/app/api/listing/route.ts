import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

const FILE = join(process.cwd(), 'data', 'listings.json');
const TREASURY = new PublicKey('6bvB3PTz48wozyPJeuTB77axexWu9MfUSjBYbQzEgK88');
const ASX_MINT = 'cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma';
const LISTING_FEE = 1_000_000;
const ASX_DECIMALS = 9;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function read(): Promise<any[]> {
  try { return JSON.parse(await readFile(FILE, 'utf-8')); }
  catch { return []; }
}

async function verifyTx(txSig: string, wallet: string): Promise<{ ok: boolean; error?: string }> {
  const connection = new Connection(SOLANA_RPC, 'confirmed');

  const tx = await connection.getParsedTransaction(txSig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return { ok: false, error: 'Transaction not found on Solana' };
  if (tx.meta?.err) return { ok: false, error: 'Transaction failed on-chain' };

  // Find token transfer instruction to treasury
  const instructions = tx.transaction.message.instructions;
  let feeVerified = false;

  for (const ix of instructions) {
    if ('parsed' in ix && ix.parsed?.type === 'transferChecked') {
      const info = ix.parsed.info;
      const mintMatch = info.mint === ASX_MINT;
      const destOwner = info.destination; // ATA — check its owner
      const amountRaw = Number(info.tokenAmount?.amount || 0);
      const expectedRaw = LISTING_FEE * 10 ** ASX_DECIMALS;
      const amountOk = amountRaw >= expectedRaw;

      if (mintMatch && amountOk) {
        // Verify the destination ATA is owned by treasury
        try {
          const destInfo = await connection.getParsedAccountInfo(new PublicKey(destOwner));
          const destData = (destInfo.value?.data as any)?.parsed?.info;
          if (destData?.owner === TREASURY.toBase58()) {
            feeVerified = true;
            break;
          }
        } catch {
          // fall through
        }
      }
    }
  }

  if (!feeVerified) {
    return { ok: false, error: 'Could not verify 1,000,000 ASX transfer to treasury in this transaction' };
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const { tokenAddress, network, tokenName, tokenSymbol, wallet, txSig, signature } = await req.json();

    if (!tokenAddress || !txSig || !wallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prevent duplicate listing for same tx
    const listings = await read();
    if (listings.find((l: any) => l.txSig === txSig)) {
      return NextResponse.json({ error: 'This transaction has already been used for a listing' }, { status: 409 });
    }

    // Verify on Solana
    const verification = await verifyTx(txSig, wallet);
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    listings.push({
      tokenAddress, network, tokenName, tokenSymbol,
      wallet, txSig, signature,
      verified: true,
      listedAt: new Date().toISOString(),
    });

    await mkdir(join(process.cwd(), 'data'), { recursive: true });
    await writeFile(FILE, JSON.stringify(listings, null, 2));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Listing error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(await read());
}
