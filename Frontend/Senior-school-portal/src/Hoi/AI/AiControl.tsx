import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Shell } from "../AcademicOverview";      /* sidebar + header. Adjust the path if you move this file. */

/* Styles live in ai.css. Paste that file's contents into App.css. */

/* ================================================================== */
/* Types: the shape your API should return and accept                  */
/* ================================================================== */

type Role = "Learner" | "Teacher" | "Finance" | "HOI";
const ROLES: Role[] = ["Learner", "Teacher", "Finance", "HOI"];

export interface AiTool { id: string; name: string; description: string; enabled: boolean; roles: Role[] }

export interface AiSettings {
  enabled: boolean;                          // master switch for the whole school
  tools: AiTool[];
  tutorMode: "hints" | "explain" | "full";   // how much the AI tutor gives away
  filterLevel: "standard" | "strict";
  dailyLimit: number;                        // messages per learner per day
  quietFrom: string;                         // "21:00"
  quietTo: string;                           // "06:00"
  blockDuringExams: boolean;
  teacherReview: boolean;                    // AI comments need a teacher's approval before release
  anonymise: boolean;                        // remove learner names before text goes to the AI
  retentionDays: number;
}

export interface Flag { id: string; learner: string; className: string; tool: string; reason: string; when: string; reviewed: boolean }
export interface Usage { adoption: number; messagesThisWeek: number; activeUsers: number; totalUsers: number }
interface Payload { settings: AiSettings; flags: Flag[]; usage: Usage }

/* ================================================================== */
/* Data layer: change only this section to match your backend          */
/* ================================================================== */

/** Set VITE_API_URL in .env. Without it the page shows sample data and saves only in memory. */
const API_URL = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const SETTINGS_PATH = "/ai/settings";          // GET returns { settings, flags, usage }; PUT saves { ...settings }
const FLAGS_PATH = "/ai/flags";                // PATCH {API_URL}/ai/flags/{id} with { reviewed: true }

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");  /* rename if your login stores it differently */
  return { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const fail = (status: number) => new Error(status === 401 ? "Your session has expired. Please sign in again." : `The server responded with ${status}.`);

async function fetchAll(signal: AbortSignal): Promise<{ data: Payload; sample: boolean }> {
  if (!API_URL) { await new Promise((r) => setTimeout(r, 450)); return { data: samplePayload(), sample: true }; }
  const res = await fetch(`${API_URL}${SETTINGS_PATH}`, { signal, headers: authHeaders() });
  if (!res.ok) throw fail(res.status);
  const json = await res.json();
  return { data: (json.data ?? json) as Payload, sample: false };
}
async function saveSettings(s: AiSettings): Promise<void> {
  if (!API_URL) { await new Promise((r) => setTimeout(r, 400)); return; }
  const res = await fetch(`${API_URL}${SETTINGS_PATH}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(s) });
  if (!res.ok) throw fail(res.status);
}
async function markReviewed(id: string): Promise<void> {
  if (!API_URL) return;
  const res = await fetch(`${API_URL}${FLAGS_PATH}/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ reviewed: true }) });
  if (!res.ok) throw fail(res.status);
}

/* ================================================================== */
/* Small pieces                                                        */
/* ================================================================== */

const ICONS: Record<string, string> = {
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 20c.7-3.5 3.4-5.5 7-5.5s6.3 2 7 5.5M17 4a4 4 0 010 7M22 20c-.4-2.4-1.8-4-4-5",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`ai-sw${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}><i /></button>
  );
}

/** A labelled row: text on the left, control on the right. */
function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="ai-row">
      <div><strong>{title}</strong><small>{hint}</small></div>
      <div className="ai-row-c">{children}</div>
    </div>
  );
}

const sinceLabel = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

function AiControl() {
  const [saved, setSaved] = useState<AiSettings | null>(null);     // what the server has
  const [draft, setDraft] = useState<AiSettings | null>(null);     // what the form shows
  const [flags, setFlags] = useState<Flag[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [sample, setSample] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback((signal: AbortSignal) => {
    setState("loading");
    fetchAll(signal)
      .then(({ data, sample }) => { setSaved(data.settings); setDraft(data.settings); setFlags(data.flags); setUsage(data.usage); setSample(sample); setState("ready"); })
      .catch((e: Error) => { if (e.name === "AbortError") return; setError(e.message || "Something went wrong while loading AI settings."); setState("error"); });
  }, []);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load, reload]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const setTool = (id: string, patch: Partial<AiTool>) => setDraft((d) => (d ? { ...d, tools: d.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : d));
  const toggleRole = (t: AiTool, r: Role) => setTool(t.id, { roles: t.roles.includes(r) ? t.roles.filter((x) => x !== r) : [...t.roles, r] });

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try { await saveSettings(draft); setSaved(draft); setToast({ kind: "ok", text: "AI settings saved. The change is recorded in the audit log." }); }
    catch (e) { setToast({ kind: "err", text: (e as Error).message || "The settings could not be saved. Try again." }); }
    finally { setSaving(false); }
  };

  const review = async (id: string) => {
    const before = flags;
    setFlags((f) => f.map((x) => (x.id === id ? { ...x, reviewed: true } : x)));
    try { await markReviewed(id); }
    catch (e) { setFlags(before); setToast({ kind: "err", text: (e as Error).message || "Could not update that item." }); }
  };

  const on = !!draft?.enabled;
  const toolsOn = draft ? draft.tools.filter((t) => t.enabled).length : 0;
  const pending = flags.filter((f) => !f.reviewed);

  return (
    <Shell title="AI Controls">
      <div className="ai-page">
        <div className="ai-head">
          <div>
            <h2>AI controls</h2>
            <p>Decide which AI tools the school uses, who can use them, and the safety rules around them.</p>
          </div>
        </div>

        {sample && state === "ready" && (
          <div className="ai-note" role="status">
            <Icon name="alert" />
            <span>Showing sample settings. Changes are kept only until you leave this page. Set <code>VITE_API_URL</code> in your <code>.env</code> file and check <code>SETTINGS_PATH</code> in this file to use real data.</span>
          </div>
        )}

        {state === "loading" && <div className="ai-card ai-skel-block" aria-label="Loading AI settings" />}

        {state === "error" && (
          <div className="ai-card ai-empty">
            <h4>AI settings could not be loaded</h4><p>{error}</p>
            <button type="button" className="ai-btn ai-btn-primary" onClick={() => setReload((n) => n + 1)}><Icon name="refresh" /> Try again</button>
          </div>
        )}

        {state === "ready" && draft && usage && (
          <>
            {/* usage */}
            <div className="ai-kpis">
              <div className="ai-card ai-kpi"><span><Icon name="users" /> AI adoption</span><b>{usage.adoption}%</b>
                <div className="ai-bar" aria-hidden="true"><i style={{ width: `${usage.adoption}%` }} /></div><small>{usage.activeUsers} of {usage.totalUsers} learners and teachers</small></div>
              <div className="ai-card ai-kpi"><span><Icon name="chat" /> Messages this week</span><b>{usage.messagesThisWeek.toLocaleString("en-KE")}</b><small>Across all AI tools</small></div>
              <div className="ai-card ai-kpi"><span><Icon name="bolt" /> Tools switched on</span><b>{on ? `${toolsOn} of ${draft.tools.length}` : "None"}</b><small>{on ? "Shown to the roles you choose below" : "AI is switched off for everyone"}</small></div>
              <div className="ai-card ai-kpi ai-kpi-red"><span><Icon name="flag" /> To review</span><b>{pending.length}</b><small>{pending.length ? "Flagged conversations" : "Nothing flagged"}</small></div>
            </div>

            {/* master switch */}
            <section className={`ai-card ai-master${on ? "" : " is-off"}`}>
              <div>
                <h3>AI tools for the school</h3>
                <p>{on ? "AI is on. Learners and staff can use the tools you have enabled below." : "AI is off. Nobody can open any AI tool until you switch it back on."}</p>
              </div>
              <Switch checked={on} onChange={(v) => set("enabled", v)} label="Turn AI tools on for the whole school" />
            </section>

            <fieldset className="ai-fieldset" disabled={!on}>
              {/* tools */}
              <section className="ai-card ai-panel">
                <header><h3>Tools and who can use them</h3><span>Switch a tool off to hide it from everyone</span></header>
                <ul className="ai-tools">
                  {draft.tools.map((t) => (
                    <li key={t.id} className={t.enabled ? "" : "is-off"}>
                      <div className="ai-tool-main">
                        <strong>{t.name}</strong>
                        <small>{t.description}</small>
                        <div className="ai-roles" role="group" aria-label={`Who can use ${t.name}`}>
                          {ROLES.map((r) => (
                            <button key={r} type="button" aria-pressed={t.roles.includes(r)} disabled={!t.enabled} onClick={() => toggleRole(t, r)}>{r}</button>
                          ))}
                        </div>
                      </div>
                      <Switch checked={t.enabled} onChange={(v) => setTool(t.id, { enabled: v })} label={`${t.name} on or off`} />
                    </li>
                  ))}
                </ul>
              </section>

              <div className="ai-two">
                {/* learner safety */}
                <section className="ai-card ai-panel">
                  <header><h3>Learner safety</h3><span>Applies to the AI tutor</span></header>
                  <div className="ai-rows">
                    <Row title="How the tutor helps" hint="Hints push learners to think. Full answers give the solution straight away.">
                      <div className="ai-seg" role="group" aria-label="Tutor style">
                        {([["hints", "Hints"], ["explain", "Explain"], ["full", "Full answers"]] as const).map(([v, l]) => (
                          <button key={v} type="button" aria-pressed={draft.tutorMode === v} onClick={() => set("tutorMode", v)}>{l}</button>
                        ))}
                      </div>
                    </Row>
                    <Row title="Content filter" hint="Strict blocks more topics and flags more conversations.">
                      <div className="ai-seg" role="group" aria-label="Content filter">
                        {([["standard", "Standard"], ["strict", "Strict"]] as const).map(([v, l]) => (
                          <button key={v} type="button" aria-pressed={draft.filterLevel === v} onClick={() => set("filterLevel", v)}>{l}</button>
                        ))}
                      </div>
                    </Row>
                    <Row title="Daily message limit" hint="Per learner, per day.">
                      <select value={draft.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value))} aria-label="Daily message limit">
                        {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n} messages</option>)}
                      </select>
                    </Row>
                    <Row title="Quiet hours" hint="The tutor is closed to learners between these times.">
                      <div className="ai-times">
                        <input type="time" value={draft.quietFrom} onChange={(e) => set("quietFrom", e.target.value)} aria-label="Quiet hours start" />
                        <span>to</span>
                        <input type="time" value={draft.quietTo} onChange={(e) => set("quietTo", e.target.value)} aria-label="Quiet hours end" />
                      </div>
                    </Row>
                    <Row title="Pause during exams" hint="Learners cannot use the tutor while an assessment is running.">
                      <Switch checked={draft.blockDuringExams} onChange={(v) => set("blockDuringExams", v)} label="Pause the tutor during exams" />
                    </Row>
                  </div>
                </section>

                {/* privacy */}
                <section className="ai-card ai-panel">
                  <header><h3>Privacy and records</h3><span>How learner data is handled</span></header>
                  <div className="ai-rows">
                    <Row title="Teacher approval for AI comments" hint="Report card comments written by AI are not released until a teacher approves them.">
                      <Switch checked={draft.teacherReview} onChange={(v) => set("teacherReview", v)} label="Require teacher approval for AI comments" />
                    </Row>
                    <Row title="Hide learner names from the AI" hint="Names are replaced with a code before any text is sent to the AI service.">
                      <Switch checked={draft.anonymise} onChange={(v) => set("anonymise", v)} label="Hide learner names from the AI" />
                    </Row>
                    <Row title="Keep conversation records" hint="Records are deleted automatically after this period.">
                      <select value={draft.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} aria-label="Keep conversation records for">
                        {[30, 90, 180, 365].map((n) => <option key={n} value={n}>{n} days</option>)}
                      </select>
                    </Row>
                    <div className="ai-lock"><Icon name="lock" /><span>Only the Head of Institution can change these settings. Every change is written to the audit log.</span></div>
                  </div>
                </section>
              </div>
            </fieldset>

            {/* flagged */}
            <section className="ai-card ai-panel">
              <header><h3>Flagged conversations</h3><span>{pending.length ? `${pending.length} to review` : "All reviewed"}</span></header>
              {flags.length === 0 ? (
                <p className="ai-muted ai-pad">Nothing has been flagged. Conversations are flagged when they touch blocked topics or show signs a learner may need help.</p>
              ) : (
                <ul className="ai-flags">
                  {flags.map((f) => (
                    <li key={f.id} className={f.reviewed ? "is-done" : ""}>
                      <span className="ai-flag-i"><Icon name="flag" /></span>
                      <div><strong>{f.reason}</strong><small>{f.learner} · {f.className} · {f.tool} · {sinceLabel(f.when)}</small></div>
                      {f.reviewed
                        ? <span className="ai-tag ok"><Icon name="check" size={13} /> Reviewed</span>
                        : <button type="button" className="ai-btn ai-btn-sm" onClick={() => review(f.id)}>Mark reviewed</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* save bar */}
      {state === "ready" && dirty && (
        <div className="ai-savebar" role="region" aria-label="Unsaved changes">
          <span>You have unsaved changes.</span>
          <div>
            <button type="button" className="ai-btn" onClick={() => setDraft(saved)} disabled={saving}>Discard</button>
            <button type="button" className="ai-btn ai-btn-primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </div>
      )}
      <div className="ai-toast-wrap" aria-live="polite">{toast && <div className={`ai-toast ${toast.kind}`}>{toast.text}</div>}</div>
    </Shell>
  );
}

export default AiControl;

/* ================================================================== */
/* Sample data (used only while VITE_API_URL is not set)               */
/* ================================================================== */

function samplePayload(): Payload {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return {
    settings: {
      enabled: true,
      tools: [
        { id: "tutor", name: "AI tutor", description: "Learners ask questions and get step-by-step help with their subjects.", enabled: true, roles: ["Learner"] },
        { id: "pathways", name: "Career pathway recommender", description: "Suggests Senior School pathways from a learner's results and interests.", enabled: true, roles: ["Learner", "Teacher"] },
        { id: "planner", name: "Lesson and question planner", description: "Helps teachers draft lesson plans, notes and practice questions.", enabled: true, roles: ["Teacher"] },
        { id: "comments", name: "Report card comments", description: "Drafts a comment for each learner from their marks. A teacher edits it before release.", enabled: true, roles: ["Teacher"] },
        { id: "insights", name: "School insights", description: "Reads school data and points out what needs the Head of Institution's attention.", enabled: true, roles: ["HOI"] },
        { id: "reminders", name: "Fee reminder drafts", description: "Writes polite fee reminder messages for the finance office to review and send.", enabled: false, roles: ["Finance"] },
      ],
      tutorMode: "hints", filterLevel: "standard", dailyLimit: 30, quietFrom: "21:00", quietTo: "06:00",
      blockDuringExams: true, teacherReview: true, anonymise: true, retentionDays: 90,
    },
    usage: { adoption: 61, messagesThisWeek: 1284, activeUsers: 267, totalUsers: 438 },
    flags: [
      { id: "f1", learner: "Learner 2418", className: "11B", tool: "AI tutor", reason: "Asked for exam answers", when: ago(3), reviewed: false },
      { id: "f2", learner: "Learner 2467", className: "10A", tool: "AI tutor", reason: "Message may show the learner is struggling", when: ago(20), reviewed: false },
      { id: "f3", learner: "Learner 2390", className: "12A", tool: "AI tutor", reason: "Off-topic content", when: ago(52), reviewed: false },
      { id: "f4", learner: "Learner 2433", className: "12B", tool: "AI tutor", reason: "Asked for exam answers", when: ago(96), reviewed: true },
    ],
  };
}