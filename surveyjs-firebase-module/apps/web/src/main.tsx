import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "survey-core/survey-core.min.css";
import { App } from "@/app/App";
import { AuthProvider } from "@/auth/AuthProvider";
import { OrgProvider } from "@/auth/OrgProvider";
import { env } from "@/config/env";
import "@/styles/global.css";

// Error monitoring is opt-in via VITE_SENTRY_DSN and skipped in emulator runs.
if (!env.useEmulators && env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: env.environment,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <App />
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
