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


const DONATION_ADDRESS = "0x18f6212B658b8a2A9D3a50360857F78ec50dC0eE";

export default function Page() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm Barkr—ask me anything about dog rescue, training, or finding a dog to adopt.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [thankYouImageUrl, setThankYouImageUrl] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only auto-scroll if there are more than 1 message (to avoid scrolling on initial load)
    if (messages.length > 1 && lastMessageRef.current) {
      requestAnimationFrame(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages]);


  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const content = data.content || "";
      if (content) {
        setMessages((prev) => [...prev, { role: "assistant", content }]);
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


  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {thankYouImageUrl && (
          <ThankYouToast
            imageUrl={thankYouImageUrl}
            onClose={() => setThankYouImageUrl(null)}
            onDownload={handleDownload}
          />
        )}


        <header className="flex items-center justify-between mb-12 z-50 relative">
          <img
            src="/logos/barkbase-logo.png"
            alt="BarkBase Logo"
            className="w-48 md:w-60 lg:w-72 h-auto"
          />
          <div className="relative z-50">
            <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2">
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownLink
                  icon="wallet"
                  href="https://keys.coinbase.com"
                >
                  Wallet
                </WalletDropdownLink>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>

        </header>
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
              At BarkBase, we believe the smallest rescues often carry the
              heaviest load. In rural towns and forgotten corners, dedicated
              people give everything they have to save dogs—without big
              sponsors, without much help, and without ever giving up. We're
              here to change that.
            </p>
            <p className="text-gray-700 mb-4">
              BarkBase is a donation & discovery platform built to lift up these
              unsung heroes. Through transparent, onchain giving and tools like
              Barkr, our AI rescue dog, we connect donors to real rescues, real
              needs, and real lives saved.
            </p>
            <p className="text-gray-700 mb-4">
              Barkr helps people find adoptable dogs, offers support and
              education, and shines a light on the incredible work being done by
              our rescue partners. Every donation brings food, medical care,
              safe shelter, and hope. As BarkBase grows, so does our pack—but
              the mission stays the same.
            </p>
            <p className="text-blue-700 font-bold text-lg mt-4">
              We’re here to help dogs
              <br />& the people who never gave up on them.
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
              className="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
            >
              {loading ? "Sending..." : `Donate Base ${amount || ""} ETH`}
            </button>
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
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md h-96 flex flex-col justify-between border border-gray-200">
                  <div
                    className="overflow-y-auto space-y-2 text-sm text-gray-800 mb-2 pr-2 flex-1 min-h-0"
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
                        ref={i === messages.length - 1 && msg.role === "assistant" ? lastMessageRef : null}
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

                  </div>

                  <div className="mt-2 flex">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
                      placeholder="Ask Barkr about dog care or finding a pup..."
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