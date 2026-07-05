"use client";
import { SiweMessage } from "siwe";

export interface Me {
  walletAddress: string;
  chainId: number;
}
export interface FreeTier {
  used: number;
  limit: number;
  remaining: number;
}

export async function fetchMe(): Promise<{ user: Me | null; freeTier?: FreeTier }> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return { user: null };
  return res.json();
}

async function getNonce(address: string): Promise<string> {
  const res = await fetch("/api/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.nonce) {
    // Surface the server's reason (e.g. backend-not-configured) instead of a
    // generic message so the user knows what to fix.
    throw new Error(data.error || "Failed to get nonce");
  }
  return data.nonce;
}

/** Build the SIWE message the wallet will sign (EIP-4361). */
export function buildSiweMessage(address: string, chainId: number, nonce: string): string {
  const msg = new SiweMessage({
    domain: window.location.host,
    address,
    statement: "Sign in to LensAI. This proves you own this wallet. No transaction, no gas.",
    uri: window.location.origin,
    version: "1",
    chainId,
    nonce,
  });
  return msg.prepareMessage();
}

export async function requestNonceAndMessage(
  address: string,
  chainId: number,
): Promise<string> {
  const nonce = await getNonce(address);
  return buildSiweMessage(address, chainId, nonce);
}

export async function verifySignature(message: string, signature: string): Promise<boolean> {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
