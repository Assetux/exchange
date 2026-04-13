import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const LIFI = 'https://li.quest/v1';

// Curated token addresses per chain: native + USDC/USDT + ASX deployments
// '0x0000000000000000000000000000000000000000' = native coin
const DEFAULTS: Record<string, string[]> = {
  '1': [ // Ethereum
    '0x0000000000000000000000000000000000000000', // ETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x5bcf2be3bf0243655f121c85763a0a063bb8152c', // ASX
  ],
  '8453': [ // Base
    '0x0000000000000000000000000000000000000000', // ETH
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    '0x9cd7ec05f483069353f4e487dabe644306014963', // ASX
  ],
  '56': [ // BNB Chain
    '0x0000000000000000000000000000000000000000', // BNB
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
    '0x55d398326f99059fF775485246999027B3197955', // USDT
    '0x6f7a6a45b7bb844b6f037681a8d7aae3ca42ce57', // ASX
  ],
  '42161': [ // Arbitrum
    '0x0000000000000000000000000000000000000000', // ETH
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
    '0x5bcf2be3bf0243655f121c85763a0a063bb8152c', // ASX
  ],
  '137': [ // Polygon
    '0x0000000000000000000000000000000000000000', // POL
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
  ],
  '10': [ // Optimism
    '0x0000000000000000000000000000000000000000', // ETH
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
  ],
  '43114': [ // Avalanche
    '0x0000000000000000000000000000000000000000', // AVAX
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // USDT
  ],
  '100': [ // Gnosis
    '0x0000000000000000000000000000000000000000', // xDAI
    '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', // USDC
    '0x4ECaBa5870353805a9F068101A40E0f32ed605C6', // USDT
  ],
  '324': [ // zkSync Era
    '0x0000000000000000000000000000000000000000', // ETH
    '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', // USDC
    '0x493257fD37EDB34451f62EDf8D2a0C418852bA4c', // USDT
  ],
  '59144': [ // Linea
    '0x0000000000000000000000000000000000000000', // ETH
    '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', // USDC
  ],
  '534352': [ // Scroll
    '0x0000000000000000000000000000000000000000', // ETH
    '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', // USDC
    '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', // USDT
  ],
  '81457': [ // Blast
    '0x0000000000000000000000000000000000000000', // ETH
    '0x4300000000000000000000000000000000000003', // USDB (Blast native stablecoin)
  ],
  '5000': [ // Mantle
    '0x0000000000000000000000000000000000000000', // MNT
    '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9', // USDC
    '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE', // USDT
  ],
  '480': [ // World Chain
    '0x0000000000000000000000000000000000000000', // ETH
    '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1', // USDC
    '0x9cd7ec05f483069353f4e487dabe644306014963', // ASX
  ],
  '42220': [ // Celo
    '0x0000000000000000000000000000000000000000', // CELO
    '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // USDC
    '0x617f3112bf5397D0467D315cC709EF968D9ba546', // USDT
  ],
  '34443': [ // Mode
    '0x0000000000000000000000000000000000000000', // ETH
    '0xd988097fb8612cc24eeC14542bC03424c656005f', // USDC
    '0xf0F161fDA2712DB8b566946122a5af183995e2eD', // USDT
  ],
  '167000': [ // Taiko
    '0x0000000000000000000000000000000000000000', // ETH
    '0x07d83526730c7438048D55A4fc0b850e2aaB6f0b', // USDC
    '0x2DEF195713CF4a606B49D07E520e22741E1d60d', // USDT
  ],
  '146': [ // Sonic
    '0x0000000000000000000000000000000000000000', // S
    '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', // USDC
  ],
  '1329': [ // Sei EVM
    '0x0000000000000000000000000000000000000000', // SEI
    '0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1', // USDC
  ],
  '204': [ // opBNB
    '0x0000000000000000000000000000000000000000', // BNB
    '0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3', // USDC
  ],
  '1151111081099710': [ // Solana (LiFi chain ID)
    'So11111111111111111111111111111111111111112',   // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma',  // ASX
    'Yt9PdC1GssVbiCr2y7rWpXcJm28g1kcEAY8GrNgcyai',  // HOTPOT
  ],
};

// aaaBTC logo override — applies to all known contract addresses and the symbol
const AABTC_LOGO = 'https://greenfield-sp.defibit.io/view/aaa/BTC.png';
const AABTC_ADDRESSES = new Set([
  '0x5bcf2be3bf0243655f121c85763a0a063bb8152c', // ETH / ARB
  '0x9cd7ec05f483069353f4e487dabe644306014963', // Base / World
  '0x6f7a6a45b7bb844b6f037681a8d7aae3ca42ce57', // BSC
]);

// wSOL is LiFi's name for native SOL — normalize to SOL for consistent filtering
const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112';

function applyLogoOverrides(tokens: any[]): any[] {
  return tokens.map(t => {
    if (t.address === WSOL_ADDRESS) {
      return { ...t, symbol: 'SOL', name: 'SOL' };
    }
    if (AABTC_ADDRESSES.has(t.address?.toLowerCase()) || AABTC_ADDRESSES.has(t.address) || t.symbol === 'aaaBTC') {
      return { ...t, logoURI: AABTC_LOGO };
    }
    return t;
  });
}

// Stable symbols to keep when falling back to LiFi token list
const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'USDC.e', 'USDCe', 'USDB', 'DAI', 'FRAX', 'LUSD']);
const NATIVE = '0x0000000000000000000000000000000000000000';

// For chains not in DEFAULTS, fetch from LiFi and keep native + stablecoins
async function fetchFallbackTokens(chainId: string): Promise<any[]> {
  try {
    const res = await fetch(`${LIFI}/tokens?chains=${chainId}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const tokens: any[] = data.tokens?.[chainId] || [];
    return tokens.filter(t =>
      t.address === NATIVE ||
      STABLE_SYMBOLS.has(t.symbol)
    );
  } catch {
    return [];
  }
}

async function fetchTokenMeta(chainId: string, address: string) {
  try {
    const res = await fetch(`${LIFI}/token?chain=${chainId}&token=${address}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getListedTokens(chainId: string): Promise<string[]> {
  try {
    const raw = await readFile(join(process.cwd(), 'data', 'listings.json'), 'utf-8');
    const listings: any[] = JSON.parse(raw);
    return listings
      .filter(l => String(l.network) === chainId && l.verified && l.tokenAddress)
      .map(l => l.tokenAddress as string);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const chainId = req.nextUrl.searchParams.get('chainId');
  if (!chainId) return NextResponse.json({ error: 'chainId required' }, { status: 400 });

  const listed = await getListedTokens(chainId);
  const defaults = DEFAULTS[chainId];

  if (defaults) {
    // Known chain: fetch metadata for each default + listed address
    const all = [...new Set([...defaults, ...listed.map(a => a.toLowerCase())])];
    const results = await Promise.all(
      all.map(async (address) => {
        const meta = await fetchTokenMeta(chainId, address);
        if (meta) return meta;
        return {
          address, symbol: address.slice(0, 6), name: address.slice(0, 10) + '…',
          decimals: 18, chainId: Number(chainId), logoURI: null, priceUSD: null,
        };
      })
    );
    return NextResponse.json(applyLogoOverrides(results.filter(Boolean)));
  }

  // Unknown chain: dynamically fetch native + stablecoins from LiFi
  const [fallback, listedMeta] = await Promise.all([
    fetchFallbackTokens(chainId),
    Promise.all(listed.map(a => fetchTokenMeta(chainId, a))),
  ]);

  const seen = new Set(fallback.map((t: any) => t.address?.toLowerCase()));
  const extra = listedMeta.filter(m => m && !seen.has(m.address?.toLowerCase()));

  return NextResponse.json(applyLogoOverrides([...fallback, ...extra].filter(Boolean)));
}
