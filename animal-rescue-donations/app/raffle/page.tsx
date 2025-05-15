"use client";

import { useEffect, useState, useRef } from "react";
import { ConnectWallet, Wallet } from "@coinbase/onchainkit/wallet";
import { getParticipants, getPotTotal, enterRaffle, getTimeLeft as getTimeLeftFromContract } from "@/lib/raffle";
import { useAccount, useConfig } from "wagmi";
import { useSearchParams } from "next/navigation";

export default function RafflePage() {
  const { address, isConnected } = useAccount();
  const [pot, setPot] = useState("0");
  const [participants, setParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [refLink, setRefLink] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [raffleEnded, setRaffleEnded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const searchParams = useSearchParams();
  const referrer = searchParams.get("ref");

  useEffect(() => {
    async function fetchData() {
      const potTotal = await getPotTotal();
      const participantList = await getParticipants();
      const secondsLeft = await getTimeLeftFromContract();
      setPot(potTotal);
      setParticipants(participantList);
      initCountdown(secondsLeft);
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
      await enterRaffle(referrer ?? undefined);
      setHasEntered(true);
      if (address) {
        setRefLink(`${window.location.origin}/raffle?ref=${address}`);
      }
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
    return (
      <div className="bg-green-100 p-4 rounded-xl shadow mb-4">
        🎉 Congratulations to <strong>{shortWinner}</strong>!<br />
        <strong>🏆 They won:</strong> {halfPot} ETH<br />
        <strong>🐶 And {halfPot} ETH goes to dog rescues!</strong><br />
        Everybody wins! A new raffle will begin soon...
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center bg-white/80 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">🐾 50/50 Rescue Raffle</h1>
        <div className="hidden sm:block">
          <Wallet>
            <ConnectWallet />
          </Wallet>
        </div>
      </div>
      <p className="text-lg mb-2">Enter for a chance to win — and support dog rescues!</p>

      {raffleEnded ? (
        renderWinnerMessage()
      ) : (
        <>
          <p><strong>Pot Total:</strong> {pot} ETH</p>
          <p><strong>Participants:</strong> {participants.length}</p>

          <div className="mt-6">
            {!isConnected ? (
              <div className="sm:hidden">
                <Wallet>
                  <ConnectWallet />
                </Wallet>
              </div>
            ) : (
              <button
                onClick={handleEnter}
                disabled={loading}
                className="bg-blue-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Entering..." : "Enter Raffle (0.005 ETH)"}
              </button>
            )}
          </div>

          {refLink && (
            <div className="mt-4 bg-yellow-100 p-3 rounded-xl text-sm">
              📣 Your referral link:<br />
              <span className="break-all font-mono">{refLink}</span><br />
              🐶 Share it with friends to boost your impact!
            </div>
          )}

          <div className="text-xl font-bold mt-6">
            ⏳ Time Left: {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
          </div>

          <div className="mt-6 text-left text-sm">
            <strong>Current Participants:</strong>
            <ul className="list-disc list-inside mt-1">
              {participants.map((addr, i) => (
                <li key={i}>{addr.slice(0, 6)}...{addr.slice(-4)}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
