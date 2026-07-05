import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Service-role Supabase client (Path B, spec §9). This bypasses RLS, so it
 * MUST only ever be used from server route handlers, and every query MUST scope
 * to the authenticated wallet in application code. Never import from a Client
 * Component and never expose the service-role key to the browser.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
