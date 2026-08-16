import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-card">
        <span className="eyebrow">Community feedback</span>
        <h1>Surveys that turn feedback into better programs.</h1>
        <p>
          This independently deployable module supports anonymous or authenticated surveys,
          branching, safe progress saving, reporting, and controlled exports.
        </p>
        <div className="button-row">
          <Link className="button" to="/s/demo-end-of-season">
            Open demo survey
          </Link>
          <Link className="button button--secondary" to="/admin">
            Survey administration
          </Link>
        </div>
        <p className="fine-print">
          Local demo: start the Firebase emulators and run the seed task before opening the sample.
        </p>
      </div>
    </main>
  );
}
