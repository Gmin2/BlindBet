import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ABIs } from "@/lib/contracts/abis";
import type { EncryptedPosition } from "@/types/market";
import { useEncryptInput } from "@/hooks/fhevm/useEncryptInput";

export function useBlindBetMarket(marketAddress: string) {
  const address = marketAddress as `0x${string}`;
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [position, setPosition] = useState<EncryptedPosition | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: tokenAddress } = useReadContract({
    address,
    abi: ABIs.BlindBetMarket,
    functionName: "token",
  });

  const { data: marketCount } = useReadContract({
    address,
    abi: ABIs.BlindBetMarket,
    functionName: "marketCount",
  });

  const getMarket = useCallback(
    async (marketId: number) => {
      if (!publicClient) return null;
      return await publicClient.readContract({
        address,
        abi: ABIs.BlindBetMarket as any,
        functionName: "getMarket",
        args: [BigInt(marketId)],
      });
    },
    [address, publicClient],
  );

  const getMarketState = useCallback(
    async (marketId: number) => {
      if (!publicClient) return null;
      return await publicClient.readContract({
        address,
        abi: ABIs.BlindBetMarket as any,
        functionName: "getMarketState",
        args: [BigInt(marketId)],
      });
    },
    [address, publicClient],
  );

  const getPosition = useCallback(
    async (marketId: number) => {
      if (!userAddress || !publicClient) return null;
      setLoading(true);
      try {
        const res = await publicClient.readContract({
          address,
          abi: ABIs.BlindBetMarket as any,
          functionName: "getEncryptedPosition",
          args: [BigInt(marketId), userAddress],
        });
        if (res) {
          const [yesAmount, noAmount, hasPosition] = res as [string, string, string];
          const p: EncryptedPosition = { yesAmount, noAmount, exists: hasPosition };
          setPosition(p);
          return p;
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [address, userAddress, publicClient],
  );

  const lockMarket = useCallback(
    async (marketId: number) => {
      setLoading(true);
      try {
        return await writeContractAsync({
          address,
          abi: ABIs.BlindBetMarket,
          functionName: "lockMarket",
          args: [BigInt(marketId)],
        });
      } finally {
        setLoading(false);
      }
    },
    [address, writeContractAsync],
  );

  const requestResolution = useCallback(
    async (marketId: number) => {
      setLoading(true);
      try {
        return await writeContractAsync({
          address,
          abi: ABIs.BlindBetMarket,
          functionName: "requestResolution",
          args: [BigInt(marketId)],
        });
      } finally {
        setLoading(false);
      }
    },
    [address, writeContractAsync],
  );

  const setResolution = useCallback(
    async (marketId: number, outcome: number) => {
      setLoading(true);
      try {
        return await writeContractAsync({
          address,
          abi: ABIs.BlindBetMarket,
          functionName: "setResolution",
          args: [BigInt(marketId), outcome],
        });
      } finally {
        setLoading(false);
      }
    },
    [address, writeContractAsync],
  );

  const hasClaimed = useCallback(
    async (marketId: number) => {
      if (!userAddress) return false;
      return await (window as any).wagmi?.readContract?.({
        address,
        abi: ABIs.BlindBetMarket,
        functionName: "hasClaimed",
        args: [BigInt(marketId), userAddress],
      });
    },
    [address, userAddress],
  );

  const claimWinnings = useCallback(
    async (marketId: number) => {
      setLoading(true);
      try {
        return await writeContractAsync({
          address,
          abi: ABIs.BlindBetMarket,
          functionName: "claimWinnings",
          args: [BigInt(marketId)],
        });
      } finally {
        setLoading(false);
      }
    },
    [address, writeContractAsync],
  );

  return {
    tokenAddress: tokenAddress as string | undefined,
    marketCount,
    getMarket,
    getMarketState,
    getPosition,
    position,
    lockMarket,
    requestResolution,
    setResolution,
    hasClaimed,
    claimWinnings,
    loading,
  };
}
