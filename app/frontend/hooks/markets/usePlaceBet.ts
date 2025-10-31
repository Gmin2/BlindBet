import { useState, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { ABIs } from "@/lib/contracts/abis";
import { useEncryptInput } from "@/hooks/fhevm/useEncryptInput";
import { useConfidentialUSDC } from "@/hooks/contracts/useConfidentialUSDC";

export function usePlaceBet(marketAddress: string, tokenAddress?: string) {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { approve, approving: approvingToken } = useConfidentialUSDC();
  const [placing, setPlacing] = useState(false);
  const { encryptBetInput } = useEncryptInput(marketAddress);

  const placeBet = useCallback(
    async (marketId: number, amount: bigint, outcome: boolean) => {
      if (!userAddress) throw new Error("Wallet not connected");
      if (!tokenAddress) throw new Error("Token address not available");

      try {
        setPlacing(true);

        // Step 1: Approve tokens (encrypted)
        await approve(tokenAddress, amount);

        // Step 2: Encrypt bet inputs
        const encrypted = await encryptBetInput(amount, outcome);
        if (!encrypted) throw new Error("Failed to encrypt bet inputs");

        // Step 3: Place bet
        const txHash = await writeContractAsync({
          address: marketAddress as `0x${string}`,
          abi: ABIs.BlindBetMarket,
          functionName: "placeBet",
          args: [
            BigInt(marketId),
            encrypted.handles[0], // encryptedAmount
            encrypted.handles[1], // encryptedOutcome
            encrypted.inputProof,
          ],
        });

        return txHash;
      } finally {
        setPlacing(false);
      }
    },
    [marketAddress, tokenAddress, userAddress, approve, encryptBetInput, writeContractAsync],
  );

  return {
    placeBet,
    placing,
    approving: approvingToken,
    loading: placing || approvingToken,
  };
}



