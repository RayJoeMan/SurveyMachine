import * as Sentry from "@sentry/node";

/**
 * Opt-in error monitoring for Cloud Functions. Enabled only when SENTRY_DSN is
 * set in the function environment; otherwise a no-op so deployments without a
 * DSN are unaffected.
 */
export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV ?? "production",
  });
}
