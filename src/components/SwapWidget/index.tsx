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
import SwapVertIcon from '@mui/icons-material/SwapVert';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useConnection, usePublicClient, useWalletClient, useSwitchChain, useBalance, useReadContract, useConfig } from 'wagmi';
import { getWalletClient, getPublicClient } from '@wagmi/core';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { useWallet as useSolanaWallet, useConnection as useSolanaConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL, VersionedTransaction, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createSyncNativeInstruction } from '@solana/spl-token';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getChains, getTokens, getQuote, formatAmount, isSolana, type Chain, type Token, type Quote } from '@/lib/lifi';
import { ChainSelectModal } from './ChainSelectModal';
import { TokenSelectModal } from './TokenSelectModal';
import { createWertSession } from '@/lib/wert';

const NATIVE = '0x0000000000000000000000000000000000000000';
const USD_CHAIN_ID = -1;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXCHANGE_WALLET = '0xE6d194fbeF9215976a80D4479A3caFf0caf14BD1';
// Solana system program — valid placeholder address for unauthenticated quote requests
const SOLANA_PLACEHOLDER = '11111111111111111111111111111111';

function useTokenBalance(
  evmAddress: `0x${string}` | undefined,
  token: Token | null,
  chain: Chain | null,
): string | null {
  const isNative = !token || token.address === NATIVE;
  const isEvm = !!chain && !isSolana(chain);
  const enabled = isEvm && !!evmAddress && !!token;

  // Native balance (ETH, BNB, etc.)
  const { data: nativeData } = useBalance({
    address: evmAddress,
    chainId: chain?.id,
    query: { enabled: enabled && isNative, refetchInterval: 60_000 },
  });

  // ERC-20 balance
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

export function SwapWidget({ allowedChainIds, allowedSymbols }: { allowedChainIds?: number[]; allowedSymbols?: string[] } = {}) {
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

  // Both fields are editable; track which one the user last typed in
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const activeInput = useRef<'from' | 'to'>('from');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // USD/Wert mode: pre-verify Base USDC → toToken route
  const [wertQuote, setWertQuote] = useState<Quote | null>(null);
  const [wertQuoteLoading, setWertQuoteLoading] = useState(false);
  const [wertQuoteError, setWertQuoteError] = useState('');
  const [wertUrl, setWertUrl] = useState<string | null>(null);

  const [fromChainOpen, setFromChainOpen] = useState(false);
  const [toChainOpen, setToChainOpen] = useState(false);
  const [fromTokenOpen, setFromTokenOpen] = useState(false);
  const [toTokenOpen, setToTokenOpen] = useState(false);

  const fromAddress = isSolana(fromChain) ? solPublicKey?.toBase58() : evmAddress;
  const toAddress = isSolana(toChain) ? solPublicKey?.toBase58() : evmAddress;
  const isFromConnected = isSolana(fromChain) ? solConnected : evmConnected;
  const isToConnected = isSolana(toChain) ? solConnected : true;

  // Balances
  const evmFromBalance = useTokenBalance(evmAddress, fromToken, fromChain);
  const evmToBalance = useTokenBalance(evmAddress, toToken, toChain);
  const solFromBalance = useSolanaTokenBalance(fromToken, fromChain);
  const solToBalance = useSolanaTokenBalance(toToken, toChain);

  const fromBalance = isSolana(fromChain) ? (solFromBalance !== null ? `${solFromBalance} ${fromToken?.symbol || ''}` : null) : evmFromBalance;
  const toBalance = isSolana(toChain) ? (solToBalance !== null ? `${solToBalance} ${toToken?.symbol || ''}` : null) : evmToBalance;

  useEffect(() => {
    getChains().then(c => {
      const filtered = allowedChainIds?.length ? c.filter(x => allowedChainIds.includes(x.id)) : c;
      setChains(filtered);
      const eth = filtered.find(x => x.id === 1) || filtered.find(x => x.chainType === 'EVM') || null;
      const base = filtered.find(x => x.id === 8453) || null;
      setFromChain(eth);
      setToChain(base || eth);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fromChain || usdMode) return;
    setLoadingTokens(true);
    setFromToken(null);
    getTokens(fromChain.id).then(t => {
      const filtered = allowedSymbols?.length ? t.filter(x => allowedSymbols.includes(x.symbol.toUpperCase())) : t;
      setFromTokens(filtered);
      setFromToken(filtered[0] || null);
    }).catch(console.error).finally(() => setLoadingTokens(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromChain, usdMode]);

  useEffect(() => {
    if (!toChain) return;
    setToToken(null);
    getTokens(toChain.id).then(t => {
      const filtered = allowedSymbols?.length ? t.filter(x => allowedSymbols.includes(x.symbol.toUpperCase())) : t;
      setToTokens(filtered);
      setToToken(filtered[0] || null);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toChain]);

  // Verify Base USDC → toToken route whenever USD mode params change
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
    // 95% of USD amount in USDC (6 decimals on Base)
    const usdcAmount = Math.floor(usd * 0.95 * 1e6).toString();
    const dest = toAddress || (isSolana(toChain) ? SOLANA_PLACEHOLDER : EXCHANGE_WALLET);
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
  }, [usdMode, fromAmount, toToken, toChain, toAddress]);

  const fetchQuote = useCallback(async (side: 'from' | 'to', amount: string) => {
    if (!fromChain || !toChain || !fromToken || !toToken || !amount) return;
    // Use placeholder addresses so quotes load even without a connected wallet.
    // Wallet is validated at swap execution time in handleSwap.
    const quoteFromAddress = fromAddress || EXCHANGE_WALLET;
    const quoteToAddress = toAddress || (isSolana(toChain) ? SOLANA_PLACEHOLDER : EXCHANGE_WALLET);
    setLoadingQuote(true);
    setError('');
    setQuote(null);

    try {
      let resolvedFromAmount: string;

      if (side === 'from') {
        resolvedFromAmount = parseUnits(amount, fromToken.decimals).toString();
      } else {
        // Reverse: user wants `amount` of toToken → estimate how much fromToken needed
        // Step 1: get a reference quote for 1 unit of fromToken
        const refAmount = parseUnits('1', fromToken.decimals).toString();
        const refQuote = await getQuote({
          fromChain: fromChain.id, toChain: toChain.id,
          fromToken: fromToken.address, toToken: toToken.address,
          fromAmount: refAmount, fromAddress: quoteFromAddress, toAddress: quoteToAddress,
        });
        // rate = toAmount per 1 fromToken
        const rate = Number(refQuote.estimate.toAmount) / Number(refAmount);
        if (!rate) throw new Error('Could not determine rate');
        const desiredToRaw = parseUnits(amount, toToken.decimals);
        // add 3% slippage buffer so we don't undershoot
        resolvedFromAmount = ((Number(desiredToRaw) / rate) * 1.03).toFixed(0);
      }

      const q = await getQuote({
        fromChain: fromChain.id, toChain: toChain.id,
        fromToken: fromToken.address, toToken: toToken.address,
        fromAmount: resolvedFromAmount, fromAddress: quoteFromAddress, toAddress: quoteToAddress,
      });
      setQuote(q);

      // Sync the other field from the quote result
      if (side === 'from') {
        setToAmount(formatAmount(q.estimate.toAmount, toToken.decimals));
      } else {
        setFromAmount(formatUnits(BigInt(q.action.fromAmount), fromToken.decimals));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingQuote(false);
    }
  }, [fromChain, toChain, fromToken, toToken, fromAddress, toAddress]);

  const handleSwap = async () => {
    if (!quote?.transactionRequest || !fromToken) return;
    setSwapping(true);
    setError('');
    try {
      const tx = quote.transactionRequest;
      if (isSolana(fromChain)) {
        if (!solPublicKey) throw new Error('Connect Solana wallet');

        // If fromToken is wSOL, ensure the ATA exists and has enough balance.
        // LiFi's transaction assumes the wSOL ATA is already initialized — the SDK
        // handles this automatically; we must do it manually with the raw API.
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

      // Switch chain if needed, then get fresh clients bound to the correct chain
      if (targetChainId && targetChainId !== publicClient?.chain.id) {
        try { await switchChainAsync({ chainId: targetChainId }); } catch {
          throw new Error(`Please switch your wallet to the required network (chain ${targetChainId})`);
        }
      }

      // Always fetch fresh clients after a potential chain switch — hook values are stale closures
      const freshWallet = await getWalletClient(wagmiConfig, { chainId: targetChainId });
      const freshPublic = getPublicClient(wagmiConfig, { chainId: targetChainId });
      if (!freshWallet || !freshPublic) throw new Error('Could not get wallet client for chain ' + targetChainId);

      const isNative = fromToken.address === NATIVE;
      if (!isNative && quote.estimate.approvalAddress) {
        const allowance = await freshPublic.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [evmAddress, quote.estimate.approvalAddress as `0x${string}`],
        });
        if (allowance < BigInt(quote.action.fromAmount)) {
          const ah = await freshWallet.writeContract({
            address: fromToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.estimate.approvalAddress as `0x${string}`, BigInt(quote.action.fromAmount)],
          });
          await freshPublic.waitForTransactionReceipt({ hash: ah });
        }
      }

      const hash = await freshWallet.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      });
      await freshPublic.waitForTransactionReceipt({ hash });
      setSuccess(`Swap complete! Tx: ${hash}`);
      setQuote(null); setFromAmount(''); setToAmount('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSwapping(false);
    }
  };

  const handleCardBuy = async () => {
    const destWallet = isSolana(toChain) ? solPublicKey?.toBase58() : evmAddress;
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
    setQuote(null);
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

  return (
    <>
      {/* Wert payment overlay — iframe avoids popup blockers and origin issues */}
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
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, background: '#0f0c26', border: '1px solid rgba(255,255,255,0.07)', maxWidth: 480, width: '100%' }}>
        <Typography variant="h6" fontWeight={700} mb={2}>Swap</Typography>

        {/* FROM */}
        <Box sx={{ p: 2, borderRadius: 2, background: '#08061a', border: '1px solid rgba(255,255,255,0.06)', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" mb={1.5} display="block">From</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <ButtonBase onClick={() => setFromChainOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 130,
              px: 1.25, py: 0.75, borderRadius: 2,
              background: usdMode ? 'rgba(72,158,255,0.1)' : 'rgba(255,255,255,0.06)',
              border: usdMode ? '1px solid rgba(72,158,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
              '&:hover': { background: 'rgba(255,255,255,0.1)' },
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
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                '&:hover': { background: 'rgba(255,255,255,0.1)' }, opacity: fromChain ? 1 : 0.4,
              }}>
                {fromToken
                  ? <Avatar src={fromToken.logoURI} sx={{ width: 22, height: 22, fontSize: 11 }}>{fromToken.symbol[0]}</Avatar>
                  : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
                <Typography variant="caption" fontWeight={600}>{fromToken?.symbol || 'Token'}</Typography>
                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
              </ButtonBase>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" color="text.secondary">Visa / Mastercard</Typography>
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
              {fromIsSolana && <Chip label="Solana" size="small" sx={{ ml: 1, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.2)', color: '#9945FF' }} />}
            </Typography>
          )}
        </Box>

        {/* Swap arrow */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
          <Box onClick={swapSides} sx={{
            p: 0.75, borderRadius: '50%', background: '#1a1535', border: '2px solid #08061a',
            cursor: usdMode ? 'default' : 'pointer', opacity: usdMode ? 0.4 : 1,
            '&:hover': { background: usdMode ? '#1a1535' : '#2a2050' },
          }}>
            <SwapVertIcon sx={{ color: 'primary.main', display: 'block' }} />
          </Box>
        </Box>

        {/* TO */}
        <Box sx={{ p: 2, borderRadius: 2, background: '#08061a', border: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
          <Typography variant="caption" color="text.secondary" mb={1.5} display="block">To</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <ButtonBase onClick={() => setToChainOpen(true)} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 130,
              px: 1.25, py: 0.75, borderRadius: 2,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              '&:hover': { background: 'rgba(255,255,255,0.1)' },
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
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              '&:hover': { background: 'rgba(255,255,255,0.1)' }, opacity: toChain ? 1 : 0.4,
            }}>
              {toToken
                ? <Avatar src={toToken.logoURI} sx={{ width: 22, height: 22, fontSize: 11 }}>{toToken.symbol[0]}</Avatar>
                : <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />}
              <Typography variant="caption" fontWeight={600}>{toToken?.symbol || 'Token'}</Typography>
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
            </ButtonBase>
          </Box>

          {toIsSolana && !solConnected && (
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

          {!usdMode && (
            <>
              <BalanceRow balance={toBalance} />
              {toIsSolana && solConnected && (
                <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                  To: {solPublicKey?.toBase58().slice(0, 6)}…{solPublicKey?.toBase58().slice(-4)}
                  <Chip label="Solana" size="small" sx={{ ml: 0.5, height: 16, fontSize: 10, background: 'rgba(153,69,255,0.2)', color: '#9945FF' }} />
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* Quote details */}
        {!usdMode && quote && (
          <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.12)', mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Route</Typography>
              <Chip label={quote.toolDetails?.name || quote.tool} size="small" sx={{ height: 20, fontSize: 11 }} />
            </Box>
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
            {!evmConnected && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <ConnectButton label="Connect Wallet to Buy" />
              </Box>
            )}
            <Button variant="contained" fullWidth size="large"
              onClick={handleCardBuy}
              disabled={cardLoading || !fromAmount || parseFloat(fromAmount) < 10 || !toToken || !evmConnected || !wertQuote || wertQuoteLoading}
              sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
              {cardLoading ? <CircularProgress size={22} color="inherit" />
                : wertQuoteLoading ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />Checking route…</>
                : `Pay $${fromAmount || '…'} → get ${toToken?.symbol || '…'}`}
            </Button>
          </>
        ) : !isFromConnected ? (
          <WalletConnectSection />
        ) : !quote ? (
          <Button variant="contained" fullWidth size="large"
            onClick={() => fetchQuote(activeInput.current, activeInput.current === 'from' ? fromAmount : toAmount)}
            disabled={!fromAmount && !toAmount || !fromToken || !toToken || loadingQuote}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
            {loadingQuote ? <CircularProgress size={22} color="inherit" /> : 'GET QUOTE'}
          </Button>
        ) : (
          <Button variant="contained" fullWidth size="large" onClick={handleSwap} disabled={swapping}
            sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
            {swapping ? <CircularProgress size={22} color="inherit" /> : `Swap ${fromToken?.symbol} → ${toToken?.symbol}`}
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
