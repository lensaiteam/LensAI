/**
 * Per-provider quota tracking for the pool: a sliding one-minute window
 * (rpm), a UTC-day counter (rpd), and a cooldown set when a provider returns 429.
 * In-memory by design — a restart forgets today's count, which only makes the
 * tracker optimistic until the provider's own 429 corrects it (the cooldown).
 */

const MINUTE = 60_000;
const DAY = 86_400_000;

interface State {
  recent: number[];
  day: number;
  dayCount: number;
  cooldownUntil: number;
}

export interface Limits {
  rpm: number;
  rpd: number;
}

export class QuotaTracker {
  private state = new Map<string, State>();
  constructor(private readonly now: () => number = Date.now) {}

  private get(id: string): State {
    const t = this.now();
    const day = Math.floor(t / DAY);
    let s = this.state.get(id);
    if (!s) {
      s = { recent: [], day, dayCount: 0, cooldownUntil: 0 };
      this.state.set(id, s);
    }
    if (s.day !== day) {
      s.day = day;
      s.dayCount = 0;
    }
    s.recent = s.recent.filter((x) => t - x < MINUTE);
    return s;
  }

  canUse(id: string, limits: Limits): boolean {
    const s = this.get(id);
    return this.now() >= s.cooldownUntil && s.recent.length < limits.rpm && s.dayCount < limits.rpd;
  }

  /** 0..1 — how much of the tighter limit is consumed (lower = more headroom). */
  utilization(id: string, limits: Limits): number {
    const s = this.get(id);
    return Math.max(s.recent.length / limits.rpm, s.dayCount / limits.rpd);
  }

  record(id: string): void {
    const s = this.get(id);
    s.recent.push(this.now());
    s.dayCount += 1;
  }

  cooldown(id: string, ms: number): void {
    const s = this.get(id);
    s.cooldownUntil = Math.max(s.cooldownUntil, this.now() + ms);
  }

  snapshot(id: string, limits: Limits): { minute: number; day: number; coolingDown: boolean; rpm: number; rpd: number } {
    const s = this.get(id);
    return { minute: s.recent.length, day: s.dayCount, coolingDown: this.now() < s.cooldownUntil, ...limits };
  }
}
