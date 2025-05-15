import { ethers } from 'ethers';
import ABI from './RescueRaffleABI.json';

export const RAFFLE_CONTRACT_ADDRESS = '0x8cEc98ccdFa0c04D1a4B79340bda69C1c041b134';

// Safe wrapper: only call after wallet is connected
export async function getRaffleContract() {
  if (typeof window === 'undefined') throw new Error('Window undefined');
  const { ethereum } = window as any;
  if (!ethereum) throw new Error('No wallet found');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(RAFFLE_CONTRACT_ADDRESS, ABI, signer);
}

export async function enterRaffle(referrer: string = ethers.ZeroAddress) {
  const contract = await getRaffleContract();
  const entryFee = await contract.ENTRY_FEE();
  const signer = await contract.signer;
  const entrantAddress = await signer.getAddress();

  // Prevent self-referral
  const referralAddress = referrer.toLowerCase() === entrantAddress.toLowerCase() ? ethers.ZeroAddress : referrer;

  const tx = await contract.enter(referralAddress, { value: entryFee });
  return tx.hash;
}

export async function getPotTotal(): Promise<string> {
  try {
    const contract = await getRaffleContract();
    const pot = await contract.getPotTotal();
    return ethers.formatEther(pot);
  } catch {
    return '0';
  }
}

export async function getParticipants(): Promise<string[]> {
  try {
    const contract = await getRaffleContract();
    return await contract.getEntries();
  } catch {
    return [];
  }
}

export async function getTimeLeft(): Promise<number> {
  try {
    const contract = await getRaffleContract();
    const time = await contract.timeLeft();
    return Number(time);
  } catch {
    return 0;
  }
}
