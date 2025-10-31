"use client";

import { formatUnits } from "ethers";
import { useUserBalance } from "@/hooks/user/useUserBalance";
import { Card } from "@/components/ui/Card";

export function TokenBalance() {
  const { balance, loading } = useUserBalance();

  if (loading) {
    return (
      <Card className="p-4">
        <div className="card-body p-0">
          <p className="text-sm">Loading balance...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="card-body p-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Balance:</span>
          <span className="font-mono text-lg font-bold">
            {balance !== null ? `${formatUnits(balance, 6)} cUSDC` : "0 cUSDC"}
          </span>
        </div>
      </div>
    </Card>
  );
}




