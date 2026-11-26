import { ApiError, apiUrl, authHeaders, clearSession, getToken } from "./authApi";
import type { LearnerDashboardData } from "../Student/LearnerDashboard";

/** What GET /api/learner/dashboard sends back. */
interface Payload {
  learner: LearnerDashboardData["learner"];
  profile: NonNullable<LearnerDashboardData["profile"]>;
  termLabel: string;
  ai: { consentOnRecord: boolean };
}

/** Sections with no backend yet. They show their "nothing here yet" messages. */
const EMPTY: LearnerDashboardData = {
  learner: { firstName: "", fullName: "", classLabel: "" },
  termLabel: "",
  dateLabel: "",
  attendance: { percent: 0, present: 0, total: 0 },
  exams: [],
  materials: [],
  timetable: [],
  fees: { currency: "KES", currentTerm: "", structure: [], payments: [] },
  ai: {
    consentOnRecord: false,
    chat: { recent: [], suggestions: [] },
    tutor: { resumeTopic: "", resumeWhen: "", savedCount: 0, path: [] },
  },
  career: { profilePercent: 0, pathways: [] },
  topics: [],
  tasks: [],
  notices: [],
};

const today = () =>
  new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Remembered for a minute so moving between pages does not refetch every time.
// Keyed by token, so a new sign-in or a password change starts fresh.
let cache: { token: string; at: number; data: LearnerDashboardData } | null = null;

export async function fetchLearnerDashboard(force = false): Promise<LearnerDashboardData> {
  const token = getToken();
  if (!token) throw new ApiError("Please sign in.", 401);
  if (!force && cache && cache.token === token && Date.now() - cache.at < 60_000) return cache.data;

  const res = await fetch(apiUrl("/learner/dashboard"), { headers: authHeaders() });
  const body = (await res.json().catch(() => null)) as (Partial<Payload> & { message?: string }) | null;

  if (res.status === 401) {
    clearSession();
    cache = null;
    throw new ApiError("Your session has ended. Please sign in again.", 401);
  }
  if (!res.ok || !body?.learner) {
    throw new ApiError(body?.message ?? "Could not load your dashboard.", res.status);
  }

  const data: LearnerDashboardData = {
    ...EMPTY,
    learner: { ...body.learner, admissionNo: body.learner.admissionNo ?? body.profile?.admissionNo },
    profile: body.profile,
    termLabel: body.termLabel ?? "",
    dateLabel: today(),
    ai: { ...EMPTY.ai, consentOnRecord: body.ai?.consentOnRecord ?? false },
  };
  cache = { token, at: Date.now(), data };
  return data;
}

/** Ends the session on the server and in this browser. */
export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("/logout"), {
      method: "POST",
      headers: { Accept: "application/json", ...authHeaders() },
    });
  } catch {
    // Server unreachable: still sign out on this device.
  } finally {
    clearSession();
    cache = null;
    window.location.replace("/login"); // change if your login route is different
  }
}