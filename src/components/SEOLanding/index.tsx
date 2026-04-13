'use client';

const features = [
  {
    icon: '⛓',
    title: 'Multi-chain',
    desc: 'Ethereum, Base, Polygon, Arbitrum, Optimism, BNB, Avalanche, Solana — all in one interface.',
  },
  {
    icon: '⚡',
    title: 'Best rates',
    desc: 'Aggregates Uniswap, Jupiter, Meteora, Curve, Balancer and 30+ more DEXs automatically.',
  },
  {
    icon: '💳',
    title: 'Card payments',
    desc: 'Buy crypto with Visa or Mastercard in seconds. USD → any token, no KYC friction.',
  },
  {
    icon: '🔒',
    title: 'Non-custodial',
    desc: 'Your keys, your coins. We never hold your funds — every swap goes directly on-chain.',
  },
  {
    icon: '🏷',
    title: 'Web3 Names',
    desc: 'Send to .bnb, .eth, .arb, .sol domains via Space ID — no need to paste long addresses.',
  },
  {
    icon: '🔗',
    title: 'Deep-link Routes',
    desc: 'Pre-fill any swap via URL params — share exact token pairs and amounts with one link.',
  },
];

const steps = [
  { n: '01', title: 'Choose tokens', desc: 'Select source and destination chains and tokens from 30+ networks.' },
  { n: '02', title: 'Enter amount', desc: 'Type how much you want to send or receive — quotes update in real time.' },
  { n: '03', title: 'Set recipient', desc: 'Send to your wallet, paste any address, or type a Web3 Name domain.' },
  { n: '04', title: 'Confirm & swap', desc: 'One click — we route through the best DEX and bridge automatically.' },
];

const stats = [
  { value: '30+', label: 'Networks' },
  { value: '10k+', label: 'Tokens' },
  { value: '< 30s', label: 'Avg swap time' },
  { value: '0%', label: 'Custody risk' },
];

export function SEOLanding() {
  return (
    <section style={{ color: 'rgba(255,255,255,0.75)', overflow: 'hidden' }}>

      {/* ── STATS BAR ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
        maxWidth: 900, margin: '0 auto 80px', padding: '0 24px',
        gap: 1,
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding: '28px 16px', textAlign: 'center',
            borderTop: '1px solid rgba(72,158,255,0.15)',
            borderBottom: '1px solid rgba(72,158,255,0.15)',
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: -1,
              background: 'linear-gradient(135deg,#489EFF,#9166FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── FEATURES GRID ── */}
      <div style={{ maxWidth: 960, margin: '0 auto 100px', padding: '0 24px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
          color: '#489EFF', marginBottom: 16, textAlign: 'center' }}>Platform capabilities</p>
        <h2 style={{ fontSize: 38, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 1.2 }}>
          Everything you need to swap
        </h2>
        <p style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto 52px', lineHeight: 1.8, fontSize: 16 }}>
          Assetux aggregates the best DEX routes, bridges and fiat on-ramps into a single, elegant interface.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{
              padding: '28px 24px', borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(72,158,255,0.1)',
              backdropFilter: 'blur(12px)',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 18, fontWeight: 800 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{
        maxWidth: 960, margin: '0 auto 100px', padding: '0 24px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#9166FF', marginBottom: 16 }}>
            How it works
          </p>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 20 }}>
            Swap anything in&nbsp;four steps
          </h2>
          <p style={{ lineHeight: 1.8, fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
            No wallets to configure, no DEX to research — just pick your tokens and let Assetux find the optimal route across Uniswap, Jupiter, Meteora, and 30+ liquidity sources.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 40, height: 40, borderRadius: 10,
                background: i % 2 === 0 ? 'rgba(72,158,255,0.12)' : 'rgba(145,102,255,0.12)',
                border: `1px solid ${i % 2 === 0 ? 'rgba(72,158,255,0.25)' : 'rgba(145,102,255,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: i % 2 === 0 ? '#489EFF' : '#9166FF',
                letterSpacing: 0.5,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SEO TEXT ── */}
      <div style={{ maxWidth: 780, margin: '0 auto 80px', padding: '0 24px' }}>
        <div style={{
          padding: '48px 40px', borderRadius: 24,
          background: 'linear-gradient(135deg,rgba(72,158,255,0.05),rgba(145,102,255,0.05))',
          border: '1px solid rgba(72,158,255,0.12)',
        }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 14 }}>
            Buy Crypto with USD — Visa &amp; Mastercard Accepted
          </h2>
          <p style={{ lineHeight: 1.85, marginBottom: 24, fontSize: 15 }}>
            Assetux Exchange lets you <strong style={{ color: '#fff' }}>buy crypto with a credit or debit card</strong> instantly.
            Purchase any token on Ethereum, Base, Polygon, Arbitrum, Solana and more — directly with USD using Visa or Mastercard.
            No KYC friction, just fast and secure fiat-to-crypto conversion powered by Wert.
          </p>

          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 14 }}>
            Swap Tokens via Uniswap, Jupiter &amp; Meteora
          </h2>
          <p style={{ lineHeight: 1.85, marginBottom: 24, fontSize: 15 }}>
            Our swap engine aggregates the best rates across <strong style={{ color: '#fff' }}>Uniswap</strong>, <strong style={{ color: '#fff' }}>Jupiter</strong>, <strong style={{ color: '#fff' }}>Meteora</strong>,
            and dozens of other DEXs. Whether you&apos;re swapping ETH for USDC on Ethereum, SOL for memecoins on Solana,
            or bridging assets cross-chain — Assetux finds the fastest and cheapest route automatically.
          </p>

          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 14 }}>
            Send to Web3 Names — .bnb, .eth, .arb, .sol
          </h2>
          <p style={{ lineHeight: 1.85, fontSize: 15 }}>
            Powered by <strong style={{ color: '#fff' }}>Space ID</strong>, Assetux resolves Web3 Name domains so you can type <em>alice.bnb</em> or <em>vitalik.eth</em> directly in the recipient field instead of a long hex address. If your wallet has a domain, it shows next to your address automatically.
          </p>
        </div>
      </div>

      {/* ── FOOTER TAGLINE ── */}
      <div style={{ textAlign: 'center', padding: '0 24px 100px' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 18px', borderRadius: 100,
          background: 'rgba(72,158,255,0.08)', border: '1px solid rgba(72,158,255,0.15)',
          fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20,
        }}>
          Non-custodial · Open source · Powered by LI.FI &amp; Space ID
        </div>
        <h2 style={{ fontSize: 40, fontWeight: 900, color: '#fff', margin: '0 auto', maxWidth: 600, lineHeight: 1.2,
          background: 'linear-gradient(135deg,#489EFF,#9166FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Swap anything, send anywhere.
        </h2>
      </div>
    </section>
  );
}
