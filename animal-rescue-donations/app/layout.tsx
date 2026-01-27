
'use client';

import '@coinbase/onchainkit/styles.css';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import type { ReactNode } from 'react';
import './globals.css';

const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'BarkBase' }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_PROJECT_ID}
          chain={base}
          config={{
            appearance: {
              name: 'BarkBase',
              logo: 'https://barkbase.xyz/images/barkbase-logo.png',
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>BarkBase — Never Let a Dog Become Invisible</title>
        <meta name="description" content="BarkBase shines a light on overlooked rescue dogs from rural shelters. Discover invisible dogs, donate crypto, and help underdogs find homes." />
        
        {/* Open Graph / Facebook / Farcaster */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://barkbase.xyz/" />
        <meta property="og:title" content="BarkBase — Never Let a Dog Become Invisible" />
        <meta property="og:description" content="BarkBase shines a light on overlooked rescue dogs from rural shelters. Discover invisible dogs, donate crypto, and help underdogs find homes." />
        <meta property="og:image" content="https://barkbase.xyz/og-image.png" />
        <meta property="og:site_name" content="BarkBase" />
        
        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://barkbase.xyz/" />
        <meta name="twitter:title" content="BarkBase — Never Let a Dog Become Invisible" />
        <meta name="twitter:description" content="BarkBase shines a light on overlooked rescue dogs from rural shelters. Discover invisible dogs, donate crypto, and help underdogs find homes." />
        <meta name="twitter:image" content="https://barkbase.xyz/og-image.png" />
        
        {/* Farcaster Frame */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://barkbase.xyz/og-image.png" />
        
        {/* Base / Coinbase */}
        <meta name="theme-color" content="#0052FF" />
        
        <link rel="canonical" href="https://barkbase.xyz/" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
