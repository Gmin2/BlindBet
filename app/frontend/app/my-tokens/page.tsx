"use client";

import Link from "next/link";
import { MintTestTokens } from "@/components/token/MintTestTokens";
import { TokenBalance } from "@/components/token/TokenBalance";
import { Wallet, Coins, TrendingUp, History, ArrowLeft, Zap } from "lucide-react";

export default function MyTokensPage() {
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

            <div className="flex items-center gap-3">
              <Wallet className="w-10 h-10 text-brand-primary" />
              <h1 className="text-5xl font-bold gradient-text">My Wallet</h1>
            </div>
            <p className="text-xl text-gray-300">
              Manage your confidential tokens and track your portfolio
            </p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Token Balance - Large */}
            <div className="lg:col-span-2 glass-card p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-3">
                <Coins className="w-8 h-8 text-brand-primary" />
                <h2 className="text-2xl font-bold text-white">Token Balance</h2>
              </div>
              <TokenBalance />
            </div>

            {/* Portfolio Stats */}
            <div className="glass-card p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-success" />
                <h2 className="text-xl font-bold text-white">Portfolio</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-4xl font-bold gradient-text">$0.00</div>
                  <div className="text-sm text-gray-400 mt-1">Total Value</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-success">
                  <TrendingUp className="w-4 h-4" />
                  <span>+0% (24h)</span>
                </div>
              </div>
            </div>

            {/* Mint Tokens */}
            <div className="glass-card p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-warning" />
                <h2 className="text-xl font-bold text-white">Mint Test Tokens</h2>
              </div>
              <MintTestTokens />
            </div>

            {/* Transaction History */}
            <div className="lg:col-span-2 glass-card p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-3">
                <History className="w-8 h-8 text-brand-accent" />
                <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
              </div>
              <div className="text-center py-12 text-gray-400">
                <History className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg">No transactions yet</p>
                <p className="text-sm mt-2">Your transaction history will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}



