import Link from "next/link";
import { Highlight } from "@/components/ui/hero-highlight";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { ArrowRight, Shield, Eye, Lock } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Hero Section with Background Beams */}
      <div className="relative w-full">
        <BackgroundBeams className="absolute inset-0" />
        <div className="relative z-10 pt-32 pb-32">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto text-center space-y-8">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight text-white">
                <span className="gradient-text">Confidential</span> Prediction Markets
                <br />
                <Highlight className="text-white">
                  Powered by FHE
                </Highlight>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
                Trade on outcomes while keeping your positions completely private.
                No front-running, no manipulation, just pure prediction markets.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm text-white">
                  <Shield className="w-4 h-4 text-brand-primary" />
                  <span>Encrypted Positions</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm text-white">
                  <Eye className="w-4 h-4 text-brand-secondary" />
                  <span>Hidden Order Books</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm text-white">
                  <Lock className="w-4 h-4 text-brand-accent" />
                  <span>Private Balances</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap justify-center gap-4 pt-6">
                <Link href="/create" className="glow-button flex items-center gap-2 text-lg">
                  Create Market
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/markets"
                  className="px-6 py-3 rounded-lg border border-white/20 hover:border-brand-primary hover:bg-surface-hover transition-all flex items-center gap-2 text-lg text-white"
                >
                  Explore Markets
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
