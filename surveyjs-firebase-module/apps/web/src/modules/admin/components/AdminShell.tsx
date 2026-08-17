import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, signOutUser } = useAuth();
  const { memberships, activeOrgId, activeOrg, setActiveOrgId } = useActiveOrg();
  return (
    <div className="admin-app">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin">
          Survey administration
        </Link>
        <nav aria-label="Administration">
          <Link to="/admin">Surveys</Link>
          <Link to="/admin/billing">Billing</Link>
          {memberships.length > 1 ? (
            <label className="org-switcher">
              <span className="sr-only">Organization</span>
              <select
                value={activeOrgId ?? ""}
                onChange={(event) => setActiveOrgId(event.target.value)}
              >
                {memberships.map((membership) => (
                  <option key={membership.orgId} value={membership.orgId}>
                    {membership.name}
                  </option>
                ))}
              </select>
            </label>
          ) : activeOrg ? (
            <span className="admin-user">{activeOrg.name}</span>
          ) : null}
          <span className="admin-user">{user?.email}</span>
          <button className="text-button" type="button" onClick={() => void signOutUser()}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
