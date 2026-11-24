import { useMemo, useState } from "react";
import { DashboardLayout } from "./HoiDashboard";

/* ---------- Types ---------- */

export type AuditCategory = "Authentication" | "Marks" | "Finance" | "Users" | "Settings" | "AI" | "Data";
export type AuditOutcome = "Success" | "Failed" | "Flagged";

export interface AuditEvent {
  id: string;
  time: string; // ISO date string
  user: string;
  role: string;
  action: string;
  category: AuditCategory;
  target: string;
  ip: string;
  outcome: AuditOutcome;
  details: string;
  before?: string;
  after?: string;
}

interface Props {
  /** Replace the sample data with events from your API. */
  events?: AuditEvent[];
}

const CATEGORIES: AuditCategory[] = ["Authentication", "Marks", "Finance", "Users", "Settings", "AI", "Data"];
const OUTCOMES: AuditOutcome[] = ["Success", "Failed", "Flagged"];
const RANGES = [
  { key: "1", label: "Last 24 hours" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "all", label: "All time" },
];
const PAGE_SIZE = 10;

/* ---------- Icons ---------- */

const PATHS = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l5 5",
  download: "M12 4v11 M7 11l5 5 5-5 M5 20h14",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2",
  chevron: "M6 9l6 6 6-6",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  activity: "M3 12h4l3-8 4 16 3-8h4",
} as const;

function Ico({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- Sample data (deterministic, replace with API results) ---------- */

type Tpl = [number, string, string, string, AuditCategory, string, AuditOutcome, string, string?, string?, string?];

const TEMPLATES: Tpl[] = [
  [6, "Head of Institution", "HOI", "Signed in", "Authentication", "Portal login", "Success", "Signed in from a trusted device.", undefined, undefined, "197.232.14.20"],
  [22, "Ms. Wanjiru", "Teacher", "Submitted marks", "Marks", "Grade 10 Biology, End of Term 2", "Success", "42 learner scores submitted for approval."],
  [38, "Unknown", "None", "Failed sign-in", "Authentication", "kiprono@school.ac.ke", "Failed", "Wrong password entered. 3rd attempt in 10 minutes.", undefined, undefined, "105.163.2.88"],
  [55, "Finance Officer", "Finance", "Recorded payment", "Finance", "Receipt RC-20944", "Success", "Payment of KES 18,500 recorded for Adm. 1042.", undefined, undefined, "197.232.14.31"],
  [90, "Deputy: J. Mwangi", "Deputy", "Edited timetable", "Data", "Grade 11 timetable", "Success", "Moved Chemistry from Tuesday P3 to Wednesday P2.", "Tue P3", "Wed P2", "197.232.14.40"],
  [140, "Finance Officer", "Finance", "Requested payment reversal", "Finance", "Receipt RC-20931", "Flagged", "Reversal needs HOI approval before it takes effect.", "KES 12,000 paid", "Reversed", "197.232.14.31"],
  [210, "Head of Institution", "HOI", "Created teacher account", "Users", "Mr. Kiprono", "Success", "Login details emailed to the teacher.", undefined, undefined, "197.232.14.20"],
  [320, "Mr. Otieno", "Teacher", "Generated AI quiz", "AI", "Grade 11 Chemistry quiz", "Success", "Quiz generated from uploaded learning material."],
  [480, "Unknown", "None", "Failed sign-in", "Authentication", "admin", "Flagged", "Repeated attempts on a non-existent account.", undefined, undefined, "41.90.66.12"],
  [600, "Head of Institution", "HOI", "Changed AI settings", "Settings", "AI Tutor access", "Success", "AI Tutor restricted for Grade 10 during exams.", "Enabled", "Restricted", "197.232.14.20"],
  [1300, "Ms. Achieng", "Teacher", "Marked attendance", "Data", "Grade 10A register", "Success", "Register saved. 41 present, 3 absent."],
  [1500, "Finance Officer", "Finance", "Changed fee structure", "Finance", "Term 3 fees, Grade 10", "Success", "Activity fee line updated.", "KES 3,000", "KES 3,500", "197.232.14.31"],
  [1900, "Head of Institution", "HOI", "Approved marks release", "Marks", "Grade 12 Mathematics, CAT 2", "Success", "Results published to learners."],
  [2600, "Mr. Kamau", "Teacher", "Edited submitted marks", "Marks", "Grade 10B English, Mid-term", "Flagged", "Marks changed after submission. Reason given: data entry error.", "58", "65", "197.232.14.52"],
  [3100, "Head of Institution", "HOI", "Reset user password", "Users", "Mrs. Mwangi", "Success", "Temporary password sent by email."],
  [4300, "Unknown", "None", "Failed sign-in", "Authentication", "wanjiru@school.ac.ke", "Failed", "Account locked after 5 failed attempts.", undefined, undefined, "154.122.9.4"],
  [5800, "Deputy: J. Mwangi", "Deputy", "Exported learner list", "Data", "Grade 11 learners", "Success", "CSV export of 80 learner records."],
  [7200, "Head of Institution", "HOI", "Suspended user", "Users", "Mr. Test Account", "Success", "Unused test account suspended.", "Active", "Suspended"],
  [9800, "Ms. Wanjiru", "Teacher", "Uploaded learning material", "AI", "Biology Form notes.pdf", "Success", "File uploaded and indexed for AI Tutor."],
  [14400, "Finance Officer", "Finance", "Generated invoices", "Finance", "Term 2 invoices", "Success", "412 invoices generated."],
  [20200, "Head of Institution", "HOI", "Updated grading scale", "Settings", "Grading bands", "Success", "Meeting band set to 50 to 79.", "50 to 80", "50 to 79"],
  [28800, "Head of Institution", "HOI", "Registered learner", "Users", "Adm. 1058", "Success", "New learner admitted to Grade 10B."],
  [36500, "Mr. Otieno", "Teacher", "Failed sign-in", "Authentication", "otieno@school.ac.ke", "Failed", "Wrong password entered.", undefined, undefined, "197.232.14.77"],
  [43200, "Head of Institution", "HOI", "Created announcement", "Data", "Term 3 opening date", "Success", "Published to School-wide audience."],
];

function buildSample(): AuditEvent[] {
  const now = Date.now();
  return TEMPLATES.map((t, i) => ({
    id: `ev-${1000 + i}`,
    time: new Date(now - t[0] * 60000).toISOString(),
    user: t[1], role: t[2], action: t[3], category: t[4], target: t[5], outcome: t[6], details: t[7],
    before: t[8], after: t[9], ip: t[10] ?? "197.232.14.20",
  }));
}

/* ---------- Helpers ---------- */

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/* ---------- Page ---------- */

function AuditLog({ events }: Props) {
  const all = useMemo(() => (events ?? buildSample()).slice().sort((a, b) => +new Date(b.time) - +new Date(a.time)), [events]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [outcome, setOutcome] = useState<"all" | AuditOutcome>("all");
  const [range, setRange] = useState("7");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    const needle = q.trim().toLowerCase();
    return all.filter((e) =>
      +new Date(e.time) >= cutoff &&
      (category === "all" || e.category === category) &&
      (outcome === "all" || e.outcome === outcome) &&
      (!needle || `${e.user} ${e.action} ${e.target} ${e.ip} ${e.details}`.toLowerCase().includes(needle)),
    );
  }, [all, q, category, outcome, range]);

  /* KPIs always describe the last 24 hours, whatever the filters say */
  const kpi = useMemo(() => {
    const day = all.filter((e) => +new Date(e.time) >= Date.now() - 86400000);
    return {
      events: day.length,
      failed: day.filter((e) => e.action === "Failed sign-in").length,
      flagged: day.filter((e) => e.outcome === "Flagged").length,
      users: new Set(day.filter((e) => e.role !== "None").map((e) => e.user)).size,
    };
  }, [all]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const change = (fn: () => void) => { fn(); setPage(0); setOpen(null); };
  const hasFilters = q !== "" || category !== "all" || outcome !== "all" || range !== "7";
  const clear = () => change(() => { setQ(""); setCategory("all"); setOutcome("all"); setRange("7"); });

  const exportCsv = () => {
    const head = ["Time", "User", "Role", "Action", "Category", "Target", "IP address", "Outcome", "Details"];
    const rows = filtered.map((e) => [e.time, e.user, e.role, e.action, e.category, e.target, e.ip, e.outcome, e.details].map(csvCell).join(","));
    const blob = new Blob([[head.map(csvCell).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      role="HOI"
      user={{ name: "Head of Institution", roleLabel: "HOI" }}
      title="Audit Log"
    >
      <style>{STYLES}</style>
      <div className="al-page">
        {/* Heading */}
        <div className="al-head">
          <div>
            <h2 className="al-title">Audit log</h2>
            <p className="al-sub">A read-only record of who did what in the portal, and when.</p>
          </div>
          <button type="button" className="ss-btn ss-btn-primary" onClick={exportCsv} disabled={filtered.length === 0}>
            <Ico name="download" /> Export CSV
          </button>
        </div>

        <div className="al-lock" role="note">
          <Ico name="lock" size={15} />
          Entries cannot be edited or deleted. Every change to marks, fees, users and settings is recorded here.
        </div>

        {/* KPIs (last 24 hours) */}
        <div className="al-kpis">
          <div className="ss-card al-kpi">
            <span className="al-kpi-icon"><Ico name="activity" size={20} /></span>
            <div><small>Events, last 24 hours</small><b>{kpi.events}</b></div>
          </div>
          <div className="ss-card al-kpi">
            <span className="al-kpi-icon danger"><Ico name="alert" size={20} /></span>
            <div><small>Failed sign-ins</small><b>{kpi.failed}</b></div>
          </div>
          <div className="ss-card al-kpi">
            <span className="al-kpi-icon warn"><Ico name="shield" size={20} /></span>
            <div><small>Flagged for review</small><b>{kpi.flagged}</b></div>
          </div>
          <div className="ss-card al-kpi">
            <span className="al-kpi-icon"><Ico name="users" size={20} /></span>
            <div><small>Active users</small><b>{kpi.users}</b></div>
          </div>
        </div>

        {/* Filters */}
        <section className="ss-card al-filters" aria-label="Filters">
          <label className="al-search">
            <Ico name="search" />
            <input
              type="search"
              value={q}
              onChange={(e) => change(() => setQ(e.target.value))}
              placeholder="Search user, action, target or IP address..."
              aria-label="Search the audit log"
            />
          </label>
          <label className="al-sel">
            <span>Category</span>
            <select value={category} onChange={(e) => change(() => setCategory(e.target.value as "all" | AuditCategory))}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="al-sel">
            <span>Outcome</span>
            <select value={outcome} onChange={(e) => change(() => setOutcome(e.target.value as "all" | AuditOutcome))}>
              <option value="all">All outcomes</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="al-sel">
            <span>Period</span>
            <select value={range} onChange={(e) => change(() => setRange(e.target.value))}>
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          {hasFilters && <button type="button" className="ss-link-btn al-clear" onClick={clear}>Clear filters</button>}
        </section>

        {/* Table */}
        <section className="ss-card al-tablecard">
          <header className="al-tablehead">
            <h3>Activity</h3>
            <span className="al-count">{filtered.length} {filtered.length === 1 ? "event" : "events"}</span>
          </header>

          {filtered.length === 0 ? (
            <p className="al-empty">No events match these filters.</p>
          ) : (
            <div className="al-scroll">
              <table className="al-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Category</th>
                    <th scope="col">Target</th>
                    <th scope="col">Outcome</th>
                    <th scope="col"><span className="al-sr">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e) => {
                    const isOpen = open === e.id;
                    return (
                      <FragmentRow key={e.id} e={e} isOpen={isOpen} onToggle={() => setOpen(isOpen ? null : e.id)} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <footer className="al-pager">
              <span>
                Showing {safePage * PAGE_SIZE + 1} to {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => { setPage(safePage - 1); setOpen(null); }} disabled={safePage === 0}>Previous</button>
                <span className="al-pageno">Page {safePage + 1} of {pages}</span>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => { setPage(safePage + 1); setOpen(null); }} disabled={safePage >= pages - 1}>Next</button>
              </div>
            </footer>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

/* One table row plus its expandable detail row */
function FragmentRow({ e, isOpen, onToggle }: { e: AuditEvent; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={isOpen ? "is-open" : ""}>
        <td data-label="Time" className="al-time">{fmt(e.time)}</td>
        <td data-label="User"><strong>{e.user}</strong><small>{e.role}</small></td>
        <td data-label="Action">{e.action}</td>
        <td data-label="Category"><span className="al-cat">{e.category}</span></td>
        <td data-label="Target" className="al-target">{e.target}</td>
        <td data-label="Outcome"><span className={`al-pill ${e.outcome.toLowerCase()}`}>{e.outcome}</span></td>
        <td className="al-end">
          <button type="button" className="al-more" onClick={onToggle} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} details for ${e.action}`}>
            <Ico name="chevron" size={16} />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="al-detail">
          <td colSpan={7}>
            <div className="al-detail-grid">
              <div><small>Details</small><p>{e.details}</p></div>
              <div><small>Exact time</small><p>{fmtFull(e.time)}</p></div>
              <div><small>IP address</small><p>{e.ip}</p></div>
              <div><small>Event ID</small><p>{e.id}</p></div>
              {(e.before || e.after) && (
                <div className="al-change">
                  <small>Change</small>
                  <p>
                    <span className="al-before">{e.before ?? "None"}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="al-after">{e.after ?? "None"}</span>
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default AuditLog;

/* ---------- Styles (uses the --ss-* theme variables, so light and dark both work) ---------- */

const STYLES = `

`;