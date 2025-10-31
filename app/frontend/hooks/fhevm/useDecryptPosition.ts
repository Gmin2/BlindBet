import { useState, useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { getFhevmInstance } from "@/lib/fhevm/client";
import type { EncryptedPosition, DecryptedPosition } from "@/types/market";

export function useDecryptPosition(contractAddress: string) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const decryptPosition = useCallback(
    async (
      encryptedPosition: EncryptedPosition
    ): Promise<DecryptedPosition | null> => {
      if (!address) return null;

      try {
        setLoading(true);
        setError(null);

        const instance = await getFhevmInstance();

        const keypair = instance.generateKeypair();

        const eip712 = instance.createEIP712(
          keypair.publicKey,
          [contractAddress],
          Math.floor(Date.now() / 1000).toString(),
          "10"
        );

        const signature = await signTypedDataAsync({
          domain: eip712.domain,
          types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          primaryType: "UserDecryptRequestVerification",
          message: eip712.message,
        });

        const result = await instance.userDecrypt(
          [
            { handle: encryptedPosition.yesAmount, contractAddress },
            { handle: encryptedPosition.noAmount, contractAddress },
          ],
          keypair.privateKey,
          keypair.publicKey,
          signature.replace("0x", ""),
          [contractAddress],
          address,
          Math.floor(Date.now() / 1000).toString(),
          "10"
        );

        const yesAmount = BigInt(result[encryptedPosition.yesAmount] || 0);
        const noAmount = BigInt(result[encryptedPosition.noAmount] || 0);

        return {
          yesAmount,
          noAmount,
          totalBet: yesAmount + noAmount,
        };
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [contractAddress, address, signTypedDataAsync]
  );

  return {
    decryptPosition,
    loading,
    error,
  };
}





