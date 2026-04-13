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

| Variable | Chains |
|---|---|
| `NOWNODES_KEY` | ETH, Base, BSC, Arbitrum, Polygon, Optimism, Avalanche, Gnosis, zkSync, Linea, Scroll, Blast, Mantle, Celo, and more |
| `ALCHEMY_KEY` | World Chain, Mode, Taiko, Sonic, Sei, opBNB, and others |
| `SOLANA_RPC_URL` | Solana (server-side) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana (client-side) |

> **Security:** Never prefix wallet private keys or server-side secrets with `NEXT_PUBLIC_`. Those values are exposed to the browser.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 · React 19 |
| UI | MUI 7 |
| Swap routing | LI.FI REST API |
| Fiat on-ramp | Wert |
| EVM wallet | RainbowKit + wagmi + viem |
| Solana wallet | Solana Wallet Adapter |
| Web3 Names | @web3-name-sdk/core (Space ID) |
| Hosting | PM2 on VPS + Nginx |

- **Swap routing** — [LiFi API](https://li.quest/v1) with 3% slippage, registered integrator ID `assetux`
- **EVM wallets** — RainbowKit + Wagmi
- **Solana wallets** — Phantom, Solflare via `@solana/wallet-adapter`
- **Fiat onramp** — Wert webhook triggers backend swap: card payment → USDC on Base → swap to destination token (5% service fee)
- **Token listings** — stored in `/data/listings.json`; on-chain Solana transaction verified before listing is added

---

## Solana Token API

Two server-side API routes work for any Solana SPL or Token-2022 mint:

### `GET /api/solana/:address/stats`

```
GET /api/solana/cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma/stats
```

Returns live price, 24h volume, liquidity, and treasury balance from DexScreener + Solana RPC. Cached 5 minutes.

### `GET /api/solana/:address/balance?wallet=:pubkey`

```
GET /api/solana/cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma/balance?wallet=6bvB3PTz48wozyPJeuTB77axexWu9MfUSjBYbQzEgK88
```

Returns the SPL token balance for a given wallet. Cached 30 seconds.

---

## Deployment

The server runs `update.sh`:

```bash
git stash && git fetch && git pull && git stash pop && yarn build && pm2 restart exchange
```
