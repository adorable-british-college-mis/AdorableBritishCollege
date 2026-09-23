import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { useAuth } from "./auth-context";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      const target = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(target, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/abc-logo.png" alt="Adorable British College" />
        </div>
        <div className="login-copy">
          <p className="eyebrow">College management information system</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to access your secure workspace.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <div className="input-wrap"><Mail size={18} aria-hidden="true" /><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@adorablebritishcollege.com" required /></div>
          <div className="password-label"><label htmlFor="password">Password</label><button type="button" className="text-button" disabled title="Password recovery will be enabled with the email provider">Forgot password?</button></div>
          <div className="input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" minLength={8} required /><button type="button" className="icon-button inside" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner small" /> Signing in…</> : "Sign in"}</button>
        </form>
        <Link className="login-apply-link" to="/"><ArrowLeft size={16} /> Apply for admission</Link>
        <p className="login-support">Need help? Contact the college ICT support team.</p>
      </section>
      <section className="login-visual" aria-label="Adorable British College students"><img src="/abc-students.png" alt="Students of Adorable British College" /></section>
    </main>
  );
}
