/* eslint-disable react-refresh/only-export-components */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isSuperAdminEmail } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/config/env";
import { db } from "@/firebase/client";

/** Roles granted to a super-admin account for every organization. */
const SUPER_ADMIN_ROLES = ["org_admin", "survey_admin", "survey_editor", "report_viewer"];

export interface OrgMembership {
  orgId: string;
  name: string;
  roles: string[];
}

interface OrgContextValue {
  /** Organizations the signed-in user is an active member of. */
  memberships: OrgMembership[];
  /** Currently selected organization, if any. */
  activeOrgId: string | null;
  activeOrg: OrgMembership | null;
  setActiveOrgId: (orgId: string) => void;
  /** Re-fetch memberships (e.g. after creating an organization). */
  reload: () => void;
  loading: boolean;
}

const STORAGE_KEY = "surveyModule.activeOrgId";

/**
 * For a collectionGroup query on `members`, each document is
 * organizations/{orgId}/members/{uid}; the document id is the user's uid, so
 * the organization id must be read from the document path.
 */
function orgIdFromMemberPath(path: string): string {
  const parts = path.split("/");
  return parts.length >= 3 ? parts[parts.length - 3] : "";
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Force an async boundary so state updates never run synchronously inside
      // the effect (avoids cascading renders).
      await Promise.resolve();

      if (!user) {
        if (!active) return;
        setMemberships([]);
        setActiveOrgIdState(null);
        setLoading(false);
        return;
      }

      if (!active) return;
      setLoading(true);
      try {
        // Super-admin accounts see every organization with full roles; other
        // users see only the organizations they are a member of.
        const isSuperAdmin = isSuperAdminEmail(user.email);
        const snapshot = isSuperAdmin
          ? await getDocs(collection(db, "organizations"))
          : await getDocs(
              query(collectionGroup(db, "members"), where("uid", "==", user.uid)),
            );
        const loaded = await Promise.all(
          snapshot.docs.map(async (snap): Promise<OrgMembership> => {
            const orgId = isSuperAdmin ? snap.id : orgIdFromMemberPath(snap.ref.path);
            let name = orgId;
            if (isSuperAdmin) {
              if (typeof snap.get("name") === "string") {
                name = snap.get("name") as string;
              }
              return { orgId, name, roles: SUPER_ADMIN_ROLES };
            }
            try {
              const organization = await getDoc(doc(db, "organizations", orgId));
              if (organization.exists() && typeof organization.get("name") === "string") {
                name = organization.get("name") as string;
              }
            } catch {
              // Fall back to the organization ID as the display name.
            }
            return {
              orgId,
              name,
              roles: Array.isArray(snap.get("roles")) ? (snap.get("roles") as string[]) : [],
            };
          }),
        );
        if (!active) return;
        setMemberships(loaded);

        const stored = window.localStorage.getItem(STORAGE_KEY);
        const selected =
          stored && loaded.some((membership) => membership.orgId === stored)
            ? stored
            : env.defaultOrgId && loaded.some((membership) => membership.orgId === env.defaultOrgId)
              ? env.defaultOrgId
              : (loaded[0]?.orgId ?? null);
        setActiveOrgIdState(selected);
      } catch (error) {
        console.error("Failed to load organization memberships", error);
        if (!active) return;
        setMemberships([]);
        setActiveOrgIdState(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey, user]);

  const setActiveOrgId = useCallback((orgId: string) => {
    window.localStorage.setItem(STORAGE_KEY, orgId);
    setActiveOrgIdState(orgId);
  }, []);

  const value = useMemo<OrgContextValue>(
    () => ({
      memberships,
      activeOrgId,
      activeOrg: memberships.find((membership) => membership.orgId === activeOrgId) ?? null,
      setActiveOrgId,
      reload,
      loading: loading || authLoading,
    }),
    [activeOrgId, authLoading, loading, memberships, reload, setActiveOrgId],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useActiveOrg(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) throw new Error("useActiveOrg must be used within OrgProvider.");
  return value;
}
