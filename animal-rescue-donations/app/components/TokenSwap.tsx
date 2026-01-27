'use client';

import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { useState, useEffect, useMemo } from 'react';
import {
  Swap,
  SwapAmountInput,
  SwapToggleButton,
  SwapButton,
  SwapMessage,
  SwapToast,
  SwapSettings,
  SwapSettingsSlippageTitle,
  SwapSettingsSlippageDescription,
  SwapSettingsSlippageInput,
} from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';
import type { TransactionReceipt } from 'viem';
import type { SwapError } from '@coinbase/onchainkit/swap';
import { erc20Abi } from 'viem';

interface TokenSwapProps {
  onSuccess?: (receipt: TransactionReceipt) => void;
  onError?: (error: SwapError) => void;
}

const ETHToken: Token = {
  name: 'Ethereum',
  address: '',
  symbol: 'ETH',
  decimals: 18,
  image: 'https://dynamic-assets.coinbase.com/dbb4b4983bde81309ddab83eb598358eb44375b930b94687ebe38bc22e52c3b2125258ffb8477a5ef22e33d6bd72e32a506c391caa13af64c00e46613c3e5806/asset_icons/4113b082d21cc5fab17fc8f2d19fb996165bcce635e6900f7fc2d57c4ef33ae9.png',
  chainId: 8453,
};

const USDCToken: Token = {
  name: 'USD Coin',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
  image: 'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/44/2b/442b80bd16af0c0d9b22e03a16753823fe826e5bfd457292b55fa0ba8c1ba213-ZWUzYjJmZGUtMDYxNy00NDcyLTg0NjQtMWI4OGEwYjBiODE2',
  chainId: 8453,
};

const POPULAR_BASE_TOKENS: Token[] = [
  ETHToken,
  USDCToken,
  {
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    decimals: 18,
    image: 'https://dynamic-assets.coinbase.com/dbb4b4983bde81309ddab83eb598358eb44375b930b94687ebe38bc22e52c3b2125258ffb8477a5ef22e33d6bd72e32a506c391caa13af64c00e46613c3e5806/asset_icons/4113b082d21cc5fab17fc8f2d19fb996165bcce635e6900f7fc2d57c4ef33ae9.png',
    chainId: 8453,
  },
  {
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    decimals: 8,
    image: 'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/3b/bf/3bbf118b5e6dc2f9e7fc607a6e7526647b4ba8f0bea87125f971446d57b296d2-MDNmNjY0MmEtNGFiZi00N2I0LWIwMTItMDUyMzg2ZDZhMWNm',
    chainId: 8453,
  },
  {
    name: 'Dai Stablecoin',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    decimals: 18,
    image: 'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/92/13/9213e31b84c98a693f4c624580fdbe6e4c1cb550efbba15aa9ea68fd25ffb90c-ZTE1NmNjMGUtZGVkYi00ZDliLWI2N2QtNTY2ZWRjMmYwZmMw',
    chainId: 8453,
  },
];

export default function TokenSwap({ onSuccess, onError }: TokenSwapProps) {
  const { address, isConnected } = useAccount();
  const [tokensWithBalance, setTokensWithBalance] = useState<Token[]>([ETHToken]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const { data: ethBalance } = useBalance({
    address: address,
    chainId: 8453,
  });

  const erc20TokensToCheck = POPULAR_BASE_TOKENS.filter(t => t.address !== '');

  const { data: tokenBalances } = useReadContracts({
    contracts: erc20TokensToCheck.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address!],
      chainId: 8453,
    })),
    query: {
      enabled: !!address && isConnected,
    },
  });

  useEffect(() => {
    if (!address || !isConnected) {
      setTokensWithBalance([ETHToken]);
      return;
    }

    setIsLoadingBalances(true);

    const filtered: Token[] = [];

    if (ethBalance && ethBalance.value > 0n) {
      filtered.push(ETHToken);
    }

    if (tokenBalances) {
      erc20TokensToCheck.forEach((token, idx) => {
        const balance = tokenBalances[idx]?.result as bigint | undefined;
        if (balance && balance > 0n) {
          filtered.push(token);
        }
      });
    }

    if (filtered.length === 0) {
      filtered.push(ETHToken);
    }

    setTokensWithBalance(filtered);
    setIsLoadingBalances(false);
  }, [address, isConnected, ethBalance, tokenBalances]);

  const handleSuccess = (receipt: TransactionReceipt) => {
    onSuccess?.(receipt);
  };

  const handleError = (error: SwapError) => {
    console.error('Swap error:', error);
    onError?.(error);
  };

  if (!address) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100 text-center">
        <h3 className="text-xl font-bold text-blue-800 mb-4">
          Swap Any Token to Donate
        </h3>
        <p className="text-gray-600 mb-4">
          Connect your wallet to swap tokens
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100">
      <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">
        Swap Tokens
      </h3>
      <p className="text-gray-600 text-sm text-center mb-4">
        {isLoadingBalances 
          ? 'Loading your tokens...' 
          : `Swap from ${tokensWithBalance.length} token${tokensWithBalance.length !== 1 ? 's' : ''} in your wallet`
        }
      </p>

      <div className="swap-container">
        <Swap 
          onSuccess={handleSuccess}
          onError={handleError}
        >
          <SwapSettings>
            <SwapSettingsSlippageTitle>Max. slippage</SwapSettingsSlippageTitle>
            <SwapSettingsSlippageDescription>
              Your swap will revert if the price changes by more than this percentage.
            </SwapSettingsSlippageDescription>
            <SwapSettingsSlippageInput />
          </SwapSettings>
          
          <SwapAmountInput
            label="You pay"
            swappableTokens={tokensWithBalance}
            token={tokensWithBalance[0]}
            type="from"
          />
          
          <SwapToggleButton className="my-2" />
          
          <SwapAmountInput
            label="You receive"
            swappableTokens={[ETHToken, USDCToken]}
            token={ETHToken}
            type="to"
          />
          
          <SwapButton className="mt-4 w-full" />
          <SwapMessage />
          <SwapToast />
        </Swap>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        Swap any token to ETH or USDC, then donate directly
      </p>
    </div>
  );
}
