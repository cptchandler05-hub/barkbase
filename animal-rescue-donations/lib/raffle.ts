import { ethers } from 'ethers';
import ABI from './RescueRaffleABI.json';

export const RAFFLE_CONTRACT_ADDRESS = '0x0CB71aa79AbEb15798e3291863C10Bc59A444a56';

// Safe wrapper: only call after wallet is connected
export async function getRaffleContract(readOnly = false) {
  try {
    const { ethereum } = window as any;

    let provider: ethers.Provider;
    let signerOrProvider: ethers.Signer | ethers.Provider;

    if (!ethereum || readOnly) {
      // Fallback to public read-only provider (Base Sepolia)
      provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      signerOrProvider = provider;
    } else {
      const browserProvider = new ethers.BrowserProvider(ethereum);
      const signer = await browserProvider.getSigner();
      signerOrProvider = signer;
    }

    return new ethers.Contract(RAFFLE_CONTRACT_ADDRESS, ABI, signerOrProvider);
  } catch (error) {
    console.error('Failed to get contract:', error);
    throw error;
  }
}


export async function enterRaffle(referrer: string = ethers.ZeroAddress, count: number = 1) {
  try {
    const contract = await getRaffleContract();
    const entryFee = await contract.ENTRY_FEE();
    const { ethereum } = window as any;
    if (!ethereum) throw new Error("No wallet found");

    const browserProvider = new ethers.BrowserProvider(ethereum);
    const signer = await browserProvider.getSigner();

    if (!signer) throw new Error("No signer available");

    const entrantAddress = await signer.getAddress();
    const referralAddress = referrer.toLowerCase() === entrantAddress.toLowerCase() ? ethers.ZeroAddress : referrer;

    const totalValue = entryFee * BigInt(count);
    const tx = await contract.enter(referralAddress, { value: totalValue });
    return tx.hash;
  } catch (error) {
    console.error("Enter raffle error:", error);
    throw error;
  }
}

export async function getPotTotal(): Promise<string> {
  try {
    const contract = await getRaffleContract(true);
    const pot = await contract.getPotTotal();
    return ethers.formatEther(pot);
  } catch (error) {
    console.error('Error getting pot total:', error);
    return '0';
  }
}

export async function getParticipants(): Promise<string[]> {
  try {
    const contract = await getRaffleContract(true);
    const entries = await contract.getEntries();
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('Error getting participants:', error);
    return [];
  }
}

export async function getTimeLeft(): Promise<number> {
  try {
    const contract = await getRaffleContract(true);
    const time = await contract.timeLeft();
    return Number(time);
  } catch (error) {
    console.error('Error getting time left:', error);
    return 0;
  }
}

export async function getLastWinner(): Promise<string> {
  try {
    const contract = await getRaffleContract();
    return await contract.lastWinner();
  } catch (error) {
    console.error('Error fetching last winner:', error);
    return '';
  }
}

export async function getLastPrize(): Promise<string> {
  try {
    const contract = await getRaffleContract();
    const prize = await contract.lastPrize();
    return ethers.formatEther(prize);
  } catch (error) {
    console.error('Error fetching last prize:', error);
    return '0';
  }
}
