import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  createSurveyExport,
  getSurvey,
  getSurveyQuestionAggregates,
  getSurveySummary,
  type PrivateSurvey,
  type QuestionAggregates,
  type SurveySummary,
} from "@/modules/admin/data/admin.repository";
import { LoadingState } from "@/shared/AsyncState";

export function ReportPage() {
  const { surveyId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const [survey, setSurvey] = useState<PrivateSurvey | null>(null);
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [questionAggregates, setQuestionAggregates] = useState<QuestionAggregates>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !activeOrgId) return;
    void Promise.all([
      getSurvey(activeOrgId, surveyId),
      getSurveySummary(activeOrgId, surveyId),
      getSurveyQuestionAggregates(activeOrgId, surveyId),
    ])
      .then(([loadedSurvey, loadedSummary, loadedAggregates]) => {
        setSurvey(loadedSurvey);
        setSummary(loadedSummary);
        setQuestionAggregates(loadedAggregates);
      })
      .catch((loadError: unknown) => {
        console.error("Report load failed", loadError);
        setError("The report could not be loaded or you do not have reporting access.");
      })
      .finally(() => setLoading(false));
  }, [activeOrgId, surveyId, user]);

  async function handleExport() {
    if (!activeOrgId) {
      setError("No organization selected.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const result = await createSurveyExport({
        orgId: activeOrgId,
        surveyId,
        format: "csv",
      });
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
  if (!activeOrgId) {
    return (
      <AdminShell>
        <div className="empty-panel">
          <h1>No organization selected</h1>
          <p>Select an organization before viewing reports.</p>
        </div>
      </AdminShell>
    );
  }

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
        <h2>Question distributions</h2>
        <p>
          Precomputed on the server from completed responses. Free-text answers are never copied
          here; raw responses remain available only through controlled export.
        </p>
        {Object.keys(questionAggregates).length === 0 ? (
          <p className="empty-panel">No aggregate data yet — publish a survey and collect responses.</p>
        ) : (
          <div className="distribution-list">
            {Object.entries(questionAggregates).map(([name, aggregate]) => {
              const counts = aggregate.counts || {};
              const total = aggregate.total || 0;
              const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              return (
                <article className="distribution-card" key={name}>
                  <header>
                    <strong>{name}</strong>
                    <span>
                      {aggregate.questionType || "question"} · {total} response{total === 1 ? "" : "s"}
                    </span>
                  </header>
                  <ul>
                    {entries.map(([value, count]) => (
                      <li key={value}>
                        <span className="distribution-label">{value}</span>
                        <span className="distribution-bar-track">
                          <span
                            className="distribution-bar"
                            style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="distribution-count">{count}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
