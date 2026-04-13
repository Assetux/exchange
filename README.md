# Assetux Exchange

**The unified multi-chain swap gateway** — buy crypto with a card, swap across 30+ networks, and send to Web3 Name domains in one interface.

🔗 [exchange.assetux.com](https://exchange.assetux.com)

---

## What's new — April 2026

### Platform update: futuristic landing, custom recipient address & deep-link routing

We shipped a major batch of improvements to Assetux Exchange. Here's everything that landed.

---

#### 1. New landing design

The page below the swap form has been redesigned from the ground up. Instead of plain paragraphs, you now get:

- **Stats bar** — 30+ networks, 10 000+ tokens, <30 s average swap time, 0% custody risk.
- **Feature grid** — six cards covering multi-chain support, best rates, card payments, non-custodial architecture, Web3 Names, and deep-link routing.
- **How it works** — four numbered steps (choose tokens → enter amount → set recipient → confirm).
- **SEO content** — buy with card, swap via Uniswap/Jupiter/Meteora, send to Web3 Names.

The aesthetic is dark futuristic: gradient text, glass-morphism cards, tight typography.

---

#### 2. Custom recipient address (`toAddress`)

Previously swaps always landed in the connected wallet. Now you can toggle **"Set recipient"** in the swap header and type any destination:

- **Plain EVM address** — validated as `0x…` 40-hex on blur.
- **Plain Solana address** — validated as base58 (32–44 chars).
- **Cross-chain validation** — if you pick BNB as destination chain and paste a Solana address, the widget rejects it immediately with a clear error before you can request a quote.
- **Space ID domains** — type `alice.bnb` or `vitalik.eth` and the widget resolves it to an on-chain address in real time (600 ms debounce). If the domain can't be resolved the swap button stays disabled.

The resolved address flows through the entire quote → swap / card-buy pipeline — LI.FI `toAddress` param and the Wert `toWallet` param are both updated.

---

#### 3. URL deep-link routing

Pre-fill the widget from a URL. All params are optional:

```
/?fromChain=ETH&toChain=BNB&fromToken=USDC&toToken=BNB&amount=100&toAddress=alice.bnb
```

| Param | Example | Notes |
|---|---|---|
| `fromChain` | `ETH`, `SOL`, `56` | Chain name substring or numeric chain ID |
| `toChain` | `BNB`, `8453` | Same |
| `fromToken` | `USDC`, `ETH` | Symbol or token address |
| `toToken` | `SOL`, `BNB` | Symbol or token address |
| `amount` | `0.5`, `100` | From-amount, pre-filled |
| `toAddress` | `0x…`, `alice.bnb` | Recipient — opens the custom-recipient panel automatically |

This enables sharing a pre-configured swap link — useful for token listing announcements, support links, and partner integrations.

---

#### 4. Space ID — connected wallet name display

When your EVM or Solana wallet is connected, Assetux now does a reverse Space ID lookup and shows your Web3 Name next to the address:

```
From: 0xb592…3540  spaceid.bnb
```

Supported via `@web3-name-sdk/core` — checks BNB Chain (`.bnb`), Ethereum (`.eth`), Arbitrum (`.arb`), and more automatically.

---

## Space ID integration

> Assetux Exchange now integrates [Space ID](https://space.id) — bringing human-readable Web3 Name domains to every swap.

### What Space ID provides

Space ID is the leading multi-chain Web3 Name Service. It supports `.bnb` on BNB Chain, `.eth` on Ethereum, `.arb` on Arbitrum, `.sol` on Solana, and 15+ more TLDs. The `@web3-name-sdk/core` SDK resolves names across all supported chains with a single API call.

### How Assetux uses it

**Forward resolution (type a name, get an address):**

```ts
import { createWeb3Name } from '@web3-name-sdk/core';
const w = createWeb3Name();
const address = await w.getAddress('alice.bnb');
// → 0xb5932a6b7d50a966aec6c74c97385412fb497540
```

This runs in the toAddress field — the user types a domain, the widget resolves it and validates the result against the selected destination chain type (EVM vs Solana).

**Reverse resolution (address → name):**

```ts
const name = await w.getDomainName({
  address: evmAddress,
  queryChainIdList: [56, 1, 42161],
});
// → 'spaceid.bnb'
```

This runs on wallet connect — the connected wallet's domain (if any) shows as a chip beside the truncated address.

### Supported TLDs

`.bnb` · `.eth` · `.arb` · `.sol` · `.gno` · `.taiko` · `.mint` · `.sei` · `.lens` · and more.

### Why this matters

Web3 adoption slows down when users have to verify 42-character hex strings. Space ID names make sending and receiving crypto feel like sending an email. Assetux Exchange surfaces Space ID names natively in the swap UI — both in the sender display and as a valid recipient input.

---

## Features

- **Cross-chain swaps** — swap tokens across Ethereum, Base, BSC, Arbitrum, Polygon, Optimism, Avalanche, Solana, and 20+ more networks via LiFi routing
- **Any token** — curated defaults plus community-listed tokens; unknown chains fall back to LiFi's full token catalog
- **Buy with card** — Visa/Mastercard onramp via Wert: pay USD, receive any supported token in your wallet
- **Custom recipient** — send swapped tokens to any address or Web3 Name domain, not just your own wallet
- **URL deep links** — pre-fill chain, token, amount, and recipient via query params
- **Space ID** — resolve `.bnb`, `.eth`, `.arb`, `.sol` domains in the recipient field; see your own domain next to your connected address
- **List a token** — submit any token for listing by paying a 10,000,000 ASX fee on Solana; verified on-chain automatically
- **Non-custodial** — swaps execute from user wallets directly; no funds held

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
