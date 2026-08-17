import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import type { SurveyModuleRole } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  inviteMember,
  listMembers,
  removeMember,
  updateMemberRoles,
} from "@/modules/admin/data/members.repository";
import { LoadingState } from "@/shared/AsyncState";

const ALL_ROLES: SurveyModuleRole[] = [
  "org_admin",
  "survey_admin",
  "survey_editor",
  "report_viewer",
];

const ROLE_LABELS: Record<SurveyModuleRole, string> = {
  org_admin: "Organization admin",
  survey_admin: "Survey admin",
  survey_editor: "Survey editor",
  report_viewer: "Report viewer",
};

interface MemberRow {
  uid: string;
  email?: string;
  displayName?: string;
  roles: SurveyModuleRole[];
  active: boolean;
}

export function MembersPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrg();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<SurveyModuleRole[]>(["survey_editor"]);
  const [inviting, setInviting] = useState(false);

  const isOrgAdmin = Boolean(activeOrg?.roles.includes("org_admin"));

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const rows = await listMembers(activeOrgId);
      setMembers(
        rows.map((row) => ({
          uid: row.uid,
          email: row.email,
          displayName: row.displayName,
          roles: row.roles as SurveyModuleRole[],
          active: row.active,
        })),
      );
    } catch (loadError) {
      console.error("Members load failed", loadError);
      setError("Members could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [load]);

  function toggleInviteRole(role: SurveyModuleRole) {
    setInviteRoles((current) =>
      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role],
    );
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!activeOrgId || inviteRoles.length === 0) return;
    setInviting(true);
    setError("");
    setNotice("");
    try {
      await inviteMember({ orgId: activeOrgId, email: inviteEmail, roles: inviteRoles });
      setInviteEmail("");
      setNotice(`Invitation sent to ${inviteEmail.trim().toLowerCase()}.`);
    } catch (inviteError) {
      console.error("Invite failed", inviteError);
      setError(
        inviteError instanceof Error
          ? `Invitation failed: ${inviteError.message}`
          : "Invitation failed.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: MemberRow, role: SurveyModuleRole) {
    if (!activeOrgId) return;
    setError("");
    setNotice("");
    const next = member.roles.includes(role)
      ? member.roles.filter((entry) => entry !== role)
      : [...member.roles, role];
    if (next.length === 0) return;
    try {
      await updateMemberRoles({ orgId: activeOrgId, uid: member.uid, roles: next });
      setMembers((current) =>
        current.map((entry) => (entry.uid === member.uid ? { ...entry, roles: next } : entry)),
      );
    } catch (roleError) {
      console.error("Role update failed", roleError);
      setError(
        roleError instanceof Error
          ? `Role update failed: ${roleError.message}`
          : "Role update failed.",
      );
    }
  }

  async function handleRemove(member: MemberRow) {
    if (!activeOrgId) return;
    if (!window.confirm(`Remove ${member.email ?? member.uid} from this organization?`)) return;
    setError("");
    setNotice("");
    try {
      await removeMember({ orgId: activeOrgId, uid: member.uid });
      setMembers((current) => current.filter((entry) => entry.uid !== member.uid));
    } catch (removeError) {
      console.error("Remove failed", removeError);
      setError(
        removeError instanceof Error ? `Remove failed: ${removeError.message}` : "Remove failed.",
      );
    }
  }

  if (authLoading || orgLoading) return <LoadingState label="Loading members…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) return <Navigate to="/admin" replace />;

  return (
    <AdminShell>
      <div className="page">
        <h1>Members</h1>
        <p className="muted">People who can view and manage surveys in {activeOrg?.name}.</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success-banner" role="status">
            {notice}
          </p>
        )}

        {isOrgAdmin && (
          <form className="invite-form" onSubmit={handleInvite}>
            <h2>Invite someone</h2>
            <label>
              Email
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
                maxLength={254}
                placeholder="teammate@example.com"
              />
            </label>
            <fieldset>
              <legend>Roles</legend>
              {ALL_ROLES.map((role) => (
                <label key={role} className="role-check">
                  <input
                    type="checkbox"
                    checked={inviteRoles.includes(role)}
                    onChange={() => toggleInviteRole(role)}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </fieldset>
            <button
              type="submit"
              className="primary"
              disabled={inviting || inviteRoles.length === 0}
            >
              {inviting ? "Inviting…" : "Send invitation"}
            </button>
          </form>
        )}

        {loading ? (
          <LoadingState label="Loading members…" />
        ) : (
          <table className="members-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Roles</th>
                {isOrgAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.uid}>
                  <td>
                    <strong>{member.displayName || member.email || member.uid}</strong>
                    {member.email && <span className="muted block">{member.email}</span>}
                    {!member.active && <span className="muted block">Inactive</span>}
                  </td>
                  <td>
                    {isOrgAdmin ? (
                      <span className="role-toggles">
                        {ALL_ROLES.map((role) => (
                          <label key={role} className="role-check">
                            <input
                              type="checkbox"
                              checked={member.roles.includes(role)}
                              onChange={() => void handleRoleChange(member, role)}
                            />
                            {ROLE_LABELS[role]}
                          </label>
                        ))}
                      </span>
                    ) : (
                      member.roles.map((role) => ROLE_LABELS[role]).join(", ")
                    )}
                  </td>
                  {isOrgAdmin && (
                    <td>
                      {member.uid !== user?.uid && (
                        <button
                          type="button"
                          className="danger-link"
                          onClick={() => void handleRemove(member)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
