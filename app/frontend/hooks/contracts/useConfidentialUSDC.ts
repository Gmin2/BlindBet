import { useCallback, useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { getContractAddress } from "@/lib/contracts/addresses";
import { ABIs } from "@/lib/contracts/abis";
import { useEncryptInput } from "@/hooks/fhevm/useEncryptInput";

export function useConfidentialUSDC() {
  const { address: userAddress } = useAccount();
  const tokenAddress = useMemo(() => getContractAddress("sepolia", "ConfidentialUSDC") as `0x${string}`, []);

  const { writeContractAsync } = useWriteContract();
  const [approving, setApproving] = useState(false);
  const { encryptApprovalInput } = useEncryptInput(tokenAddress);

  const approve = useCallback(
    async (spender: string, amount: bigint) => {
      if (!userAddress) throw new Error("Wallet not connected");
      setApproving(true);
      try {
        const encrypted = await encryptApprovalInput(amount);
        if (!encrypted) throw new Error("Failed to encrypt approval amount");

        const txHash = await writeContractAsync({
          address: tokenAddress,
          abi: ABIs.ConfidentialUSDC,
          functionName: "approve",
          args: [spender as `0x${string}`, encrypted.handles[0], encrypted.inputProof],
        });
        return txHash;
      } finally {
        setApproving(false);
      }
    },
    [encryptApprovalInput, tokenAddress, userAddress, writeContractAsync],
  );

  return { tokenAddress, approve, approving };
}



