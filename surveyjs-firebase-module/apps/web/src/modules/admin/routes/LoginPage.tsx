import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/shared/AsyncState";

export function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, redirectError, clearRedirectError } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Sign-in failed. Check the email and password, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError("");
    clearRedirectError();
    try {
      await signInWithGoogle();
      // With the redirect flow the page navigates to Google; on return the
      // provider processes the result and redirectError reports any failure.
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
        <h1>Sign in to Survey Machine</h1>
        <p>Sign in with your organization account to manage surveys and reports.</p>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <Link className="login-help" to="/forgot-password">
          Forgot password?
        </Link>
        {(error || redirectError) && (
          <p className="form-error" role="alert">
            {error || redirectError}
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
          By continuing you agree to our <Link to="/legal/terms">Terms of Service</Link> and{" "}
          <Link to="/legal/privacy">Privacy Policy</Link>.
        </p>
      </form>
    </main>
  );
}
