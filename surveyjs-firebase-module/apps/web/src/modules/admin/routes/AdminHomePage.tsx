import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  exportOrganizationData,
  listSurveys,
  type PrivateSurvey,
} from "@/modules/admin/data/admin.repository";
import { LoadingState } from "@/shared/AsyncState";

function CopyPublicLink({ surveyId }: { surveyId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/s/${surveyId}`;
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1_600);
        });
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function AdminHomePage() {
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrg();
  const [surveys, setSurveys] = useState<PrivateSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || !activeOrgId) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      try {
        const items = await listSurveys(activeOrgId);
        if (!active) return;
        setSurveys(items);
      } catch (loadError: unknown) {
        if (!active) return;
        console.error("Survey list failed", loadError);
        setError("You do not have access, or the survey list could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeOrgId, user]);

  const canExportOrganization = Boolean(activeOrg?.roles.includes("org_admin"));

  async function handleExportOrg() {
    if (!activeOrgId) return;
    setExporting(true);
    setError("");
    try {
      const result = await exportOrganizationData({ orgId: activeOrgId });
      window.location.assign(result.downloadUrl);
    } catch (exportError) {
      console.error("Organization export failed", exportError);
      setError("The organization export could not be created. Verify your role and try again.");
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || orgLoading) return <LoadingState label="Checking access…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) {
    return (
      <AdminShell>
        <div className="empty-panel">
          <h1>No organization selected</h1>
          <p>
            Your account is not a member of any organization yet. An administrator must create your
            organization with the bootstrap tool and grant your membership.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{activeOrg?.name || activeOrgId}</span>
          <h1>Surveys</h1>
          <p>
            Create a draft, test its branching, publish a public projection, and review results.
          </p>
        </div>
        <div className="page-actions">
          {canExportOrganization && (
            <button
              className="button button--secondary"
              type="button"
              disabled={exporting}
              onClick={() => void handleExportOrg()}
            >
              {exporting ? "Preparing export…" : "Export organization data"}
            </button>
          )}
          <Link className="button" to="/admin/surveys/new">
            New survey
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading surveys…" />
      ) : error ? (
        <div className="inline-message inline-message--error" role="alert">
          {error}
        </div>
      ) : surveys.length === 0 ? (
        <div className="empty-panel">
          <h2>No surveys yet</h2>
          <p>
            Start with the JSON editor and preview. A licensed visual Creator can be added later.
          </p>
          <Link className="button" to="/admin/surveys/new">
            Create the first survey
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Survey</th>
                <th>Status</th>
                <th>Version</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((survey) => (
                <tr key={survey.surveyId}>
                  <td>
                    <strong>{survey.title}</strong>
                    <span className="table-subtitle">{survey.description}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${survey.status}`}>
                      {survey.status}
                    </span>
                  </td>
                  <td>{survey.publishedVersion || "—"}</td>
                  <td className="table-actions">
                    <Link to={`/admin/surveys/${survey.surveyId}/edit`}>Edit</Link>
                    <Link to={`/admin/surveys/${survey.surveyId}/report`}>Report</Link>
                    {survey.status === "published" && (
                      <>
                        <a href={`/s/${survey.surveyId}`} target="_blank" rel="noreferrer">
                          Open
                        </a>
                        <CopyPublicLink surveyId={survey.surveyId} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
