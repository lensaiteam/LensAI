/**
 * Standalone capture scripts don't get Next's automatic .env loading, so load it
 * ourselves via Node's built-in env-file support. .env.local wins over .env.
 * (captureConfig reads process.env lazily, so calling this at the top of main()
 * is enough.)
 */
export function loadLocalEnv(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* file absent — fine */
    }
  }
}
