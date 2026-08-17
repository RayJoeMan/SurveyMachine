import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { OrgBranding } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import { loadOrgBranding, updateOrganization } from "@/modules/admin/data/admin.repository";
import { storage } from "@/firebase/client";
import { LoadingState } from "@/shared/AsyncState";

const DEFAULT_BRANDING: OrgBranding = {
  organizationName: "",
  primaryColor: "#123a63",
  accentColor: "#f4b942",
};

export function OrgSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId, activeOrg, reload, loading: orgLoading } = useActiveOrg();
  const [name, setName] = useState("");
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      try {
        const loaded = await loadOrgBranding(activeOrgId);
        if (!active) return;
        if (loaded) setBranding(loaded);
      } catch (loadError) {
        console.error("Branding load failed", loadError);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeOrgId]);

  const isOrgAdmin = Boolean(activeOrg?.roles.includes("org_admin"));

  async function handleUploadLogo(file: File) {
    if (!activeOrgId) return;
    setUploading(true);
    setError("");
    try {
      const logoRef = ref(storage, `public-assets/${activeOrgId}/logo`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      setBranding((current) => ({ ...current, logoUrl: url }));
      setSaved(false);
    } catch (uploadError) {
      console.error("Logo upload failed", uploadError);
      setError(
        uploadError instanceof Error
          ? `Logo upload failed: ${uploadError.message}`
          : "Logo upload failed. Use a PNG, JPEG, or WebP under 2 MB.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!activeOrgId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const orgName = name.trim() || activeOrg?.name || "";
      await updateOrganization({
        orgId: activeOrgId,
        name: orgName || undefined,
        branding: {
          organizationName: branding.organizationName.trim() || orgName,
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
          accentColor: branding.accentColor,
        },
      });
      setSaved(true);
      reload();
    } catch (saveError) {
      console.error("Settings save failed", saveError);
      setError(
        saveError instanceof Error
          ? `Settings could not be saved: ${saveError.message}`
          : "Settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || orgLoading) return <LoadingState label="Loading settings…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) return <Navigate to="/admin" replace />;

  return (
    <AdminShell>
      <div className="page">
        <h1>Settings</h1>
        <p className="muted">Organization name, brand colors, and logo.</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="success-banner" role="status">
            Settings saved.
          </p>
        )}

        {loading ? (
          <LoadingState label="Loading settings…" />
        ) : (
          <form className="settings-form" onSubmit={handleSave}>
            <label>
              Organization name
              <input
                value={name || activeOrg?.name || ""}
                onChange={(event) => setName(event.target.value)}
                disabled={!isOrgAdmin}
                maxLength={120}
              />
            </label>

            <fieldset>
              <legend>Brand colors</legend>
              <div className="color-row">
                <label>
                  Primary
                  <span className="color-input">
                    <input
                      type="color"
                      value={branding.primaryColor}
                      disabled={!isOrgAdmin}
                      onChange={(event) =>
                        setBranding((current) => ({
                          ...current,
                          primaryColor: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={branding.primaryColor}
                      disabled={!isOrgAdmin}
                      maxLength={7}
                      onChange={(event) =>
                        setBranding((current) => ({
                          ...current,
                          primaryColor: event.target.value,
                        }))
                      }
                    />
                  </span>
                </label>
                <label>
                  Accent
                  <span className="color-input">
                    <input
                      type="color"
                      value={branding.accentColor}
                      disabled={!isOrgAdmin}
                      onChange={(event) =>
                        setBranding((current) => ({
                          ...current,
                          accentColor: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={branding.accentColor}
                      disabled={!isOrgAdmin}
                      maxLength={7}
                      onChange={(event) =>
                        setBranding((current) => ({
                          ...current,
                          accentColor: event.target.value,
                        }))
                      }
                    />
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Logo</legend>
              {branding.logoUrl && (
                <img
                  className="org-logo-preview"
                  src={branding.logoUrl}
                  alt="Organization logo preview"
                />
              )}
              {isOrgAdmin && (
                <label className="file-button">
                  {uploading ? "Uploading…" : "Upload logo (PNG/JPEG/WebP, ≤ 2 MB)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleUploadLogo(file);
                    }}
                  />
                </label>
              )}
              <p className="muted small">
                The logo and colors are applied to your public survey pages and used as the default
                branding for new surveys.
              </p>
            </fieldset>

            {isOrgAdmin && (
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            )}
          </form>
        )}
      </div>
    </AdminShell>
  );
}
