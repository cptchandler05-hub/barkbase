'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';

const DONATION_ADDRESS = '0x18f6212B658b8a2A9D3a50360857F78ec50dC0eE';

export default function Page() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Barkr—ask me anything about dog rescue, training, or finding a dog to adopt." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const content = data.content || '';
      if (content) {
        setMessages((prev) => [...prev, { role: 'assistant', content }]);
      }
    } catch (error) {
      console.error('API error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't fetch a reply just now." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async () => {
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      setLoading(true);
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        alert('No Ethereum provider found. Please install a wallet.');
        return;
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        alert('Please connect your wallet.');
        return;
      }

      const valueInWei = (parsedAmount * 1e18).toString();
      const tx = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          to: DONATION_ADDRESS,
          from: accounts[0],
          value: '0x' + valueInWei.toString(16),
        }],
      });

      alert('Thank you for your donation! Transaction: ' + tx);
    } catch (error) {
      console.error('Donation error:', error);
      alert('Failed to process donation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <header className="flex items-center justify-between mb-12">
          <img src="/logos/barkbase-logo.png" alt="BarkBase Logo" className="w-48 md:w-60 lg:w-72 h-auto" />
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
              <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                Wallet
              </WalletDropdownLink>
              <WalletDropdownDisconnect />
            </WalletDropdown>
          </Wallet>
        </header>

        <main className="flex flex-col items-center gap-10">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full text-center shadow-xl border border-gray-100">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">🐾 Our Mission</h2>
            <p className="text-gray-700 mb-4">
              BarkBase is here to help rescue as many dogs as possible—providing food, medical care, safe foster homes, and finding loving forever families.
            </p>
            <p className="text-gray-700 mb-4">
              Powered by Barkr, our AI rescue dog, we help users find their perfect match and provide guidance on everything from dog behavior and training to diet and healthcare.
            </p>
            <p className="text-gray-700 mb-4">
              We partner with real, verified dog rescues and help raise donations to support their lifesaving work. As BarkBase grows, so does our pack—but the mission stays the same.
            </p>
            <p className="text-blue-700 font-bold text-lg mt-4">
              Your donation rescues dogs and powers BarkBase.<br />Thanks for supporting the mission!
            </p>
          </div>

          <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-gray-100">
            <h1 className="text-3xl font-bold text-blue-700 mb-4">Join the tail-wagging revolution! 🐺</h1>
            <p className="text-base text-gray-600 mb-6">
              Your donation fuels rescue efforts & saves lives. Together, we’re unleashing the power of blockchain to create a better world for our furry best friends!
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
              {loading ? 'Sending...' : `Donate Base ${amount || ''} ETH`}
            </button>
          </div>

          <div className="max-w-md w-full">
            <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100 text-center">
              <h2 className="text-2xl font-semibold text-blue-700 mb-2">Meet Barkr AI 🧠</h2>
              <p className="text-gray-600 mb-4">
                Your smart rescue assistant. Ask about training, adoptions, breed info, or let Barkr help find you a dog.
              </p>
              <div className="bg-white p-4 rounded-lg shadow-md h-96 flex flex-col justify-between border border-gray-200">
                <div ref={chatContainerRef} className="overflow-y-auto space-y-2 text-sm text-gray-800 mb-2 pr-1">
                  {messages.map((msg, i) => (
                    <div key={i} className={`p-2 rounded whitespace-pre-wrap ${msg.role === 'assistant' ? 'bg-blue-50' : 'bg-gray-100'}`}>
                      <strong>{msg.role === 'assistant' ? 'Barkr:' : 'You:'}</strong>{' '}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition">
                              {props.children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ))}
                  <div ref={chatContainerRef} />
                </div>
                <div className="mt-2 flex">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
                    placeholder="Ask Barkr about dog care or finding a pup..."
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 rounded-r-lg hover:bg-blue-500 disabled:opacity-50"
                  >
                    {loading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-sm text-center text-gray-500 mt-12">
          © {new Date().getFullYear()} BarkBase | Powered by Base | Built with ❤️ by Toad Gang
        </footer>
      </div>
    </div>
  );
}