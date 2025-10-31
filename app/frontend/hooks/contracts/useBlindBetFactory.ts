import { useCallback, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { getContractAddress } from "@/lib/contracts/addresses";
import { ABIs } from "@/lib/contracts/abis";

export function useBlindBetFactory() {
  const { address: userAddress } = useAccount();
  const factoryAddress = useMemo(() => getContractAddress("sepolia", "BlindBetFactory") as `0x${string}`, []);

  const [writing, setWriting] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: marketCount } = useReadContract({
    address: factoryAddress,
    abi: ABIs.BlindBetFactory,
    functionName: "marketCount",
  });

  const { data: config } = useReadContract({
    address: factoryAddress,
    abi: ABIs.BlindBetFactory,
    functionName: "getConfig",
  });

  const getMarketAddress = useCallback(
    async (id: number) => {
      if (!publicClient) return null;
      return await publicClient.readContract({
        address: factoryAddress,
        abi: ABIs.BlindBetFactory as any,
        functionName: "getMarketAddress",
        args: [BigInt(id)],
      });
    },
    [factoryAddress, publicClient],
  );

  const deployMarket = useCallback(
    async (params: { question: string; bettingDuration: bigint; resolutionDelay: bigint; resolver: `0x${string}` }) => {
      if (!userAddress) throw new Error("Wallet not connected");
      try {
        setWriting(true);
        const txHash = await writeContractAsync({
          address: factoryAddress,
          abi: ABIs.BlindBetFactory,
          functionName: "deployMarket",
          args: [params],
        });
        return txHash;
      } finally {
        setWriting(false);
      }
    },
    [factoryAddress, userAddress, writeContractAsync],
  );

  return {
    factoryAddress,
    marketCount: marketCount ? Number(marketCount) : 0,
    config,
    getMarketAddress,
    deployMarket,
    writing,
  };
}
