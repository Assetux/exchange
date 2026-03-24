'use client';
import { ReactNode } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { mainnet, base, polygon, arbitrum, optimism, bsc, avalanche } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import '@rainbow-me/rainbowkit/styles.css';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#489EFF' },
    secondary: { main: '#9166FF' },
    background: { default: '#08061a', paper: '#0f0c26' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(135deg, #489EFF 0%, #9166FF 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #7ab8ff 0%, #b399ff 100%)' },
        },
      },
    },
  },
});

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

// injectedWallet works in MetaMask/Coinbase in-app browsers (window.ethereum present).
// All other mobile wallets (MetaMask deep-link, Trust, Rainbow, WalletConnect QR)
// require a real WalletConnect project ID — get one free at cloud.walletconnect.com
// and set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in your deployment env vars.
const walletList = projectId
  ? [
      {
        groupName: 'Popular',
        wallets: [injectedWallet, metaMaskWallet, coinbaseWallet, trustWallet, rainbowWallet, walletConnectWallet],
      },
    ]
  : [
      {
        groupName: 'Browser Wallet',
        wallets: [injectedWallet, coinbaseWallet],
      },
    ];

const wagmiConfig = getDefaultConfig({
  appName: 'Assetux Exchange',
  projectId: projectId || 'placeholder',
  wallets: walletList,
  chains: [mainnet, base, polygon, arbitrum, optimism, bsc, avalanche],
  transports: {
    [mainnet.id]:   http(process.env.NEXT_PUBLIC_ETH_RPC      || 'https://eth.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [base.id]:      http(process.env.NEXT_PUBLIC_BASE_RPC     || 'https://base.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [polygon.id]:   http(process.env.NEXT_PUBLIC_POLYGON_RPC  || 'https://matic.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [arbitrum.id]:  http(process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [optimism.id]:  http(process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://op.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [bsc.id]:       http(process.env.NEXT_PUBLIC_BSC_RPC      || 'https://bsc.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
    [avalanche.id]: http(process.env.NEXT_PUBLIC_AVAX_RPC     || 'https://avax.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4'),
  },
  ssr: true,
});

const queryClient = new QueryClient();

const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
const solanaEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://sol.nownodes.io/31299d58-8732-45f2-8c4d-36754e81a8f4';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider>
          <ConnectionProvider endpoint={solanaEndpoint}>
            <WalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>
                <ThemeProvider theme={theme}>
                  <CssBaseline />
                  {children}
                </ThemeProvider>
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
