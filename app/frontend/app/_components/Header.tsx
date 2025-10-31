"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Home, Coins, PlusCircle } from "lucide-react";
const ConnectButton = dynamic(() => import("@rainbow-me/rainbowkit").then((m) => m.ConnectButton), { ssr: false });
import { TokenBalance } from "@/components/token/TokenBalance";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold gradient-text">BlindBet</span>
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/markets"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Markets</span>
            </Link>
            <Link
              href="/my-tokens"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-surface-hover transition-all"
            >
              <Coins className="w-4 h-4" />
              <span>My Tokens</span>
            </Link>
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-2 rounded-lg glow-button"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <TokenBalance />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
