import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { slugifyOrganizationName } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  createOrganization,
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
  const { activeOrgId, activeOrg, reload, loading: orgLoading } = useActiveOrg();
  const [surveys, setSurveys] = useState<PrivateSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgIdInput, setOrgIdInput] = useState("");
  const [creating, setCreating] = useState(false);

  const previewOrgId = orgIdInput.trim() || slugifyOrganizationName(orgName);

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

  async function handleCreateOrg(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      await createOrganization({
        name: orgName.trim(),
        orgId: previewOrgId || undefined,
      });
      setOrgName("");
      setOrgIdInput("");
      reload();
    } catch (createError) {
      console.error("Organization creation failed", createError);
      setError(
        createError instanceof Error
          ? `Your organization could not be created: ${createError.message}`
          : "Your organization could not be created. Check the name and try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || orgLoading) return <LoadingState label="Checking access…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) {
    return (
      <AdminShell>
        <div className="empty-panel">
          <h1>Create your organization</h1>
          <p>
            You are not a member of an organization yet. Create one to start collecting feedback,
            or ask an existing administrator to add your account as a member.
          </p>
          <form className="onboarding-form" onSubmit={(event) => void handleCreateOrg(event)}>
            <label>
              Organization name
              <input
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                required
                maxLength={120}
                placeholder="e.g. Northside Youth Sports"
              />
            </label>
            <label>
              Identifier (optional)
              <input
                value={orgIdInput}
                onChange={(event) => setOrgIdInput(event.target.value)}
                placeholder={previewOrgId || "auto-generated"}
                maxLength={80}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create organization"}
            </button>
          </form>
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
