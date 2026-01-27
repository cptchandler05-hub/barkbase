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

const cbETHToken: Token = {
  name: 'Coinbase Wrapped Staked ETH',
  address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  symbol: 'cbETH',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/27008/small/cbeth.png',
  chainId: 8453,
};

const USDTToken: Token = {
  name: 'Tether USD',
  address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  symbol: 'USDT',
  decimals: 6,
  image: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  chainId: 8453,
};

const DEGENToken: Token = {
  name: 'Degen',
  address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  symbol: 'DEGEN',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/34515/small/degen.png',
  chainId: 8453,
};

const BRETTToken: Token = {
  name: 'Brett',
  address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
  symbol: 'BRETT',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/35529/small/brett.jpg',
  chainId: 8453,
};

const TOSHIToken: Token = {
  name: 'Toshi',
  address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
  symbol: 'TOSHI',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/31126/small/toshi.png',
  chainId: 8453,
};

const VIRTUALToken: Token = {
  name: 'Virtual Protocol',
  address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
  symbol: 'VIRTUAL',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/33857/small/VIRTUAL.png',
  chainId: 8453,
};

const AEROToken: Token = {
  name: 'Aerodrome Finance',
  address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  symbol: 'AERO',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/31745/small/token.png',
  chainId: 8453,
};

const swappableFromTokens: Token[] = [
  ETHToken, USDCToken, DAIToken, WETHToken, cbBTCToken, cbETHToken, 
  USDTToken, DEGENToken, BRETTToken, TOSHIToken, VIRTUALToken, AEROToken
];

const swappableToTokens: Token[] = [ETHToken, USDCToken];

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
          Swap to Donate
        </h3>
        <p className="text-gray-600 mb-4">
          Connect your wallet to swap tokens
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100">
      <h3 className="text-xl font-bold text-blue-800 mb-2 text-center">
        Swap to Donate
      </h3>
      <p className="text-gray-600 text-sm text-center mb-4">
        Click token to select from popular Base tokens
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
            swappableTokens={swappableFromTokens}
            token={ETHToken}
            type="from"
          />
          
          <SwapToggleButton className="my-2" />
          
          <SwapAmountInput
            label="You receive"
            swappableTokens={swappableToTokens}
            token={USDCToken}
            type="to"
          />
          
          <SwapButton className="mt-4 w-full" />
          <SwapMessage />
          <SwapToast />
        </Swap>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        Swap to ETH or USDC, then send below
      </p>
    </div>
  );
}
