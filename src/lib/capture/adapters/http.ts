/** Shared HTTP helpers for adapters: native fetch, timeout, no caching, UA. */

const UA = "LensAI-capture/1 (+https://github.com/lensaiteam/LensAI)";

async function httpRaw(url: string, timeoutMs: number, accept: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function httpJson<T = unknown>(url: string, timeoutMs = 15_000): Promise<T> {
  const res = await httpRaw(url, timeoutMs, "application/json");
  return (await res.json()) as T;
}

export async function httpText(url: string, timeoutMs = 15_000): Promise<string> {
  const res = await httpRaw(url, timeoutMs, "application/xml, text/xml, */*");
  return await res.text();
}
