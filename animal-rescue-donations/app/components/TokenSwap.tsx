'use client';

import { useAccount } from 'wagmi';
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

const DAIToken: Token = {
  name: 'Dai Stablecoin',
  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  symbol: 'DAI',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  chainId: 8453,
};

const WETHToken: Token = {
  name: 'Wrapped Ether',
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  chainId: 8453,
};

const cbBTCToken: Token = {
  name: 'Coinbase Wrapped BTC',
  address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  symbol: 'cbBTC',
  decimals: 8,
  image: 'https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp',
  chainId: 8453,
};

const swappableTokens: Token[] = [ETHToken, USDCToken, DAIToken, WETHToken, cbBTCToken];

export default function TokenSwap({ onSuccess, onError }: TokenSwapProps) {
  const { address } = useAccount();

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
        Search for any token in your wallet to swap
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
            swappableTokens={swappableTokens}
            token={ETHToken}
            type="from"
          />
          
          <SwapToggleButton className="my-2" />
          
          <SwapAmountInput
            label="You receive"
            swappableTokens={swappableTokens}
            token={USDCToken}
            type="to"
          />
          
          <SwapButton className="mt-4 w-full" />
          <SwapMessage />
          <SwapToast />
        </Swap>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        Swap between ETH, USDC, DAI, WETH, and cbBTC on Base
      </p>
    </div>
  );
}
