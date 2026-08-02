/** Structured JSON-line logger for the capture daemon (one object per line). */

type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(line + "\n");
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
