"use client";

import { useEffect, useState } from "react";
import { useBlindBetFactory } from "@/hooks/contracts/useBlindBetFactory";
import { MarketCard } from "@/components/market/MarketCard";

export function MarketList() {
  const { marketCount } = useBlindBetFactory();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (!marketCount) {
      setIds([]);
      return;
    }
    setIds(Array.from({ length: marketCount }, (_, i) => i));
  }, [marketCount]);

  if (ids.length === 0) {
    return <p className="text-center text-sm text-gray-500">No markets yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((id) => (
        <MarketCard key={id} id={id} />
      ))}
    </div>
  );
}



