// Updated ThankYouToast.tsx — Fixes wallet dropdown issue, restores proper image sizing, fixes X overlap, and ensures icon loading

'use client';

import Image from 'next/image';
import { X } from 'lucide-react';

interface ThankYouToastProps {
  imageUrl: string;
  onClose: () => void;
  onDownload: () => void;
}

export default function ThankYouToast({ imageUrl, onClose, onDownload }: ThankYouToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 max-w-[95%] w-[460px] sm:w-[500px]">
      <div className="relative rounded-xl shadow-2xl border border-gray-300 bg-white">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-gray-200"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <img
          src={imageUrl}
          alt="Thank you from BarkBase"
          className="w-full h-auto rounded-t-xl"
        />

        <div className="flex justify-between items-center px-4 py-3 gap-3">
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            💾 Download
          </button>

          <div className="flex items-center gap-2">
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                'I just donated to help rescue dogs on BarkBase 🐾 Check it out: https://barkbase.xyz'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on X"
            >
              <Image
                src="/logos/x-logo.png"
                alt="Share on X"
                width={24}
                height={24}
              />
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(
                'https://barkbase.xyz'
              )}&text=${encodeURIComponent(
                'I just donated to help rescue dogs on BarkBase 🐶 Join the mission!'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Telegram"
            >
              <Image
                src="/logos/telegram-logo.png"
                alt="Share on Telegram"
                width={24}
                height={24}
              />
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                'https://barkbase.xyz'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
            >
              <Image
                src="/logos/facebook-logo.png"
                alt="Share on Facebook"
                width={24}
                height={24}
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
