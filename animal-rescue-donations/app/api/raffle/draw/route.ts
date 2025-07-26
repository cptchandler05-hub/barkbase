// app/api/raffle/draw/route.ts
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import ABI from '@/lib/RescueRaffleABI.json';

import { logWinner } from "@/lib/logWinner";

const RAFFLE_CONTRACT_ADDRESS = '0x0CB71aa79AbEb15798e3291863C10Bc59A444a56';
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const wallet = new ethers.Wallet(process.env.DRAW_PRIVATE_KEY!, provider);
const contract = new ethers.Contract(RAFFLE_CONTRACT_ADDRESS, ABI, wallet);

export async function GET() {
  try {
    const timeLeft: bigint = await contract.timeLeft();
    if (timeLeft > 0n) {
      return NextResponse.json({ status: 'raffle-still-running', timeLeft: Number(timeLeft) });
    }

    const entries: string[] = await contract.getEntries();

    const tx = await contract.drawWinner();
    const receipt = await tx.wait();

    const winner = await contract.getLastWinner();
    const potBalance = await provider.getBalance(RAFFLE_CONTRACT_ADDRESS);
    const prize = parseFloat(ethers.formatEther(potBalance)) / 2;

    console.log("🎯 DRAW COMPLETED:", {
      winner,
      potBalance: ethers.formatEther(potBalance),
      prize,
      entriesCount: entries.length
    });

    await logWinner(winner, prize);

    // Immediately restart the raffle - no delay to maintain 10 PM EST schedule
    try {
      console.log('🔄 Restarting raffle immediately...');
      const restartTx = await contract.startNewRaffle();
      await restartTx.wait();
      console.log('✅ Raffle restarted successfully');
    } catch (restartError) {
      console.error('❌ Failed to restart raffle:', restartError);
    }

    if (entries.length === 0) {
      return NextResponse.json({ 
        status: 'no-entries-draw-executed', 
        txHash: tx.hash, 
        winner, 
        prize,
        shouldRefresh: true // Signal UI to refresh after showing winner message
      });
    }

    return NextResponse.json({ 
      status: 'winner-drawn', 
      txHash: tx.hash, 
      winner, 
      prize,
      shouldRefresh: true // Signal UI to refresh after showing winner message
    });
  } catch (err) {
    console.error('Draw error:', err);
    return NextResponse.json({ status: 'error', message: (err as Error).message });
  }
}