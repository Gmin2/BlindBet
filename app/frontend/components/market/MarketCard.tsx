"use client";

import { useRouter } from "next/navigation";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Clock, ArrowRight } from "lucide-react";

export function MarketCard({ id }: { id: number }) {
  const router = useRouter();

  return (
    <CardContainer className="w-full">
      <CardBody className="glass-card-hover w-full h-auto p-6 space-y-4">
        <CardItem translateZ="50" className="w-full">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-success/20 text-success text-sm font-medium border border-success/30">
              Open
            </span>
            <span className="text-gray-400 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              7d left
            </span>
          </div>
        </CardItem>

        <CardItem
          translateZ="100"
          className="w-full"
        >
          <h3 className="text-xl font-bold text-white">Market #{id}</h3>
          <p className="text-gray-300 text-sm mt-2">
            Will this market resolve favorably?
          </p>
        </CardItem>

        <CardItem translateZ="60" className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-400">
              <TrendingUp className="w-4 h-4" />
              <span>$2.5k</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Users className="w-4 h-4" />
              <span>24</span>
            </div>
          </div>
        </CardItem>

        <CardItem translateZ="80" className="w-full">
          <Button
            className="w-full glow-button flex items-center justify-center gap-2"
            onClick={() => router.push(`/market/${id}`)}
          >
            View Details
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardItem>
      </CardBody>
    </CardContainer>
  );
}
