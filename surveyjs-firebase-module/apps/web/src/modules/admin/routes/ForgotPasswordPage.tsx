import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("idle");
    setMessage("");
    try {
      await sendPasswordReset(email.trim());
      setStatus("sent");
      setMessage(
        "If an account exists for that email, a password reset link is on its way. Check your inbox (and spam folder).",
      );
    } catch (resetError) {
      console.error("Password reset request failed", resetError);
      setStatus("error");
      setMessage("We could not send a reset link. Check the email address and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
        <span className="eyebrow">Account recovery</span>
        <h1>Reset your password</h1>
        <p>Enter your account email and we will send a password reset link.</p>
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
        {status === "sent" && (
          <p className="inline-message inline-message--success" role="status">
            {message}
          </p>
        )}
        {status === "error" && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button className="button" disabled={submitting} type="submit">
          {submitting ? "Sending…" : "Send reset link"}
        </button>
        <p className="fine-print">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </main>
  );
}
