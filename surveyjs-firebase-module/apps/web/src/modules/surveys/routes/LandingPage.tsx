import { Link } from "react-router-dom";
import { env } from "@/config/env";

/** The demo survey is seeded only into local/emulator environments. */
const showDemo = env.useEmulators || env.environment !== "production";

export function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-card">
        <span className="eyebrow">Survey Machine</span>
        <h1>Feedback that builds better programs.</h1>
        <p>
          Create anonymous or signed-in surveys with branching, safe progress saving, live
          reports, and controlled exports — all under your organization&apos;s control.
        </p>
        <div className="button-row">
          <Link className="button" to="/admin">
            Get started
          </Link>
          <Link className="button button--secondary" to="/login">
            Sign in
          </Link>
          {showDemo && (
            <Link className="button button--secondary" to="/s/demo-end-of-season">
              Open demo survey
            </Link>
          )}
        </div>
      </div>
      <footer className="landing-footer">
        <Link to="/legal/terms">Terms of Service</Link>
        <Link to="/legal/privacy">Privacy Policy</Link>
        <Link to="/legal/refunds">Refunds &amp; Cancellations</Link>
      </footer>
    </main>
  );
}
