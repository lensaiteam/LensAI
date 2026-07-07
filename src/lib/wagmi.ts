"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mainnet } from "viem/chains";

/**
 * wagmi + RainbowKit config (client-side). We use the INJECTED connector only
 * (MetaMask / browser wallets) — the app's auth is SIWE via our own
 * /api/auth flow, and injected needs no WalletConnect project id.
 *
 * We deliberately do NOT use getDefaultConfig here: it bundles a WalletConnect
 * connector that eagerly dials its relay on load and floods the console with
 * 403/400s whenever NEXT_PUBLIC_WALLETCONNECT_ID is unset or a placeholder. To
 * offer WalletConnect later, add a real projectId and push walletConnectWallet
 * onto the wallet list below.
 */
const connectors = connectorsForWallets(
  [{ groupName: "Recommended", wallets: [injectedWallet] }],
  { appName: "LensAI", projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "lensai-injected-only" },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
  ssr: true,
});
