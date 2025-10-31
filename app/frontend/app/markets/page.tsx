"use client";

import { HoverEffect } from "@/components/ui/card-hover-effect";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { TrendingUpIcon } from "@/components/ui/trending-up";
import { SearchIcon } from "@/components/ui/search";
import { PlusIcon } from "@/components/ui/plus";
import { SettingsIcon } from "@/components/ui/settings";
import Link from "next/link";
import { useState } from "react";

export default function MarketsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "trending" | "ending-soon">("all");

  const markets = [
    {
      title: "Will BTC reach $100k by end of 2025?",
      description: "High volume market with 342 participants • Ends in 15 days",
      link: "/market/0",
    },
    {
      title: "Will ETH reach $5k by end of 2025?",
      description: "Active trading • 128 participants • Ends in 7 days",
      link: "/market/1",
    },
    {
      title: "Will AI replace 50% of jobs by 2030?",
      description: "Hot topic • 256 participants • Ends in 30 days",
      link: "/market/2",
    },
    {
      title: "Will SpaceX land on Mars by 2028?",
      description: "Space exploration • 189 participants • Ends in 21 days",
      link: "/market/3",
    },
    {
      title: "Will Apple release AR glasses in 2025?",
      description: "Tech predictions • 95 participants • Ends in 12 days",
      link: "/market/4",
    },
    {
      title: "Will quantum computing break RSA by 2030?",
      description: "Cryptography future • 167 participants • Ends in 45 days",
      link: "/market/5",
    },
  ];

  const filteredMarkets = markets.filter((market) =>
    market.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-b from-bg via-bg to-surface">
      <div className="container mx-auto px-4 pt-32 pb-20">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <TrendingUpIcon size={48} className="text-brand-primary" />
              <h1 className="text-5xl md:text-7xl font-bold gradient-text">
                Active Markets
              </h1>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Explore trending prediction markets and place your confidential bets
            </p>

            {/* CTA Button */}
            <div className="flex justify-center pt-4">
              <Link href="/create">
                <HoverBorderGradient
                  containerClassName="rounded-full"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <PlusIcon size={20} />
                  Create New Market
                </HoverBorderGradient>
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="glass-card p-6 text-center space-y-2 rounded-2xl">
              <div className="text-4xl font-bold gradient-text">$412k</div>
              <div className="text-sm text-gray-400">Total Volume</div>
            </div>
            <div className="glass-card p-6 text-center space-y-2 rounded-2xl">
              <div className="text-4xl font-bold gradient-text">1,377</div>
              <div className="text-sm text-gray-400">Active Traders</div>
            </div>
            <div className="glass-card p-6 text-center space-y-2 rounded-2xl">
              <div className="text-4xl font-bold gradient-text">{markets.length}</div>
              <div className="text-sm text-gray-400">Open Markets</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-elevated/50 border border-white/10 text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-primary/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 justify-center flex-wrap">
              <Filter className="w-5 h-5 text-gray-400" />
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === "all"
                    ? "bg-brand-primary text-white"
                    : "bg-surface-elevated text-gray-400 hover:text-white"
                }`}
              >
                All Markets
              </button>
              <button
                onClick={() => setFilter("trending")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === "trending"
                    ? "bg-brand-primary text-white"
                    : "bg-surface-elevated text-gray-400 hover:text-white"
                }`}
              >
                Trending
              </button>
              <button
                onClick={() => setFilter("ending-soon")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === "ending-soon"
                    ? "bg-brand-primary text-white"
                    : "bg-surface-elevated text-gray-400 hover:text-white"
                }`}
              >
                Ending Soon
              </button>
            </div>
          </div>

          {/* Markets Grid with Hover Effect */}
          <div className="max-w-6xl mx-auto">
            {filteredMarkets.length === 0 ? (
              <div className="text-center py-12 glass-card rounded-2xl p-8">
                <p className="text-xl text-gray-400">No markets found</p>
                <p className="text-gray-500 mt-2">Try adjusting your search or create a new market</p>
              </div>
            ) : (
              <HoverEffect items={filteredMarkets} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
