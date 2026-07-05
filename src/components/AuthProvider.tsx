"use client";
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import {
  fetchMe,
  requestNonceAndMessage,
  verifySignature,
  logout as apiLogout,
  type Me,
  type FreeTier,
} from "@/lib/authClient";

interface AuthState {
  user: Me | null;
  freeTier: FreeTier | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected, status } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [user, setUser] = useState<Me | null>(null);
  const [freeTier, setFreeTier] = useState<FreeTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { user, freeTier } = await fetchMe();
    setUser(user);
    setFreeTier(freeTier ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!address || !chainId) {
      setError("Connect a wallet first.");
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      const message = await requestNonceAndMessage(address, chainId);
      const signature = await signMessageAsync({ message });
      const ok = await verifySignature(message, signature);
      if (!ok) throw new Error("Signature verification failed.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }, [address, chainId, signMessageAsync, refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setFreeTier(null);
    disconnect();
  }, [disconnect]);

  // Sign out only on a genuine connected -> disconnected transition. We must NOT
  // log out during the initial mount/reconnect window (wagmi reports
  // status "connecting"/"reconnecting" with isConnected=false there) — otherwise
  // a valid cookie session would be destroyed on every page refresh. The cookie
  // is the source of truth; the wallet connection is a separate concern.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
      return;
    }
    if (status === "disconnected" && wasConnected.current && user) {
      wasConnected.current = false;
      apiLogout().finally(() => setUser(null));
    }
  }, [isConnected, status, user]);

  return (
    <AuthCtx.Provider
      value={{ user, freeTier, loading, signingIn, error, signIn, signOut, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
