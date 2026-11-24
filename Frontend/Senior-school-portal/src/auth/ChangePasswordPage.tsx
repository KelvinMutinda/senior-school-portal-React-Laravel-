import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, changePassword, saveSession } from "../api/authApi";
import { toast } from "../components/Toast";

export default function ChangePasswordPage({ schoolName = "Senior School" }: { schoolName?: string }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!current) return setError("Enter your current password.");
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
      return setError("The new password needs at least 8 characters, with letters and numbers.");
    if (next !== confirm) return setError("The two new passwords do not match.");
    if (next === current) return setError("The new password must be different from the current one.");

    setLoading(true);
    try {
      const result = await changePassword({
        current_password: current,
        password: next,
        password_confirmation: confirm,
      });
      saveSession(result, false);
      toast.success("Password changed", "You can now use your new password to sign in.");
      navigate(result.redirect, { replace: true });
    }  catch (err) {
  console.error(err);
  setError(err instanceof ApiError ? err.message : `Request failed: ${err instanceof Error ? err.message : "unknown error"}`);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <main className="lg-main" style={{ margin: "0 auto" }}>
        <div className="lg-card">
          <div className="lg-head">
            <h2>Set a new password</h2>
            <p className="lg-sub">
              Welcome to {schoolName}. For your safety, replace the password you were given before you continue.
            </p>
          </div>

          <form noValidate onSubmit={submit}>
            <div className="lg-field">
              <label htmlFor="cp-current">Current (given) password</label>
              <div className="lg-ctl">
                <input id="cp-current" className="lg-input" type={show ? "text" : "password"}
                  autoComplete="current-password" value={current}
                  onChange={(e) => setCurrent(e.target.value)} disabled={loading} />
              </div>
            </div>

            <div className="lg-field">
              <label htmlFor="cp-new">New password</label>
              <div className="lg-ctl">
                <input id="cp-new" className="lg-input" type={show ? "text" : "password"}
                  autoComplete="new-password" value={next}
                  onChange={(e) => setNext(e.target.value)} disabled={loading} />
              </div>
              <p className="lg-hint">At least 8 characters, with letters and numbers.</p>
            </div>

            <div className="lg-field">
              <label htmlFor="cp-confirm">Confirm new password</label>
              <div className="lg-ctl">
                <input id="cp-confirm" className="lg-input" type={show ? "text" : "password"}
                  autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} disabled={loading} />
              </div>
            </div>

            <label className="lg-check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
            </label>

            {error ? <p className="lg-err" role="alert">{error}</p> : null}

            <button type="submit" className="lg-submit" disabled={loading} aria-busy={loading}>
              {loading ? "Saving" : "Save new password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}