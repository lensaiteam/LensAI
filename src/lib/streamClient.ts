"use client";

// Must match TRAILER_SENTINEL in src/lib/ai/anthropic.ts.
const SENTINEL = "<<<LENSAI_DATA>>>";

export interface StreamResult {
  headers: Headers;
  full: string;
  status: number;
}

/**
 * POST JSON and stream the text/plain response body. `onText` receives the
 * running DISPLAY text (everything before the machine-readable trailer). The
 * trailer and anything after it is never shown to the user.
 */
export async function streamPost(
  url: string,
  body: unknown,
  onText: (displayText: string) => void,
): Promise<StreamResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw Object.assign(new Error(err.error || "Request failed"), { status: res.status, data: err });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    const cut = raw.indexOf(SENTINEL);
    onText(cut === -1 ? raw : raw.slice(0, cut));
    if (cut !== -1) {
      // Drain the rest but stop rendering.
      // (We keep reading so the server can finish + persist.)
    }
  }

  const cut = raw.indexOf(SENTINEL);
  return { headers: res.headers, full: cut === -1 ? raw : raw.slice(0, cut), status: res.status };
}
