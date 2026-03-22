export function SEOLanding() {
  return (
    <section style={{ maxWidth: 800, margin: '80px auto 0', padding: '0 24px 80px', color: 'rgba(255,255,255,0.7)' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
        Buy Crypto with USD — Visa &amp; Mastercard Accepted
      </h2>
      <p style={{ lineHeight: 1.8, marginBottom: 24 }}>
        Assetux Exchange lets you <strong>buy crypto with a credit or debit card</strong> instantly.
        Purchase any token on Ethereum, Base, Polygon, Arbitrum, Solana and more — directly with USD using Visa or Mastercard.
        No KYC friction, just fast and secure fiat-to-crypto conversion.
      </p>

      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
        Swap Tokens via Uniswap, Jupiter &amp; Meteora
      </h2>
      <p style={{ lineHeight: 1.8, marginBottom: 24 }}>
        Our swap engine aggregates the best rates across <strong>Uniswap</strong>, <strong>Jupiter</strong>, <strong>Meteora</strong>,
        and dozens of other DEXs. Whether you're swapping ETH for USDC on Ethereum, SOL for memecoins on Solana,
        or bridging assets cross-chain — Assetux finds the fastest and cheapest route automatically.
      </p>

      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
        Buy Crypto with Fiat — No Wallet Required to Start
      </h2>
      <p style={{ lineHeight: 1.8, marginBottom: 24 }}>
        New to crypto? <strong>Buy crypto with fiat</strong> using our simple card payment flow.
        Enter a USD amount, enter your wallet address, and we handle the rest — from card payment to on-chain delivery.
        Powered by Wert for compliant card processing and LI.FI for best-rate swaps.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginTop: 40 }}>
        {[
          { title: 'Multi-chain', desc: 'Ethereum, Base, Polygon, Arbitrum, Optimism, BNB, Avalanche, Solana' },
          { title: 'Best rates', desc: 'Aggregates Uniswap, Jupiter, Meteora, Curve, Balancer and more' },
          { title: 'Card payments', desc: 'Buy crypto with Visa or Mastercard in seconds' },
          { title: 'Non-custodial', desc: 'Your keys, your coins — we never hold your funds' },
        ].map(f => (
          <div key={f.title} style={{ padding: 20, borderRadius: 12, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.1)' }}>
            <h3 style={{ margin: '0 0 8px', color: '#489EFF', fontSize: 16 }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
