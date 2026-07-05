"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "viem/chains";

/**
 * wagmi + RainbowKit config (client-side). MetaMask/injected works without a
 * WalletConnect project id; set NEXT_PUBLIC_WALLETCONNECT_ID to enable the
 * WalletConnect option. SIWE is handled by our own /api/auth flow, not here.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "LensAI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "lensai-dev",
  chains: [mainnet],
  ssr: true,
});
