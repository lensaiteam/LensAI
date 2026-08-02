/**
 * Stubbed institutional sources. Phase 1 defines the interface and REFUSES to run:
 * a stub NEVER fabricates plausible data (invariant / KEYS_NEEDED.md). These are
 * listed under `stubbed` in config/sources.json and are not scheduled; if one is
 * ever invoked, it throws loudly.
 */

export class NotImplementedError extends Error {
  constructor(id: string, key?: string) {
    super(`Source "${id}" is a stub${key ? ` (needs ${key})` : ""}: not implemented. Never fabricate data — see KEYS_NEEDED.md.`);
    this.name = "NotImplementedError";
  }
}

export function notImplemented(id: string, key?: string): never {
  throw new NotImplementedError(id, key);
}

export const stubAdapters: Record<string, () => never> = {
  etf_flows: () => notImplemented("etf_flows", "ETF_FLOWS_API_KEY"),
  institutional_depth: () => notImplemented("institutional_depth", "INSTITUTIONAL_DEPTH_API_KEY"),
};
