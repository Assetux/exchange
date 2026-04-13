'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useConnection, usePublicClient, useWalletClient, useSwitchChain, useBalance, useReadContract, useConfig } from 'wagmi';
import { getWalletClient, getPublicClient } from '@wagmi/core';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { useWallet as useSolanaWallet, useConnection as useSolanaConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getChains, getTokens, getQuote, formatAmount, isSolana, type Chain, type Token, type Quote } from '@/lib/lifi';
import { getZeroxQuote, toZeroxTokenAddress, zeroxSupportsChain, type ZeroxQuote } from '@/lib/zerox';
import { resolveWeb3Name, getWeb3Name, isWeb3Domain, isValidAddress } from '@/lib/spaceid';
import { ChainSelectModal } from './ChainSelectModal';
import { TokenSelectModal } from './TokenSelectModal';
import { createWertSession } from '@/lib/wert';

const NATIVE = '0x0000000000000000000000000000000000000000';

export interface WidgetTheme {
  pageBg: string;
  cardBg: string;
  inputBg: string;
  fontColor: string;
  borderColor: string;
}

export const DEFAULT_WIDGET_THEME: WidgetTheme = {
  pageBg: '#08061a',
  cardBg: '#0f0c26',
  inputBg: '#08061a',
  fontColor: '#ffffff',
  borderColor: '#ffffff',
};

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const USD_CHAIN_ID = -1;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXCHANGE_WALLET = '0xE6d194fbeF9215976a80D4479A3caFf0caf14BD1';
// Solana system program — valid placeholder address for unauthenticated quote requests
const SOLANA_PLACEHOLDER = '11111111111111111111111111111111';

// ── useTokenBalance (EVM) ────────────────────────────────────────────────────
function useTokenBalance(
  evmAddress: `0x${string}` | undefined,
  token: Token | null,
  chain: Chain | null,
): string | null {
  const isNative = !token || token.address === NATIVE;
  const isEvm = !!chain && !isSolana(chain);
  const enabled = isEvm && !!evmAddress && !!token;

  const { data: nativeData } = useBalance({
    address: evmAddress,
    chainId: chain?.id,
    query: { enabled: enabled && isNative, refetchInterval: 60_000 },
  });

  const { data: erc20Raw } = useReadContract({
    address: token?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: evmAddress ? [evmAddress] : undefined,
    chainId: chain?.id,
    query: { enabled: enabled && !isNative, refetchInterval: 60_000 },
  });

  if (!enabled) return null;

  if (isNative && nativeData) {
    const num = Number(formatUnits(nativeData.value, nativeData.decimals));
    return `${num.toFixed(6)} ${nativeData.symbol}`;
  }
  if (!isNative && erc20Raw !== undefined && token) {
    const num = Number(formatUnits(erc20Raw as bigint, token.decimals));
    return `${num.toFixed(6)} ${token.symbol}`;
  }
  return null;
}

// ── useSolanaTokenBalance ────────────────────────────────────────────────────
function useSolanaTokenBalance(token: Token | null, chain: Chain | null) {
  const { publicKey } = useSolanaWallet();
  const { connection } = useSolanaConnection();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!isSolana(chain) || !publicKey || !token) { setBalance(null); return; }
    let cancelled = false;
    const fetch = async () => {
      try {
        if (token.address === 'So11111111111111111111111111111111111111112' || token.address === NATIVE) {
          const lamports = await connection.getBalance(publicKey);
          if (!cancelled) setBalance((lamports / LAMPORTS_PER_SOL).toFixed(6));
        } else {
          const accounts = await connection.getTokenAccountsByOwner(publicKey, {
            mint: new PublicKey(token.address),
          });
          if (!cancelled) {
            if (accounts.value.length === 0) { setBalance('0'); return; }
            const info = await connection.getTokenAccountBalance(accounts.value[0].pubkey);
            setBalance(info.value.uiAmountString || '0');
          }
        }
      } catch { if (!cancelled) setBalance(null); }
    };
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicKey, token, chain, connection]);

  return balance;
}

// ── useWalletSpaceId — show Space ID domain for the connected wallet ──────────
function useWalletSpaceId(address: string | undefined, chainId?: number): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setName(null); return; }
    let cancelled = false;
    getWeb3Name(address, chainId).then(n => { if (!cancelled) setName(n); });
    return () => { cancelled = true; };
  }, [address, chainId]);

  return name;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface SwapWidgetProps {
  allowedChainIds?: number[];
  allowedSymbols?: string[];
  theme?: Partial<WidgetTheme>;
  // URL-param pre-fills
  initFromChainKey?: string; // e.g. 'ETH', 'SOL', chain id as string
  initToChainKey?: string;
  initFromToken?: string;    // symbol or address
  initToToken?: string;
  initAmount?: string;
  initToAddress?: string;
}

// ── SwapWidget ───────────────────────────────────────────────────────────────
export function SwapWidget({
  allowedChainIds,
  allowedSymbols,
  theme: themeProp,
  initFromChainKey,
  initToChainKey,
  initFromToken,
  initToToken,
  initAmount,
  initToAddress,
}: SwapWidgetProps = {}) {
  const T = { ...DEFAULT_WIDGET_THEME, ...themeProp };
  const { address: evmAddress, isConnected: evmConnected } = useConnection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const wagmiConfig = useConfig();
  const { publicKey: solPublicKey, connected: solConnected, sendTransaction: sendSolanaTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useSolanaConnection();

  const [chains, setChains] = useState<Chain[]>([]);
  const [usdMode, setUsdMode] = useState(false);
  const [fromChain, setFromChain] = useState<Chain | null>(null);
  const [toChain, setToChain] = useState<Chain | null>(null);
  const [fromTokens, setFromTokens] = useState<Token[]>([]);
  const [toTokens, setToTokens] = useState<Token[]>([]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);

  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const activeInput = useRef<'from' | 'to'>('from');

  // ── toAddress feature ──────────────────────────────────────────────────────
  const [toAddressOpen, setToAddressOpen] = useState(false);
  const [toAddressInput, setToAddressInput] = useState('');
  const [toAddressResolved, setToAddressResolved] = useState<string | null>(null); // resolved hex/base58 from domain
  const [toAddressResolving, setToAddressResolving] = useState(false);
  const [toAddressError, setToAddressError] = useState('');
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteSource, setQuoteSource] = useState<'lifi' | '0x'>('lifi');
  const [zeroxQuote, setZeroxQuote] = useState<ZeroxQuote | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [wertQuote, setWertQuote] = useState<Quote | null>(null);
  const [wertQuoteLoading, setWertQuoteLoading] = useState(false);
  const [wertQuoteError, setWertQuoteError] = useState('');
  const [wertUrl, setWertUrl] = useState<string | null>(null);

  const [fromChainOpen, setFromChainOpen] = useState(false);
  const [toChainOpen, setToChainOpen] = useState(false);
  const [fromTokenOpen, setFromTokenOpen] = useState(false);
  const [toTokenOpen, setToTokenOpen] = useState(false);

  // Space ID: show domain name for connected wallets
  const evmChainId = fromChain && !isSolana(fromChain) ? fromChain.id : toChain && !isSolana(toChain) ? toChain.id : undefined;
  const evmSpaceName = useWalletSpaceId(evmAddress, evmChainId);
  const solSpaceName = useWalletSpaceId(solPublicKey?.toBase58(), undefined);

  const fromAddress = isSolana(fromChain) ? solPublicKey?.toBase58() : evmAddress;
  const walletToAddress = isSolana(toChain) ? solPublicKey?.toBase58() : evmAddress;

  // The effective toAddress: manual override takes priority
  const effectiveToAddress = toAddressInput.trim()
    ? (toAddressResolved || (toAddressError ? undefined : undefined))
    : walletToAddress;

  const isFromConnected = isSolana(fromChain) ? solConnected : evmConnected;
  const isToConnected = isSolana(toChain) ? solConnected : true;

  // Balances
  const evmFromBalance = useTokenBalance(evmAddress, fromToken, fromChain);
  const evmToBalance = useTokenBalance(evmAddress, toToken, toChain);
  const solFromBalance = useSolanaTokenBalance(fromToken, fromChain);
  const solToBalance = useSolanaTokenBalance(toToken, toChain);

  const fromBalance = isSolana(fromChain) ? (solFromBalance !== null ? `${solFromBalance} ${fromToken?.symbol || ''}` : null) : evmFromBalance;
  const toBalance = isSolana(toChain) ? (solToBalance !== null ? `${solToBalance} ${toToken?.symbol || ''}` : null) : evmToBalance;

  // ── Init chains ──────────────────────────────────────────────────────────
  const didInit = useRef(false);
  useEffect(() => {
    getChains().then(c => {
      const filtered = allowedChainIds?.length ? c.filter(x => allowedChainIds.includes(x.id)) : c;
      setChains(filtered);

      let from: Chain | null = null;
      let to: Chain | null = null;

      if (initFromChainKey) {
        from = filtered.find(x => x.name.toUpperCase().includes(initFromChainKey.toUpperCase()) || String(x.id) === initFromChainKey) || null;
      }
      if (initToChainKey) {
        to = filtered.find(x => x.name.toUpperCase().includes(initToChainKey.toUpperCase()) || String(x.id) === initToChainKey) || null;
      }

      if (!from) {
        if (filtered.length === 1) from = filtered[0];
        else from = filtered.find(x => x.id === 1) || filtered.find(x => x.chainType === 'EVM') || null;
      }
      if (!to) {
        if (filtered.length === 1) to = filtered[0];
        else to = filtered.find(x => x.id === 8453) || from;
      }
      setFromChain(from);
      setToChain(to);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load from-tokens ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!fromChain || usdMode) return;
    setLoadingTokens(true);
    setFromToken(null);
    getTokens(fromChain.id).then(t => {
      const filtered = allowedSymbols?.length ? t.filter(x => allowedSymbols.includes(x.symbol.toUpperCase())) : t;
      setFromTokens(filtered);
      if (initFromToken && !didInit.current) {
        const match = filtered.find(x => x.symbol.toUpperCase() === initFromToken.toUpperCase() || x.address.toLowerCase() === initFromToken.toLowerCase());
        setFromToken(match || filtered[0] || null);
      } else {
        setFromToken(filtered[0] || null);
      }
    }).catch(console.error).finally(() => setLoadingTokens(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromChain, usdMode]);

  // ── Load to-tokens ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toChain) return;
    setToToken(null);
    getTokens(toChain.id).then(t => {
      const filtered = allowedSymbols?.length ? t.filter(x => allowedSymbols.includes(x.symbol.toUpperCase())) : t;
      setToTokens(filtered);
      if (initToToken && !didInit.current) {
        const match = filtered.find(x => x.symbol.toUpperCase() === initToToken.toUpperCase() || x.address.toLowerCase() === initToToken.toLowerCase());
        setToToken(match || filtered[0] || null);
      } else {
        setToToken(filtered[0] || null);
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toChain]);

  // ── Apply init amount & toAddress once both tokens are loaded ────────────
  useEffect(() => {
    if (didInit.current) return;
    if (!fromToken || !toToken) return;
    if (initAmount) { setFromAmount(initAmount); activeInput.current = 'from'; }
    if (initToAddress) {
      setToAddressOpen(true);
      setToAddressInput(initToAddress);
    }
    didInit.current = true;
  }, [fromToken, toToken, initAmount, initToAddress]);

  // ── toAddress input → validate / resolve Space ID domain ─────────────────
  useEffect(() => {
    const raw = toAddressInput.trim();
    setToAddressError('');
    setToAddressResolved(null);

    if (!raw) return;

    if (resolveTimer.current) clearTimeout(resolveTimer.current);

    if (isWeb3Domain(raw)) {
      // Resolve Space ID domain
      setToAddressResolving(true);
      resolveTimer.current = setTimeout(async () => {
        const addr = await resolveWeb3Name(raw);
        setToAddressResolving(false);
        if (addr) {
          // Validate resolved address against destination chain type
          const solDest = isSolana(toChain);
          if (!isValidAddress(addr, solDest)) {
            setToAddressError(`Resolved address (${addr.slice(0, 8)}…) is not compatible with ${toChain?.name || 'destination chain'}`);
          } else {
            setToAddressResolved(addr);
          }
        } else {
          setToAddressError(`Could not resolve "${raw}" — domain not found or no address set`);
        }
      }, 600);
    } else {
      // Plain address — validate immediately
      const solDest = isSolana(toChain);
      if (!isValidAddress(raw, solDest)) {
        setToAddressError(`Address format is not compatible with ${toChain?.name || 'destination chain'}`);
      }
    }

    return () => { if (resolveTimer.current) clearTimeout(resolveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toAddressInput, toChain]);

  // ── USD/Wert wertQuote ────────────────────────────────────────────────────
  useEffect(() => {
    if (!usdMode || !toToken || !toChain) {
      setWertQuote(null); setWertQuoteError(''); return;
    }
    const usd = parseFloat(fromAmount);
    if (!fromAmount || !usd || usd < 10) {
      setWertQuote(null); setWertQuoteError(''); return;
    }
    let cancelled = false;
    setWertQuoteLoading(true);
    setWertQuote(null);
    setWertQuoteError('');
    const usdcAmount = Math.floor(usd * 0.95 * 1e6).toString();
    const dest = effectiveToAddress || (isSolana(toChain) ? SOLANA_PLACEHOLDER : EXCHANGE_WALLET);
    getQuote({
      fromChain: 8453, toChain: toChain.id,
      fromToken: USDC_BASE, toToken: toToken.address,
      fromAmount: usdcAmount,
      fromAddress: EXCHANGE_WALLET,
      toAddress: dest,
    }).then(q => { if (!cancelled) setWertQuote(q); })
      .catch(e => { if (!cancelled) setWertQuoteError(e.message || 'No route found'); })
      .finally(() => { if (!cancelled) setWertQuoteLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdMode, fromAmount, toToken, toChain, effectiveToAddress]);

  // ── fetchQuote — compares LiFi vs 0x (same-chain EVM), uses best rate ────
  const fetchQuote = useCallback(async (side: 'from' | 'to', amount: string) => {
    if (!fromChain || !toChain || !fromToken || !toToken || !amount) return;
    const quoteFromAddress = fromAddress || EXCHANGE_WALLET;
    const quoteToAddress = effectiveToAddress || (isSolana(toChain) ? SOLANA_PLACEHOLDER : EXCHANGE_WALLET);
    setLoadingQuote(true);
    setError('');
    setQuote(null);
    setZeroxQuote(null);
    setQuoteSource('lifi'); // reset until we know the winner

    // 0x is viable for same-chain EVM swaps only.
    // Use real wallet address as taker if connected; fall back to EXCHANGE_WALLET
    // for quote comparison (same pattern LiFi uses for unauthenticated quotes).
    const canUse0x = !isSolana(fromChain) && !isSolana(toChain)
      && fromChain.id === toChain.id
      && zeroxSupportsChain(fromChain.id);
    const zeroxTaker = fromAddress || EXCHANGE_WALLET;

    try {
      let resolvedFromAmount: string;

      if (side === 'from') {
        resolvedFromAmount = parseUnits(amount, fromToken.decimals).toString();
      } else {
        // Reverse quote: estimate via LiFi ref quote
        const refAmount = parseUnits('1', fromToken.decimals).toString();
        const refQuote = await getQuote({
          fromChain: fromChain.id, toChain: toChain.id,
          fromToken: fromToken.address, toToken: toToken.address,
          fromAmount: refAmount, fromAddress: quoteFromAddress, toAddress: quoteToAddress,
        });
        const rate = Number(refQuote.estimate.toAmount) / Number(refAmount);
        if (!rate) throw new Error('Could not determine rate');
        const desiredToRaw = parseUnits(amount, toToken.decimals);
        resolvedFromAmount = ((Number(desiredToRaw) / rate) * 1.03).toFixed(0);
      }

      // Fire LiFi and (optionally) 0x in parallel
      const [lifiResult, zeroxResult] = await Promise.allSettled([
        getQuote({
          fromChain: fromChain.id, toChain: toChain.id,
          fromToken: fromToken.address, toToken: toToken.address,
          fromAmount: resolvedFromAmount, fromAddress: quoteFromAddress, toAddress: quoteToAddress,
        }),
        canUse0x
          ? getZeroxQuote({
              chainId: fromChain.id,
              sellToken: toZeroxTokenAddress(fromToken.address),
              buyToken: toZeroxTokenAddress(toToken.address),
              sellAmount: resolvedFromAmount,
              taker: zeroxTaker,
              ...(quoteToAddress !== zeroxTaker ? { recipient: quoteToAddress } : {}),
            })
          : Promise.resolve(null),
      ]);

      const lifiQ = lifiResult.status === 'fulfilled' ? lifiResult.value : null;
      const zxQ   = zeroxResult.status === 'fulfilled' ? zeroxResult.value : null;

      if (!lifiQ && !zxQ) throw new Error('No route found');

      // Pick the source that gives more output tokens
      const lifiOut = lifiQ ? BigInt(lifiQ.estimate.toAmount) : 0n;
      const zxOut   = zxQ   ? BigInt(zxQ.buyAmount)           : 0n;

      // ── Rate comparison log ───────────────────────────────────────────────
      console.group(`[Assetux] Quote — ${fromToken?.symbol} → ${toToken?.symbol} (${fromChain?.name})`);
      console.log('Input:   ', amount, fromToken?.symbol, `(${resolvedFromAmount} raw)`);
      if (lifiQ) {
        const lifiFormatted = formatAmount(lifiQ.estimate.toAmount, toToken!.decimals);
        console.log('LI.FI:   ', lifiFormatted, toToken?.symbol,
          `| tool: ${lifiQ.toolDetails?.name || lifiQ.tool}`,
          `| gas: $${lifiQ.estimate.gasCosts?.[0]?.amountUSD ?? '?'}`,
          `| ~${Math.round((lifiQ.estimate.executionDuration || 30) / 60)}m`);
      } else {
        console.log('LI.FI:    no quote');
      }
      if (zxQ) {
        const zxFormatted = formatAmount(zxQ.buyAmount, toToken!.decimals);
        const fills = zxQ.route?.fills?.map(f => f.source).join(', ') || '?';
        console.log('0x:      ', zxFormatted, toToken?.symbol,
          `| via: ${fills}`,
          `| min: ${formatAmount(zxQ.minBuyAmount, toToken!.decimals)}`);
      } else {
        const reason = isSolana(fromChain) || isSolana(toChain) ? 'Solana' : fromChain?.id !== toChain?.id ? 'cross-chain' : `chain ${fromChain?.id} not supported`;
        console.log(`0x:       no quote (${reason})`);
      }
      if (lifiQ && zxQ) {
        const diff = Number(zxOut - lifiOut);
        const pct  = lifiOut > 0n ? ((Number(zxOut) / Number(lifiOut) - 1) * 100).toFixed(3) : 'N/A';
        const winner = zxOut > lifiOut ? '0x' : 'LI.FI';
        console.log(`Winner:   ${winner} (+${pct}% / ${formatAmount(String(diff < 0 ? -diff : diff), toToken!.decimals)} ${toToken?.symbol})`);
      }
      console.groupEnd();
      // ─────────────────────────────────────────────────────────────────────

      if (zxQ && zxOut > lifiOut) {
        // 0x wins
        setZeroxQuote(zxQ);
        setQuote(lifiQ); // keep LiFi for display fallback if needed
        setQuoteSource('0x');
        const outAmount = formatAmount(zxQ.buyAmount, toToken.decimals);
        if (side === 'from') setToAmount(outAmount);
        else setFromAmount(formatUnits(BigInt(resolvedFromAmount), fromToken.decimals));
      } else if (lifiQ) {
        // LiFi wins (or 0x unavailable)
        setQuote(lifiQ);
        setZeroxQuote(zxQ);
        setQuoteSource('lifi');
        if (side === 'from') setToAmount(formatAmount(lifiQ.estimate.toAmount, toToken.decimals));
        else setFromAmount(formatUnits(BigInt(lifiQ.action.fromAmount), fromToken.decimals));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingQuote(false);
    }
  }, [fromChain, toChain, fromToken, toToken, fromAddress, effectiveToAddress]);

  // ── handleSwap0x — execute via 0x allowance-holder router ───────────────
  const handleSwap0x = async () => {
    if (!zeroxQuote || !fromToken || !evmAddress || !fromChain) return;
    setSwapping(true);
    setError('');
    try {
      const chainId = fromChain.id;

      if (chainId !== publicClient?.chain.id) {
        try { await switchChainAsync({ chainId }); } catch {
          throw new Error(`Please switch to ${fromChain.name} in your wallet`);
        }
      }

      const freshWallet = await getWalletClient(wagmiConfig, { chainId });
      const freshPublic = getPublicClient(wagmiConfig, { chainId });
      if (!freshWallet || !freshPublic) throw new Error('Could not get wallet client');

      // ERC-20 approval if needed
      const isNative = fromToken.address === NATIVE;
      if (!isNative && zeroxQuote.allowanceTarget) {
        const allowance = await freshPublic.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [evmAddress, zeroxQuote.allowanceTarget as `0x${string}`],
        });
        const needed = BigInt(zeroxQuote.sellAmount);
        if ((allowance as bigint) < needed) {
          const ah = await freshWallet.writeContract({
            address: fromToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [zeroxQuote.allowanceTarget as `0x${string}`, needed],
          });
          await freshPublic.waitForTransactionReceipt({ hash: ah });
        }
      }

      const tx = zeroxQuote.transaction;
      const hash = await freshWallet.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
      });
      await freshPublic.waitForTransactionReceipt({ hash });
      setSuccess(`Swap complete via 0x! Tx: ${hash}`);
      setQuote(null); setZeroxQuote(null); setFromAmount(''); setToAmount('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSwapping(false);
    }
  };

  // ── handleSwap ────────────────────────────────────────────────────────────
  const handleSwap = async () => {
    if (quoteSource === '0x' && zeroxQuote) {
      await handleSwap0x();
      return;
    }
    if (!fromToken) return;
    if (!quote?.transactionRequest) {
      setError('No transaction data in quote — please click GET QUOTE again to refresh.');
      return;
    }
    setSwapping(true);
    setError('');
    const isCrossChain = fromChain && toChain && fromChain.id !== toChain.id;
    console.group(`[Assetux] Swap — ${fromToken?.symbol} → ${toToken?.symbol} via LI.FI${isCrossChain ? ' (cross-chain)' : ''}`);
    try {
      const tx = quote.transactionRequest;
      console.log('tx.to:', tx.to, '| chainId:', tx.chainId, '| value:', tx.value, '| gasLimit:', tx.gasLimit);
      if (isSolana(fromChain)) {
        if (!solPublicKey) throw new Error('Connect Solana wallet');

        const WSOL = 'So11111111111111111111111111111111111111112';
        if (fromToken?.address === WSOL) {
          const wsolMint = new PublicKey(WSOL);
          const ata = getAssociatedTokenAddressSync(wsolMint, solPublicKey);
          const [ataInfo, { blockhash }] = await Promise.all([
            solanaConnection.getAccountInfo(ata),
            solanaConnection.getLatestBlockhash(),
          ]);

          let currentWsol = BigInt(0);
          if (ataInfo) {
            const bal = await solanaConnection.getTokenAccountBalance(ata);
            currentWsol = BigInt(bal.value.amount);
          }

          const required = BigInt(quote.action.fromAmount);
          const wrapIxs = [];
          if (!ataInfo) {
            wrapIxs.push(createAssociatedTokenAccountInstruction(solPublicKey, ata, solPublicKey, wsolMint));
          }
          if (required > currentWsol) {
            wrapIxs.push(SystemProgram.transfer({ fromPubkey: solPublicKey, toPubkey: ata, lamports: required - currentWsol }));
            wrapIxs.push(createSyncNativeInstruction(ata));
          }
          if (wrapIxs.length > 0) {
            const wrapTx = new Transaction({ recentBlockhash: blockhash, feePayer: solPublicKey });
            wrapTx.add(...wrapIxs);
            const wrapSig = await sendSolanaTransaction(wrapTx, solanaConnection);
            await solanaConnection.confirmTransaction(wrapSig, 'confirmed');
          }
        }

        const rawData = (quote.transactionRequest as any)?.data as string | undefined;
        if (!rawData) throw new Error('No transaction data returned by LiFi');
        const txBytes = Uint8Array.from(atob(rawData.replace(/^0x/, '')), c => c.charCodeAt(0));
        let solTx: VersionedTransaction | Transaction;
        try {
          solTx = VersionedTransaction.deserialize(txBytes);
        } catch {
          solTx = Transaction.from(txBytes);
        }
        const sig = await sendSolanaTransaction(solTx, solanaConnection);
        await solanaConnection.confirmTransaction(sig, 'confirmed');
        setSuccess(`Swapped! ${sig.slice(0, 16)}…`);
        setSwapping(false);
        return;
      }
      if (!evmAddress) throw new Error('Connect EVM wallet');

      const targetChainId = tx.chainId as number;
      console.log('1. target chain:', targetChainId, '| wallet chain:', publicClient?.chain.id);

      if (targetChainId && targetChainId !== publicClient?.chain.id) {
        console.log('2. switching chain to', targetChainId);
        try { await switchChainAsync({ chainId: targetChainId }); } catch {
          throw new Error(`Please switch your wallet to the required network (chain ${targetChainId})`);
        }
      }

      const freshWallet = await getWalletClient(wagmiConfig, { chainId: targetChainId });
      const freshPublic = getPublicClient(wagmiConfig, { chainId: targetChainId });
      if (!freshWallet || !freshPublic) throw new Error('Could not get wallet client for chain ' + targetChainId);
      console.log('3. got wallet client for chain', targetChainId);

      const isNative = fromToken.address === NATIVE;
      if (!isNative && quote.estimate.approvalAddress) {
        console.log('4. checking ERC-20 allowance for', fromToken.symbol, 'spender:', quote.estimate.approvalAddress);
        const allowance = await freshPublic.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [evmAddress, quote.estimate.approvalAddress as `0x${string}`],
        });
        console.log('   allowance:', allowance, '| needed:', quote.action.fromAmount);
        if (allowance < BigInt(quote.action.fromAmount)) {
          console.log('4a. sending approve tx');
          const ah = await freshWallet.writeContract({
            address: fromToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.estimate.approvalAddress as `0x${string}`, BigInt(quote.action.fromAmount)],
          });
          await freshPublic.waitForTransactionReceipt({ hash: ah });
          console.log('4b. approval confirmed:', ah);
        }
      }

      console.log('5. sending swap tx to', tx.to, 'value:', tx.value);
      const hash = await freshWallet.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      });
      console.log('6. tx sent:', hash, '— waiting for receipt…');
      await freshPublic.waitForTransactionReceipt({ hash });
      console.log('7. confirmed!');
      console.groupEnd();
      setSuccess(`Swap complete! Tx: ${hash}`);
      setQuote(null); setFromAmount(''); setToAmount('');
    } catch (e: any) {
      console.error('[Assetux] Swap error:', e);
      console.groupEnd();
      setError(e.message);
    } finally {
      setSwapping(false);
    }
  };

  // ── handleCardBuy ─────────────────────────────────────────────────────────
  const handleCardBuy = async () => {
    const destWallet = effectiveToAddress || (isSolana(toChain) ? solPublicKey?.toBase58() : evmAddress);
    if (!toChain || !toToken || !fromAmount || !destWallet) return;
    setCardLoading(true);
    setError('');
    try {
      const { payment_url } = await createWertSession({
        usdAmount: parseFloat(fromAmount),
        toToken: toToken.address,
        toChain: toChain.id,
        toWallet: destWallet,
      });
      setWertUrl(payment_url);
    } catch (e: any) { setError(e.message); }
    finally { setCardLoading(false); }
  };

  const handleFromChainSelect = (chain: Chain) => {
    if ((chain as any).id === USD_CHAIN_ID) {
      setUsdMode(true); setQuote(null); setFromAmount(''); setToAmount('');
    } else {
      setUsdMode(false); setFromChain(chain); setFromToken(null); setQuote(null);
    }
  };

  const swapSides = () => {
    if (usdMode) return;
    setFromChain(toChain); setToChain(fromChain);
    setFromToken(toToken); setToToken(fromToken);
    setFromTokens(toTokens); setToTokens(fromTokens);
    setFromAmount(toAmount); setToAmount(fromAmount);
    setQuote(null); setZeroxQuote(null); setQuoteSource('lifi');
    // Clear custom toAddress if set — sides are flipped
    setToAddressInput('');
    setToAddressResolved(null);
    setToAddressError('');
  };

  const setMax = () => {
    if (!fromBalance || !fromToken) return;
    const num = fromBalance.split(' ')[0];
    activeInput.current = 'from';
    setFromAmount(num);
    setToAmount('');
    setQuote(null);
  };

  const fromIsSolana = isSolana(fromChain);
  const toIsSolana = isSolana(toChain);
  const usdEstimate = fromAmount && parseFloat(fromAmount) > 0
    ? `~$${(parseFloat(fromAmount) * 0.95).toFixed(2)} of ${toToken?.symbol || 'tokens'}`
    : '';

  const WalletConnectSection = () => (
    !fromIsSolana
      ? <Box sx={{ display: 'flex', justifyContent: 'center' }}><ConnectButton label="Connect Wallet" /></Box>
      : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Connect Solana wallet to swap</Typography>
          <WalletMultiButton style={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', borderRadius: 12, height: 44 }} />
        </Box>
  );

  const BalanceRow = ({ balance, onMax }: { balance: string | null; onMax?: () => void }) => {
    if (!balance) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{balance}</Typography>
        </Box>
        {onMax && (
          <Chip label="MAX" size="small" onClick={onMax}
            sx={{ height: 18, fontSize: 10, cursor: 'pointer', background: 'rgba(72,158,255,0.15)', color: 'primary.main',
              '&:hover': { background: 'rgba(72,158,255,0.3)' } }} />
        )}
      </Box>
    );
  };

  // Whether the custom toAddress input is valid (or empty = use wallet)
  const toAddressOk = !toAddressInput.trim() ||
    (toAddressResolved !== null) ||
    (!toAddressError && !isWeb3Domain(toAddressInput.trim()) && isValidAddress(toAddressInput.trim(), toIsSolana));

  return (
    <>
      {/* Wert payment overlay */}
      {wertUrl && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ position: 'relative', width: { xs: '100%', sm: 480 }, height: { xs: '100%', sm: 700 }, maxHeight: '100vh', borderRadius: { xs: 0, sm: 3 }, overflow: 'hidden', background: '#fff' }}>
            <Button onClick={() => setWertUrl(null)} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, minWidth: 0, color: '#000', background: 'rgba(255,255,255,0.9)', borderRadius: '50%', p: 0.5 }}>✕</Button>
            <iframe
              src={wertUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="camera *; microphone *; payment *; clipboard-write"
            />
          </Box>
        </Box>
      )}

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, background: T.cardBg, border: `1px solid ${withAlpha(T.borderColor, 0.1)}`, maxWidth: 480, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: T.fontColor }}>Swap</Typography>
          {/* Recipient address toggle */}
          <Tooltip title={toAddressOpen ? 'Use my wallet address' : 'Send to a different address or Web3 Name'}>
            <Chip
              icon={<EditIcon sx={{ fontSize: '14px !important' }} />}
              label={toAddressOpen ? (toAddressInput ? 'Custom recipient' : 'Set recipient') : 'Set recipient'}
              size="small"
              onClick={() => { setToAddressOpen(v => !v); if (toAddressOpen) { setToAddressInput(''); setToAddressResolved(null); setToAddressError(''); } }}
              sx={{
                height: 26, fontSize: 11, cursor: 'pointer',
                background: toAddressOpen ? 'rgba(72,158,255,0.15)' : withAlpha(T.fontColor, 0.06),
                color: toAddressOpen ? 'primary.main' : 'text.secondary',
                border: toAddressOpen ? '1px solid rgba(72,158,255,0.3)' : `1px solid ${withAlpha(T.borderColor, 0.1)}`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          </Tooltip>
        </Box>

        {/* ── FROM ── */}
        <Box sx={{ p: 2, borderRadius: 2, background: T.inputBg, border: `1px solid ${withAlpha(T.borderColor, 0.08)}`, mb: 1 }}>
          <Typography variant="caption" mb={1.5} display="block" sx={{ color: withAlpha(T.fontColor, 0.5) }}>From</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <ButtonBase onClick={() => setFromChainOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 130,
              px: 1.25, py: 0.75, borderRadius: 2,
              background: usdMode ? 'rgba(72,158,255,0.1)' : withAlpha(T.fontColor, 0.06),
              border: usdMode ? '1px solid rgba(72,158,255,0.3)' : `1px solid ${withAlpha(T.borderColor, 0.12)}`,
              '&:hover': { background: withAlpha(T.fontColor, 0.12) },
            }}>
              {usdMode
                ? <><CreditCardIcon sx={{ fontSize: 20, color: 'primary.main' }} /><Typography variant="caption" fontWeight={700} color="primary.main">USD</Typography></>
                : fromChain
                  ? <><Avatar src={fromChain.logoURI} sx={{ width: 22, height: 22 }}>{fromChain.name[0]}</Avatar>
                    <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 70 }}>{fromChain.name}</Typography></>
                  : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
            </ButtonBase>

            {!usdMode ? (
              <ButtonBase onClick={() => fromChain && setFromTokenOpen(true)} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, flex: 1,
                px: 1.25, py: 0.75, borderRadius: 2,
                background: withAlpha(T.fontColor, 0.06), border: `1px solid ${withAlpha(T.borderColor, 0.12)}`,
                '&:hover': { background: withAlpha(T.fontColor, 0.12) }, opacity: fromChain ? 1 : 0.4,
              }}>
                {fromToken
                  ? <Avatar src={fromToken.logoURI} sx={{ width: 22, height: 22, fontSize: 11 }}>{fromToken.symbol[0]}</Avatar>
                  : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
                <Typography variant="caption" fontWeight={600}>{fromToken?.symbol || 'Token'}</Typography>
                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
              </ButtonBase>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 2, background: withAlpha(T.fontColor, 0.03), border: `1px solid ${withAlpha(T.borderColor, 0.08)}` }}>
                <Typography variant="caption" sx={{ color: withAlpha(T.fontColor, 0.5) }}>Visa / Mastercard</Typography>
              </Box>
            )}
          </Box>

          <TextField fullWidth size="small" type="number"
            placeholder={usdMode ? 'Amount in USD (min $10)' : '0.0'}
            value={fromAmount}
            onChange={e => {
              activeInput.current = 'from';
              setFromAmount(e.target.value);
              setToAmount('');
              setQuote(null);
            }}
            onBlur={() => { if (!usdMode && fromAmount) fetchQuote('from', fromAmount); }}
            slotProps={usdMode ? { input: { startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary', fontWeight: 700 }}>$</Typography> } } : undefined}
            sx={{ '& .MuiOutlinedInput-root': { background: 'transparent', fontSize: 20, fontWeight: 700 } }}
          />
          {!usdMode && <BalanceRow balance={fromBalance} onMax={setMax} />}
          {!usdMode && fromAddress && (
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
              From: {fromAddress.slice(0, 6)}…{fromAddress.slice(-4)}
              {evmSpaceName && !fromIsSolana && (
                <Chip label={evmSpaceName} size="small" sx={{ ml: 1, height: 16, fontSize: 10, background: 'rgba(72,158,255,0.15)', color: 'primary.main' }} />
              )}
              {solSpaceName && fromIsSolana && (
                <Chip label={solSpaceName} size="small" sx={{ ml: 1, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.15)', color: '#9945FF' }} />
              )}
              {fromIsSolana && <Chip label="Solana" size="small" sx={{ ml: 1, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.2)', color: '#9945FF' }} />}
            </Typography>
          )}
        </Box>

        {/* Swap arrow */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
          <Box onClick={swapSides} sx={{
            p: 0.75, borderRadius: '50%', background: withAlpha(T.fontColor, 0.08), border: `2px solid ${T.inputBg}`,
            cursor: usdMode ? 'default' : 'pointer', opacity: usdMode ? 0.4 : 1,
            '&:hover': { background: usdMode ? withAlpha(T.fontColor, 0.08) : withAlpha(T.fontColor, 0.15) },
          }}>
            <SwapVertIcon sx={{ color: 'primary.main', display: 'block' }} />
          </Box>
        </Box>

        {/* ── TO ── */}
        <Box sx={{ p: 2, borderRadius: 2, background: T.inputBg, border: `1px solid ${withAlpha(T.borderColor, 0.08)}`, mb: toAddressOpen ? 1 : 2 }}>
          <Typography variant="caption" mb={1.5} display="block" sx={{ color: withAlpha(T.fontColor, 0.5) }}>To</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <ButtonBase onClick={() => setToChainOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 130,
              px: 1.25, py: 0.75, borderRadius: 2,
              background: withAlpha(T.fontColor, 0.06), border: `1px solid ${withAlpha(T.borderColor, 0.12)}`,
              '&:hover': { background: withAlpha(T.fontColor, 0.12) },
            }}>
              {toChain
                ? <><Avatar src={toChain.logoURI} sx={{ width: 22, height: 22 }}>{toChain.name[0]}</Avatar>
                  <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 70 }}>{toChain.name}</Typography></>
                : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
            </ButtonBase>

            <ButtonBase onClick={() => toChain && setToTokenOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, flex: 1,
              px: 1.25, py: 0.75, borderRadius: 2,
              background: withAlpha(T.fontColor, 0.06), border: `1px solid ${withAlpha(T.borderColor, 0.12)}`,
              '&:hover': { background: withAlpha(T.fontColor, 0.12) }, opacity: toChain ? 1 : 0.4,
            }}>
              {toToken
                ? <Avatar src={toToken.logoURI} sx={{ width: 22, height: 22, fontSize: 11 }}>{toToken.symbol[0]}</Avatar>
                : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
              <Typography variant="caption" fontWeight={600}>{toToken?.symbol || 'Token'}</Typography>
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
            </ButtonBase>
          </Box>

          {toIsSolana && !solConnected && !toAddressOpen && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="warning.main" display="block" mb={0.5}>
                Connect Solana wallet to receive tokens
              </Typography>
              <WalletMultiButton style={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', borderRadius: 8, height: 36, fontSize: 13 }} />
            </Box>
          )}

          {usdMode ? (
            wertQuoteLoading
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Checking route…</Typography>
                </Box>
              : wertQuote
                ? <Typography variant="h5" fontWeight={800} color="primary.main">
                    ~{formatAmount(wertQuote.estimate.toAmount, toToken?.decimals ?? 6)} {toToken?.symbol}
                  </Typography>
                : <Typography variant="body1" color="text.secondary" fontWeight={700}>—</Typography>
          ) : (
            <TextField fullWidth size="small" type="number"
              placeholder="0.0"
              value={toAmount}
              onChange={e => {
                activeInput.current = 'to';
                setToAmount(e.target.value);
                setFromAmount('');
                setQuote(null);
              }}
              onBlur={() => { if (toAmount) fetchQuote('to', toAmount); }}
              sx={{ '& .MuiOutlinedInput-root': { background: 'transparent', fontSize: 20, fontWeight: 700,
                color: loadingQuote ? 'text.secondary' : 'primary.main' } }}
            />
          )}

          {!usdMode && !toAddressOpen && (
            <>
              <BalanceRow balance={toBalance} />
              {toIsSolana && solConnected && (
                <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                  To: {solPublicKey?.toBase58().slice(0, 6)}…{solPublicKey?.toBase58().slice(-4)}
                  {solSpaceName && (
                    <Chip label={solSpaceName} size="small" sx={{ ml: 0.5, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.15)', color: '#9945FF' }} />
                  )}
                  <Chip label="Solana" size="small" sx={{ ml: 0.5, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.2)', color: '#9945FF' }} />
                </Typography>
              )}
              {!toIsSolana && evmAddress && (
                <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                  To: {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
                  {evmSpaceName && (
                    <Chip label={evmSpaceName} size="small" sx={{ ml: 0.5, height: 16, fontSize: 10, background: 'rgba(72,158,255,0.15)', color: 'primary.main' }} />
                  )}
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* ── CUSTOM RECIPIENT ADDRESS ── */}
        <Collapse in={toAddressOpen}>
          <Box sx={{ p: 2, borderRadius: 2, background: T.inputBg, border: `1px solid rgba(72,158,255,0.2)`, mb: 2 }}>
            <Typography variant="caption" mb={1} display="block" sx={{ color: 'rgba(72,158,255,0.8)', fontWeight: 600 }}>
              Recipient address
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder={toIsSolana ? 'Solana address or .sol domain' : 'EVM address, .bnb, .eth, .arb domain…'}
              value={toAddressInput}
              onChange={e => { setToAddressInput(e.target.value); setQuote(null); }}
              error={!!toAddressError}
              helperText={toAddressError || undefined}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {toAddressResolving && <CircularProgress size={16} />}
                      {!toAddressResolving && toAddressResolved && <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />}
                      {!toAddressResolving && toAddressError && <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />}
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { background: 'transparent', fontSize: 14 } }}
            />
            {toAddressResolved && (
              <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mt: 0.75 }}>
                ✓ Resolved: {toAddressResolved.slice(0, 10)}…{toAddressResolved.slice(-6)}
              </Typography>
            )}
            {!toAddressInput && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                Supports Web3 Name domains via Space ID (.bnb, .eth, .arb, .sol…)
              </Typography>
            )}
          </Box>
        </Collapse>

        {/* Quote details */}
        {!usdMode && (quote || zeroxQuote) && (
          <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.12)', mb: 2 }}>
            {/* Source badge */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Best route</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Chip
                  label={
                    quoteSource === '0x'
                      ? '0x Protocol ✓'
                      : fromChain && toChain && fromChain.id !== toChain.id
                        ? `LI.FI ✓ (cross-chain)`
                        : (quote?.toolDetails?.name || quote?.tool || 'LI.FI ✓')
                  }
                  size="small"
                  sx={{ height: 20, fontSize: 11,
                    background: quoteSource === '0x' ? 'rgba(0,175,255,0.15)' : 'rgba(72,158,255,0.15)',
                    color: quoteSource === '0x' ? '#00AFFF' : 'primary.main' }}
                />
              </Box>
            </Box>

            {/* Both quotes side-by-side when available */}
            {quote && zeroxQuote && (
              <Box sx={{ display: 'flex', gap: 1, mb: 1, p: 1, borderRadius: 1.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block">LI.FI</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: quoteSource === 'lifi' ? 'primary.main' : 'text.secondary' }}>
                    {formatAmount(quote.estimate.toAmount, toToken?.decimals ?? 6)} {toToken?.symbol}
                    {quoteSource === 'lifi' && <span style={{ marginLeft: 4 }}>★</span>}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block">0x</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: quoteSource === '0x' ? '#00AFFF' : 'text.secondary' }}>
                    {formatAmount(zeroxQuote.buyAmount, toToken?.decimals ?? 6)} {toToken?.symbol}
                    {quoteSource === '0x' && <span style={{ marginLeft: 4 }}>★</span>}
                  </Typography>
                </Box>
              </Box>
            )}

            {quoteSource === '0x' && zeroxQuote ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Min received</Typography>
                  <Typography variant="caption">
                    {toToken ? `${formatAmount(zeroxQuote.minBuyAmount, toToken.decimals)} ${toToken.symbol}` : '—'}
                  </Typography>
                </Box>
                {zeroxQuote.route?.fills?.[0] && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Via</Typography>
                    <Typography variant="caption">{zeroxQuote.route.fills[0].source}</Typography>
                  </Box>
                )}
              </>
            ) : quote ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Est. time</Typography>
                  <Typography variant="caption">{Math.round((quote.estimate.executionDuration || 30) / 60)}m</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Gas</Typography>
                  <Typography variant="caption">${quote.estimate.gasCosts?.[0]?.amountUSD || '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Min received</Typography>
                  <Typography variant="caption">
                    {toToken ? `${formatAmount(quote.estimate.toAmountMin, toToken.decimals)} ${toToken.symbol}` : '—'}
                  </Typography>
                </Box>
              </>
            ) : null}

            {effectiveToAddress && effectiveToAddress !== walletToAddress && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Sending to</Typography>
                <Typography variant="caption" sx={{ color: 'primary.main' }}>
                  {effectiveToAddress.slice(0, 8)}…{effectiveToAddress.slice(-6)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {usdMode && (
          <Box sx={{ mb: 2 }}>
            {wertQuote && (
              <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.12)', mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Route</Typography>
                  <Chip label={wertQuote.toolDetails?.name || wertQuote.tool} size="small" sx={{ height: 20, fontSize: 11 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Min received</Typography>
                  <Typography variant="caption">
                    {toToken ? `${formatAmount(wertQuote.estimate.toAmountMin, toToken.decimals)} ${toToken.symbol}` : '—'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Est. time</Typography>
                  <Typography variant="caption">{Math.round((wertQuote.estimate.executionDuration || 30) / 60)}m</Typography>
                </Box>
              </Box>
            )}
            {wertQuoteError && (
              <Alert severity="warning" sx={{ mb: 1, fontSize: 12 }}>
                No swap route found for this token. Make sure it has liquidity on a{' '}
                <a href="https://li.fi/ecosystem/" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                  LI.FI-supported DEX
                </a>.
              </Alert>
            )}
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.12)' }}>
              <Typography variant="caption" color="text.secondary">
                You pay USD → we receive USDC on BASE → swap via LI.FI to{' '}
                <strong>{toToken?.symbol || '…'}</strong> on <strong>{toChain?.name || '…'}</strong> → sent to your wallet.
                Rate: market price −5% · Min $10
              </Typography>
            </Box>
          </Box>
        )}

        {loadingQuote && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Finding best route…</Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2, fontSize: 12, wordBreak: 'break-all' }}>{success}</Alert>}

        {/* CTA */}
        {usdMode ? (
          <>
            {!( toIsSolana ? solConnected : evmConnected) && !toAddressOpen && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                {toIsSolana
                  ? <WalletMultiButton style={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', borderRadius: 12, height: 44 }} />
                  : <ConnectButton label="Connect Wallet to Buy" />}
              </Box>
            )}
            <Button variant="contained" fullWidth size="large"
              onClick={handleCardBuy}
              disabled={
                cardLoading || !fromAmount || parseFloat(fromAmount) < 10 || !toToken ||
                (!toAddressOpen && !(toIsSolana ? solConnected : evmConnected)) ||
                (toAddressOpen && (!toAddressInput.trim() || !toAddressOk || toAddressResolving)) ||
                !wertQuote || wertQuoteLoading
              }
              sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
              {cardLoading ? <CircularProgress size={22} color="inherit" />
                : wertQuoteLoading ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />Checking route…</>
                : `Pay $${fromAmount || '…'} → get ${toToken?.symbol || '…'}`}
            </Button>
          </>
        ) : !isFromConnected ? (
          <WalletConnectSection />
        ) : !(quote || zeroxQuote) ? (
          <Button variant="contained" fullWidth size="large"
            onClick={() => fetchQuote(activeInput.current, activeInput.current === 'from' ? fromAmount : toAmount)}
            disabled={!fromAmount && !toAmount || !fromToken || !toToken || loadingQuote || !toAddressOk || toAddressResolving}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
            {loadingQuote ? <CircularProgress size={22} color="inherit" /> : 'GET QUOTE'}
          </Button>
        ) : (
          <Button variant="contained" fullWidth size="large" onClick={handleSwap}
            disabled={swapping || !toAddressOk || toAddressResolving}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 700,
              background: quoteSource === '0x'
                ? 'linear-gradient(135deg,#00AFFF,#0070CC)'
                : undefined }}>
            {swapping
              ? <CircularProgress size={22} color="inherit" />
              : `Swap ${fromToken?.symbol} → ${toToken?.symbol} via ${quoteSource === '0x' ? '0x' : 'LI.FI'}`}
          </Button>
        )}
      </Paper>

      <ChainSelectModal open={fromChainOpen} onClose={() => setFromChainOpen(false)}
        chains={chains} onSelect={handleFromChainSelect} title="From network" showUSD />
      <ChainSelectModal open={toChainOpen} onClose={() => setToChainOpen(false)}
        chains={chains} onSelect={c => { setToChain(c); setToToken(null); setQuote(null); }} title="To network" />
      <TokenSelectModal open={fromTokenOpen} onClose={() => setFromTokenOpen(false)}
        tokens={fromTokens} onSelect={t => { setFromToken(t); setQuote(null); }}
        loading={loadingTokens} title="From token" />
      <TokenSelectModal open={toTokenOpen} onClose={() => setToTokenOpen(false)}
        tokens={toTokens} onSelect={t => { setToToken(t); setQuote(null); }}
        title="To token" />
    </>
  );
}
