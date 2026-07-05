import "server-only";
import { supabaseAdmin } from "./supabase";

/** Create an analysis session for a wallet + ticker. Returns the session id. */
export async function createSession(walletAddress: string, ticker: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("analysis_sessions")
    .insert({ wallet_address: walletAddress, ticker: ticker.toUpperCase() })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create session: ${error?.message}`);
  return data.id as string;
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await supabaseAdmin().from("messages").insert({ session_id: sessionId, role, content });
}

/** Load a session's messages in order (for follow-up context). */
export async function getMessages(
  sessionId: string,
  limit = 20,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data } = await supabaseAdmin()
    .from("messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/** Verify a session belongs to the wallet (server-side scoping under Path B). */
export async function sessionOwnedBy(sessionId: string, walletAddress: string): Promise<
  { ticker: string } | null
> {
  const { data } = await supabaseAdmin()
    .from("analysis_sessions")
    .select("ticker, wallet_address")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.wallet_address !== walletAddress) return null;
  return { ticker: data.ticker };
}
