# Assetux Exchange

A multi-chain token swap platform supporting 25+ EVM networks and Solana. Swap any token across networks, buy crypto with a card, and list new tokens permissionlessly.

---

## Features

- **Cross-chain swaps** — swap tokens across Ethereum, Base, BSC, Arbitrum, Polygon, Optimism, Avalanche, Solana, and 20+ more networks via LiFi routing
- **Any token** — curated defaults plus community-listed tokens; unknown chains fall back to LiFi's full token catalog
- **Buy with card** — Visa/Mastercard onramp via Wert: pay USD, receive any supported token in your wallet
- **List a token** — submit any token for listing by paying a 10,000,000 ASX fee on Solana; verified on-chain automatically
- **Non-custodial** — swaps execute from user wallets directly; no funds held
- **Solana token API** — generic endpoints for any SPL token: on-chain balance per wallet and live market stats (price, 24h volume, liquidity) via DexScreener

---

## Supported Networks & Tokens

| Network | Tokens |
|---|---|
| Ethereum | ETH, USDC, USDT, ASX |
| Base | ETH, USDC, ASX |
| BSC | BNB, USDC, USDT, ASX |
| Arbitrum | ETH, USDC, USDT, ASX |
| Polygon | POL, USDC, USDT |
| Optimism | ETH, USDC, USDT |
| Avalanche | AVAX, USDC, USDT |
| Solana | SOL, USDC, USDT, ASX |
| zkSync Era | ETH, USDC, USDT |
| Linea | ETH, USDC |
| Scroll | ETH, USDC, USDT |
| Blast | ETH, USDB |
| Mantle | MNT, USDC, USDT |
| Gnosis | xDAI, USDC, USDT |
| World Chain | ETH, USDC, ASX |
| Celo | CELO, USDC, USDT |
| Mode | ETH, USDC, USDT |
| Taiko | ETH, USDC, USDT |
| Sonic | S, USDC |
| Sei EVM | SEI, USDC |
| opBNB | BNB, USDC |

Additional tokens can be listed by the community via the `/listing` page.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in the required keys (see [Environment Variables](#environment-variables) below).

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Required

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect project ID | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_WERT_PARTNER_ID` | Wert widget partner ID | [wert.io/partners](https://wert.io/partners) |
| `WERT_API_KEY` | Wert server-side API key (secret) | [wert.io/partners](https://wert.io/partners) |
| `EXCHANGE_WALLET_ADDRESS` | Wallet that receives USDC from Wert (Base chain) | Your wallet |
| `EXCHANGE_WALLET_PRIVATE_KEY` | Private key for executing swaps after fiat onramp (secret) | Your wallet |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the app (used in Wert callbacks) | Your deployment URL |

### RPC Providers

The app uses [NowNodes](https://nownodes.io) for most chains and [Alchemy](https://alchemy.com) for others.

| Variable | Chains |
|---|---|
| `NOWNODES_KEY` | ETH, Base, BSC, Arbitrum, Polygon, Optimism, Avalanche, Gnosis, zkSync, Linea, Scroll, Blast, Mantle, Celo, Ronin, and more |
| `ALCHEMY_KEY` | World Chain, Fraxtal, Apechain, Mode, Taiko, Soneium, Abstract, Unichain, Berachain, Sonic, Sei, Ink, Immutable X, opBNB |
| `SOLANA_RPC_URL` | Solana (server-side) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana (client-side) |

> **Security:** Never prefix wallet private keys or server-side secrets with `NEXT_PUBLIC_`. Those values are exposed to the browser.

---

## Architecture

- **Swap routing** — [LiFi API](https://li.quest/v1) with 3% slippage, registered integrator ID `assetux`
- **EVM wallets** — RainbowKit + Wagmi
- **Solana wallets** — Phantom, Solflare via `@solana/wallet-adapter`
- **Fiat onramp** — Wert webhook triggers backend swap: card payment → USDC on Base → swap to destination token (5% service fee)
- **Token listings** — stored in `/data/listings.json`; on-chain Solana transaction verified before listing is added
- **Solana token API** — dynamic routes at `/api/solana/[address]/stats` and `/api/solana/[address]/balance`; hooks `useSolanaTokenStats(mint)` and `useSolanaTokenBalance(mint, wallet)` in `src/hooks/useAsxStats.ts`

---

## Solana Token API

Two server-side API routes work for **any Solana SPL or Token-2022 mint**:

### `GET /api/solana/:address/stats`

Returns live market data from DexScreener and the treasury balance from Solana RPC.

```
GET /api/solana/cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma/stats
```

Response:
```json
{
  "mint": "cyaiYg...",
  "priceUsd": "0.000123",
  "volume24h": 45200,
  "priceChange24h": 3.7,
  "liquidity": 180000,
  "dex": "raydium",
  "pairAddress": "...",
  "treasuryBalance": "38200000"
}
```

Cached 5 minutes (`s-maxage=300`). Picks the highest-volume Solana pair on DexScreener.

### `GET /api/solana/:address/balance?wallet=:pubkey`

Returns the SPL token balance for a given wallet.

```
GET /api/solana/cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma/balance?wallet=6bvB3PTz48wozyPJeuTB77axexWu9MfUSjBYbQzEgK88
```

Response:
```json
{
  "wallet": "6bvB3P...",
  "mint": "cyaiYg...",
  "balance": "38200000"
}
```

Cached 30 seconds.

### React hooks

```ts
import { useSolanaTokenStats, useSolanaTokenBalance, useAsxStats, useAsxBalance } from '@/hooks/useAsxStats';

// Generic — any mint
const { stats } = useSolanaTokenStats('cyaiYg...');
const { balance } = useSolanaTokenBalance('cyaiYg...', wallet);

// ASX convenience wrappers (mint pre-filled)
const { stats } = useAsxStats();
const { balance } = useAsxBalance(wallet);
```
