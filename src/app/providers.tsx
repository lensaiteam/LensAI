"use client";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { MotionConfig } from "framer-motion";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";
import { AuthProvider } from "@/components/AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#c8a84b",
            accentColorForeground: "#000",
            borderRadius: "medium",
          })}
        >
          <MotionConfig reducedMotion="user">
            <AuthProvider>{children}</AuthProvider>
          </MotionConfig>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
