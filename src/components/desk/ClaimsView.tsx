"use client";
import { useCallback, useEffect, useState } from "react";
import { agentFetch, type CheckedClaim, type ClaimCheckRecord, type ClaimCheckResponse } from "@/lib/agentClient";
import { Btn, Err, Placard, Sheet, Tag, utc } from "./bits";

type Shown = { asOf: number | null; claims: CheckedClaim[]; provider?: string | null; savedId?: string | null };

export function ClaimsView({ onSpent }: { onSpent: () => void }) {
  const [text, setText] = useState("");
  const [save, setSave] = useState(false);
  const [result, setResult] = useState<Shown | null>(null);
  const [saved, setSaved] = useState<ClaimCheckRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      setSaved((await agentFetch<{ claimChecks: ClaimCheckRecord[] }>("/v1/claim-checks")).claimChecks);
    } catch {
      /* the list is secondary */
    }
  }, []);
  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const run = async () => {
    if (text.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await agentFetch<ClaimCheckResponse>("/v1/claim-check", { method: "POST", body: { text: text.trim(), save } });
      setResult({ asOf: r.asOf, claims: r.claims, provider: r.provider, savedId: r.id });
      onSpent();
      if (save) loadSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = (rec: ClaimCheckRecord) => {
    const r = rec.result as { asOf?: number | null; claims?: CheckedClaim[] };
    setText(rec.input);
    setResult({ asOf: r.asOf ?? null, claims: r.claims ?? [], savedId: rec.id });
  };
  const remove = async (rec: ClaimCheckRecord) => {
    try {
      await agentFetch(`/v1/claim-checks/${rec.id}`, { method: "DELETE" });
      setSaved((s) => s.filter((x) => x.id !== rec.id));
      if (result?.savedId === rec.id) setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const counts = result
    ? { supported: result.claims.filter((c) => c.verdict === "supported").length, contradicted: result.claims.filter((c) => c.verdict === "contradicted").length, unverifiable: result.claims.filter((c) => c.verdict === "unverifiable").length }
    : null;

  return (
    <div className="dk-wrap">
      <div className="dk-top">
        <div>
          <span className="dk-kick">A07 / Claim check</span>
          <h1 className="dk-title">
            Hand it <em>a claim.</em>
          </h1>
        </div>
      </div>

      <div className="dk-stack">
        <Sheet marks>
          <Placard items={[["input", "a post, a thread, a paragraph"], ["verdicts", "arithmetic against the store"]]} />
          <p className="dk-note">
            Paste what someone wrote. The model only extracts what it asserts and maps each number to the store row that measures the same
            thing. The verdict is computed: supported, contradicted with the store&apos;s value shown, or unverifiable when the desk does not
            measure it. A trade instruction is reported, never repeated.
          </p>
          <textarea
            className="dk-ta"
            style={{ marginTop: 14, minHeight: 140 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text to check (10 to 6000 characters)"
            maxLength={6000}
            aria-label="Text to check"
          />
          <div className="dk-row between">
            <label className="dk-check">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> keep this check
            </label>
            <div className="dk-row">
              <span className="dk-note" style={{ fontFamily: "var(--font-mono-stack)", fontSize: 10.5 }}>{text.length} / 6000</span>
              <Btn onClick={run} disabled={busy || text.trim().length < 10}>{busy ? "Checking" : "Check"}</Btn>
            </div>
          </div>
          <Err>{error}</Err>
        </Sheet>

        {result && counts && (
          <Sheet marks>
            <Placard
              items={[
                ["as of", utc(result.asOf)],
                ["supported", String(counts.supported)],
                ["contradicted", String(counts.contradicted)],
                ["unverifiable", String(counts.unverifiable)],
                result.savedId ? ["kept", "yes"] : null,
              ]}
            />
            {result.claims.length === 0 && <p className="dk-note">No checkable factual or causal claims were found in the text.</p>}
            {result.claims.length > 0 && (
              <table className="dk-tbl">
                <thead>
                  <tr><th>#</th><th>verdict</th><th>claim</th><th>evidence</th></tr>
                </thead>
                <tbody>
                  {result.claims.map((c, i) => (
                    <tr key={i}>
                      <td className="mono">{String(i + 1).padStart(2, "0")}</td>
                      <td>
                        <Tag kind={c.verdict === "contradicted" ? "red" : c.verdict === "supported" ? "ink" : "mut"}>{c.verdict}</Tag>
                      </td>
                      <td>
                        {c.advisory ? <span className="dk-note">A trade instruction. Reported, not repeated or evaluated.</span> : <>&ldquo;{c.text}&rdquo;</>}
                        {c.claimant && <span className="dk-refs">claimant: {c.claimant}</span>}
                        {c.mechanism === "documented" && <span className="dk-refs">causal link matches a documented channel: {c.edgeId}</span>}
                        {c.mechanism === "undocumented" && <span className="dk-refs">causal link is not a documented channel in the mechanism graph</span>}
                      </td>
                      <td className="mono">
                        {c.evidence.length ? c.evidence.map((e, k) => <div key={k}>{e}</div>) : c.verdict === "unverifiable" ? "the desk does not measure this" : "n/a"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="dk-note" style={{ marginTop: 12 }}>Verdicts are arithmetic against measured data. They are not a judgement of the author, and not financial advice.</p>
          </Sheet>
        )}

        {saved.length > 0 && (
          <Sheet>
            <Placard items={[["kept checks", String(saved.length)]]} />
            <table className="dk-tbl">
              <thead>
                <tr><th>date</th><th>text</th><th></th></tr>
              </thead>
              <tbody>
                {saved.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{utc(s.createdAt)}</td>
                    <td>{s.input.length > 120 ? s.input.slice(0, 120) + "…" : s.input}</td>
                    <td className="n">
                      <span className="dk-row end">
                        <Btn ghost small onClick={() => open(s)}>Open</Btn>
                        <Btn ghost small onClick={() => remove(s)}>Delete</Btn>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        )}
      </div>
    </div>
  );
}
