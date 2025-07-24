"use client";

import { useEffect, useState, useRef } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { getParticipants, getPotTotal, enterRaffle, getTimeLeft as getTimeLeftFromContract } from "@/lib/raffle";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import { Facebook, SendHorizontal } from "lucide-react";
import { X } from "lucide-react";

import { getWinners } from "@/lib/getWinners";
import BarkrBackflip from "@/components/BarkrBackFlip";


export default function RafflePage() {
  const { address, isConnected } = useAccount();
  const [pot, setPot] = useState("0");
  const [participants, setParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [refLink, setRefLink] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState(1);
  const [showPaws, setShowPaws] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [raffleEnded, setRaffleEnded] = useState(false);
  const [winners, setWinners] = useState<{ address: string; amount: string }[]>([]);  
  const [playBackflip, setPlayBackflip] = useState(false);  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const searchParams = useSearchParams();
  const referrer = searchParams.get("ref");
  useEffect(() => {
    async function fetchWinners() {
      try {
        const data = await getWinners();
        console.log("Fetched winners data:", data); // Debug log
        setWinners(data || []);
      } catch (error) {
        console.error("Error fetching winners:", error);
        setWinners([]);
      }
    }

    fetchWinners();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const potTotal = await getPotTotal();
        const participantList = await getParticipants();
        const secondsLeft = await getTimeLeftFromContract();

        setPot(potTotal);
        setParticipants(participantList);
        initCountdown(secondsLeft);
      } catch (error) {
        console.error("Error loading raffle data:", error);
      }
    }

    fetchData();
    return () => clearInterval(timerRef.current!);
  }, [hasEntered]);

  function initCountdown(seconds: number) {
    clearInterval(timerRef.current!);
    updateTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      seconds -= 1;
      updateTimeLeft(seconds);
    }, 1000);
  }

  function updateTimeLeft(seconds: number) {
    if (seconds <= 0) {
      clearInterval(timerRef.current!);
      setRaffleEnded(true);
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      setTimeLeft({ hours, minutes, seconds: secs });
    }
  }

  const handleEnter = async () => {
    if (referrer && referrer.toLowerCase() === address?.toLowerCase()) {
      alert("You can't refer yourself!");
      return;
    }
    setLoading(true);
    try {
      await enterRaffle(referrer ?? undefined, entryCount);
      setHasEntered(true);
      if (address) {
        setRefLink(`${window.location.origin}/raffle?ref=${address}`);
      }
      setShowPaws(true);
      setPlayBackflip(true); // Trigger Barkr flip

      setTimeout(() => setShowPaws(false), 2000);
    } catch (error) {
      console.error("Entry failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderWinnerMessage = () => {
    if (!participants.length) return null;
    const lastWinner = participants[participants.length - 1];
    const shortWinner = `${lastWinner.slice(0, 6)}...${lastWinner.slice(-4)}`;
    const halfPot = (parseFloat(pot) / 2).toFixed(4);

    const newWinner = { address: shortWinner, amount: halfPot };
    if (!winners.find(w => w.address === shortWinner && w.amount === halfPot)) {
      setWinners(prev => [newWinner, ...prev]);
      setPlayBackflip(true);
      setTimeout(() => setPlayBackflip(false), 2000);
    }

    return (
      <div className="bg-green-100 p-4 rounded-xl shadow mb-4 animate-pulse">
        🎉 Congratulations to <strong>{shortWinner}</strong>!<br />
        <strong>🏆 They won:</strong> {halfPot} ETH<br />
        <strong>🐶 And {halfPot} ETH goes to support the mission & our featured dog rescue!</strong><br />
        Everybody wins! A new raffle will begin soon...
      </div>
    );
  };



  return (

    <div className="relative min-h-screen">
      <div className="mt-4 flex justify-end z-[1000] relative">


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
    </div>



      <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-yellow-50 to-blue-100 rounded-2xl shadow-2xl relative overflow-visible px-6 py-10 mt-8 sm:mt-16 md:mt-20 z-[10]">


      <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pawprints.png')] bg-cover opacity-10 animate-pulse-slow z-0" />
      {/* BarkBase Logo - halfway down left side */}
      <img
        src="/logos/barkbase-logo.png"
        alt="BarkBase Logo"
        className="absolute top-1/3 left-4 transform -translate-y-1/2 w-28 sm:w-36 z-10"
      />

      {/* Barkr Mascot - halfway down right side */}
      <img
        src="/images/barkr.png"
        alt="Barkr Mascot"
        className="absolute top-1/3 right-4 transform -translate-y-1/2 w-20 sm:w-28 z-10"
      />


      <div className="relative z-10">
              <div className="flex justify-center items-center mb-4">
                <h1 className="text-3xl font-bold text-blue-900 text-center">🐾 Barkr's 50/50 Rescue Raffle🐾</h1>
              </div>


        <p className="text-lg mb-2 text-blue-800">🎉 Win big. Save lives. Everyone wins! 🐶</p>

        {(raffleEnded && participants.length > 0) ? renderWinnerMessage() : (
          <>
            <p><strong>Pot Total:</strong> {pot} ETH</p>
            <p><strong>Participants:</strong> {participants.length}</p>

            <div className="mt-6 space-y-3">
              <input
                type="number"
                min={1}
                step={1}
                value={entryCount}
                onChange={(e) => setEntryCount(parseInt(e.target.value) || 1)}
                className="w-24 text-center border border-gray-300 rounded px-2 py-1"
              />
              <p>Total: {(entryCount * 0.005).toFixed(3)} ETH</p>
              <button
                onClick={() => {
                  if (!isConnected) {
                    alert("Please connect your wallet to enter the raffle.");
                    return;
                  }
                  handleEnter();
                }}
                disabled={loading}
                className="bg-green-600 text-white font-bold px-6 py-3 rounded-full hover:bg-green-700 transition transform hover:scale-105 shadow-md animate-pulse-fast"
              >
                {loading ? "Entering..." : `🎟️ Enter Raffle (${(entryCount * 0.005).toFixed(3)} ETH)`}
              </button>
            </div>




            {refLink && (
              <div className="mt-6 bg-green-100 p-4 rounded-xl text-sm space-y-2 text-left border border-green-300">
                <p>📣 <strong>Your referral link:</strong></p>
                <p className="break-all font-mono text-blue-800">{refLink}</p>
                <p>
                  🐶 Share this link to support BarkBase and get an <strong>extra entry</strong> for every friend who joins!
                </p>
                <div className="flex gap-3 mt-3 justify-start">
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                      "Win big. Save lives. Every entry helps dogs in need! 🐾 I just entered BarkBase's 50/50 Rescue Raffle. Half the pot helps dog rescues. Enter here:"
                    )}&url=${encodeURIComponent(refLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition"
                  >
                    <img src="/logos/x-logo.png" alt="Share on X" className="w-7 h-7" />
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(
                      "🐶 BarkBase's 50/50 Raffle helps real rescue dogs. Enter to win — I get bonus entries if you join through my link!"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition"
                  >
                    <img src="/logos/telegram-logo.png" alt="Share on Telegram" className="w-7 h-7" />
                  </a>

                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}&quote=${encodeURIComponent(
                      "BarkBase 50/50 Raffle: Win crypto while helping rescue dogs! 🐕❤️"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition"
                  >
                    <img src="/logos/facebook-logo.png" alt="Share on Facebook" className="w-7 h-7" />
                  </a>

                  <a
                    href={`https://warpcast.com/~/compose?text=${encodeURIComponent(
                      "🐶 BarkBase's 50/50 Raffle helps real rescue dogs. Enter to win — I get bonus entries if you join through my link! " + refLink
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition"
                  >
                    <img 
                      src="/logos/farcaster-logo.png" 
                      alt="Share on Farcaster" 
                      className="w-7 h-7"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{display: 'none'}}
                    >
                      F
                    </div>
                  </a>
                </div>
              </div>
            )}

            <div className="text-xl font-bold mt-6 text-blue-800 animate-pulse-fast">
              ⏳ Time Left: {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </div>
            <button
              onClick={() => setShowRules(true)}
              className="mt-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 px-3 py-1 rounded-full border border-blue-300 transition-colors shadow-sm"
            >
              📜 Raffle Rules
            </button>

            <div className="mt-6 text-left text-sm max-h-40 overflow-y-auto pr-2">
              <strong>Current Participants:</strong>
              <ul className="list-disc list-inside mt-1">
                {participants.map((addr, i) => (
                  <li key={i}>{addr.slice(0, 6)}...{addr.slice(-4)}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="mt-10 text-left text-sm bg-white bg-opacity-60 p-4 rounded-xl border border-blue-200">
          <h3 className="text-blue-900 text-2xl text-center font-semibold mb-2">🏅 Past Winners</h3>
          {winners.length > 0 ? (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-2">
              {winners.map((winner, i) => (
                <li key={i} className="text-blue-800 flex justify-between">
                  <span>
                    🏆 Round {winners.length - i} — {winner.address.length > 10 ? `${winner.address.slice(0, 6)}...${winner.address.slice(-4)}` : winner.address}
                  </span>
                  <span>
                    {parseFloat(winner.amount?.toString() || '0').toFixed(3)} ETH
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-600">No winners yet. Be the first! 🎉</p>
          )}
        </div>


        {showPaws && (
          <div className="absolute inset-0 pointer-events-none animate-burst z-50">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl">🐾🐾🐾</div>
          </div>
        )}
        {showRules && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white max-w-lg w-full p-6 rounded-xl shadow-lg text-left overflow-y-auto max-h-[90vh]">
              <h2 className="text-xl font-bold mb-4 text-blue-800">🐾 Barkr’s 50/50 Rescue Raffle — Rules of the Ruff</h2>
              <ul className="list-disc pl-6 text-sm space-y-2">
                <li>🎟️ Each entry costs 0.005 ETH — just one juicy treat for a shot at glory.</li>
                <li>🔁 You can enter as many times as you want in one transaction.</li>
                <li>⏰ When the countdown hits 00:00:00, a winner is picked on-chain by BarkBase’s smart contract.</li>
                <li>🐕 50% of the pot goes to the winner.</li>
                <li>🏥 50% fuels real-life rescue missions through BarkBase and our verified rescue partners.</li>
                <li>🐾 A new round automatically begins when the current one ends. No leashes. No lags.</li>
              </ul>

              <h3 className="mt-4 font-bold text-blue-700">Referral Bonus Bones:</h3>
              <ul className="list-disc pl-6 text-sm space-y-2">
                <li>🔗 After entering, you’ll fetch a custom referral link.</li>
                <li>📣 Share it with your pack — every pup who enters through your link gives you +1 bonus entry in this round.</li>
                <li>🚫 Self-referrals don’t count. Barkr’s got anti-fraud sniffers enabled.</li>
              </ul>

              <h3 className="mt-4 font-bold text-blue-700">When the Treats Are Tallied:</h3>
              <ul className="list-disc pl-6 text-sm space-y-2">
                <li>🏆 If you win, ETH hits your wallet automatically. No claim links. No hoops.</li>
                <li>📜 All winners live forever on the Winners Board.</li>
                <li>💡 Every draw is fully transparent and on-chain — as honest as a good boy’s heart.</li>
              </ul>

              <h3 className="mt-4 font-bold text-blue-700">Technical Treats:</h3>
              <ul className="list-disc pl-6 text-sm space-y-2">
                <li>🌐 Built on the Base Network — secure, scalable, and lightning-fast.</li>
                <li>👛 You’ll need a crypto wallet (like MetaMask or Coinbase Wallet) connected to Base.</li>
                <li>📜 BarkBase smart contract:<br />
                  <a href="https://sepolia.basescan.org/address/0x0CB71aa79AbEb15798e3291863C10Bc59A444a56" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    0x0CB71aa79AbEb15798e3291863C10Bc59A444a56
                  </a>
                </li>
                <li>💸 No cap on entries. Stack your odds, fund the mission, and maybe fetch the win.</li>
              </ul>

              <button
                onClick={() => setShowRules(false)}
                className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <BarkrBackflip trigger={playBackflip} />


      </div> 
      </div>


      <footer className="text-sm text-center text-gray-500 mt-12">
      © {new Date().getFullYear()} BarkBase | Powered by Base | Built with ❤️ by Toad Gang

      </footer>
          </div>
        );
      }