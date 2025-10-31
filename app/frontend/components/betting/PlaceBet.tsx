"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { BetForm } from "@/components/betting/BetForm";
import { usePlaceBet } from "@/hooks/markets/usePlaceBet";
import { useBlindBetMarket } from "@/hooks/contracts/useBlindBetMarket";

interface PlaceBetProps {
  marketId: number;
  marketAddress: string;
}

export function PlaceBet({ marketId, marketAddress }: PlaceBetProps) {
  const [step, setStep] = useState<"input" | "approve" | "bet">("input");
  const { tokenAddress } = useBlindBetMarket(marketAddress);
  const { placeBet, loading } = usePlaceBet(marketAddress, tokenAddress);

  const handlePlaceBet = async (amount: bigint, outcome: boolean) => {
    try {
      setStep("approve");
      const txHash = await placeBet(marketId, amount, outcome);
      if (!txHash) throw new Error("Transaction failed");

      setStep("bet");
      toast.success("Approved! Placing bet...");

      // Wait for transaction
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Give time for tx to process

      toast.success("Bet placed successfully!");
      setStep("input");
    } catch (error: any) {
      console.error("Error placing bet:", error);
      toast.error(error?.message || "Failed to place bet");
      setStep("input");
    }
  };

  return (
    <div className="glass-card p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold gradient-text">Place Your Bet</h2>
        <p className="text-gray-300 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Your position will be fully encrypted
        </p>
      </div>

      {step !== "input" && (
        <div className="p-4 rounded-lg bg-brand-primary/10 border border-brand-primary/30 flex items-center gap-3">
          {step === "approve" && (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
              <span className="text-white">Approving tokens...</span>
            </>
          )}
          {step === "bet" && (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
              <span className="text-white">Placing encrypted bet...</span>
            </>
          )}
        </div>
      )}

      <BetForm onSubmit={handlePlaceBet} loading={loading} disabled={loading} />
    </div>
  );
}

