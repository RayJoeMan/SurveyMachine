import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/config/env";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  createSurveyExport,
  getSurvey,
  getSurveySummary,
  type PrivateSurvey,
  type SurveySummary,
} from "@/modules/admin/data/admin.repository";
import { LoadingState } from "@/shared/AsyncState";

export function ReportPage() {
  const { surveyId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [survey, setSurvey] = useState<PrivateSurvey | null>(null);
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      getSurvey(env.defaultOrgId, surveyId),
      getSurveySummary(env.defaultOrgId, surveyId),
    ])
      .then(([loadedSurvey, loadedSummary]) => {
        setSurvey(loadedSurvey);
        setSummary(loadedSummary);
      })
      .catch((loadError: unknown) => {
        console.error("Report load failed", loadError);
        setError("The report could not be loaded or you do not have reporting access.");
      })
      .finally(() => setLoading(false));
  }, [surveyId, user]);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const result = await createSurveyExport({ orgId: env.defaultOrgId, surveyId, format: "csv" });
      window.location.assign(result.downloadUrl);
    } catch (exportError) {
      console.error("Export failed", exportError);
      setError("The CSV export could not be created. Check your role and try again.");
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || loading) return <LoadingState label="Loading report…" />;
  if (!user) return <Navigate to="/login" replace />;

  const averageSeconds = summary?.completed
    ? Math.round(summary.totalDurationMs / summary.completed / 1000)
    : 0;

  return (
    <AdminShell>
      <div className="page-heading">
        <div>
          <Link className="back-link" to="/admin">
            ← All surveys
          </Link>
          <h1>{survey?.title || "Survey report"}</h1>
          <p>
            Summary values are server-maintained. Raw answers are available only through controlled
            export.
          </p>
        </div>
        <button
          className="button"
          type="button"
          disabled={exporting || !survey}
          onClick={() => void handleExport()}
        >
          {exporting ? "Preparing CSV…" : "Export completed responses"}
        </button>
      </div>

      {error && (
        <div className="inline-message inline-message--error" role="alert">
          {error}
        </div>
      )}

      <div className="metric-grid">
        <article className="metric-card">
          <span>Completed</span>
          <strong>{summary?.completed || 0}</strong>
        </article>
        <article className="metric-card">
          <span>In progress</span>
          <strong>{summary?.inProgress || 0}</strong>
        </article>
        <article className="metric-card">
          <span>Average completion</span>
          <strong>{averageSeconds ? `${averageSeconds}s` : "—"}</strong>
        </article>
      </div>

      <section className="report-note">
        <h2>Reporting expansion point</h2>
        <p>
          Add question-level distributions to precomputed aggregate documents. Do not download every
          response to the browser for client-side aggregation.
        </p>
      </section>
    </AdminShell>
  );
}
