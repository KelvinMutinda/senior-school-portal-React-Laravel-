import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TeacherSidebar from "../Teachers/TeacherSidebar";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type Grade = 10 | 11 | 12;
type Status = "active" | "inactive" | "transferred";

export interface Learner {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "";
  grade: Grade | null;
  className: string;              // e.g. "10A"
  pathway: string;                // e.g. "STEM"
  guardianName: string;
  guardianPhone: string;
  status: Status;
  attendance: number | null;      // %
  mean: number | null;            // average score %
  feeBalance: number | null;      // KES owed
}

/* ================================================================== */
/* Data layer: change only this section to match your backend          */
/* ================================================================== */

/** Set VITE_API_URL in .env (e.g. VITE_API_URL=http://localhost:5000/api). Without it the page shows sample data. */
const API_URL = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const LEARNERS_PATH = "/learners";

type Raw = Record<string, unknown>;
const pick = (o: Raw, ...keys: string[]) => {
  for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== "") return v; }
  return undefined;
};
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: unknown): number | null => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : null; };

/** Turns whatever your API returns into a Learner. Add your own field names to the pick() calls if needed. */
function normalize(r: Raw, i: number): Learner {
  const full = str(pick(r, "name", "fullName", "full_name"));
  const [fn = "", ...rest] = full.split(/\s+/);
  const cls = str(pick(r, "className", "class_name", "class", "stream"));
  const gradeRaw = num(pick(r, "grade", "form", "level")) ?? num(cls.match(/\d+/)?.[0]);
  const g = str(pick(r, "gender", "sex")).toLowerCase();
  const st = str(pick(r, "status", "state")).toLowerCase();
  return {
    id: str(pick(r, "id", "_id", "learnerId", "learner_id")) || `row-${i}`,
    admissionNo: str(pick(r, "admissionNo", "admission_no", "admissionNumber", "admission_number", "adm", "upi")),
    firstName: str(pick(r, "firstName", "first_name", "firstname")) || fn,
    lastName: str(pick(r, "lastName", "last_name", "lastname", "surname")) || rest.join(" "),
    gender: g.startsWith("m") ? "Male" : g.startsWith("f") ? "Female" : "",
    grade: gradeRaw === 10 || gradeRaw === 11 || gradeRaw === 12 ? gradeRaw : null,
    className: cls || (gradeRaw ? String(gradeRaw) : ""),
    pathway: str(pick(r, "pathway", "track", "cluster")),
    guardianName: str(pick(r, "guardianName", "guardian_name", "parentName", "parent_name", "guardian")),
    guardianPhone: str(pick(r, "guardianPhone", "guardian_phone", "parentPhone", "parent_phone", "phone")),
    status: st.startsWith("trans") ? "transferred" : st.startsWith("in") || st === "left" ? "inactive" : "active",
    attendance: num(pick(r, "attendance", "attendanceRate", "attendance_rate")),
    mean: num(pick(r, "mean", "meanScore", "mean_score", "average", "avg")),
    feeBalance: num(pick(r, "feeBalance", "fee_balance", "balance")),
  };
}

async function fetchLearners(signal: AbortSignal): Promise<{ learners: Learner[]; sample: boolean }> {
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 500));
    return { learners: sampleLearners(), sample: true };
  }
  const token = localStorage.getItem("token");      /* remove or rename if your login stores it differently */
  const res = await fetch(`${API_URL}${LEARNERS_PATH}`, {
    signal,
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Your session has expired. Please sign in again." : `The server responded with ${res.status}.`);
  const json = await res.json();
  const list: Raw[] = Array.isArray(json) ? json : json.data ?? json.learners ?? json.students ?? json.results ?? [];
  return { learners: list.map(normalize), sample: false };
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

const PAGE_SIZE = 12;
type SortKey = "name" | "class" | "attendance" | "mean" | "status";
const fullName = (l: Learner) => `${l.firstName} ${l.lastName}`.trim() || "Unnamed learner";
const initials = (l: Learner) => ((l.firstName[0] ?? "") + (l.lastName[0] ?? "")).toUpperCase() || "?";
const pct = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)}%`);
const kes = (n: number | null) => (n === null ? "–" : n <= 0 ? "Cleared" : `KES ${Math.round(n).toLocaleString("en-KE")}`);

function toCsv(rows: Learner[]) {
  const head = ["Admission no", "First name", "Last name", "Gender", "Grade", "Class", "Pathway", "Guardian", "Guardian phone", "Status", "Attendance %", "Mean %", "Fee balance (KES)"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((l) => [l.admissionNo, l.firstName, l.lastName, l.gender, l.grade, l.className, l.pathway, l.guardianName, l.guardianPhone, l.status, l.attendance, l.mean, l.feeBalance].map(esc).join(","));
  return [head.map(esc).join(","), ...lines].join("\n");
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const ICONS: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  close: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM16 16l5 5",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

function Students() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [learners, setLearners] = useState<Learner[]>([]);
  const [sample, setSample] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState<"all" | Grade>("all");
  const [cls, setCls] = useState("all");
  const [status, setStatus] = useState<"all" | Status>("active");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Learner | null>(null);

  /* ---- fetch ---- */
  const load = useCallback((signal: AbortSignal) => {
    setState("loading");
    fetchLearners(signal)
      .then((r) => { setLearners(r.learners); setSample(r.sample); setState("ready"); })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "Something went wrong while loading learners.");
        setState("error");
      });
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    load(ctl.signal);
    return () => ctl.abort();
  }, [load, reload]);

  /* a link like /Students?q=name pre-fills the search box; keep it in sync */
  useEffect(() => { setQ(params.get("q") ?? ""); }, [params]);
  useEffect(() => { setPage(1); }, [q, grade, cls, status, sort]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- derived data ---- */
  const classes = useMemo(() => [...new Set(learners.filter((l) => grade === "all" || l.grade === grade).map((l) => l.className).filter(Boolean))].sort(), [learners, grade]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = learners.filter((l) =>
      (grade === "all" || l.grade === grade) &&
      (cls === "all" || l.className === cls) &&
      (status === "all" || l.status === status) &&
      (!needle || `${fullName(l)} ${l.admissionNo} ${l.guardianName}`.toLowerCase().includes(needle)));
    const val = (l: Learner): string | number => ({
      name: fullName(l).toLowerCase(), class: l.className, attendance: l.attendance ?? -1, mean: l.mean ?? -1, status: l.status,
    })[sort.key];
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [learners, q, grade, cls, status, sort]);

  const stats = useMemo(() => {
    const active = learners.filter((l) => l.status === "active");
    const att = active.map((l) => l.attendance).filter((n): n is number => n !== null);
    return {
      total: active.length,
      boys: active.filter((l) => l.gender === "Male").length,
      girls: active.filter((l) => l.gender === "Female").length,
      byGrade: ([10, 11, 12] as Grade[]).map((g) => ({ g, n: active.filter((l) => l.grade === g).length })),
      attendance: att.length ? att.reduce((a, b) => a + b, 0) / att.length : null,
      atRisk: active.filter((l) => (l.attendance ?? 100) < 85 || (l.mean ?? 100) < 40).length,
    };
  }, [learners]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setSortKey = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "attendance" || key === "mean" ? -1 : 1 }));
  const th = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="st-sort" onClick={() => setSortKey(key)}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
  const clearSearch = () => { setQ(""); if (params.get("q")) setParams({}); };
  const filtersOn = q || grade !== "all" || cls !== "all" || status !== "active";

  return (
    // tt-shell gives the shared TeacherSidebar its colours and the 260px + content layout.
    // ss-shell keeps the header and content styles working.
    <div className="tt-shell ss-shell" style={{ display: "grid", background: "var(--ss-canvas)" }}>
      <TeacherSidebar />

      <div className="ss-main">
        <header className="ss-header">
          <div className="ss-h-title">
            <p className="ss-h-name">Learners</p>
            <span>Class management</span>
          </div>
        </header>

        <main className="ss-content">
          <div className="st-page">
            <div className="st-head">
              <div>
                <h2>Students</h2>
                <p>Every learner in Grades 10 to 12. Search, filter and open a record for the full details.</p>
              </div>
              <div className="st-head-actions">
                <button type="button" className="st-btn" onClick={() => setReload((n) => n + 1)} disabled={state === "loading"}><Icon name="refresh" /> Refresh</button>
                <button type="button" className="st-btn" onClick={() => download(`learners-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered))} disabled={!filtered.length}><Icon name="download" /> Export CSV</button>
                <button type="button" className="st-btn st-btn-primary" onClick={() => navigate("/Register/Learner")}><Icon name="plus" /> Register learner</button>
              </div>
            </div>

            {sample && state === "ready" && (
              <div className="st-note" role="status">
                <Icon name="alert" size={16} />
                <span>Showing sample learners. Set <code>VITE_API_URL</code> in your <code>.env</code> file and check <code>LEARNERS_PATH</code> in this file to load real data.</span>
              </div>
            )}

            {/* summary */}
            <div className="st-kpis">
              <div className="st-card st-kpi"><span>Active learners</span><b>{state === "ready" ? stats.total : "–"}</b><small>{state === "ready" ? `${stats.boys} boys · ${stats.girls} girls` : " "}</small></div>
              {stats.byGrade.map(({ g, n }) => (
                <button key={g} type="button" className={`st-card st-kpi st-kpi-btn${grade === g ? " is-on" : ""}`} onClick={() => { setGrade(grade === g ? "all" : g); setCls("all"); }} aria-pressed={grade === g}>
                  <span>Grade {g}</span><b>{state === "ready" ? n : "–"}</b><small>{grade === g ? "Showing only this grade" : "Select to filter"}</small>
                </button>
              ))}
              <div className="st-card st-kpi st-kpi-risk"><span>Need follow-up</span><b>{state === "ready" ? stats.atRisk : "–"}</b><small>Attendance under 85% or mean under 40%</small></div>
            </div>

            {/* filters */}
            <div className="st-card st-filters">
              <label className="st-search">
                <Icon name="search" />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, admission number or guardian" aria-label="Search learners" />
              </label>
              <label className="st-lab">Class
                <select value={cls} onChange={(e) => setCls(e.target.value)}>
                  <option value="all">All classes</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="st-lab">Status
                <select value={status} onChange={(e) => setStatus(e.target.value as "all" | Status)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="transferred">Transferred</option>
                  <option value="all">All</option>
                </select>
              </label>
              {filtersOn && <button type="button" className="st-link" onClick={() => { clearSearch(); setGrade("all"); setCls("all"); setStatus("active"); }}>Clear filters</button>}
            </div>

            {/* list */}
            <section className="st-card st-list" aria-busy={state === "loading"}>
              <header>
                <h3>Learners</h3>
                <span>{state === "ready" ? `${filtered.length} ${filtered.length === 1 ? "learner" : "learners"}` : ""}</span>
              </header>

              {state === "loading" && (
                <div className="st-skel" aria-label="Loading learners">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="st-skel-row"><i /><span /><span /><span /></div>)}
                </div>
              )}

              {state === "error" && (
                <div className="st-empty">
                  <h4>Learners could not be loaded</h4>
                  <p>{error}</p>
                  <button type="button" className="st-btn st-btn-primary" onClick={() => setReload((n) => n + 1)}>Try again</button>
                </div>
              )}

              {state === "ready" && filtered.length === 0 && (
                <div className="st-empty">
                  <h4>{learners.length === 0 ? "No learners registered yet" : "No learners match these filters"}</h4>
                  <p>{learners.length === 0 ? "Register the first learner to see them listed here." : "Try a different name or clear the filters."}</p>
                  {learners.length === 0 && <button type="button" className="st-btn st-btn-primary" onClick={() => navigate("/Register/Learner")}>Register learner</button>}
                </div>
              )}

              {state === "ready" && filtered.length > 0 && (
                <>
                  <div className="st-scroll">
                    <table className="st-table">
                      <caption className="st-sr">Learners</caption>
                      <thead>
                        <tr>
                          {th("name", "Learner")}{th("class", "Class")}
                          <th scope="col">Gender</th>
                          {th("attendance", "Attendance")}{th("mean", "Mean")}
                          <th scope="col">Guardian</th>{th("status", "Status")}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((l) => (
                          <tr key={l.id} tabIndex={0} onClick={() => setOpen(l)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(l); }}>
                            <td data-label="Learner">
                              <div className="st-who"><span className="st-av">{initials(l)}</span><span><strong>{fullName(l)}</strong><small>{l.admissionNo ? `Adm. ${l.admissionNo}` : "No admission number"}</small></span></div>
                            </td>
                            <td data-label="Class">{l.className || "–"}{l.pathway && <small>{l.pathway}</small>}</td>
                            <td data-label="Gender">{l.gender || "–"}</td>
                            <td data-label="Attendance" className={l.attendance !== null && l.attendance < 85 ? "st-low" : ""}>{pct(l.attendance)}</td>
                            <td data-label="Mean" className={l.mean !== null && l.mean < 40 ? "st-low" : ""}>{pct(l.mean)}</td>
                            <td data-label="Guardian">{l.guardianName || "–"}{l.guardianPhone && <small>{l.guardianPhone}</small>}</td>
                            <td data-label="Status"><span className={`st-tag ${l.status}`}>{l.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer className="st-pager">
                    <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                    <div>
                      <button type="button" className="st-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                      <b>Page {page} of {pages}</b>
                      <button type="button" className="st-btn" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                  </footer>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* detail drawer */}
      {open && (
        <>
          <div className="st-scrim" onClick={() => setOpen(null)} aria-hidden="true" />
          <aside className="st-drawer" role="dialog" aria-modal="true" aria-label={`${fullName(open)} details`}>
            <header>
              <span className="st-av lg">{initials(open)}</span>
              <div><h3>{fullName(open)}</h3><p>{open.admissionNo ? `Admission ${open.admissionNo}` : "No admission number"}</p></div>
              <button type="button" className="st-x" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" size={18} /></button>
            </header>
            <div className="st-dgrid">
              <div><span>Class</span><b>{open.className || "–"}</b></div>
              <div><span>Grade</span><b>{open.grade ?? "–"}</b></div>
              <div><span>Gender</span><b>{open.gender || "–"}</b></div>
              <div><span>Pathway</span><b>{open.pathway || "–"}</b></div>
              <div><span>Attendance</span><b className={open.attendance !== null && open.attendance < 85 ? "st-low" : ""}>{pct(open.attendance)}</b></div>
              <div><span>Mean score</span><b className={open.mean !== null && open.mean < 40 ? "st-low" : ""}>{pct(open.mean)}</b></div>
              <div><span>Fee balance</span><b>{kes(open.feeBalance)}</b></div>
              <div><span>Status</span><b><span className={`st-tag ${open.status}`}>{open.status}</span></b></div>
            </div>
            <h4>Guardian</h4>
            <div className="st-guard">
              <div><strong>{open.guardianName || "Not recorded"}</strong><small>{open.guardianPhone || "No phone number"}</small></div>
              {open.guardianPhone && <a className="st-btn" href={`tel:${open.guardianPhone.replace(/\s+/g, "")}`}><Icon name="phone" /> Call</a>}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default Students;


function sampleLearners(): Learner[] {
  const male = ["Brian", "Kevin", "Dennis", "Victor", "Samuel", "Ian", "Collins", "Festus", "Allan", "Eric", "Mark", "Peter"];
  const female = ["Faith", "Mercy", "Grace", "Linet", "Joy", "Esther", "Naomi", "Cynthia", "Purity", "Beatrice", "Ruth", "Winnie"];
  const last = ["Mwangi", "Kamau", "Njeru", "Muriithi", "Kinyua", "Mugambi", "Gitonga", "Murithi", "Karimi", "Mwenda", "Kiambi", "Nyaga"];
  const classes = ["10A", "10B", "11A", "11B", "12A", "12B"];
  const paths = ["STEM", "Social Sciences", "Arts and Sports"];
  const out: Learner[] = [];
  for (let i = 0; i < 48; i++) {
    const isF = i % 2 === 1;
    const c = classes[i % classes.length];
    out.push({
      id: `s${i + 1}`, admissionNo: String(2400 + i * 7),
      firstName: (isF ? female : male)[(i * 5) % 12], lastName: last[(i * 7 + 3) % 12],
      gender: isF ? "Female" : "Male", grade: Number(c.slice(0, 2)) as Grade, className: c, pathway: paths[i % 3],
      guardianName: `${["Mr.", "Mrs.", "Ms."][i % 3]} ${last[(i * 3 + 1) % 12]}`, guardianPhone: `07${10 + (i % 80)} ${100 + ((i * 37) % 900)} ${100 + ((i * 53) % 900)}`,
      status: i === 11 ? "transferred" : i === 29 ? "inactive" : "active",
      attendance: Math.round((82 + ((i * 13) % 17)) * 10) / 10, mean: Math.round((38 + ((i * 17) % 45)) * 10) / 10,
      feeBalance: i % 4 === 0 ? 0 : (i % 7) * 4500,
    });
  }
  return out;
}