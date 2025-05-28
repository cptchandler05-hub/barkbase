
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import ABI from '@/lib/RescueRaffleABI.json';

const RAFFLE_CONTRACT_ADDRESS = '0x0CB71aa79AbEb15798e3291863C10Bc59A444a56';
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const contract = new ethers.Contract(RAFFLE_CONTRACT_ADDRESS, ABI, provider);

export async function GET() {
  try {
    const lastWinner = await contract.lastWinner();
    const lastPrize = await contract.lastPrize();
    
    return NextResponse.json({
      lastWinner,
      lastPrize: ethers.formatEther(lastPrize),
      hasWinner: lastWinner !== '0x0000000000000000000000000000000000000000'
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message });
  }
}
