import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { createEncryptedInput } from "@/lib/fhevm/client";

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

export function useEncryptInput(contractAddress: string) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const encryptBetInput = useCallback(
    async (amount: bigint, outcome: boolean): Promise<EncryptedInput | null> => {
      if (!address) return null;

      try {
        setLoading(true);
        setError(null);

        const input = await createEncryptedInput(contractAddress, address);
        input.add64(amount);
        input.addBool(outcome);

        const encrypted = await input.encrypt();

        return {
          handles: encrypted.handles,
          inputProof: encrypted.inputProof,
        };
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contractAddress, address]
  );

  const encryptApprovalInput = useCallback(
    async (amount: bigint): Promise<EncryptedInput | null> => {
      if (!address) return null;

      try {
        setLoading(true);
        setError(null);

        const input = await createEncryptedInput(contractAddress, address);
        input.add64(amount);

        const encrypted = await input.encrypt();

        return {
          handles: encrypted.handles,
          inputProof: encrypted.inputProof,
        };
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contractAddress, address]
  );

  return {
    encryptBetInput,
    encryptApprovalInput,
    loading,
    error,
  };
}





