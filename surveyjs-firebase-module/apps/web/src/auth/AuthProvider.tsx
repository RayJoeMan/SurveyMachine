/* eslint-disable react-refresh/only-export-components */
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { env } from "@/config/env";
import { auth } from "@/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Error surfaced when a redirect-based Google sign-in fails on return. */
  redirectError: string | null;
  clearRedirectError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      }),
    [],
  );

  // Process a redirect-based Google sign-in on return to the app. The user is
  // handled by onAuthStateChanged; this only surfaces failures (e.g. cancelled
  // popup, unauthorized domain, account conflict) that would otherwise be lost.
  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      try {
        await getRedirectResult(auth);
      } catch (error) {
        if (!active) return;
        console.error("Google redirect sign-in failed", error);
        const message = error instanceof Error ? error.message : String(error);
        setRedirectError(
          message.includes("unauthorized-domain")
            ? "Google sign-in is not authorized for this domain yet."
            : message.includes("account-exists-with-different-credential")
              ? "An account already exists for this email with a different sign-in method."
              : "Google sign-in was not completed.",
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const clearRedirectError = useCallback(() => setRedirectError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      redirectError,
      clearRedirectError,
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle() {
        setRedirectError(null);
        // Popup works against the emulator; the production flow uses a full
        // redirect, which is compatible with popup blockers, mobile browsers,
        // and restrictive COOP headers.
        if (env.useEmulators) {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } else {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        }
      },
      async signOutUser() {
        await signOut(auth);
      },
      async sendPasswordReset(email) {
        await sendPasswordResetEmail(auth, email);
      },
      async sendEmailVerification() {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
    }),
    [loading, redirectError, user, clearRedirectError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
