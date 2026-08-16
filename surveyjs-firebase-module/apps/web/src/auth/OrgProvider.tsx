/* eslint-disable react-refresh/only-export-components */
import { collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/config/env";
import { db } from "@/firebase/client";

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
        const snapshot = await getDocs(
          query(collectionGroup(db, "members"), where("uid", "==", user.uid)),
        );
        const loaded = await Promise.all(
          snapshot.docs.map(async (memberDoc): Promise<OrgMembership> => {
            const orgId = memberDoc.id;
            let name = orgId;
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
              roles: Array.isArray(memberDoc.get("roles"))
                ? (memberDoc.get("roles") as string[])
                : [],
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
