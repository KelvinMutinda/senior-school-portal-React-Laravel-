import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../AcademicOverview";      /* sidebar + header. Adjust the path if you move this file. */

/* Styles live in ai.css. Paste that file's contents into App.css. */

/* ================================================================== */
/* Types: the shape your API should return                             */
/* ================================================================== */

type Category = "academic" | "attendance" | "finance" | "wellbeing";
type Severity = "high" | "medium" | "low" | "positive";
type Status = "new" | "done" | "dismissed";

export interface Insight {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  summary: string;
  evidence: { label: string; value: string }[];
  action: { label: string; to: string };           // where the button takes the Head of Institution
  status: Status;
}
export interface AtRisk { id: string; name: string; className: string; score: number; reasons: string[] }
export interface Forecast { label: string; now: number; later: number; unit: "%"; target?: number }
export interface InsightsData {
  generatedAt: string;                              // ISO date
  summary: string[];                                // 2 to 4 plain sentences
  forecasts: Forecast[];
  insights: Insight[];
  atRisk: AtRisk[];
}

/* ================================================================== */
/* Data layer: change only this section to match your backend          */
/* ================================================================== */

/** Set VITE_API_URL in .env. Without it the page shows sample data. */
const API_URL = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const INSIGHTS_PATH = "/ai/insights";                 // GET returns InsightsData
const REGENERATE_PATH = "/ai/insights/regenerate";    // POST asks the AI to look at the latest data again
const UPDATE_PATH = "/ai/insights";                   // PATCH {API_URL}/ai/insights/{id} with { status }

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");         /* rename if your login stores it differently */
  return { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const fail = (status: number) => new Error(status === 401 ? "Your session has expired. Please sign in again." : `The server responded with ${status}.`);

async function fetchInsights(signal: AbortSignal): Promise<{ data: InsightsData; sample: boolean }> {
  if (!API_URL) { await new Promise((r) => setTimeout(r, 500)); return { data: sampleData(), sample: true }; }
  const res = await fetch(`${API_URL}${INSIGHTS_PATH}`, { signal, headers: authHeaders() });
  if (!res.ok) throw fail(res.status);
  const json = await res.json();
  return { data: (json.data ?? json) as InsightsData, sample: false };
}
async function regenerate(): Promise<void> {
  if (!API_URL) { await new Promise((r) => setTimeout(r, 900)); return; }
  const res = await fetch(`${API_URL}${REGENERATE_PATH}`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw fail(res.status);
}
async function updateStatus(id: string, status: Status): Promise<void> {
  if (!API_URL) return;
  const res = await fetch(`${API_URL}${UPDATE_PATH}/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
  if (!res.ok) throw fail(res.status);
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "academic", label: "Academic" }, { key: "attendance", label: "Attendance" }, { key: "finance", label: "Fees" }, { key: "wellbeing", label: "Learner support" },
];
const SEV_LABEL: Record<Severity, string> = { high: "Act now", medium: "Keep an eye on", low: "For information", positive: "Good news" };
const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, positive: 3 };

const ICONS: Record<string, string> = {
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  up: "M7 17L17 7M9 7h8v8",
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const riskTone = (s: number) => (s >= 70 ? "lo" : s >= 50 ? "mid" : "ok");

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

function AiInsights() {
  const navigate = useNavigate();
  const [data, setData] = useState<InsightsData | null>(null);
  const [sample, setSample] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<"all" | Category>("all");
  const [showDone, setShowDone] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback((signal: AbortSignal) => {
    setState("loading");
    fetchInsights(signal)
      .then(({ data, sample }) => { setData(data); setSample(sample); setState("ready"); })
      .catch((e: Error) => { if (e.name === "AbortError") return; setError(e.message || "Something went wrong while loading insights."); setState("error"); });
  }, []);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load, reload]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 4000); return () => clearTimeout(t); }, [msg]);

  const setStatus = async (id: string, status: Status) => {
    if (!data) return;
    const before = data;
    setData({ ...data, insights: data.insights.map((i) => (i.id === id ? { ...i, status } : i)) });
    try { await updateStatus(id, status); }
    catch (e) { setData(before); setMsg((e as Error).message || "Could not update that insight."); }
  };

  const onRegenerate = async () => {
    setBusy(true);
    try { await regenerate(); setReload((n) => n + 1); }
    catch (e) { setMsg((e as Error).message || "Could not refresh the insights."); }
    finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const open = (data?.insights ?? []).filter((i) => i.status === "new");
    return { open: open.length, urgent: open.filter((i) => i.severity === "high").length };
  }, [data]);

  const visible = useMemo(() => (data?.insights ?? [])
    .filter((i) => (cat === "all" || i.category === cat) && (showDone || i.status === "new"))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]), [data, cat, showDone]);

  return (
    <Shell title="AI Insights">
      <div className="ai-page">
        <div className="ai-head">
          <div>
            <h2>AI insights</h2>
            <p>What the AI has noticed in your school's marks, attendance and fees, and what to do about it.</p>
          </div>
          <div className="ai-head-r">
            {data && <span className="ai-stamp">Updated {when(data.generatedAt)}</span>}
            <button type="button" className="ai-btn" onClick={onRegenerate} disabled={busy || state === "loading"}><Icon name="refresh" /> {busy ? "Refreshing..." : "Refresh insights"}</button>
          </div>
        </div>

        {sample && state === "ready" && (
          <div className="ai-note" role="status">
            <Icon name="alert" />
            <span>Showing sample insights. Set <code>VITE_API_URL</code> in your <code>.env</code> file and check <code>INSIGHTS_PATH</code> in this file to use real data.</span>
          </div>
        )}

        {state === "loading" && (<><div className="ai-card ai-skel-block short" /><div className="ai-card ai-skel-block" aria-label="Loading insights" /></>)}

        {state === "error" && (
          <div className="ai-card ai-empty">
            <h4>Insights could not be loaded</h4><p>{error}</p>
            <button type="button" className="ai-btn ai-btn-primary" onClick={() => setReload((n) => n + 1)}><Icon name="refresh" /> Try again</button>
          </div>
        )}

        {state === "ready" && data && (
          <>
            {/* summary */}
            <section className="ai-card ai-summary">
              <div className="ai-summary-i"><Icon name="spark" size={20} /></div>
              <div>
                <h3>This week at a glance</h3>
                {data.summary.map((p, i) => <p key={i}>{p}</p>)}
                <small>Written by AI from your school's records. Check the figures before you act on them.</small>
              </div>
            </section>

            {/* forecasts */}
            <div className="ai-kpis ai-kpis-3">
              {data.forecasts.map((f) => {
                const delta = f.later - f.now;
                const short = f.target !== undefined && f.later < f.target;
                return (
                  <div key={f.label} className="ai-card ai-kpi">
                    <span>{f.label}</span>
                    <div className="ai-fc"><em>{f.now.toFixed(1)}{f.unit}</em><Icon name="arrow" size={14} /><b>{f.later.toFixed(1)}{f.unit}</b></div>
                    <small className={delta >= 0 ? "ai-good" : "ai-bad"}>{delta >= 0 ? "Expected to rise" : "Expected to fall"} by {Math.abs(delta).toFixed(1)} points by the end of term</small>
                    {f.target !== undefined && <small className={short ? "ai-bad" : "ai-good"}>{short ? `Still ${(f.target - f.later).toFixed(1)} points under` : "Meets"} the {f.target}% target</small>}
                  </div>
                );
              })}
            </div>

            {/* insight list */}
            <section className="ai-card ai-panel">
              <header>
                <h3>What needs your attention <span className="ai-count">{counts.open} open{counts.urgent ? `, ${counts.urgent} urgent` : ""}</span></h3>
                <label className="ai-check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done and dismissed</label>
              </header>
              <div className="ai-filterbar" role="group" aria-label="Filter insights by topic">
                {([{ key: "all", label: "All" }, ...CATEGORIES] as { key: "all" | Category; label: string }[]).map((c) => (
                  <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</button>
                ))}
              </div>

              {visible.length === 0 ? (
                <div className="ai-empty slim"><h4>Nothing to act on here</h4><p>{cat === "all" ? "You have dealt with every insight. Refresh to look at the latest data." : "No open insights in this topic."}</p></div>
              ) : (
                <ul className="ai-insights">
                  {visible.map((i) => (
                    <li key={i.id} className={`sev-${i.severity}${i.status !== "new" ? " is-closed" : ""}`}>
                      <div className="ai-ins-top">
                        <span className={`ai-sev ${i.severity}`}>{SEV_LABEL[i.severity]}</span>
                        <span className="ai-cat">{CATEGORIES.find((c) => c.key === i.category)?.label}</span>
                        {i.status !== "new" && <span className="ai-tag ok">{i.status === "done" ? "Done" : "Dismissed"}</span>}
                      </div>
                      <h4>{i.title}</h4>
                      <p>{i.summary}</p>
                      <dl className="ai-evid">
                        {i.evidence.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}
                      </dl>
                      <div className="ai-ins-actions">
                        <button type="button" className="ai-btn ai-btn-primary ai-btn-sm" onClick={() => navigate(i.action.to)}>{i.action.label} <Icon name="arrow" size={14} /></button>
                        {i.status === "new" ? (
                          <>
                            <button type="button" className="ai-btn ai-btn-sm" onClick={() => setStatus(i.id, "done")}><Icon name="check" size={14} /> Mark done</button>
                            <button type="button" className="ai-link" onClick={() => setStatus(i.id, "dismissed")}>Dismiss</button>
                          </>
                        ) : (
                          <button type="button" className="ai-link" onClick={() => setStatus(i.id, "new")}>Reopen</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* learners at risk */}
            <section className="ai-card ai-panel">
              <header><h3>Learners who may need support</h3><span>Ranked by how many warning signs they show</span></header>
              {data.atRisk.length === 0 ? (
                <p className="ai-muted ai-pad">No learners are showing several warning signs at once.</p>
              ) : (
                <div className="ai-scroll">
                  <table className="ai-table">
                    <caption className="ai-sr">Learners who may need support</caption>
                    <thead><tr><th scope="col">Learner</th><th scope="col">Class</th><th scope="col">Risk</th><th scope="col">Why</th><th scope="col"><span className="ai-sr">Open</span></th></tr></thead>
                    <tbody>
                      {data.atRisk.map((l) => (
                        <tr key={l.id}>
                          <td data-label="Learner"><strong>{l.name}</strong></td>
                          <td data-label="Class">{l.className}</td>
                          <td data-label="Risk">
                            <div className="ai-risk"><div className="ai-bar" aria-hidden="true"><i className={`r-${riskTone(l.score)}`} style={{ width: `${l.score}%` }} /></div><b>{l.score}</b></div>
                          </td>
                          <td data-label="Why"><div className="ai-reasons">{l.reasons.map((r) => <span key={r} className="ai-tag muted">{r}</span>)}</div></td>
                          <td><button type="button" className="ai-btn ai-btn-sm" onClick={() => navigate(`/Students?q=${encodeURIComponent(l.name)}`)}>Open record</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <div className="ai-toast-wrap" aria-live="polite">{msg && <div className="ai-toast err">{msg}</div>}</div>
    </Shell>
  );
}

export default AiInsights;

/* ================================================================== */
/* Sample data (used only while VITE_API_URL is not set)               */
/* ================================================================== */

function sampleData(): InsightsData {
  const d = new Date(); d.setHours(6, 30, 0, 0);
  return {
    generatedAt: d.toISOString(),
    summary: [
      "The school mean is 64.2%, which is 1.2 points higher than last term and just under the 65% target. Pass rate has risen to 84%.",
      "Two things stand out: Chemistry in 11B has dropped sharply, and attendance in 12B has fallen below 85% this week.",
      "Fee collection is at 78% against an 85% target. At the current pace it should reach about 84% by the end of term.",
    ],
    forecasts: [
      { label: "School mean score", now: 64.2, later: 65.4, unit: "%", target: 65 },
      { label: "Pass rate", now: 84.0, later: 86.1, unit: "%" },
      { label: "Fees collected", now: 78.2, later: 84.5, unit: "%", target: 85 },
    ],
    insights: [
      { id: "i1", category: "academic", severity: "high", title: "Chemistry in 11B fell 9.0 points", summary: "The class average dropped from 58.4% to 49.4% since last term, and 9 learners are now below 40%. Other 11B subjects are steady, so this looks specific to Chemistry.",
        evidence: [{ label: "Last term", value: "58.4%" }, { label: "This term", value: "49.4%" }, { label: "Below 40%", value: "9 learners" }], action: { label: "See class results", to: "/Academic/Overview" }, status: "new" },
      { id: "i2", category: "attendance", severity: "high", title: "Grade 12B attendance dropped below 85%", summary: "Attendance fell from 90.2% last week to 83.9% this week. Six learners have missed three or more days.",
        evidence: [{ label: "This week", value: "83.9%" }, { label: "Last week", value: "90.2%" }, { label: "Absent 3+ days", value: "6 learners" }], action: { label: "Review attendance", to: "/Hoi/Attendance" }, status: "new" },
      { id: "i3", category: "finance", severity: "medium", title: "Fee collection is 6.8 points under target", summary: "KES 6.1M of KES 7.8M has been collected. Fourteen learners have owed fees for more than 90 days, which is KES 210,000.",
        evidence: [{ label: "Collected", value: "78.2%" }, { label: "Target", value: "85%" }, { label: "Over 90 days", value: "14 learners" }], action: { label: "Open financial reports", to: "/Hoi/Finance/Reports" }, status: "new" },
      { id: "i4", category: "academic", severity: "medium", title: "10 mark sets are still outstanding", summary: "Results cannot be finalised until every class has its marks in. Most of the missing sets are in Mathematics and Sciences.",
        evidence: [{ label: "Submitted", value: "50 of 60 sets" }, { label: "Mathematics and Sciences", value: "7 missing" }], action: { label: "Open results", to: "/Results/View/Results" }, status: "new" },
      { id: "i5", category: "wellbeing", severity: "medium", title: "7 learners show several warning signs at once", summary: "These learners have low attendance, falling marks and unpaid fees at the same time. Learners with this mix are more likely to drop out of a term.",
        evidence: [{ label: "Learners", value: "7" }, { label: "Most in", value: "Grade 11" }], action: { label: "See the learners", to: "/Students" }, status: "new" },
      { id: "i6", category: "academic", severity: "low", title: "English in 10B fell 6.0 points", summary: "The drop is smaller than Chemistry in 11B but it is the second largest this term.",
        evidence: [{ label: "Last term", value: "67.8%" }, { label: "This term", value: "61.8%" }], action: { label: "See class results", to: "/Academic/Overview" }, status: "new" },
      { id: "i7", category: "academic", severity: "positive", title: "Mathematics in 12A is up 5.0 points", summary: "This is the biggest improvement in the school this term. It may be worth asking the teacher what changed.",
        evidence: [{ label: "Last term", value: "58.0%" }, { label: "This term", value: "63.0%" }], action: { label: "See class results", to: "/Academic/Overview" }, status: "new" },
      { id: "i8", category: "attendance", severity: "positive", title: "School attendance is steady at 94%", summary: "Apart from 12B, every class is above the 90% expectation.",
        evidence: [{ label: "School-wide", value: "94%" }, { label: "Classes under 90%", value: "1 of 6" }], action: { label: "Review attendance", to: "/Hoi/Attendance" }, status: "done" },
    ],
    atRisk: [
      { id: "r1", name: "Brian Njeru", className: "11B", score: 86, reasons: ["Attendance 71%", "Chemistry down 14 pts", "KES 48,000 owed"] },
      { id: "r2", name: "Faith Mwangi", className: "12B", score: 79, reasons: ["Attendance 74%", "Mean under 40%"] },
      { id: "r3", name: "Kevin Muriithi", className: "11B", score: 72, reasons: ["Chemistry down 11 pts", "KES 36,500 owed"] },
      { id: "r4", name: "Mercy Kamau", className: "10B", score: 66, reasons: ["English down 9 pts", "Attendance 82%"] },
      { id: "r5", name: "Dennis Mugambi", className: "12A", score: 58, reasons: ["Attendance 80%", "KES 29,000 owed"] },
      { id: "r6", name: "Grace Kinyua", className: "12B", score: 52, reasons: ["Attendance 79%"] },
    ],
  };
}