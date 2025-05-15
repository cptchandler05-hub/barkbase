import { ethers } from 'ethers';
import ABI from './RescueRaffleABI.json';

export const RAFFLE_CONTRACT_ADDRESS = '0x8cEc98ccdFa0c04D1a4B79340bda69C1c041b134';

// Safe wrapper: only call after wallet is connected
export async function getRaffleContract() {
  try {
    if (typeof window === 'undefined') throw new Error('Window undefined');
    const { ethereum } = window as any;
    if (!ethereum) throw new Error('No wallet found');

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    
    return new ethers.Contract(RAFFLE_CONTRACT_ADDRESS, ABI, signer);
  } catch (error) {
    console.error('Failed to get contract:', error);
    throw error;
  }
}

export async function enterRaffle(referrer: string = ethers.ZeroAddress) {
  try {
    const contract = await getRaffleContract();
    const entryFee = await contract.ENTRY_FEE();
    const provider = await contract.runner?.provider;
    if (!provider) throw new Error("No provider available");
    
    const signer = await provider.getSigner();
    if (!signer) throw new Error("No signer available");
    
    const entrantAddress = await signer.getAddress();
    const referralAddress = referrer.toLowerCase() === entrantAddress.toLowerCase() ? ethers.ZeroAddress : referrer;

    const tx = await contract.enter(referralAddress, { value: entryFee });
    return tx.hash;
  } catch (error) {
    console.error("Enter raffle error:", error);
    throw error;
  }
}

export async function getPotTotal(): Promise<string> {
  try {
    const contract = await getRaffleContract();
    const pot = await contract.getPotTotal();
    return ethers.formatEther(pot);
  } catch (error) {
    console.error('Error getting pot total:', error);
    return '0';
  }
}

export async function getParticipants(): Promise<string[]> {
  try {
    const contract = await getRaffleContract();
    const entries = await contract.getEntries();
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('Error getting participants:', error);
    return [];
  }
}

export async function getTimeLeft(): Promise<number> {
  try {
    const contract = await getRaffleContract();
    const time = await contract.timeLeft();
    return Number(time);
  } catch (error) {
    console.error('Error getting time left:', error);
    return 0;
  }
}
