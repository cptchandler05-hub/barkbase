'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Award, Sparkles, ExternalLink } from 'lucide-react';

interface DonorNFTMintProps {
  donationAmount?: string;
  tokenType?: string;
  transactionHash?: string;
}

export default function DonorNFTMint({ 
  donationAmount, 
  tokenType = 'ETH',
  transactionHash 
}: DonorNFTMintProps) {
  const { address, isConnected } = useAccount();
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMintNFT = async () => {
    if (!address) return;
    
    setMinting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/nft/mint-donor-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          donationAmount,
          tokenType,
          transactionHash,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mint NFT');
      }

      const data = await response.json();
      setMintedTokenId(data.tokenId);
      setMinted(true);
    } catch (err) {
      console.error('Mint error:', err);
      setError(err instanceof Error ? err.message : 'Failed to mint NFT');
    } finally {
      setMinting(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  if (minted && mintedTokenId) {
    return (
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 text-white text-center">
        <div className="flex justify-center mb-3">
          <Award className="w-12 h-12" />
        </div>
        <h3 className="text-xl font-bold mb-2">
          Rescue Hero Badge Minted!
        </h3>
        <p className="text-white/90 mb-4">
          Your donor appreciation NFT is now in your wallet
        </p>
        <a
          href={`https://basescan.org/token/${process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS}?a=${mintedTokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors"
        >
          View on BaseScan
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-6 h-6" />
        <h3 className="text-xl font-bold">Claim Your Rescue Hero Badge</h3>
      </div>
      
      <p className="text-white/90 mb-4">
        As a thank you for your donation, claim a free commemorative NFT badge on Base. 
        Show the world you helped save rescue dogs!
      </p>

      <div className="bg-white/10 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold">BarkBase Rescue Hero</p>
            <p className="text-sm text-white/70">
              {donationAmount ? `${donationAmount} ${tokenType} Donor` : 'Donor Badge'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleMintNFT}
        disabled={minting}
        className="w-full bg-white text-purple-600 font-semibold py-3 px-6 rounded-full hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {minting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Minting...
          </span>
        ) : (
          'Claim Free NFT Badge'
        )}
      </button>

      <p className="text-xs text-white/60 text-center mt-3">
        Gas sponsored by BarkBase - completely free!
      </p>
    </div>
  );
}
