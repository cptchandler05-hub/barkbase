'use client';

import { useState } from 'react';
import {
  Checkout,
  CheckoutButton,
  CheckoutStatus,
} from '@coinbase/onchainkit/checkout';
import type { LifecycleStatus } from '@coinbase/onchainkit/checkout';

interface DonationCheckoutProps {
  onSuccess?: (chargeId: string, transactionHash?: string) => void;
  onError?: (error: Error) => void;
}

const DONATION_TIERS = [
  { amount: '5', label: '$5' },
  { amount: '10', label: '$10' },
  { amount: '25', label: '$25' },
  { amount: '50', label: '$50' },
  { amount: '100', label: '$100' },
];

export default function DonationCheckout({ onSuccess, onError }: DonationCheckoutProps) {
  const [selectedAmount, setSelectedAmount] = useState('25');
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const donationAmount = isCustom ? customAmount : selectedAmount;

  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const chargeHandler = async () => {
    setCheckoutError(null);
    try {
      const response = await fetch('/api/coinbase/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: donationAmount,
          metadata: {
            campaign: 'barkbase-rescue',
            type: 'donation',
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to create checkout. Please try again.';
        setCheckoutError(errorMessage);
        throw new Error(errorMessage);
      }
      
      const { chargeId } = await response.json();
      return chargeId;
    } catch (error) {
      console.error('Charge creation error:', error);
      const message = error instanceof Error ? error.message : 'Checkout failed';
      setCheckoutError(message);
      throw error;
    }
  };

  const handleStatus = (status: LifecycleStatus) => {
    const { statusName, statusData } = status;
    
    switch (statusName) {
      case 'success':
        setCheckoutError(null);
        onSuccess?.(
          (statusData as any)?.chargeId || '',
          (statusData as any)?.transactionReceipt?.transactionHash
        );
        break;
      case 'error':
        const errorMsg = (statusData as any)?.error?.message || 'Checkout failed. Please try again.';
        setCheckoutError(errorMsg);
        onError?.(new Error(errorMsg));
        break;
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100">
      <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">
        Pay with Card, Apple Pay, or Crypto
      </h3>
      <p className="text-gray-600 text-sm text-center mb-4">
        Credit/debit, Apple Pay, or USDC - no wallet needed
      </p>
      
      <div className="grid grid-cols-5 gap-2 mb-4">
        {DONATION_TIERS.map((tier) => (
          <button
            key={tier.amount}
            onClick={() => {
              setSelectedAmount(tier.amount);
              setIsCustom(false);
            }}
            className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              !isCustom && selectedAmount === tier.amount
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tier.label}
          </button>
        ))}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Custom amount (USD)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            placeholder="Enter amount"
            value={customAmount}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '');
              setCustomAmount(value);
              setIsCustom(true);
            }}
            onFocus={() => setIsCustom(true)}
            className={`w-full pl-8 pr-4 py-2 rounded-lg border text-gray-800 bg-white ${
              isCustom ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
            } focus:outline-none`}
          />
        </div>
      </div>

      <div className="text-center mb-4">
        <span className="text-2xl font-bold text-blue-700">
          ${donationAmount || '0'}
        </span>
      </div>

      {checkoutError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {checkoutError}
        </div>
      )}

      <Checkout 
        key={`checkout-${donationAmount}`}
        chargeHandler={chargeHandler}
        onStatus={handleStatus}
      >
        <CheckoutButton 
          coinbaseBranded 
          text="Pay Now"
          disabled={!donationAmount || parseFloat(donationAmount) <= 0}
          className="w-full"
        />
        <CheckoutStatus />
      </Checkout>

      <p className="text-xs text-gray-500 text-center mt-3">
        Powered by Coinbase Commerce - Apple Pay, Card, or Crypto
      </p>
    </div>
  );
}
