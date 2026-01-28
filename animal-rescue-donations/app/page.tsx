"use client";

import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  FundButton,
} from "@coinbase/onchainkit/fund";
import { motion } from "framer-motion";
import ThankYouToast from "@/app/components/ThankYouToast";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import InvisibleDogSpotlight from "@/app/components/InvisibleDogSpotlight";
import TokenSwap from "@/app/components/TokenSwap";
import DonorNFTMint from "@/app/components/DonorNFTMint";
import WalletDonation from "@/app/components/WalletDonation";


const DONATION_ADDRESS = "0x18f6212B658b8a2A9D3a50360857F78ec50dC0eE";

export default function Page() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm Barkr—ask me anything about dog rescue, training, or finding a dog to adopt." },
  ]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    // Only focus after user has interacted to prevent initial scroll to bottom
    if (inputRef.current && hasUserInteracted) {
      inputRef.current.focus();
    }
  }, [messages, hasUserInteracted]);

  const [input, setInput] = useState("");

  const [location, setLocation] = useState<string | null>(null);
  const [breed, setBreed] = useState<string | null>(null);

  const [memory, setMemory] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [ethAmount, setEthAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [thankYouImageUrl, setThankYouImageUrl] = useState<string | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [lastDonationAmount, setLastDonationAmount] = useState<string>("");
  const [lastDonationToken, setLastDonationToken] = useState<string>("ETH");
  const [showNFTMint, setShowNFTMint] = useState(false);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const lastRequestRef = useRef<string>("");

  useEffect(() => {
    // Only scroll when explicitly told to do so AND user has interacted
    if (shouldScroll && hasUserInteracted && lastMessageRef.current) {
      setTimeout(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setShouldScroll(false); // Reset the flag
      }, 100);
    }
  }, [shouldScroll, hasUserInteracted]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(); // matches your actual send function
    }
  };

  // Reset chat while preserving location and breed memory
  const handleResetChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I'm Barkr—ask me anything about dog rescue, training, or finding a dog to adopt.",
      },
    ]);
    setInput("");
    setHasUserInteracted(true);
    setShouldScroll(true); // triggers autoscroll
    setMemory(null); // Move this inside the function
  };

  // Show most invisible dogs from rural areas
  const handleShowInvisibleDogs = async () => {
    setLoading(true);
    try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                ...messages,
                { role: 'user', content: 'show me the most invisible dogs' }
              ],
              memory: memory
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.content) {
              const newMessages = [
                ...messages,
                { role: 'user', content: 'show me the most invisible dogs' },
                { role: 'assistant', content: data.content }
              ];
              setMessages(newMessages);
              if (data.memory) {
                setMemory(data.memory);
              }
            }
          } else {
            console.error('Invisible dogs request failed');
          }
        } catch (error) {
          console.error('Invisible dogs error:', error);
        } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    // Block short garbage inputs locally too
    if (input.trim().length <= 3) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Throw me a bone here 🐾. I need a bit more to work with.",
        },
      ]);
      setInput("");
      setShouldScroll(true);
      return;
    }

    // Prevent duplicate requests
    const currentInput = input.trim();
    if (currentInput === lastRequestRef.current && loading) {
      return;
    }
    lastRequestRef.current = currentInput;

    setHasUserInteracted(true);
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setShouldScroll(true);

    try {
      // Build memory object from current state
      const currentMemory = {
        location: memory?.location || location || null,
        breed: memory?.breed || breed || null,
        hasSeenResults: memory?.hasSeenResults || false,
        seenDogIds: memory?.seenDogIds || [],
        cachedDogs: memory?.cachedDogs || [],
      };

      console.log('[🖥️ Frontend sending memory]:', currentMemory);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          memory: currentMemory,
        }),
      });

      const data = await res.json();
      const content = data.content || "";

      // Update memory state from API response
      if (data.memory) {
        console.log('[🖥️ Frontend received memory]:', data.memory);

        if (data.memory.isAdoptionMode === false) {
          console.log("[🧠 Frontend] Barkr exited adoption mode.");
        }

        setMemory(data.memory);

        // Update individual state for backward compatibility, with basic validation
        if (
          data.memory.location &&
          data.memory.location.length > 2 &&
          !["rural areas", "location", "near me"].includes(data.memory.location.toLowerCase())
        ) {
          setLocation(data.memory.location);
        }

        if (
          data.memory.breed &&
          data.memory.breed.length > 1 &&
          !["dogs", "breeds", "terriers", "puppies"].includes(data.memory.breed.toLowerCase())
        ) {
          setBreed(data.memory.breed);
        }

        }

      if (content && content.trim().length > 1) {
        setMessages((prev) => [...prev, { role: "assistant", content }]);
        setShouldScroll(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something got stuck in the ether—want to try again?",
          },
        ]);
        setShouldScroll(true);
      }

    } catch (error) {
      console.error("API error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't fetch a reply just now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async () => {
    if (!ethAmount || isNaN(Number(ethAmount)) || Number(ethAmount) <= 0) {
      alert("Please enter a valid ETH amount.");
      return;
    }

    try {
      setLoading(true);
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        alert("No Ethereum provider found. Please install a wallet.");
        return;
      }

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        alert("Please connect your wallet.");

        return;
      }

      const from = accounts[0];
      const valueInWei = ethers.parseEther(ethAmount).toString(); // ✅ safe and precise conversion

      const tx = await ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            to: DONATION_ADDRESS,
            from,
            value: ethers.toBeHex(BigInt(valueInWei)), // ✅ convert to proper hex format
          },
        ],
      });

      const shortWallet = `${from.slice(0, 6)}...${from.slice(-4)}`;
      const variant = Math.floor(Math.random() * 5);
      const url = `/api/thank-you-image?wallet=${encodeURIComponent(shortWallet)}&amount=${ethAmount}&token=ETH&variant=${variant}`;
      setThankYouImageUrl(url);
      setLastDonationAmount(ethAmount);
      setLastDonationToken('ETH');
      setShowNFTMint(true);

      alert("Thank you for your donation! Transaction: " + tx);
    } catch (error) {
      console.error("Donation error:", error);
      alert("Failed to process donation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnrampDonate = async () => {
    if (!usdAmount || isNaN(Number(usdAmount)) || Number(usdAmount) <= 0) {
      alert("Please enter a valid USD amount.");
      return;
    }

    try {
      setLoading(true);
      
      // Step 1: Get session token from our API
      console.log('[🔐 Onramp] Requesting session token...');
      const sessionResponse = await fetch('/api/coinbase/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: DONATION_ADDRESS,
          assets: ['USDC'],
        }),
      });

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error || 'Failed to create session token');
      }

      const { token: sessionToken } = await sessionResponse.json();
      console.log('[✅ Onramp] Session token received');

      // Step 2: Generate Coinbase Onramp URL with session token
      const onrampURL = `https://pay.coinbase.com/buy?sessionToken=${sessionToken}&defaultAsset=USDC&presetCryptoAmount=${Number(usdAmount)}`;

      console.log('[🚀 Onramp] Opening Coinbase payment window...');

      // Step 3: Open Coinbase onramp in popup
      const onrampWindow = window.open(
        onrampURL,
        'Coinbase Onramp',
        'width=500,height=700,scrollbars=yes'
      );

      if (!onrampWindow) {
        alert("Please allow popups to use card payments.");
        return;
      }

      // Note: We cannot detect if the transaction was successful or canceled
      // since Coinbase doesn't provide callbacks when the popup closes.
      // The thank you toast will only show for successful wallet transactions.

    } catch (error) {
      console.error("[❌ Onramp Error]", error);
      alert(`Failed to open payment window: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or use wallet option.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const img = document.querySelector('img[alt="Thank you from BarkBase"]') as HTMLImageElement;
    if (!img) {
      alert("Image not found.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      alert("Could not create canvas.");
      return;
    }

    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        alert("Could not convert image.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "barkbase-thank-you.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleInvisibleDogs = async () => {
    try {
      setIsLoading(true);

      // Fetch invisible dogs from dedicated API endpoint
      const response = await fetch('/api/invisible-dogs');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch invisible dogs');
      }

      if (!data.dogs || data.dogs.length === 0) {
        // Fallback to chat API if no dogs found
        const invisibleDogsMessage = "Show me the most invisible dogs";
        setMessages(prev => [...prev, { role: 'user', content: invisibleDogsMessage }]);
        setInput(invisibleDogsMessage);
        setShouldScroll(true);
        setHasUserInteracted(true);
        handleSend();
        return;
      }

      // Cache the dogs and create a message that triggers the chat with cached data
      const invisibleDogsMemory = {
        ...memory,
        cachedDogs: data.dogs,
        seenDogIds: [],
        hasSeenResults: false,
        isAdoptionMode: true,
        isInvisibleDogsSearch: true,
        location: null,
        breed: null
      };

      // Send message to chat API with pre-loaded invisible dogs
      const invisibleDogsMessage = "Show me the most invisible dogs";
      setMessages(prev => [...prev, { role: 'user', content: invisibleDogsMessage }]);
      setInput('');
      setShouldScroll(true);
      setHasUserInteracted(true);

      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: invisibleDogsMessage }],
          memory: invisibleDogsMemory
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Chat API failed');
      }

      const chatData = await chatResponse.json();
      setMessages(prev => [...prev, { role: 'assistant', content: chatData.content }]);
      setMemory(chatData.memory);
      setShouldScroll(true);

    } catch (error) {
      console.error('[❌ Invisible Dogs Button Error]', error);
      // Fallback to regular chat message
      const invisibleDogsMessage = "Show me the most invisible dogs";
      setMessages(prev => [...prev, { role: 'user', content: invisibleDogsMessage }]);
      setInput(invisibleDogsMessage);
      setShouldScroll(true);
      setHasUserInteracted(true);
      handleSend();
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-6">
        {thankYouImageUrl && (
          <ThankYouToast
            imageUrl={thankYouImageUrl}
            onClose={() => setThankYouImageUrl(null)}
            onDownload={handleDownload}
          />
        )}


        <Navigation />
        {/* Raffle banner removed - keeping code for future use
        <a
          href="/raffle"
          className="block group relative mx-auto mt-6 mb-10 w-full max-w-5xl rounded-2xl overflow-hidden shadow-lg border border-yellow-400 bg-yellow-100 hover:shadow-2xl transition-all duration-300"
        >
          <img
            src="/images/Coins.png"
            alt="Gold coins"
            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
          />
          <div className="relative z-10 p-6 md:p-10 flex flex-col items-center text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-800 drop-shadow">
              🪙 Join Barkr’s 50/50 Rescue Raffle!
            </h2>
            <p className="mt-2 text-yellow-900 text-base md:text-lg font-extrabold">
              Win ETH. Help dogs. Everyone wins.
            </p>
            <button className="mt-4 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-full shadow-md transition duration-200">
              🎟️ Enter Now
            </button>
          </div>
        </a>
        */}

        <main className="flex flex-col items-center gap-10 mt-8 px-4">
          {/* Invisible Dog Spotlight */}
          <div className="w-full max-w-4xl">
            <InvisibleDogSpotlight />
          </div>

          {/* Mission Section - Compact & Engaging */}
          <div className="card-gradient-blue p-8 md:p-10 max-w-3xl w-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-200/30 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 text-center">
              <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold mb-6">
                🐾 Our Mission
              </span>
              
              <h2 className="section-title text-gradient-blue mb-4">
                Underdogs First
              </h2>
              
              <p className="text-lg text-gray-700 mb-6 max-w-xl mx-auto leading-relaxed">
                Rural rescues. Overlooked dogs. Hard cases. We surface the invisible 
                and route help where it actually saves lives.
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/70 rounded-2xl p-3 md:p-4 shadow-md border border-blue-100 card-hover min-w-0">
                  <div className="text-2xl mb-1">🔗</div>
                  <p className="text-xs md:text-sm font-bold text-gray-800 truncate">Transparent</p>
                </div>
                <div className="bg-white/70 rounded-2xl p-3 md:p-4 shadow-md border border-blue-100 card-hover min-w-0">
                  <div className="text-2xl mb-1">🐕</div>
                  <p className="text-xs md:text-sm font-bold text-gray-800 truncate">Invisible Dogs</p>
                </div>
                <div className="bg-white/70 rounded-2xl p-3 md:p-4 shadow-md border border-blue-100 card-hover min-w-0">
                  <div className="text-2xl mb-1">💪</div>
                  <p className="text-xs md:text-sm font-bold text-gray-800 truncate">Small Rescues</p>
                </div>
              </div>
              
              <p className="text-gradient-gold font-bold text-lg italic">
                "For the dogs no one saw—and the people who never stopped looking."
              </p>
            </div>
          </div>
          {/* Donation Section - Streamlined */}
          <div className="card-gradient-purple p-8 md:p-10 max-w-3xl w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 -translate-x-1/2"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold mb-4">
                  💖 Support the Mission
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
                  Every Donation Saves Lives
                </h2>
                <p className="text-white/80 text-lg max-w-lg mx-auto">
                  100% goes to rescue partners. Choose your preferred way to give.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Direct Send - ETH, USDC & TOBY */}
                <WalletDonation 
                  onSuccess={(amount, token) => {
                    setLastDonationAmount(amount);
                    setLastDonationToken(token);
                    setShowNFTMint(true);
                  }}
                />
                
                {/* Token Swap - Swap any token to ETH/USDC/TOBY */}
                <TokenSwap 
                  onSuccess={() => {
                    setShowNFTMint(true);
                  }}
                />
              </div>
              
              {/* NFT Mint After Donation */}
              {showNFTMint && (
                <div className="mt-6">
                  <DonorNFTMint 
                    donationAmount={lastDonationAmount}
                    tokenType={lastDonationToken}
                  />
                </div>
              )}
            </div>
          </div>
          {/* Barkr AI Chat Section */}
          <div className="max-w-3xl w-full">
            <div className="card-gradient-blue p-8 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-200/30 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                  <motion.img
                    src="/images/barkr.png"
                    alt="Barkr mascot"
                    className="w-24 h-auto drop-shadow-lg"
                    initial={{ y: 0 }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "loop",
                      ease: "easeInOut",
                    }}
                  />

                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-2xl font-bold text-gradient-blue mb-2">
                      Meet Barkr AI 🧠
                    </h2>
                    <p className="text-gray-600 mb-4">
                      Your rescue matchmaker. Find dogs, get training tips, or explore invisible pups waiting for homes.
                    </p>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <button
                        onClick={handleResetChat}
                        className="btn-secondary text-sm py-2"
                      >
                        🔄 Reset
                      </button>
                      <button
                        onClick={handleShowInvisibleDogs}
                        disabled={loading}
                        className="btn-gold text-sm py-2 disabled:opacity-50"
                      >
                        👻 Invisible Dogs
                      </button>
                    </div>


                  </div>
                </div>
                
                {/* Chat Container */}
                <div className="bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg h-96 flex flex-col justify-between border border-blue-100">
                  <div
                    className="overflow-y-auto space-y-2 text-sm text-gray-800 mb-2 pr-2 flex-1 min-h-0"
                    aria-live="polite"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                      overflowX: "hidden",
                      hyphens: "auto",
                    }}
                  >


                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        ref={i === messages.length - 1 && hasUserInteracted && messages.length > 1 ? lastMessageRef : null}
                        className={`p-3 rounded-lg text-sm leading-relaxed ${
                          msg.role === "assistant" ? "bg-blue-50" : "bg-gray-100"
                        }`}
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          whiteSpace: "normal",
                          overflowX: "hidden",
                          maxWidth: "100%",
                          fontFamily: "'Comic Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            strong: ({ node, ...props }) => (
                              <strong className="font-bold">
                                {props.children}
                              </strong>

                            ),
                            blockquote: ({ node, ...props }) => (
                              <blockquote className="border-l-4 border-yellow-400 pl-4 italic text-yellow-700 my-2">
                                {props.children}
                              </blockquote>
                            ),

                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition"
                              >
                                {props.children}
                              </a>
                            ),
                            img: ({ node, ...props }) => (
                              <img
                                {...props}
                                className="max-w-full rounded-lg my-2"
                                alt={props.alt || "Image"}
                              />
                            ),
                            p: ({ node, ...props }) => (
                              <p 
                                className="mb-2 text-sm text-gray-800 leading-relaxed" 
                                style={{ 
                                  wordBreak: "break-word", 
                                  overflowWrap: "break-word", 
                                  whiteSpace: "normal",
                                  maxWidth: "100%",
                                  fontFamily: "'Comic Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                                }}
                              >
                                {props.children}
                              </p>
                            ),
                            code: ({ node, ...props }) => (
                              <code 
                                {...props}
                                style={{
                                  fontFamily: "'Comic Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                                  wordBreak: "break-word",
                                  overflowWrap: "break-word",
                                  whiteSpace: "normal",
                                }}
                              />
                            ),
                            pre: ({ node, ...props }) => (
                              <pre 
                                {...props}
                                style={{
                                  fontFamily: "'Comic Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                                  wordBreak: "break-word",
                                  overflowWrap: "break-word",
                                  whiteSpace: "pre-wrap",
                                  maxWidth: "100%",
                                }}
                              />
                            ),
                          }}
                        >
                          {`**${msg.role === "assistant" ? "Barkr" : "You"}:** ${msg.content}`}
                        </ReactMarkdown>

                      </div>

                    ))}

                    {loading && (
                      <div className="flex items-center gap-2 px-4 py-3">
                        <img
                          src="/images/spinner-paw.svg"
                          alt="Barkr is thinking..."
                          className="animate-spin h-6 w-6 opacity-70"
                        />
                        <span className="text-sm italic text-gray-500">Barkr is thinking…</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Howl at me!"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg resize-none focus:outline-none"
                    />

                    <button
                      onClick={handleSend}
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 rounded-r-lg hover:bg-blue-500 disabled:opacity-50"
                    >
                      {loading ? "..." : "Send"}
                    </button>
                  </div>
                </div>{" "}
                {/* closes the chat box */}
              </div>{" "}
              {/* ✅ this was missing — it closes the text content wrapper */}
            </div>{" "}
            {/* closes flex container */}
          </div>{" "}
          {/* closes max-w-4xl */}
        </main>

        <Footer />
      </div>
    </div>
  );
}