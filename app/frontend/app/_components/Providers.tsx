"use client";

import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// RainbowKit is loaded dynamically on client to avoid SSR IndexedDB usage
import { sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "react-hot-toast";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "dummy-project-id-for-development";

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && typeof window !== "undefined") {
  console.warn("WalletConnect projectId not set. Get one at https://cloud.walletconnect.com");
}

// Create config only on the client to avoid SSR IndexedDB errors
let wagmiConfigSingleton: any | null = null;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [RainbowKitProvider, setRainbowKitProvider] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function load() {
      if (typeof window === "undefined") return;
      const rk = await import("@rainbow-me/rainbowkit");
      if (canceled) return;
      setRainbowKitProvider(() => rk.RainbowKitProvider as any);
      setTheme(() => rk.darkTheme);

      if (!wagmiConfigSingleton) {
        wagmiConfigSingleton = rk.getDefaultConfig({ appName: "BlindBet", projectId, chains: [sepolia] });
      }
      setConfig(wagmiConfigSingleton);
      setMounted(true);
    }
    load();
    return () => {
      canceled = true;
    };
  }, []);

  if (!mounted || !config || !RainbowKitProvider) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme ? theme() : undefined} modalSize="compact">
          {children}
          <Toaster position="top-right" />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
