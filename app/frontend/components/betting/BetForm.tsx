"use client";

import { useState } from "react";
import { parseUnits } from "ethers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BetFormProps {
  onSubmit: (amount: bigint, outcome: boolean) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function BetForm({ onSubmit, loading = false, disabled = false }: BetFormProps) {
  const [amount, setAmount] = useState("");
  const [outcome, setOutcome] = useState<boolean>(true); // true = Yes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    const amountWei = parseUnits(amount, 6); // cUSDC has 6 decimals
    await onSubmit(amountWei, outcome);
    setAmount(""); // Reset form after submission
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Amount (cUSDC)</span>
        </label>
        <Input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading || disabled}
          min="0"
          step="0.01"
          required
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Outcome</span>
        </label>
        <div className="btn-group w-full">
          <Button
            type="button"
            className={`btn flex-1 ${outcome ? "btn-active btn-success" : ""}`}
            onClick={() => setOutcome(true)}
            disabled={loading || disabled}
          >
            Yes
          </Button>
          <Button
            type="button"
            className={`btn flex-1 ${!outcome ? "btn-active btn-error" : ""}`}
            onClick={() => setOutcome(false)}
            disabled={loading || disabled}
          >
            No
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        className="btn-primary w-full"
        loading={loading}
        disabled={!amount || parseFloat(amount) <= 0 || loading || disabled}
      >
        Place Bet
      </Button>
    </form>
  );
}




