"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { MarketState } from "@/types/market";
import { useBlindBetMarket } from "@/hooks/contracts/useBlindBetMarket";
import { toast } from "react-hot-toast";

export function ClaimWinnings({
  marketId,
  marketAddress,
  state,
}: {
  marketId: number;
  marketAddress: string;
  state: MarketState;
}) {
  const { hasClaimed, claimWinnings, loading } = useBlindBetMarket(marketAddress);
  const [claimed, setClaimed] = useState<boolean>(false);

  useEffect(() => {
    async function checkClaimed() {
      const c = await hasClaimed(marketId);
      setClaimed(Boolean(c));
    }
    if (state === MarketState.Resolved) {
      checkClaimed();
    }
  }, [marketId, state, hasClaimed]);

  if (state !== MarketState.Resolved) return null;

  const onClaim = async () => {
    try {
      const tx = await claimWinnings(marketId);
      if (tx) toast.success("Claim transaction sent");
      setClaimed(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to claim");
    }
  };

  return (
    <Card className="p-6 bg-[#B2F5EA] text-black">
      <div className="card-body p-0">
        <h2 className="card-title text-xl font-extrabold">Claim Winnings</h2>
        <p className="text-sm text-black/80 mb-4">Claim your payout if you were on the winning side.</p>
        <Button onClick={onClaim} disabled={claimed} loading={loading} className="btn-primary">
          {claimed ? "Already Claimed" : "Claim"}
        </Button>
      </div>
    </Card>
  );
}
