"use client";

import { useState } from "react";
import { parseUnits } from "ethers";
import { useAccount, useWriteContract } from "wagmi";
import { getContractAddress } from "@/lib/contracts/addresses";
import { ABIs } from "@/lib/contracts/abis";
import { toast } from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function MintTestTokens() {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [minting, setMinting] = useState(false);

  const tokenAddress = getContractAddress("sepolia", "ConfidentialUSDC") as `0x${string}`;

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress || !amount || parseFloat(amount) <= 0) return;

    try {
      setMinting(true);
      const amountWei = parseUnits(amount, 6);
      if (amountWei > BigInt(2 ** 64 - 1)) {
        toast.error("Amount too large (max: 18,446,744,073,709.551615 cUSDC)");
        return;
      }

      // Convert to uint64 (contract expects uint64, which is a plain number)
      const amountUint64 = Number(amountWei);
      if (amountUint64 > Number.MAX_SAFE_INTEGER) {
        toast.error("Amount too large");
        return;
      }

      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ABIs.ConfidentialUSDC,
        functionName: "mint",
        args: [userAddress, amountUint64],
      });

      toast.success("Mint transaction sent!");
      setAmount("");
    } catch (error: any) {
      console.error("Mint error:", error);
      toast.error(error?.message || "Failed to mint tokens");
    } finally {
      setMinting(false);
    }
  };

  if (!userAddress) {
    return (
      <Card className="p-4">
        <div className="card-body p-0">
          <p className="text-sm text-gray-600">Connect wallet to mint test tokens</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="card-body p-0">
        <h2 className="card-title mb-4">Mint Test Tokens</h2>
        <p className="text-sm text-gray-600 mb-4">Mint cUSDC tokens for testing (testnet only)</p>

        <form onSubmit={handleMint} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Amount (cUSDC)</span>
            </label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={minting}
              min="0"
              step="0.01"
              required
            />
          </div>

          <Button type="submit" className="btn-primary w-full" loading={minting} disabled={!amount || minting}>
            Mint Tokens
          </Button>
        </form>
      </div>
    </Card>
  );
}

