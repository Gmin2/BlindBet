import { useState, useCallback, useEffect } from "react";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { getContractAddress } from "@/lib/contracts/addresses";
import { ABIs } from "@/lib/contracts/abis";
import { getFhevmInstance } from "@/lib/fhevm/client";

export function useUserBalance() {
  const { address: userAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const tokenAddress = getContractAddress("sepolia", "ConfidentialUSDC") as `0x${string}`;

  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { data: encryptedBalance } = useReadContract({
    address: tokenAddress,
    abi: ABIs.ConfidentialUSDC,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  const decryptBalance = useCallback(async () => {
    if (!userAddress || !encryptedBalance) return;

    try {
      setLoading(true);
      setError(null);

      const instance = await getFhevmInstance();
      const keypair = instance.generateKeypair();

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        [tokenAddress],
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
        [{ handle: encryptedBalance as string, contractAddress: tokenAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        [tokenAddress],
        userAddress,
        Math.floor(Date.now() / 1000).toString(),
        "10"
      );

      const decryptedBalance = BigInt(result[encryptedBalance as string] || 0);
      setBalance(decryptedBalance);
    } catch (err) {
      setError(err as Error);
      console.error("Failed to decrypt balance:", err);
    } finally {
      setLoading(false);
    }
  }, [userAddress, encryptedBalance, tokenAddress, signTypedDataAsync]);

  useEffect(() => {
    if (encryptedBalance && userAddress) {
      decryptBalance();
    } else {
      setBalance(null);
    }
  }, [encryptedBalance, userAddress, decryptBalance]);

  return {
    balance,
    loading,
    error,
    encryptedBalance: encryptedBalance as string | undefined,
    refresh: decryptBalance,
  };
}




