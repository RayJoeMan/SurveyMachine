import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { UpsertSurveyInputSchema, type SurveyBranding, type SurveySettings } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  closeSurvey,
  deleteSurvey,
  getSurvey,
  isDraftConflictError,
  publishSurvey,
  upsertSurvey,
} from "@/modules/admin/data/admin.repository";
import { defaultSurveySchema } from "@/modules/admin/defaultSurvey";
import { LoadingState } from "@/shared/AsyncState";

interface SchemaDiagnostic {
  level: "error" | "warning";
  message: string;
}

function analyzeSurveySchema(schema: unknown): SchemaDiagnostic[] {
  const diagnostics: SchemaDiagnostic[] = [];
  if (!schema || typeof schema !== "object") {
    return [{ level: "error", message: "Schema must be a JSON object." }];
  }
  const record = schema as Record<string, unknown>;
  const pages = Array.isArray(record.pages)
    ? record.pages
    : Array.isArray(record.elements)
      ? record.elements
      : [];

  const questions: Array<{ name?: unknown; type?: unknown }> = [];
  const walk = (nodes: unknown[]): void => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const item = node as Record<string, unknown>;
      if (typeof item.type === "string" && item.type !== "page" && item.type !== "panel") {
        questions.push({ name: item.name, type: item.type });
      }
      if (Array.isArray(item.elements)) walk(item.elements);
    }
  };
  walk(pages);

  const names = questions.map((question) => String(question.name ?? ""));
  const duplicates = names.filter((name, index) => name && names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    diagnostics.push({
      level: "error",
      message: `Duplicate question names: ${[...new Set(duplicates)].join(", ")}.`,
    });
  }
  if (questions.some((question) => !question.name)) {
    diagnostics.push({ level: "error", message: "Every question requires a stable name." });
  }
  for (const question of questions) {
    if (question.type === "file") {
      diagnostics.push({
        level: "error",
        message: `File question "${String(question.name)}" cannot be used while uploads are disabled.`,
      });
    }
  }
  if (questions.length > 500) {
    diagnostics.push({ level: "warning", message: "Surveys are limited to 500 questions." });
  }
  if (pages.length > 50) {
    diagnostics.push({ level: "warning", message: "Surveys are limited to 50 pages." });
  }
  return diagnostics;
}

const defaultSettings: SurveySettings = {
  allowAnonymous: true,
  requireAuthentication: false,
  saveProgress: true,
  responseLimit: null,
  closesAt: null,
  locale: "en",
};

const defaultBranding: SurveyBranding = {
  organizationName: "Your Organization",
  primaryColor: "#123a63",
  accentColor: "#f4b942",
};

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function SurveyEditorPage() {
  const { surveyId: routeSurveyId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const navigate = useNavigate();
  const [surveyId, setSurveyId] = useState(routeSurveyId || "");
  const [status, setStatus] = useState<"draft" | "published" | "closed" | "archived">("draft");
  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [title, setTitle] = useState("New community survey");
  const [description, setDescription] = useState("Tell us about your experience.");
  const [schemaText, setSchemaText] = useState(JSON.stringify(defaultSurveySchema, null, 2));
  const [settings, setSettings] = useState<SurveySettings>(defaultSettings);
  const [branding, setBranding] = useState<SurveyBranding>(defaultBranding);
  const [closesAtInput, setClosesAtInput] = useState("");
  const [responseLimitInput, setResponseLimitInput] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "phone">("desktop");
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [loading, setLoading] = useState(Boolean(routeSurveyId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeSurveyId || !user || !activeOrgId) return;
    void getSurvey(activeOrgId, routeSurveyId)
      .then((survey) => {
        if (!survey) {
          setError("Survey not found.");
          return;
        }
        setSurveyId(survey.surveyId);
        setStatus(survey.status);
        setDraftRevision(Number(survey.draftRevision || 0));
        setPublishedVersion(Number(survey.publishedVersion || 0));
        setTitle(survey.title);
        setDescription(survey.description);
        setSchemaText(JSON.stringify(survey.schema, null, 2));
        setSettings(survey.settings);
        setBranding(survey.branding);
        setClosesAtInput(toLocalDateTime(survey.settings.closesAt));
        setResponseLimitInput(survey.settings.responseLimit?.toString() || "");
      })
      .catch((loadError: unknown) => {
        console.error("Survey load failed", loadError);
        setError("Survey could not be loaded or you do not have access.");
      })
      .finally(() => setLoading(false));
  }, [activeOrgId, routeSurveyId, user]);

  const preview = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(schemaText);
      const model = new Model(parsed);
      model.setDevice(previewMode);
      return { model, error: "", diagnostics: analyzeSurveySchema(parsed) };
    } catch (previewError) {
      return {
        model: null,
        error: previewError instanceof Error ? previewError.message : "Invalid SurveyJS JSON.",
        diagnostics: [],
      };
    }
  }, [previewMode, schemaText]);

  const hasBlockingDiagnostics = preview.diagnostics.some(
    (diagnostic) => diagnostic.level === "error",
  );

  function buildInput() {
    if (!activeOrgId) throw new Error("No organization selected.");
    const parsedSchema: unknown = JSON.parse(schemaText);
    const responseLimit = responseLimitInput ? Number(responseLimitInput) : null;
    const closesAt = closesAtInput ? new Date(closesAtInput).toISOString() : null;
    return UpsertSurveyInputSchema.parse({
      orgId: activeOrgId,
      surveyId: surveyId || undefined,
      title,
      description,
      schema: parsedSchema,
      settings: { ...settings, responseLimit, closesAt },
      branding,
      expectedDraftRevision: surveyId ? draftRevision : undefined,
    });
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const input = buildInput();
      const result = await upsertSurvey(input);
      setSurveyId(result.surveyId);
      setMessage("Draft saved.");
      if (!routeSurveyId) navigate(`/admin/surveys/${result.surveyId}/edit`, { replace: true });
      return result.surveyId;
    } catch (saveError) {
      console.error("Survey save failed", saveError);
      if (isDraftConflictError(saveError)) {
        setError(
          "This draft was changed by someone else. Reload the survey to see the latest version before saving again.",
        );
      } else {
        setError(
          saveError instanceof Error
            ? `Draft was not saved: ${saveError.message}`
            : "Draft was not saved.",
        );
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!activeOrgId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const savedId = await handleSave();
      if (!savedId) return;
      const result = await publishSurvey({ orgId: activeOrgId, surveyId: savedId });
      setStatus("published");
      setPublishedVersion(result.version);
      setShowPublishReview(false);
      setMessage(`Published version ${result.version}. Public ID: ${result.publicSurveyId}`);
    } catch (publishError) {
      console.error("Survey publish failed", publishError);
      setError("The draft was not published. Verify your role and survey configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!surveyId || !activeOrgId || !window.confirm("Close this survey and stop accepting new responses?")) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await closeSurvey({ orgId: activeOrgId, surveyId });
      setStatus("closed");
      setMessage("Survey closed.");
    } catch (closeError) {
      console.error("Survey close failed", closeError);
      setError("The survey could not be closed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!surveyId || !activeOrgId) return;
    if (!window.confirm("Delete this survey and ALL of its responses permanently? This cannot be undone.")) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteSurvey({ orgId: activeOrgId, surveyId });
      navigate("/admin", { replace: true });
    } catch (deleteError) {
      console.error("Survey delete failed", deleteError);
      setError("The survey could not be deleted. Verify your role and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <LoadingState label="Loading survey editor…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) {
    return (
      <AdminShell>
        <div className="empty-panel">
          <h1>No organization selected</h1>
          <p>Select or create an organization before editing surveys.</p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="page-heading">
        <div>
          <Link className="back-link" to="/admin">
            ← All surveys
          </Link>
          <h1>{surveyId ? "Edit survey" : "New survey"}</h1>
          <p>
            The JSON editor uses the free SurveyJS Form Library. Preview every branch before
            publishing.
          </p>
        </div>
        <span className={`status-badge status-badge--${status}`}>{status}</span>
      </div>

      {message && (
        <div className="inline-message inline-message--success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="inline-message inline-message--error" role="alert">
          {error}
        </div>
      )}

      <div className="editor-layout">
        <form className="editor-form" onSubmit={(event) => void handleSave(event)}>
          <section className="form-section">
            <h2>Basics</h2>
            <label>
              Survey title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={160}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
          </section>

          <section className="form-section">
            <h2>Access and limits</h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.allowAnonymous}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    allowAnonymous: event.target.checked,
                    requireAuthentication: !event.target.checked,
                  })
                }
              />
              Allow anonymous responses
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.saveProgress}
                onChange={(event) =>
                  setSettings({ ...settings, saveProgress: event.target.checked })
                }
              />
              Save partial progress to Firebase
            </label>
            <div className="field-row">
              <label>
                Response limit (optional)
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={responseLimitInput}
                  onChange={(event) => setResponseLimitInput(event.target.value)}
                />
              </label>
              <label>
                Close date (optional)
                <input
                  type="datetime-local"
                  value={closesAtInput}
                  onChange={(event) => setClosesAtInput(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>Branding</h2>
            <label>
              Organization name
              <input
                value={branding.organizationName}
                onChange={(event) =>
                  setBranding({ ...branding, organizationName: event.target.value })
                }
                required
              />
            </label>
            <div className="field-row">
              <label>
                Primary color
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(event) =>
                    setBranding({ ...branding, primaryColor: event.target.value })
                  }
                />
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(event) =>
                    setBranding({ ...branding, accentColor: event.target.value })
                  }
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading-row">
              <div>
                <h2>SurveyJS schema</h2>
                <p>Use stable question names; changing them changes reporting keys.</p>
              </div>
              {preview.error && <span className="validation-chip">Invalid JSON</span>}
            </div>
            <label>
              <span className="sr-only">SurveyJS JSON</span>
              <textarea
                className="code-editor"
                value={schemaText}
                onChange={(event) => setSchemaText(event.target.value)}
                rows={30}
                spellCheck={false}
              />
            </label>
            {preview.error && (
              <p className="form-error" role="alert">
                {preview.error}
              </p>
            )}
          </section>

          <div className="sticky-actions">
            <button
              className="button button--secondary"
              type="submit"
              disabled={saving || Boolean(preview.error)}
            >
              {saving ? "Working…" : "Save draft"}
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setShowPublishReview(true)}
              disabled={saving || Boolean(preview.error) || hasBlockingDiagnostics}
            >
              Publish
            </button>
            {status === "published" && (
              <button
                className="danger-button"
                type="button"
                onClick={() => void handleClose()}
                disabled={saving}
              >
                Close survey
              </button>
            )}
            {surveyId && (
              <button
                className="danger-button"
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                Delete survey
              </button>
            )}
          </div>
        </form>

        <aside className="preview-panel" aria-label="Survey preview">
          <div className="preview-heading">
            <span className="eyebrow">Live preview</span>
            <strong>Not connected to response storage</strong>
          </div>
          <div className="preview-toolbar" role="group" aria-label="Preview device">
            {(["desktop", "tablet", "phone"] as const).map((device) => (
              <button
                key={device}
                type="button"
                className={previewMode === device ? "preview-mode is-active" : "preview-mode"}
                aria-pressed={previewMode === device}
                onClick={() => setPreviewMode(device)}
              >
                {device}
              </button>
            ))}
          </div>
          <div className={`preview-frame preview-frame--${previewMode}`}>
            {preview.model ? (
              <Survey model={preview.model} />
            ) : (
              <p>Fix the JSON to restore the preview.</p>
            )}
          </div>
          {preview.diagnostics.length > 0 && (
            <div className="diagnostics-panel">
              <h3>Schema checks</h3>
              <ul>
                {preview.diagnostics.map((diagnostic, index) => (
                  <li
                    key={`${diagnostic.level}-${index}`}
                    className={`diagnostic diagnostic--${diagnostic.level}`}
                    role={diagnostic.level === "error" ? "alert" : undefined}
                  >
                    {diagnostic.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {showPublishReview && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-review-title"
          >
            <h2 id="publish-review-title">Review before publishing</h2>
            <dl className="review-list">
              <div>
                <dt>Public URL</dt>
                <dd>/s/{surveyId || "(assigned after first save)"}</dd>
              </div>
              <div>
                <dt>Version created</dt>
                <dd>{publishedVersion + 1}</dd>
              </div>
              <div>
                <dt>Respondents see</dt>
                <dd>This draft becomes the live public projection.</dd>
              </div>
            </dl>
            <p className="review-warning" role="alert">
              Changing question names changes reporting keys. Existing responses keep the version
              they were submitted under.
            </p>
            <div className="modal-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setShowPublishReview(false)}
              >
                Cancel
              </button>
              <button className="button" type="button" onClick={() => void handlePublish()}>
                Confirm publish
              </button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
