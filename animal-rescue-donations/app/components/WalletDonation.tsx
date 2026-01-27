'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, type Address } from 'viem';

interface WalletDonationProps {
  onSuccess?: (amount: string, token: string) => void;
  onError?: (error: Error) => void;
}

const DONATION_ADDRESS = "0x18f6212B658b8a2A9D3a50360857F78ec50dC0eE" as Address;

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const TOBY_ADDRESS = "0xb8D98a102b0079B69FFbc760C8d857A31653e56e" as Address;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

type TokenType = 'ETH' | 'USDC' | 'TOBY';

export default function WalletDonation({ onSuccess, onError }: WalletDonationProps) {
  const { address, isConnected } = useAccount();
  const [selectedToken, setSelectedToken] = useState<TokenType>('ETH');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txCancelled, setTxCancelled] = useState(false);

  const { sendTransaction, data: ethTxHash, isPending: isEthPending, error: ethError, reset: resetEth } = useSendTransaction();
  const { writeContract, data: usdcTxHash, isPending: isUsdcPending, error: usdcError, reset: resetUsdc } = useWriteContract();

  const { isLoading: isEthConfirming, isSuccess: isEthSuccess } = useWaitForTransactionReceipt({
    hash: ethTxHash,
  });

  const { isLoading: isUsdcConfirming, isSuccess: isUsdcSuccess } = useWaitForTransactionReceipt({
    hash: usdcTxHash,
  });

  const successCallbackFired = useRef(false);
  
  useEffect(() => {
    if ((isEthSuccess || isUsdcSuccess) && !successCallbackFired.current) {
      successCallbackFired.current = true;
      setIsLoading(false);
      onSuccess?.(amount, selectedToken);
    }
  }, [isEthSuccess, isUsdcSuccess, amount, selectedToken, onSuccess]);

  useEffect(() => {
    if (ethError || usdcError) {
      const err = ethError || usdcError;
      const message = err?.message || 'Transaction failed';
      const isUserRejection = message.toLowerCase().includes('rejected') || 
                              message.toLowerCase().includes('denied') ||
                              message.toLowerCase().includes('cancelled') ||
                              message.toLowerCase().includes('user refused');
      
      setError(isUserRejection ? 'Transaction cancelled' : message);
      setIsLoading(false);
      setTxCancelled(true);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [ethError, usdcError, onError]);

  const handleDonate = async () => {
    if (!isConnected || !amount || parseFloat(amount) <= 0) {
      setError('Please connect your wallet and enter an amount');
      return;
    }

    setError(null);
    setIsLoading(true);
    setTxCancelled(false);
    resetEth();
    resetUsdc();
    successCallbackFired.current = false;

    try {
      if (selectedToken === 'ETH') {
        sendTransaction({
          to: DONATION_ADDRESS,
          value: parseEther(amount),
        });
      } else if (selectedToken === 'USDC') {
        writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [DONATION_ADDRESS, parseUnits(amount, 6)],
        });
      } else if (selectedToken === 'TOBY') {
        writeContract({
          address: TOBY_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [DONATION_ADDRESS, parseUnits(amount, 18)],
        });
      }
    } catch (err) {
      console.error('Donation error:', err);
      const message = err instanceof Error ? err.message : 'Transaction failed';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
      setIsLoading(false);
    }
  };

  if (isEthSuccess || isUsdcSuccess) {
    return (
      <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h3 className="text-xl font-bold text-green-700 mb-2">Thank You!</h3>
        <p className="text-gray-600">
          Your donation of {amount} {selectedToken} helps save dogs!
        </p>
      </div>
    );
  }

  const isPending = !txCancelled && (isEthPending || isUsdcPending || isEthConfirming || isUsdcConfirming || isLoading);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
          <span className="text-xl">💎</span>
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Send Crypto</h3>
          <p className="text-xs text-gray-500">Direct wallet transfer</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedToken('ETH')}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-sm ${
            selectedToken === 'ETH'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ETH
        </button>
        <button
          onClick={() => setSelectedToken('USDC')}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-sm ${
            selectedToken === 'USDC'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          USDC
        </button>
        <button
          onClick={() => setSelectedToken('TOBY')}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-sm ${
            selectedToken === 'TOBY'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          TOBY
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={amount}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9.]/g, '');
            setAmount(value);
          }}
          placeholder={selectedToken === 'ETH' ? '0.01' : selectedToken === 'USDC' ? '25' : '1000'}
          className="w-full px-4 py-3 text-center text-xl font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none text-gray-800 bg-white"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
          {selectedToken}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isConnected ? (
        <p className="text-center text-gray-500 text-sm py-3">
          Connect your wallet above to donate
        </p>
      ) : (
        <button
          onClick={handleDonate}
          disabled={isPending || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3 px-4 rounded-xl font-bold transition-all ${
            isPending || !amount || parseFloat(amount) <= 0
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
          }`}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isEthConfirming || isUsdcConfirming ? 'Confirming...' : 'Sending...'}
            </span>
          ) : (
            `Send ${amount || (selectedToken === 'ETH' ? '0.01' : selectedToken === 'USDC' ? '25' : '1000')} ${selectedToken}`
          )}
        </button>
      )}

      <p className="text-xs text-gray-400 text-center mt-3">
        On Base network
      </p>
    </div>
  );
}
