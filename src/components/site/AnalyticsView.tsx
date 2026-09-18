import Link from "next/link";
import { CountUp, LineReveal } from "@/components/landing/kit";
import type { DailyStat, PlatformStats } from "@/lib/stats";
import { DUNE_DASHBOARD_URL } from "@/lib/site/links";

/**
 * The ledger: the platform counted from its own records. Server-rendered SVG,
 * hairline tables and mono figures; nothing here is a library chart. Every number
 * comes from platform_stats() and the page says when it was computed.
 */

const W = 720;
const H = 180;
const PAD = { l: 0, r: 0, t: 10, b: 0 };

const fmt = (n: number): string => n.toLocaleString("en-US");
const dayLabel = (d: string): string => d.slice(5).replace("-", "/");

function scale(values: number[]): (v: number) => number {
  const max = Math.max(1, ...values);
  const h = H - PAD.t - PAD.b;
  return (v) => PAD.t + h - (v / max) * h;
}

function linePath(values: number[]): string {
  if (!values.length) return "";
  const y = scale(values);
  const step = values.length > 1 ? (W - PAD.l - PAD.r) / (values.length - 1) : 0;
  return values.map((v, i) => `${i ? "L" : "M"}${(PAD.l + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

function areaPath(values: number[]): string {
  const line = linePath(values);
  if (!line) return "";
  const step = values.length > 1 ? (W - PAD.l - PAD.r) / (values.length - 1) : 0;
  return `${line} L${(PAD.l + (values.length - 1) * step).toFixed(1)},${H} L${PAD.l},${H} Z`;
}

/** A line over the whole range with the first, peak and last values placarded. */
function Series({ values, days, label, area, bars }: { values: number[]; days: string[]; label: string; area?: boolean; bars?: number[] }) {
  const max = Math.max(1, ...values, ...(bars ?? []));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) - (v / max) * (H - PAD.t - PAD.b);
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const peakI = values.indexOf(Math.max(...values));
  return (
    <figure className="led-fig">
      <figcaption className="mono">
        <span>{label}</span>
        <span>
          peak <b>{fmt(Math.max(0, ...values))}</b> on {days[peakI] ?? "n/a"}
        </span>
      </figcaption>
      <div className="led-plot">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="led-svg" role="img" aria-label={`${label} over time`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} className="led-grid" />
        ))}
        {bars && bars.map((b, i) => (
          <rect key={i} x={i * step - Math.max(1, step * 0.35)} width={Math.max(2, step * 0.7)} y={y(b)} height={H - y(b)} className="led-bar" />
        ))}
        {area && <path d={areaPath(values)} className="led-area" />}
        <path d={linePath(values)} className="led-line" pathLength={1} />
      </svg>
      <span className="led-end" style={{ left: "100%", top: `${(y(values[values.length - 1] ?? 0) / H) * 100}%` }} aria-hidden="true" />
      </div>
      <div className="led-axis mono">
        <span>{days[0] ? dayLabel(days[0]) : ""}</span>
        <span>{days[Math.floor(days.length / 2)] ? dayLabel(days[Math.floor(days.length / 2)]) : ""}</span>
        <span>{days[days.length - 1] ? dayLabel(days[days.length - 1]) : ""}</span>
      </div>
    </figure>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 140;
  const h = 26;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="led-spark" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Head({ n, title }: { n: string; title: string }) {
  return (
    <div className="blk-head">
      <span className="mono">{n}</span>
      <LineReveal as="h2" className="display" lines={[title]} />
    </div>
  );
}

const sum = (rows: DailyStat[], k: keyof DailyStat): number => rows.reduce((n, r) => n + Number(r[k]), 0);

export function AnalyticsView({ stats }: { stats: PlatformStats }) {
  const { daily, tickers, totals } = stats;
  const days = daily.map((d) => d.day);
  const last30 = daily.slice(-30);
  const last7 = daily.slice(-7);
  const prev7 = daily.slice(-14, -7);
  const cumulative = daily.reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d.new_wallets], []);
  const hitRate = daily.map((d) => (d.model_calls + d.cache_hits ? Math.round((d.cache_hits / (d.model_calls + d.cache_hits)) * 100) : 0));
  const deskStart = daily.findIndex((d) => d.agent_conversations > 0);
  const desk = deskStart >= 0 ? daily.slice(deskStart) : [];
  const served = totals.model_calls + totals.cache_hits;

  const ledger: { name: string; key: keyof DailyStat; total: number }[] = [
    { name: "Analyses", key: "analyses", total: totals.analyses },
    { name: "Follow-up questions", key: "followups", total: totals.followups },
    { name: "Desk conversations", key: "agent_conversations", total: totals.agent_conversations },
    { name: "Desk questions", key: "agent_questions", total: totals.agent_questions },
    { name: "Watches created", key: "agent_watches_created", total: totals.agent_watches },
    { name: "Watches fired", key: "agent_triggers", total: totals.agent_triggers },
    { name: "Claim checks", key: "agent_claim_checks", total: totals.agent_claim_checks },
    { name: "Model calls", key: "model_calls", total: totals.model_calls },
    { name: "Served from cache", key: "cache_hits", total: totals.cache_hits },
  ];

  return (
    <div className="led">
      <ul className="led-facts">
        <li><b><CountUp to={totals.wallets} group /></b>wallets</li>
        <li><b><CountUp to={totals.analyses} group /></b>analyses</li>
        <li><b><CountUp to={totals.followups} group /></b>follow-ups</li>
        <li><b><CountUp to={totals.agent_questions} group /></b>desk questions</li>
        <li><b><CountUp to={totals.agent_watches_active} group /></b>watches standing</li>
        <li><b><CountUp to={totals.agent_claim_checks} group /></b>claims checked</li>
      </ul>
      {DUNE_DASHBOARD_URL && (
        <p className="led-verify">
          Don&apos;t take the desk&apos;s word for it. The same figures are published as open tables on Dune, where anyone can run the queries.{" "}
          <a href={DUNE_DASHBOARD_URL} target="_blank" rel="noreferrer">Verify them on Dune →</a>
        </p>
      )}

      <section className="led-blk">
        <Head n="L.1" title="Activity, by day" />
        <p className="led-note">Active wallets are wallets that did anything that day: an analysis, a follow-up, a desk question, a watch or a claim check. Bars are analyses filed.</p>
        <Series label="active wallets · analyses" values={daily.map((d) => d.active_wallets)} bars={daily.map((d) => d.analyses)} days={days} />
      </section>

      <section className="led-blk">
        <Head n="L.2" title="Growth" />
        <p className="led-note">Wallets that have signed in at least once, cumulative. A wallet is counted when it first proves ownership with a signature.</p>
        <Series label="cumulative wallets" values={cumulative} days={days} area />
      </section>

      <section className="led-blk">
        <Head n="L.3" title="The ledger" />
        <div className="led-tbl-wrap">
          <table className="led-tbl">
            <thead>
              <tr>
                <th className="mono">series</th>
                <th className="mono n">all time</th>
                <th className="mono">last 30 days</th>
                <th className="mono n">last 7 days</th>
                <th className="mono n">vs prior 7</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => {
                const a = sum(last7, row.key);
                const b = sum(prev7, row.key);
                const delta = b ? Math.round(((a - b) / b) * 100) : null;
                return (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td className="n">{fmt(row.total)}</td>
                    <td><Spark values={last30.map((d) => Number(d[row.key]))} /></td>
                    <td className="n">{fmt(a)}</td>
                    <td className="n">{delta == null ? "n/a" : `${delta > 0 ? "+" : ""}${delta}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {desk.length > 0 && (
        <section className="led-blk">
          <Head n="L.4" title="The desk" />
          <p className="led-note">Since the first desk conversation. Questions spend at most one model call each; watches and what-changed reads spend none.</p>
          <Series label="desk questions · conversations" values={desk.map((d) => d.agent_questions)} bars={desk.map((d) => d.agent_conversations)} days={desk.map((d) => d.day)} />
        </section>
      )}

      <section className="led-blk">
        <Head n="L.5" title="Coverage" />
        <p className="led-note">{fmt(totals.tickers)} tickers have been analysed. The twelve most read, with the number of distinct wallets that asked.</p>
        <ol className="led-rank">
          {tickers.map((t, i) => (
            <li key={t.ticker}>
              <span className="mono led-rank-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="led-rank-t">{t.ticker}</span>
              <span className="led-rank-bar" aria-hidden="true"><i style={{ width: `${(t.analyses / Math.max(1, tickers[0]?.analyses ?? 1)) * 100}%` }} /></span>
              <span className="mono n">{fmt(t.analyses)}</span>
              <span className="mono led-rank-w">{fmt(t.unique_wallets)} wallets</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="led-blk">
        <Head n="L.6" title="Cost, decoupled" />
        <p className="led-note">
          Share of analyses served from the shared cache instead of a fresh model call. All time: {served ? Math.round((totals.cache_hits / served) * 100) : 0}% of {fmt(served)} served. Every hit is a read that cost nothing to answer.
        </p>
        <Series label="cache hit rate, %" values={hitRate} days={days} />
      </section>

      <p className="led-foot mono">
        Computed {new Date(stats.generated_at).toISOString().replace("T", " ").slice(0, 16)}Z from the platform&apos;s own records · aggregates only · refreshed hourly ·{" "}
        <Link className="dk-link" href="/privacy">what is kept</Link>
        {DUNE_DASHBOARD_URL && (<>{" · "}<a className="dk-link" href={DUNE_DASHBOARD_URL} target="_blank" rel="noreferrer">verify on Dune</a></>)}
      </p>
    </div>
  );
}
