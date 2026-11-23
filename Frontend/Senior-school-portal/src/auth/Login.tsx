import { useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login, saveSession } from "../api/authApi";
import { toast } from "../components/Toast";

/* ==========================================================================
   LoginPage
   Styles live in App.css (section "Login page"). Every class starts with lg-.

   Signs in by itself: calls the Laravel API (src/api/authApi.ts), saves the
   token, shows the result with toast, and goes to the redirect the backend
   sends for the person's role (or to the change-password page).
   ========================================================================== */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type LoginRole = "learner" | "staff";

export interface LoginRoleOption {
  key: LoginRole;
  /** Short label on the toggle button. */
  label: string;
  /** Label of the first field for this role, e.g. "Admission number". */
  idLabel: string;
  idPlaceholder: string;
  /** Small helper line shown under the toggle. */
  hint?: string;
}

export interface LoginCredentials {
  role: LoginRole;
  identifier: string;
  password: string;
  remember: boolean;
}

export interface LoginPageProps {
  schoolName?: string;
  /** Roles shown in the toggle. Pass a single role to hide the toggle. */
  roles?: LoginRoleOption[];
  initialRole?: LoginRole;
  /** Shown above the form, for example "Your session ended. Please sign in again." */
  notice?: string;
  helpText?: string;
  onForgotPassword?: () => void;
}

const DEFAULT_ROLES: LoginRoleOption[] = [
  {
    key: "learner",
    label: "Learner",
    idLabel: "Admission number",
    idPlaceholder: "For example 1021",
    hint: "Use the admission number on your school ID.",
  },
  {
    key: "staff",
    label: "Staff",
    idLabel: "Staff number or email",
    idPlaceholder: "Staff number or school email",
    hint: "For teachers, office and management staff.",
  },
];

function initialsOf(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "SP";
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName = "eye" | "eyeOff" | "results" | "fees" | "tutor" | "user" | "lock" | "shield";

const ICON_PATHS: Record<IconName, ReactNode> = {
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  results: <path d="M5 20V11M12 20V4M19 20v-6" />,
  fees: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  tutor: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "results", title: "Results and report cards", text: "See every exam, your position and how you are progressing." },
  { icon: "fees", title: "Fees and receipts", text: "Check balances and payment records, and download receipts." },
  { icon: "tutor", title: "Learning materials and AI Tutor", text: "Notes, past papers and a tutor that teaches step by step." },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function LoginPage({
  schoolName = "Senior School",
  roles = DEFAULT_ROLES,
  initialRole,
  notice,
  helpText = "Need help signing in? Contact the school office.",
  onForgotPassword,
}: LoginPageProps) {
  const navigate = useNavigate();
  const uid = useId();
  const ids = {
    identifier: `${uid}-identifier`,
    identifierErr: `${uid}-identifier-err`,
    password: `${uid}-password`,
    passwordErr: `${uid}-password-err`,
    caps: `${uid}-caps`,
  };

  const [role, setRole] = useState<LoginRole>(initialRole ?? roles[0]?.key ?? "learner");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const option = roles.find((r) => r.key === role) ?? roles[0] ?? DEFAULT_ROLES[0];

  const chooseRole = (key: LoginRole) => {
    setRole(key);
    setErrors({});
  };

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState?.("CapsLock") ?? false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Quick checks in the browser first, shown under the fields.
    const next: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) next.identifier = `Enter your ${option.idLabel.toLowerCase()}.`;
    if (!password) next.password = "Enter your password.";
    setErrors(next);

    if (next.identifier) {
      identifierRef.current?.focus();
      return;
    }
    if (next.password) {
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const credentials: LoginCredentials = { role, identifier: identifier.trim(), password, remember };
      const result = await login(credentials);
      saveSession(result, remember);

      const firstName = result.user.name.split(" ")[0];
      toast.success(
        "Signed in",
        result.user.must_change_password
          ? "Please set a new password to continue."
          : `Welcome back, ${firstName}.`,
      );
      navigate(result.redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error("Too many attempts", err.message);
      } else if (err instanceof ApiError && err.status >= 500) {
        toast.error("Something went wrong", "The server could not sign you in. Try again, and tell the school office if it keeps happening.");
      } else if (err instanceof ApiError) {
        toast.error("Could not sign you in", err.message);
      } else {
        toast.error("Cannot reach the server", "Check your connection and that the backend is running, then try again.");
      }
      setPassword("");
      requestAnimationFrame(() => passwordRef.current?.focus());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <aside className="lg-aside" aria-label={`About the ${schoolName} portal`}>
        <div className="lg-brand">
          <span className="lg-logo" aria-hidden="true">
            <strong>{initialsOf(schoolName)}</strong>
          </span>
          <div>
            <strong>{schoolName}</strong>
            <small>STUDENT &amp; STAFF PORTAL</small>
          </div>
        </div>

        <div className="lg-hero">
          <h1>One place for school life</h1>
          <p>Results, fees, learning materials and the AI Tutor, for learners and staff.</p>
          <ul className="lg-points">
            {POINTS.map((p) => (
              <li key={p.title}>
                <i>
                  <Icon name={p.icon} />
                </i>
                <div>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="lg-copy">© {new Date().getFullYear()} {schoolName}. All rights reserved.</p>
      </aside>

      <main className="lg-main">
        <div className="lg-card">
          <div className="lg-head">
            <h2>Welcome back</h2>
            <p className="lg-sub">
              {roles.length > 1 ? "Select your account type, then sign in to continue." : "Enter your details to continue."}
            </p>
          </div>

          {notice ? (
            <p className="lg-notice" role="status">
              {notice}
            </p>
          ) : null}

          <form noValidate onSubmit={submit}>
            {roles.length > 1 ? (
              <fieldset className="lg-roles">
                <legend>I am signing in as</legend>
                <div className="lg-seg">
                  {roles.map((r) => (
                    <label className="lg-role" key={r.key}>
                      <input
                        type="radio"
                        name={`${uid}-role`}
                        className="lg-sr"
                        value={r.key}
                        checked={role === r.key}
                        onChange={() => chooseRole(r.key)}
                        disabled={loading}
                      />
                      <span>
                        <Icon name={r.key === "learner" ? "tutor" : "user"} size={16} />
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
                {option.hint ? <p className="lg-hint">{option.hint}</p> : null}
              </fieldset>
            ) : null}

            <div className="lg-field">
              <label htmlFor={ids.identifier}>{option.idLabel}</label>
              <div className="lg-ctl">
                <span className="lg-ico">
                  <Icon name="user" />
                </span>
                <input
                  ref={identifierRef}
                  id={ids.identifier}
                  className="lg-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={option.idPlaceholder}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-invalid={errors.identifier ? true : undefined}
                  aria-describedby={errors.identifier ? ids.identifierErr : undefined}
                  disabled={loading}
                />
              </div>
              {errors.identifier ? (
                <span id={ids.identifierErr} className="lg-err">
                  {errors.identifier}
                </span>
              ) : null}
            </div>

            <div className="lg-field">
              <label htmlFor={ids.password}>Password</label>
              <div className="lg-ctl lg-pw">
                <span className="lg-ico">
                  <Icon name="lock" />
                </span>
                <input
                  ref={passwordRef}
                  id={ids.password}
                  className="lg-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={trackCaps}
                  onKeyUp={trackCaps}
                  onBlur={() => setCapsOn(false)}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={[errors.password ? ids.passwordErr : "", capsOn ? ids.caps : ""].filter(Boolean).join(" ") || undefined}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="lg-eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </div>
              {errors.password ? (
                <span id={ids.passwordErr} className="lg-err">
                  {errors.password}
                </span>
              ) : null}
              {capsOn ? (
                <span id={ids.caps} className="lg-caps">
                  Caps Lock is on.
                </span>
              ) : null}
            </div>

            <div className="lg-row">
              <label className="lg-check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={loading} />
                Keep me signed in on this device
              </label>
              <button type="button" className="lg-link" onClick={() => onForgotPassword?.()}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="lg-submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <>
                  <span className="lg-spin" aria-hidden="true" />
                  Signing in
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="lg-help">
            <p>{helpText}</p>
            <p className="lg-secure">
              <Icon name="shield" size={16} />
              Never share your password. The school will not ask for it by phone or message.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}