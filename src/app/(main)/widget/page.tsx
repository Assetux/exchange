'use client';
import { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getChains, type Chain } from '@/lib/lifi';

const SITE = 'https://exchange.assetux.com';
// Fetch token symbols from these representative chains
const KEY_CHAIN_IDS = [1, 56, 137, 42161, 10, 1151111081099710];

interface TokenSymbol {
  symbol: string;
  logoURI: string;
}

export default function WidgetPage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChainIds, setSelectedChainIds] = useState<Set<number>>(new Set());
  const [allTokens, setAllTokens] = useState<TokenSymbol[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState('480');
  const [height, setHeight] = useState('600');
  const [copied, setCopied] = useState(false);
  const [searchChain, setSearchChain] = useState('');
  const [searchToken, setSearchToken] = useState('');
  const [tab, setTab] = useState(0);

  useEffect(() => {
    getChains().then(c => {
      setChains(c);
      setSelectedChainIds(new Set(c.map(x => x.id)));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all(
      KEY_CHAIN_IDS.map(cid =>
        fetch(`/api/tokens?chainId=${cid}`).then(r => r.json()).catch(() => [])
      )
    ).then(results => {
      const seen = new Map<string, string>(); // symbol -> logoURI
      (results as any[][]).flat().forEach((t: any) => {
        if (t?.symbol && !seen.has(t.symbol)) {
          seen.set(t.symbol, t.logoURI || '');
        }
      });
      const list = [...seen.entries()].map(([symbol, logoURI]) => ({ symbol, logoURI }));
      setAllTokens(list);
      setSelectedSymbols(new Set(list.map(t => t.symbol)));
    });
  }, []);

  const filteredChains = useMemo(() => {
    if (!searchChain) return chains;
    return chains.filter(c => c.name.toLowerCase().includes(searchChain.toLowerCase()));
  }, [chains, searchChain]);

  const filteredTokens = useMemo(() => {
    if (!searchToken) return allTokens;
    return allTokens.filter(t => t.symbol.toLowerCase().includes(searchToken.toLowerCase()));
  }, [allTokens, searchToken]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedChainIds.size > 0 && selectedChainIds.size < chains.length) {
      params.set('chains', [...selectedChainIds].join(','));
    }
    if (selectedSymbols.size > 0 && selectedSymbols.size < allTokens.length) {
      params.set('tokens', [...selectedSymbols].join(','));
    }
    return params.toString();
  }, [selectedChainIds, chains.length, selectedSymbols, allTokens.length]);

  const previewUrl = `/embed${queryString ? '?' + queryString : ''}`;
  const embedUrl = `${SITE}/embed${queryString ? '?' + queryString : ''}`;

  const code = `<!-- Assetux Swap Widget -->
<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  style="border: none; border-radius: 16px;"
  allow="clipboard-write"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleChain = (id: number) => {
    setSelectedChainIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedChainIds.size === chains.length) {
      setSelectedChainIds(new Set());
    } else {
      setSelectedChainIds(new Set(chains.map(c => c.id)));
    }
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      return next;
    });
  };

  const toggleAllTokens = () => {
    if (selectedSymbols.size === allTokens.length) {
      setSelectedSymbols(new Set());
    } else {
      setSelectedSymbols(new Set(allTokens.map(t => t.symbol)));
    }
  };

  const sectionSx = {
    p: 2.5,
    background: '#0f0c26',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 3,
  };

  const searchSx = {
    mb: 1.5,
    '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.04)', borderRadius: 2 },
  };

  const rowSx = (selected: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.75,
    borderRadius: 2, cursor: 'pointer',
    background: selected ? 'rgba(72,158,255,0.07)' : 'transparent',
    '&:hover': { background: selected ? 'rgba(72,158,255,0.12)' : 'rgba(255,255,255,0.04)' },
    transition: 'background 0.15s',
  });

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 4 }, py: 6 }}>
      <Typography variant="h4" fontWeight={900} mb={1}
        sx={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Embed Swap Widget
      </Typography>
      <Typography color="text.secondary" mb={4}>
        Add a fully functional swap widget to your website. Pick networks, filter tokens, then copy the embed code.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px 1fr' }, gap: 3, alignItems: 'start' }}>

        {/* ── Left: config ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Networks */}
          <Paper sx={sectionSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography fontWeight={700}>Networks</Typography>
              <Button size="small" onClick={toggleAll} sx={{ fontSize: 12, py: 0, color: 'primary.main' }}>
                {selectedChainIds.size === chains.length ? 'Deselect all' : 'Select all'}
              </Button>
            </Box>
            <TextField
              size="small" fullWidth placeholder="Search networks…"
              value={searchChain} onChange={e => setSearchChain(e.target.value)}
              sx={searchSx}
            />
            <Box sx={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {filteredChains.map(chain => (
                <Box
                  key={chain.id}
                  onClick={() => toggleChain(chain.id)}
                  sx={rowSx(selectedChainIds.has(chain.id))}
                >
                  <Checkbox
                    checked={selectedChainIds.has(chain.id)}
                    size="small" sx={{ p: 0 }}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleChain(chain.id)}
                  />
                  <Avatar src={chain.logoURI} sx={{ width: 24, height: 24, fontSize: 10 }}>{chain.name[0]}</Avatar>
                  <Typography variant="body2">{chain.name}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              {selectedChainIds.size} of {chains.length} networks selected
            </Typography>
          </Paper>

          {/* Tokens */}
          <Paper sx={sectionSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography fontWeight={700}>Tokens</Typography>
                <Chip label="optional" size="small" sx={{ fontSize: 10, height: 18 }} />
              </Box>
              <Button size="small" onClick={toggleAllTokens} sx={{ fontSize: 12, py: 0, color: 'primary.main' }}>
                {selectedSymbols.size === allTokens.length ? 'Deselect all' : 'Select all'}
              </Button>
            </Box>
            <TextField
              size="small" fullWidth placeholder="Search tokens…"
              value={searchToken} onChange={e => setSearchToken(e.target.value)}
              sx={searchSx}
            />
            <Box sx={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {filteredTokens.map(token => (
                <Box
                  key={token.symbol}
                  onClick={() => toggleSymbol(token.symbol)}
                  sx={rowSx(selectedSymbols.has(token.symbol))}
                >
                  <Checkbox
                    checked={selectedSymbols.has(token.symbol)}
                    size="small" sx={{ p: 0 }}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleSymbol(token.symbol)}
                  />
                  <Avatar src={token.logoURI} sx={{ width: 24, height: 24, fontSize: 10 }}>{token.symbol[0]}</Avatar>
                  <Typography variant="body2">{token.symbol}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              {selectedSymbols.size === allTokens.length
                ? 'All tokens shown'
                : `${selectedSymbols.size} of ${allTokens.length} tokens selected`}
            </Typography>
          </Paper>

          {/* Dimensions */}
          <Paper sx={sectionSx}>
            <Typography fontWeight={700} mb={1.5}>Dimensions</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                size="small" label="Width (px)" value={width}
                onChange={e => setWidth(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.04)', borderRadius: 2 } }}
              />
              <TextField
                size="small" label="Height (px)" value={height}
                onChange={e => setHeight(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.04)', borderRadius: 2 } }}
              />
            </Box>
          </Paper>
        </Box>

        {/* ── Right: code + preview ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ mb: -1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
            <Tab label="Embed Code" />
            <Tab label="Live Preview" />
          </Tabs>

          {tab === 0 && (
            <Paper sx={{ p: 2.5, background: '#0f0c26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography fontWeight={700}>Copy &amp; paste into your HTML</Typography>
                <Button
                  variant="contained" size="small"
                  startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                  onClick={handleCopy}
                  sx={{ background: 'linear-gradient(135deg,#489EFF,#9166FF)', minWidth: 120 }}
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
              </Box>
              <Box
                component="pre"
                sx={{
                  background: 'rgba(0,0,0,0.45)', borderRadius: 2, p: 2,
                  overflow: 'auto', fontSize: 13, lineHeight: 1.7,
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#89d4ff', fontFamily: 'monospace', m: 0,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              >
                {code}
              </Box>

              <Box sx={{ mt: 2.5, p: 2, background: 'rgba(72,158,255,0.05)', borderRadius: 2, border: '1px solid rgba(72,158,255,0.12)' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Embed URL
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', color: 'primary.main', fontFamily: 'monospace', fontSize: 12 }}>
                  {embedUrl}
                </Typography>
              </Box>
            </Paper>
          )}

          {tab === 1 && (
            <Paper sx={{ p: 2.5, background: '#0f0c26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography fontWeight={700}>Live Preview</Typography>
                <Button
                  size="small" endIcon={<OpenInNewIcon fontSize="small" />}
                  component="a" href={previewUrl} target="_blank"
                  sx={{ color: 'primary.main', fontSize: 13 }}
                >
                  Open in new tab
                </Button>
              </Box>
              {/* Fake browser chrome */}
              <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Box sx={{ background: '#1a1730', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                  <Box sx={{ flex: 1, mx: 1.5, background: 'rgba(255,255,255,0.06)', borderRadius: 1, px: 1.5, py: 0.5 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                      exchange.assetux.com/embed{queryString ? '?' + queryString.slice(0, 50) + (queryString.length > 50 ? '…' : '') : ''}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{
                  background: '#08061a',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  p: 3, minHeight: Number(height) + 48 || 648, overflowX: 'auto',
                }}>
                  <iframe
                    key={previewUrl}
                    src={previewUrl}
                    width={Math.min(Number(width) || 480, 560)}
                    height={Number(height) || 600}
                    style={{ border: 'none', borderRadius: 16, display: 'block' }}
                  />
                </Box>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}
