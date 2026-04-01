'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Connection, PublicKey, Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useWallet, useConnection as useSolanaConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAsxStats, useAsxBalance } from '@/hooks/useAsxStats';
import { createPublicClient, http, erc20Abi, isAddress, defineChain, type Chain } from 'viem';

const LIFI_BASE = 'https://li.quest/v1';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const EXCHANGE_WALLET = '0xE6d194fbeF9215976a80D4479A3caFf0caf14BD1';

const ASX_MINT = new PublicKey('cyaiYgJhfSuFY7yz8iNeBwsD1XNDzZXVBEGubuuxdma');
const TREASURY = new PublicKey('6bvB3PTz48wozyPJeuTB77axexWu9MfUSjBYbQzEgK88');
const LISTING_FEE = 10_000_000;
const ASX_DECIMALS = 9;
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const NN_KEY = '31299d58-8732-45f2-8c4d-36754e81a8f4';
const AL_KEY = 'AG7k40zCqOp_DTsQL1m7P';
const nn = (s: string) => `https://${s}.nownodes.io/${NN_KEY}`;
const al = (s: string) => `https://${s}.g.alchemy.com/v2/${AL_KEY}`;

const mk = (id: number, name: string, rpc: string, symbol = 'ETH'): Chain =>
  defineChain({ id, name, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });

interface Network { id: number; name: string; rpc: string; chain: Chain | null }

// chain: null = Solana (handled separately, no viem client needed)
// Skipped (no reliable NowNodes/Alchemy RPC): Hyperliquid, HyperEVM, Monad, Lisk, Metis,
//   Flare, Vana, Gravity, Swell, Corn, Lens, Morph, Boba, Telo, Etherlink, Hemi,
//   MegaETH, Sophon, Superposition, BOB, Flow, Katana, Viction, Plasma, Stable, Plume
const NETWORKS: Network[] = [
  { id: 1,        name: 'Ethereum',       rpc: nn('eth'),                   chain: mk(1,        'Ethereum',         nn('eth')) },
  { id: 101,      name: 'Solana',         rpc: nn('sol'),                   chain: null },
  { id: 42161,    name: 'Arbitrum',       rpc: nn('arb'),                   chain: mk(42161,    'Arbitrum',         nn('arb')) },
  { id: 8453,     name: 'Base',           rpc: nn('base'),                  chain: mk(8453,     'Base',             nn('base')) },
  { id: 56,       name: 'BNB Chain',      rpc: nn('bsc'),                   chain: mk(56,       'BNB Chain',        nn('bsc'),    'BNB') },
  { id: 10,       name: 'Optimism',       rpc: nn('op'),                    chain: mk(10,       'Optimism',         nn('op')) },
  { id: 137,      name: 'Polygon',        rpc: nn('matic'),                 chain: mk(137,      'Polygon',          nn('matic'),  'POL') },
  { id: 43114,    name: 'Avalanche',      rpc: nn('avax'),                  chain: mk(43114,    'Avalanche',        nn('avax'),   'AVAX') },
  { id: 100,      name: 'Gnosis',         rpc: nn('gno'),                   chain: mk(100,      'Gnosis',           nn('gno'),    'xDAI') },
  { id: 1284,     name: 'Moonbeam',       rpc: nn('glmr'),                  chain: mk(1284,     'Moonbeam',         nn('glmr'),   'GLMR') },
  { id: 122,      name: 'Fuse',           rpc: nn('fuse'),                  chain: mk(122,      'Fuse',             nn('fuse'),   'FUSE') },
  { id: 25,       name: 'Cronos',         rpc: nn('cro'),                   chain: mk(25,       'Cronos',           nn('cro'),    'CRO') },
  { id: 30,       name: 'Rootstock',      rpc: nn('rsk'),                   chain: mk(30,       'Rootstock',        nn('rsk'),    'RBTC') },
  { id: 324,      name: 'zkSync',         rpc: nn('zksync'),                chain: mk(324,      'zkSync Era',       nn('zksync')) },
  { id: 5000,     name: 'Mantle',         rpc: nn('mantle'),                chain: mk(5000,     'Mantle',           nn('mantle'), 'MNT') },
  { id: 59144,    name: 'Linea',          rpc: nn('linea'),                 chain: mk(59144,    'Linea',            nn('linea')) },
  { id: 534352,   name: 'Scroll',         rpc: nn('scroll'),                chain: mk(534352,   'Scroll',           nn('scroll')) },
  { id: 81457,    name: 'Blast',          rpc: nn('blast'),                 chain: mk(81457,    'Blast',            nn('blast')) },
  { id: 50,       name: 'XDC',            rpc: nn('xdc'),                   chain: mk(50,       'XDC',              nn('xdc'),    'XDC') },
  { id: 42220,    name: 'Celo',           rpc: nn('celo'),                  chain: mk(42220,    'Celo',             nn('celo'),   'CELO') },
  { id: 8217,     name: 'Kaia',           rpc: nn('klay'),                  chain: mk(8217,     'Kaia',             nn('klay'),   'KAIA') },
  { id: 2020,     name: 'Ronin',          rpc: nn('ron'),                   chain: mk(2020,     'Ronin',            nn('ron'),    'RON') },
  { id: 480,      name: 'World Chain',    rpc: al('worldchain-mainnet'),    chain: mk(480,      'World Chain',      al('worldchain-mainnet')) },
  { id: 252,      name: 'Fraxtal',        rpc: al('frax-mainnet'),          chain: mk(252,      'Fraxtal',          al('frax-mainnet'),   'frxETH') },
  { id: 33139,    name: 'ApeChain',       rpc: al('apechain-mainnet'),      chain: mk(33139,    'ApeChain',         al('apechain-mainnet'), 'APE') },
  { id: 34443,    name: 'Mode',           rpc: al('mode-mainnet'),          chain: mk(34443,    'Mode',             al('mode-mainnet')) },
  { id: 167000,   name: 'Taiko',          rpc: al('taiko-mainnet'),         chain: mk(167000,   'Taiko',            al('taiko-mainnet')) },
  { id: 1868,     name: 'Soneium',        rpc: al('soneium-mainnet'),       chain: mk(1868,     'Soneium',          al('soneium-mainnet')) },
  { id: 2741,     name: 'Abstract',       rpc: al('abstract-mainnet'),      chain: mk(2741,     'Abstract',         al('abstract-mainnet')) },
  { id: 130,      name: 'Unichain',       rpc: al('unichain-mainnet'),      chain: mk(130,      'Unichain',         al('unichain-mainnet')) },
  { id: 80094,    name: 'Berachain',      rpc: al('berachain-mainnet'),     chain: mk(80094,    'Berachain',        al('berachain-mainnet'), 'BERA') },
  { id: 146,      name: 'Sonic',          rpc: al('sonic-mainnet'),         chain: mk(146,      'Sonic',            al('sonic-mainnet'),  'S') },
  { id: 1329,     name: 'Sei',            rpc: al('sei-mainnet'),           chain: mk(1329,     'Sei',              al('sei-mainnet'),    'SEI') },
  { id: 57073,    name: 'Ink',            rpc: al('ink-mainnet'),           chain: mk(57073,    'Ink',              al('ink-mainnet')) },
  { id: 13371,    name: 'IMX',            rpc: al('immutable-zkevm'),       chain: mk(13371,    'Immutable zkEVM',  al('immutable-zkevm')) },
  { id: 204,      name: 'opBNB',          rpc: al('opbnb-mainnet'),         chain: mk(204,      'opBNB',            al('opbnb-mainnet'),  'BNB') },
];

interface TokenMeta { name: string; symbol: string; decimals: number }

function NetworkSelectModal({ open, onClose, onSelect, logoMap }: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  logoMap: Record<number, string>;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (open) setSearch(''); }, [open]);

  const filtered = useMemo(() =>
    search ? NETWORKS.filter(n => n.name.toLowerCase().includes(search.toLowerCase())) : NETWORKS,
    [search]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { background: '#0f0c26', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle component="div" sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={700} flex={1} textAlign="center">Select network</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 2, px: 1.5, py: 0.75, border: '1px solid rgba(255,255,255,0.08)', '&:focus-within': { borderColor: 'primary.main' } }}>
          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <InputBase autoFocus fullWidth placeholder="Search network" value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ fontSize: 14, '& input::placeholder': { color: 'text.secondary' } }} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1 }}>
        {filtered.map(net => (
          <Box key={net.id}
            onClick={() => { onSelect(net.id); onClose(); }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.05)' }, transition: 'background 0.15s' }}>
            <Avatar src={logoMap[net.id]} sx={{ width: 38, height: 38, background: 'rgba(145,102,255,0.15)', fontSize: 14 }}>
              {net.name[0]}
            </Avatar>
            <Typography variant="body2" fontWeight={600}>{net.name}</Typography>
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}

async function fetchEvmMeta(address: string, networkId: number): Promise<TokenMeta> {
  const net = NETWORKS.find(n => n.id === networkId);
  if (!net || !net.chain) throw new Error('Unsupported network');

  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) });
  const addr = address as `0x${string}`;

  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: addr, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address: addr, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: addr, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  return { name: name as string, symbol: symbol as string, decimals: Number(decimals) };
}

async function fetchSolanaMeta(address: string, connection: Connection): Promise<TokenMeta> {
  const mint = new PublicKey(address);

  // Try Token-2022 first, fall back to classic SPL
  let mintInfo: Awaited<ReturnType<typeof getMint>>;
  try {
    mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  } catch {
    const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
    mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_PROGRAM_ID);
  }

  // Try to read on-chain metadata (Token-2022 metadata extension)
  try {
    const { getTokenMetadata } = await import('@solana/spl-token');
    const meta = await getTokenMetadata(connection, mint);
    if (meta?.name && meta?.symbol) {
      return { name: meta.name, symbol: meta.symbol, decimals: mintInfo.decimals };
    }
  } catch { /* metadata extension not present */ }

  // Fallback: partial info from mint (decimals only, name/symbol unavailable on-chain)
  return { name: '', symbol: '', decimals: mintInfo.decimals };
}

export function ListingPage() {
  const { publicKey, signMessage, signTransaction, connected } = useWallet();
  const { connection } = useSolanaConnection();

  const { stats: asxStats } = useAsxStats();
  const { balance: asxBalance } = useAsxBalance(connected && publicKey ? publicKey.toBase58() : null);

  const feeUsd = asxStats?.priceUsd
    ? (LISTING_FEE * Number(asxStats.priceUsd)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : null;

  const [network, setNetwork] = useState(1);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [logoMap, setLogoMap] = useState<Record<number, string>>({});
  const [tokenAddress, setTokenAddress] = useState('');
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualSymbol, setManualSymbol] = useState('');

  // Fetch chain logos from LiFi once on mount
  useEffect(() => {
    fetch('https://li.quest/v1/chains?chainTypes=EVM,SVM')
      .then(r => r.json())
      .then(data => {
        const map: Record<number, string> = {};
        for (const c of (data.chains || [])) {
          if (c.logoURI) map[c.id] = c.logoURI;
        }
        setLogoMap(map);
      })
      .catch(() => {});
  }, []);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');

  const [routeOk, setRouteOk] = useState<boolean | null>(null);
  const [routeChecking, setRouteChecking] = useState(false);

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [txSig, setTxSig] = useState('');

  const isSolana = network === 101;

  // Auto-fetch metadata when address + network are ready
  useEffect(() => {
    const addr = tokenAddress.trim();
    setMeta(null);
    setMetaError('');
    setManualName('');
    setManualSymbol('');

    if (!addr) return;

    // Validate address format
    if (!isSolana && !isAddress(addr)) return;
    if (isSolana) {
      try { new PublicKey(addr); } catch { return; }
    }

    let cancelled = false;
    setMetaLoading(true);

    const load = isSolana
      ? fetchSolanaMeta(addr, connection)
      : fetchEvmMeta(addr, network);

    load
      .then(m => { if (!cancelled) setMeta(m); })
      .catch(e => { if (!cancelled) setMetaError('Could not fetch token info: ' + (e.message || e)); })
      .finally(() => { if (!cancelled) setMetaLoading(false); });

    return () => { cancelled = true; };
  }, [tokenAddress, network, isSolana, connection]);

  // After metadata loads, verify Base USDC → token route exists on LI.FI
  useEffect(() => {
    setRouteOk(null);
    if (!meta || !tokenAddress.trim()) return;

    const addr = tokenAddress.trim();
    let cancelled = false;
    setRouteChecking(true);

    // Use $100 worth as reference amount (USDC has 6 decimals)
    const usdcAmount = (100 * 1e6).toString();
    // LiFi uses 1151111081099710 as Solana's chain ID
    const lifiToChain = network === 101 ? 1151111081099710 : network;

    const q = new URLSearchParams({
      fromChain: '8453',
      toChain: String(lifiToChain),
      fromToken: USDC_BASE,
      toToken: addr,
      fromAmount: usdcAmount,
      fromAddress: EXCHANGE_WALLET,
      integrator: 'assetux',
      order: 'FASTEST',
      slippage: '0.03',
      // Solana requires a valid base58 toAddress; use the token address (already validated pubkey)
      ...(lifiToChain === 1151111081099710 && { toAddress: addr }),
    });
    fetch(`${LIFI_BASE}/quote?${q}`)
      .then(r => { if (!cancelled) setRouteOk(r.ok); })
      .catch(() => { if (!cancelled) setRouteOk(false); })
      .finally(() => { if (!cancelled) setRouteChecking(false); });

    return () => { cancelled = true; };
  }, [meta, tokenAddress, network]);

  const handleSubmit = useCallback(async () => {
    if (!tokenAddress.trim() || !meta) {
      setError('Enter a valid token address and wait for metadata to load');
      return;
    }
    const resolvedName = meta.name || manualName.trim();
    const resolvedSymbol = meta.symbol || manualSymbol.trim();
    if (!resolvedName || !resolvedSymbol) {
      setError('Token name/symbol could not be resolved on-chain. Enter them manually below.');
      return;
    }
    if (!connected || !publicKey || !signMessage || !signTransaction) {
      setError('Connect your Solana wallet first');
      return;
    }
    setError('');

    // Step 1: sign message
    setStep(1);
    let sig: string;
    try {
      const payload = JSON.stringify({
        action: 'list_token',
        tokenAddress: tokenAddress.trim(),
        network,
        tokenName: resolvedName,
        tokenSymbol: resolvedSymbol,
        tokenDecimals: meta.decimals,
        wallet: publicKey.toBase58(),
        timestamp: Date.now(),
      });
      const sigBytes = await signMessage(new TextEncoder().encode(payload));
      sig = Buffer.from(sigBytes).toString('base64');
    } catch {
      setError('Message signing cancelled');
      setStep(0);
      return;
    }

    // Step 2: send 10M ASX + memo
    setStep(2);
    try {
      const fromATA = await getAssociatedTokenAddress(
        ASX_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const toATA = await getAssociatedTokenAddress(
        ASX_MINT, TREASURY, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      tx.add(createTransferCheckedInstruction(
        fromATA, ASX_MINT, toATA, publicKey,
        LISTING_FEE * 10 ** ASX_DECIMALS,
        ASX_DECIMALS, [], TOKEN_2022_PROGRAM_ID,
      ));
      tx.add(new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(sig.slice(0, 100)),
      }));

      const signed = await signTransaction(tx);
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, 'confirmed');

      const res = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: tokenAddress.trim(),
          network,
          tokenName: meta.name,
          tokenSymbol: meta.symbol,
          tokenDecimals: meta.decimals,
          wallet: publicKey.toBase58(),
          txSig: txid,
          signature: sig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setTxSig(txid);
      setStep(3);
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
      setStep(0);
    }
  }, [tokenAddress, network, meta, connected, publicKey, signMessage, signTransaction, connection]);

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: 6, px: 2 }}>
      <Typography variant="h4" fontWeight={800} mb={1}
        sx={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        List Your Token
      </Typography>
      <Typography color="text.secondary" mb={4}>
        Pay 10,000,000 ASX to list your token on Assetux Exchange. Supports all major EVM networks and Solana.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {['Fill details', 'Sign message', 'Pay 10M ASX', 'Listed!'].map(l => (
          <Step key={l}><StepLabel>{l}</StepLabel></Step>
        ))}
      </Stepper>

      {step === 3 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, background: '#0f0c26', border: '1px solid rgba(72,158,255,0.3)', textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} mb={1}>Token Listed!</Typography>
          <Typography color="text.secondary" mb={2}>
            Your token has been verified on-chain and will appear on Assetux Exchange within a few minutes.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'block' }}>
            Tx: {txSig}
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, background: '#0f0c26', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Network selector — same style as swap page */}
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Network</Typography>
              <ButtonBase onClick={() => setNetworkModalOpen(true)} sx={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 1.25,
                px: 1.5, py: 1.25, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                '&:hover': { background: 'rgba(255,255,255,0.1)' }, transition: 'background 0.15s',
              }}>
                <Avatar src={logoMap[network]} sx={{ width: 28, height: 28, background: 'rgba(145,102,255,0.15)', fontSize: 13 }}>
                  {NETWORKS.find(n => n.id === network)?.name[0]}
                </Avatar>
                <Typography variant="body2" fontWeight={600} flex={1} textAlign="left">
                  {NETWORKS.find(n => n.id === network)?.name}
                </Typography>
                <KeyboardArrowDownIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </ButtonBase>
            </Box>

            <NetworkSelectModal
              open={networkModalOpen}
              onClose={() => setNetworkModalOpen(false)}
              onSelect={id => { setNetwork(id); setTokenAddress(''); setMeta(null); setRouteOk(null); setManualName(''); setManualSymbol(''); }}
              logoMap={logoMap}
            />

            <TextField
              label="Token Contract Address"
              fullWidth
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              placeholder={isSolana ? 'Solana mint address' : '0x…'}
              slotProps={{ input: { endAdornment: metaLoading ? <CircularProgress size={18} /> : undefined } }}
            />

            {metaError && <Alert severity="warning" sx={{ py: 0.5 }}>{metaError}</Alert>}

            {/* Auto-filled read-only metadata */}
            {meta && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, borderRadius: 2, background: 'rgba(72,158,255,0.05)', border: '1px solid rgba(72,158,255,0.15)' }}>
                <Typography variant="caption" color="primary.main" fontWeight={600} display="block">
                  Token info resolved on-chain
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Name"
                    value={meta.name ? meta.name : manualName}
                    onChange={meta.name ? undefined : (e) => setManualName(e.target.value)}
                    fullWidth size="small"
                    slotProps={{ input: { readOnly: !!meta.name } }}
                    placeholder={meta.name ? undefined : 'Enter token name'}
                    sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.03)' } }}
                  />
                  <TextField
                    label="Symbol"
                    value={meta.symbol ? meta.symbol : manualSymbol}
                    onChange={meta.symbol ? undefined : (e) => setManualSymbol(e.target.value)}
                    fullWidth size="small"
                    slotProps={{ input: { readOnly: !!meta.symbol } }}
                    placeholder={meta.symbol ? undefined : 'Enter symbol'}
                    sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.03)' } }}
                  />
                  <TextField
                    label="Decimals" value={meta.decimals} size="small" sx={{ width: 100, '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.03)' } }}
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Box>
                {(!meta.name || !meta.symbol) && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    Name/symbol not available on-chain for this token. Double-check the address and network.
                  </Alert>
                )}
                {routeChecking && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">Checking swap route availability…</Typography>
                  </Box>
                )}
                {!routeChecking && routeOk === true && (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    Swap route available — users will be able to buy this token on Assetux Exchange.
                  </Alert>
                )}
                {!routeChecking && routeOk === false && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    No swap route found for this token. Make sure it has liquidity on a{' '}
                    <a href="https://li.fi/ecosystem/" target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                      LI.FI-supported DEX
                    </a>
                    {' '}before listing.
                  </Alert>
                )}
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(145,102,255,0.08)', border: '1px solid rgba(145,102,255,0.2)' }}>
              <Typography variant="body2" color="secondary.main" fontWeight={600} mb={0.5}>How it works</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>1. Sign a message with your token details</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>2. Send 10,000,000 ASX to our treasury on Solana</Typography>
              <Typography variant="caption" color="text.secondary" display="block">3. We verify on-chain and list your token</Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(72,158,255,0.06)', border: '1px solid rgba(72,158,255,0.15)' }}>
              <Typography variant="body2" fontWeight={600}>Listing Fee</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={800}>10,000,000 ASX</Typography>
                {feeUsd && (
                  <Typography variant="body2" color="text.secondary">≈ {feeUsd}</Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">Paid from your Solana wallet · Non-refundable</Typography>
              {asxStats && (
                <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                  {asxStats.priceUsd && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">ASX Price</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        ${Number(asxStats.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                        {asxStats.priceChange24h != null && (
                          <Box component="span" sx={{ ml: 0.5, color: asxStats.priceChange24h >= 0 ? '#4caf50' : '#f44336' }}>
                            ({asxStats.priceChange24h >= 0 ? '+' : ''}{asxStats.priceChange24h.toFixed(2)}%)
                          </Box>
                        )}
                      </Typography>
                    </Box>
                  )}
                  {asxStats.volume24h != null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">24h Volume</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        ${asxStats.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Typography>
                    </Box>
                  )}
                  {asxBalance != null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Your ASX Balance</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {Number(asxBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })} ASX
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            {step === 1 && <Alert severity="info">Waiting for message signature in your wallet…</Alert>}
            {step === 2 && <Alert severity="info">Sending 10M ASX and verifying on-chain…</Alert>}

            {!connected ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">Connect Solana wallet to pay listing fee</Typography>
                <WalletMultiButton style={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', borderRadius: 12 }} />
              </Box>
            ) : (
              <Button variant="contained" size="large" fullWidth
                onClick={handleSubmit}
                disabled={step > 0 || metaLoading || routeChecking || !meta || !tokenAddress.trim()}
                sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
                {step > 0
                  ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />{step === 1 ? 'Signing…' : 'Paying…'}</>
                  : 'Sign & Pay to List'}
              </Button>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
