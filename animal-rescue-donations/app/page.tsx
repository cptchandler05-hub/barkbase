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
import { motion } from "framer-motion";
import ThankYouToast from "@/app/components/ThankYouToast";
import Navigation from "@/app/components/Navigation";


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
  const [amount, setAmount] = useState("");
  const [thankYouImageUrl, setThankYouImageUrl] = useState<string | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
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
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
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
      const valueInWei = ethers.parseEther(amount).toString(); // ✅ safe and precise conversion

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
      const url = `/api/thank-you-image?wallet=${encodeURIComponent(shortWallet)}&amount=${amount}&variant=${variant}`;
      setThankYouImageUrl(url);

      alert("Thank you for your donation! Transaction: " + tx);
    } catch (error) {
      console.error("Donation error:", error);
      alert("Failed to process donation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnrampDonate = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/onramp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: Number(amount) }),
      });

      if (!response.ok) {
        throw new Error('Failed to create onramp session');
      }

      const { url } = await response.json();
      
      const onrampWindow = window.open(url, '_blank', 'width=500,height=700');
      
      const checkWindow = setInterval(() => {
        if (onrampWindow?.closed) {
          clearInterval(checkWindow);
          
          const shortWallet = 'onramp-user';
          const variant = Math.floor(Math.random() * 5);
          const thankYouUrl = `/api/thank-you-image?wallet=${encodeURIComponent(shortWallet)}&amount=${amount}&variant=${variant}`;
          setThankYouImageUrl(thankYouUrl);
        }
      }, 1000);

    } catch (error) {
      console.error("Onramp donation error:", error);
      alert("Failed to open payment window. Please try again or use wallet option.");
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
        <a
          href="/raffle"
          className="block group relative mx-auto mt-6 mb-10 w-full max-w-5xl rounded-2xl overflow-hidden shadow-lg border border-yellow-400 bg-yellow-100 hover:shadow-2xl transition-all duration-300"
        >
          {/* Coins image background */}
          <img
            src="/images/Coins.png"
            alt="Gold coins"
            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
          />

          {/* Overlay content */}
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

        <main className="flex flex-col items-center gap-10">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-center shadow-xl border border-gray-100">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">
              🐾 Our Mission
            </h2>
            <p className="text-gray-700 mb-4">
              Small rescues carry the heaviest weight. In rural towns and overlooked corners, they save dogs with no spotlight or safety net. BarkBase exists to change that.
            </p>
            <p className="text-gray-700 mb-4">
              We’re the first rescue donation & discovery platform native to web3—transparent, traceable, relentless. Your support lands onchain and fuels real dogs and the volunteer teams who fight for them.
            </p>
            <p className="text-gray-700 mb-4">
              I’m Barkr, the rescue mutt with a map to the invisible. I surface long-listed dogs, match adopters, and route attention—and help—where it actually saves lives.
            </p>
            <p className="text-gray-700 mb-4">
              Underdogs first. Rural rescues. Hard cases. If you can’t adopt, donate. If you can’t donate, share.
            </p>
            <p className="text-blue-700 font-bold text-lg mt-4">
              For the dogs no one saw<br />
              and the people who never stopped looking.
            </p>
          </div>
          <div className="bg-white shadow-xl rounded-2xl p-8 max-w-2xl w-full text-center border border-gray-100">
            <h1 className="text-3xl font-bold text-blue-700 mb-4">
              Join the tail-wagging revolution! 🐺
            </h1>
            <p className="text-base text-gray-600 mb-6">
              Your donation fuels rescue efforts & saves lives. Receive a custom
              "Thank you" image to share or coin to spread the word. Together,
              we’re unleashing the power of blockchain to create a better world
              for our furry best friends!
            </p>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (e.g. 0.01)"
              className="mb-4 px-4 py-2 border border-gray-300 rounded-lg w-full text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleDonate}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 transition disabled:opacity-50 mb-3"
            >
              {loading ? "Sending..." : `Pay from Wallet ${amount || ""} ETH`}
            </button>
            
            {process.env.NEXT_PUBLIC_ENABLE_ONRAMP === 'true' && (
              <>
                <button
                  onClick={handleOnrampDonate}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 mb-2"
                >
                  {loading ? "Loading..." : "Pay with Card / Apple Pay (via Coinbase)"}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Card & Apple Pay via Coinbase — funds arrive as USDC to our address on Base
                </p>
              </>
            )}
          </div>
          <div className="max-w-4xl w-full">
            <div className="flex flex-col md:flex-row items-center gap-6 bg-white shadow-md rounded-xl p-6 border border-gray-100">
              {/* This is the wrapper for the Barkr AI content */}
              <div className="w-full">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-4">
                  <motion.img
                    src="/images/barkr.png"
                    alt="Barkr mascot"
                    className="w-28 h-auto"
                    initial={{ y: 0 }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "loop",
                      ease: "easeInOut",
                    }}
                  />

                  <div className="text-center md:text-left">
                    <h2 className="text-2xl font-semibold text-blue-700 mb-2">
                      Meet Barkr AI 🧠
                    </h2>
                    <p className="text-gray-600">
                      Your smart rescue assistant. Ask about training,
                      adoptions, breed info, or let Barkr help find you a dog.
                    </p>

                    <div className="mt-2 text-center space-x-3">
                      <button
                        onClick={handleResetChat}
                        className="inline-block px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition"
                      >
                        🔄 Reset Chat
                      </button>
                      <button
                        onClick={handleShowInvisibleDogs}
                        disabled={loading}
                        className="inline-block px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition disabled:opacity-50"
                      >
                        👻 Most Invisible Dogs
                      </button>
                    </div>


                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md h-96 flex flex-col justify-between border border-gray-200">
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

        <footer className="text-sm text-center text-gray-500 mt-12">
          © {new Date().getFullYear()} BarkBase | Powered by Base | Built with
          ❤️ by Toad Gang
        </footer>
      </div>
    </div>
  );
}