import type { LoginCredentials } from "../auth/Login";

/* ==========================================================================
   authApi
   Talks to the Laravel backend (POST /api/login, POST /api/logout) and keeps
   the sign-in token.

   "Keep me signed in" ticked  -> token kept in localStorage (survives closing the browser)
   "Keep me signed in" empty   -> token kept in sessionStorage (gone when the tab closes)

   Set the backend address in .env (next to package.json):
     VITE_API_URL=http://127.0.0.1:8000/api
   ========================================================================== */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000/api";

export type PortalRole = "HOI" | "DEPUTY" | "TEACHER" | "FINANCE" | "LEARNER" | "PARENT";

export interface AuthUser {
  id: number;
  name: string;
  role: PortalRole;
  identifier: string | null;
  email: string | null;
  must_change_password: boolean;
}

export interface LoginResult {
  message: string;
  token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
  /** Where to go next, decided by the backend from the account's role. */
  redirect: string;
}

/** Thrown when the server answers with an error (wrong details, too many attempts, 500...). */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

const TOKEN_KEY = "portal.token";
const USER_KEY = "portal.user";
const EXPIRES_KEY = "portal.expires_at";

const GENERIC_ERROR = "We could not sign you in. Check your details and try again.";

type ErrorBody = { message?: string; errors?: Record<string, string[]> } | null;

/** The first validation message if there is one, otherwise the plain message. */
function firstMessage(body: ErrorBody): string | null {
  if (body?.errors) {
    const first = Object.values(body.errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  return body?.message ? body.message : null;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ------------------------------------------------------------------ */
/* Login / logout                                                      */
/* ------------------------------------------------------------------ */

/**
 * Throws ApiError when the server answers with an error.
 * If the server cannot be reached at all, fetch's own error (a TypeError)
 * passes through, so callers can tell the two cases apart.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const res = await fetch(apiUrl("/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(credentials),
  });

  const body = (await res.json().catch(() => null)) as (ErrorBody & Partial<LoginResult>) | null;

  if (!res.ok) throw new ApiError(firstMessage(body) ?? GENERIC_ERROR, res.status, body?.errors ?? {});
  if (!body?.token || !body.user || !body.redirect) throw new ApiError(GENERIC_ERROR, 500);

  return body as LoginResult;
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearSession(); // signed out on this device even if the request below fails
  if (!token) return;

  try {
    await fetch(apiUrl("/logout"), {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    /* the token will simply expire on the server */
  }
}

/* ------------------------------------------------------------------ */
/* Stored session                                                      */
/* ------------------------------------------------------------------ */

export function saveSession(result: LoginResult, remember: boolean): void {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  try {
    store.setItem(TOKEN_KEY, result.token);
    store.setItem(USER_KEY, JSON.stringify(result.user));
    store.setItem(EXPIRES_KEY, result.expires_at);
  } catch {
    /* storage blocked: the person will need to sign in again after a reload */
  }
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
      store.removeItem(EXPIRES_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** The token, or null if nobody is signed in or it has expired. */
export function getToken(): string | null {
  const token = read(TOKEN_KEY);
  if (!token) return null;

  const expires = read(EXPIRES_KEY);
  if (expires && new Date(expires).getTime() <= Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

export function getUser(): AuthUser | null {
  if (!getToken()) return null;
  try {
    const raw = read(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Headers for calls to the rest of the API. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Accept: "application/json", Authorization: `Bearer ${token}` }
    : { Accept: "application/json" };
}