"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBlindBetFactory } from "@/hooks/contracts/useBlindBetFactory";
import { toast } from "react-hot-toast";

export function CreateMarketForm() {
  const { address } = useAccount();
  const { deployMarket, writing } = useBlindBetFactory();
  const [question, setQuestion] = useState("");
  const [bettingDays, setBettingDays] = useState("7");
  const [resolutionHours, setResolutionHours] = useState("24");
  const [resolver, setResolver] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return toast.error("Connect wallet");
    if (!question || question.length < 10) return toast.error("Question too short (min 10 chars)");
    const bettingDuration = BigInt(Number(bettingDays) * 24 * 60 * 60);
    const resolutionDelay = BigInt(Number(resolutionHours) * 60 * 60);
    const resolverAddr = (resolver || address) as `0x${string}`;
    try {
      const tx = await deployMarket({ question, bettingDuration, resolutionDelay, resolver: resolverAddr });
      if (tx) toast.success("Market deployment tx sent");
      setQuestion("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create market");
    }
  };

  return (
    <div className="glass-card p-8">
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Market Question</label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will ETH reach $5k by Dec 31, 2025?"
            required
          />
          <p className="text-xs text-gray-400">Minimum 10 characters</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Betting Duration (days)</label>
            <Input
              type="number"
              value={bettingDays}
              onChange={(e) => setBettingDays(e.target.value)}
              min="1"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Resolution Delay (hours)</label>
            <Input
              type="number"
              value={resolutionHours}
              onChange={(e) => setResolutionHours(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Resolver Address (Optional)</label>
          <Input
            value={resolver}
            onChange={(e) => setResolver(e.target.value)}
            placeholder="0x... (defaults to your address)"
          />
        </div>

        <Button type="submit" className="glow-button w-full" disabled={writing}>
          {writing ? "Creating..." : "Create Market"}
        </Button>
      </form>
    </div>
  );
}





