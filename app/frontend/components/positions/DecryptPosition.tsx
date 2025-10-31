"use client";

import { useState } from "react";
import { formatUnits } from "ethers";
import { useDecryptPosition } from "@/hooks/fhevm/useDecryptPosition";
import { useBlindBetMarket } from "@/hooks/contracts/useBlindBetMarket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import type { DecryptedPosition } from "@/types/market";

export function DecryptPosition({ marketId, marketAddress }: { marketId: number; marketAddress: string }) {
  const [decrypted, setDecrypted] = useState<DecryptedPosition | null>(null);
  const { getPosition, position, loading: fetchingPosition } = useBlindBetMarket(marketAddress);
  const { decryptPosition, loading: decrypting } = useDecryptPosition(marketAddress);

  const handleDecrypt = async () => {
    if (!position) {
      await getPosition(marketId);
      return;
    }
    const result = await decryptPosition(position);
    if (result) setDecrypted(result);
  };

  const loading = fetchingPosition || decrypting;

  return (
    <Card className="p-6 bg-[#FBD38D] text-black">
      <div className="card-body p-0">
        <h2 className="card-title text-xl font-extrabold">My Position</h2>

        {!decrypted ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-4">Your position is encrypted. Click to decrypt and view.</p>
            <Button onClick={handleDecrypt} loading={loading} className="btn-primary">
              Decrypt Position
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-success/10 rounded">
              <span className="font-medium">Yes Position:</span>
              <span className="font-mono text-lg">{formatUnits(decrypted.yesAmount, 6)} cUSDC</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-error/10 rounded">
              <span className="font-medium">No Position:</span>
              <span className="font-mono text-lg">{formatUnits(decrypted.noAmount, 6)} cUSDC</span>
            </div>
            <div className="divider"></div>
            <div className="flex justify-between items-center p-3 bg-base-200 rounded">
              <span className="font-bold">Total Bet:</span>
              <span className="font-mono text-xl font-bold">{formatUnits(decrypted.totalBet, 6)} cUSDC</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
