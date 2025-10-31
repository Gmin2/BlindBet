"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBlindBetFactory } from "@/hooks/contracts/useBlindBetFactory";
import { toast } from "react-hot-toast";
import { ChevronRight, CheckCircle, Calendar, Clock, User, FileText } from "lucide-react";
import Link from "next/link";

export default function CreatePage() {
  const { address } = useAccount();
  const { deployMarket, writing } = useBlindBetFactory();
  const [step, setStep] = useState(1);
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
      setStep(1);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create market");
    }
  };

  const steps = [
    { number: 1, title: "Market Question", icon: FileText },
    { number: 2, title: "Betting Duration", icon: Calendar },
    { number: 3, title: "Resolution Setup", icon: Clock },
    { number: 4, title: "Review & Create", icon: CheckCircle },
  ];

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center">
      <BackgroundBeams className="absolute inset-0" />

      <div className="relative z-10 container mx-auto px-4 py-32">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold gradient-text mb-4">Create Your Market</h1>
            <p className="text-xl text-gray-300">Launch a confidential prediction market in minutes</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-12 max-w-2xl mx-auto">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.number} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        step >= s.number
                          ? "bg-brand-primary text-white"
                          : "bg-surface-elevated text-gray-400"
                      }`}
                    >
                      {step > s.number ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 mt-2 hidden md:block">{s.title}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-16 h-1 mx-2 transition-all ${
                        step > s.number ? "bg-brand-primary" : "bg-surface-elevated"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="glass-card p-8 md:p-12 space-y-8">
            {/* Step 1: Question */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-brand-primary" />
                    What's your market question?
                  </label>
                  <p className="text-gray-400">Ask a clear yes/no question about a future event</p>
                </div>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Will ETH reach $5k by Dec 31, 2025?"
                  required
                  className="text-lg py-6"
                />
                <p className="text-sm text-gray-400">Minimum 10 characters</p>
              </div>
            )}

            {/* Step 2: Betting Duration */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-2xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-brand-primary" />
                    How long should betting be open?
                  </label>
                  <p className="text-gray-400">Set the duration for users to place bets</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setBettingDays(days.toString())}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        bettingDays === days.toString()
                          ? "border-brand-primary bg-brand-primary/10"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <div className="text-3xl font-bold text-white">{days}</div>
                      <div className="text-sm text-gray-400">days</div>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Or enter custom days:</label>
                  <Input
                    type="number"
                    value={bettingDays}
                    onChange={(e) => setBettingDays(e.target.value)}
                    min="1"
                    className="text-lg"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Resolution */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-2xl font-bold text-white flex items-center gap-2">
                    <Clock className="w-6 h-6 text-brand-primary" />
                    Resolution Settings
                  </label>
                  <p className="text-gray-400">Set when and who will resolve the market</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Resolution Delay (hours)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[12, 24, 48, 72].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setResolutionHours(hours.toString())}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          resolutionHours === hours.toString()
                            ? "border-brand-primary bg-brand-primary/10"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="text-2xl font-bold text-white">{hours}h</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Resolver Address (Optional)
                  </label>
                  <Input
                    value={resolver}
                    onChange={(e) => setResolver(e.target.value)}
                    placeholder="0x... (defaults to your address)"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-2xl font-bold text-white flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-brand-primary" />
                    Review Your Market
                  </label>
                  <p className="text-gray-400">Double-check everything before creating</p>
                </div>

                <div className="space-y-4">
                  <div className="glass-card p-6 space-y-3">
                    <div>
                      <div className="text-sm text-gray-400">Question</div>
                      <div className="text-lg text-white font-medium">{question}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Betting Duration</div>
                        <div className="text-white">{bettingDays} days</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Resolution Delay</div>
                        <div className="text-white">{resolutionHours} hours</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Resolver</div>
                      <div className="text-white font-mono text-sm">{resolver || "Your address"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6">
              {step > 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-3 rounded-lg border border-white/20 hover:bg-surface-hover transition-all text-white"
                >
                  Back
                </Button>
              ) : (
                <Link href="/markets" className="px-6 py-3 rounded-lg border border-white/20 hover:bg-surface-hover transition-all text-white inline-block">
                  Cancel
                </Link>
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="glow-button flex items-center gap-2"
                  disabled={step === 1 && question.length < 10}
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </Button>
              ) : (
                <Button type="submit" className="glow-button" disabled={writing}>
                  {writing ? "Creating..." : "Create Market"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}





