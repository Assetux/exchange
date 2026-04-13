'use client';
import { useSearchParams } from 'next/navigation';
import { SwapWidget } from './index';

/**
 * Reads URL search params and passes them as init props to SwapWidget.
 *
 * Supported params:
 *   fromChain  — chain name substring or chain id  (e.g. "ETH", "SOL", "1", "56")
 *   toChain    — same
 *   fromToken  — token symbol or address            (e.g. "USDC", "ETH")
 *   toToken    — same
 *   amount     — from-amount to pre-fill            (e.g. "0.5")
 *   toAddress  — recipient address or Web3 Name    (e.g. "alice.bnb", "0x…")
 *
 * Example:
 *   /?fromChain=ETH&toChain=BNB&fromToken=USDC&toToken=BNB&amount=100&toAddress=alice.bnb
 */
export function SwapWidgetWithParams() {
  const params = useSearchParams();

  return (
    <SwapWidget
      initFromChainKey={params.get('fromChain') ?? undefined}
      initToChainKey={params.get('toChain') ?? undefined}
      initFromToken={params.get('fromToken') ?? undefined}
      initToToken={params.get('toToken') ?? undefined}
      initAmount={params.get('amount') ?? undefined}
      initToAddress={params.get('toAddress') ?? undefined}
    />
  );
}
