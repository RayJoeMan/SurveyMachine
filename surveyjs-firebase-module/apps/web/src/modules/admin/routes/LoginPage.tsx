import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/shared/AsyncState";

export function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("admin@example.test");
  const [password, setPassword] = useState("LocalOnly123!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo") || "/admin";

  if (loading) return <LoadingState label="Checking sign-in…" />;
  if (user) return <Navigate to={returnTo} replace />;

  async function handleEmailSignIn(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signInWithEmail(email, password);
      navigate(returnTo, { replace: true });
    } catch (signInError) {
      console.error("Sign in failed", signInError);
      setError("Sign-in failed. Check the account and password, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError("");
    try {
      await signInWithGoogle();
      navigate(returnTo, { replace: true });
    } catch (signInError) {
      console.error("Google sign in failed", signInError);
      setError("Google sign-in was not completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleEmailSignIn}>
        <span className="eyebrow">Staff access</span>
        <h1>Survey administration</h1>
        <p>Use the seeded local account below or your configured Google account.</p>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={submitting} type="submit">
          {submitting ? "Signing in…" : "Sign in with email"}
        </button>
        <button
          className="button button--secondary"
          disabled={submitting}
          type="button"
          onClick={() => void handleGoogleSignIn()}
        >
          Sign in with Google
        </button>
        <p className="fine-print">
          The sample password is for the local Auth emulator only. Never reuse it in production.
        </p>
      </form>
    </main>
  );
}
