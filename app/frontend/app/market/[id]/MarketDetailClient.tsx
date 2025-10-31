"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBlindBetFactory } from "@/hooks/contracts/useBlindBetFactory";
import { useBlindBetMarket } from "@/hooks/contracts/useBlindBetMarket";
import { PlaceBet } from "@/components/betting/PlaceBet";
import { MarketState } from "@/types/market";
import { DecryptPosition } from "@/components/positions/DecryptPosition";
import { ClaimWinnings } from "@/components/positions/ClaimWinnings";
import { Tabs } from "@/components/ui/tabs";
import { BackgroundBeams } from "@/components/ui/background-beams";
import {
  TrendingUp,
  Users,
  Clock,
  DollarSign,
  Activity,
  ArrowLeft,
  CheckCircle,
  Lock,
  Eye
} from "lucide-react";

export default function MarketDetailClient({ id }: { id: number }) {
  const { getMarketAddress } = useBlindBetFactory();
  const [marketAddress, setMarketAddress] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const market = useBlindBetMarket(marketAddress || "");

  useEffect(() => {
    async function loadMarket() {
      try {
        const addr = await getMarketAddress(id);
        if (addr) setMarketAddress(addr as string);
      } catch (error) {
        console.error("Failed to load market:", error);
      }
    }
    if (id >= 0) loadMarket();
  }, [id, getMarketAddress]);

  useEffect(() => {
    async function loadMarketData() {
      if (!marketAddress) return;
      try {
        const data = await market.getMarket(id);
        if (data) setMarketData(data);
      } catch (error) {
        console.error("Failed to load market data:", error);
      }
    }
    if (marketAddress) loadMarketData();
  }, [marketAddress, id, market]);

  const stateLabels = {
    [MarketState.Open]: "Open for Betting",
    [MarketState.Locked]: "Locked",
    [MarketState.Resolving]: "Resolving...",
    [MarketState.Resolved]: "Resolved",
  };

  if (!marketAddress) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center">
        <BackgroundBeams className="absolute inset-0" />
        <div className="relative z-10 text-center">
          <Activity className="w-16 h-16 text-brand-primary animate-pulse mx-auto mb-4" />
          <p className="text-xl text-white">Loading market...</p>
        </div>
      </main>
    );
  }

  const currentState = Number(marketData?.state) as MarketState | undefined;

  const tabs = [
    {
      title: "Place Bet",
      value: "bet",
      content: (
        <div className="w-full space-y-6">
          {currentState === MarketState.Open ? (
            <PlaceBet marketId={id} marketAddress={marketAddress} />
          ) : (
            <div className="glass-card p-8 text-center">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Betting Closed</h3>
              <p className="text-gray-400">This market is no longer accepting bets</p>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "My Position",
      value: "position",
      content: (
        <div className="w-full">
          <DecryptPosition marketId={id} marketAddress={marketAddress} />
        </div>
      ),
    },
    {
      title: "Claim Winnings",
      value: "claim",
      content: (
        <div className="w-full">
          <ClaimWinnings
            marketId={id}
            marketAddress={marketAddress}
            state={currentState ?? MarketState.Open}
          />
        </div>
      ),
    },
  ];

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-b from-bg via-bg to-surface">
      <div className="container mx-auto px-4 pt-32 pb-20">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Markets
            </Link>

            {marketData && (
              <>
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">
                      {marketData.question}
                    </h1>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div
                        className={`px-4 py-2 rounded-full text-sm font-medium border ${
                          currentState === MarketState.Open
                            ? "bg-success/20 text-success border-success/30"
                            : currentState === MarketState.Resolved
                            ? "bg-brand-primary/20 text-brand-primary border-brand-primary/30"
                            : "bg-warning/20 text-warning border-warning/30"
                        }`}
                      >
                        {stateLabels[Number(marketData.state) as MarketState]}
                      </div>
                      <div className="text-sm text-gray-400">
                        Market #{id}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-brand-primary mb-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Volume</span>
                    </div>
                    <div className="text-2xl font-bold text-white">$45k</div>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-brand-secondary mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Traders</span>
                    </div>
                    <div className="text-2xl font-bold text-white">128</div>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-brand-accent mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Created</span>
                    </div>
                    <div className="text-sm font-medium text-white">
                      {new Date(Number(marketData.createdAt) * 1000).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-orange-500 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Deadline</span>
                    </div>
                    <div className="text-sm font-medium text-white">
                      {new Date(Number(marketData.bettingDeadline) * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="pt-8">
            <Tabs
              tabs={tabs}
              containerClassName="mb-8"
              activeTabClassName="bg-brand-primary"
              tabClassName="text-white"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
