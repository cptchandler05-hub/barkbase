'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert('Failed to copy link');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-semibold shadow-md"
    >
      <Share2 className="w-5 h-5" />
      {copied ? 'Link Copied!' : 'Share This Rescue'}
    </button>
  );
}
