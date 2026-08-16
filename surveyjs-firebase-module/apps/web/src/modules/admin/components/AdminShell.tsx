import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, signOutUser } = useAuth();
  return (
    <div className="admin-app">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin">
          Survey administration
        </Link>
        <nav aria-label="Administration">
          <Link to="/admin">Surveys</Link>
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
