import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "./HoiDashboard";

/* ---------- Types ---------- */

export type ApprovalType =
  | "Marks release"
  | "Report cards"
  | "Fee structure"
  | "Waiver"
  | "Payment reversal"
  | "Timetable change";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";
export type ApprovalLevel = "Standard" | "Escalated";

export interface ApprovalItem {
  id: string;
  title: string;
  type: ApprovalType;
  from: string; // who submitted it
  fromRole: string;
  submitted: string; // ISO date string
  level: ApprovalLevel;
  status: ApprovalStatus;
  summary: string;
  details: { label: string; value: string }[];
  decidedAt?: string;
  decidedBy?: string;
  note?: string; // reason given when the decision was made
}

interface Props {
  /** Replace the sample data with approvals from your API. */
  items?: ApprovalItem[];
  /** Called after the Head of Institution confirms a decision. Save it to your API here. */
  onDecide?: (id: string, decision: "Approved" | "Rejected", note: string) => void | Promise<void>;
}

const TYPES: ApprovalType[] = ["Marks release", "Report cards", "Fee structure", "Waiver", "Payment reversal", "Timetable change"];
const TABS: { key: "Pending" | "Approved" | "Rejected" | "All"; label: string }[] = [
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "All", label: "All" },
];

/* ---------- Icons ---------- */

const PATHS = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l5 5",
  check: "M20 6L9 17l-5-5",
  close: "M18 6L6 18 M6 6l12 12",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2",
  chevron: "M6 9l6 6 6-6",
  alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7l2-3h12 M16 14h2",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z M9 8h6 M9 12h6",
  calendar: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4",
  pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  inbox: "M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5",
} as const;

type IconName = keyof typeof PATHS;

function Ico({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const TYPE_ICON: Record<ApprovalType, IconName> = {
  "Marks release": "pen",
  "Report cards": "file",
  "Fee structure": "wallet",
  "Waiver": "shield",
  "Payment reversal": "receipt",
  "Timetable change": "calendar",
};

/* ---------- Sample data (deterministic, replace with API results) ---------- */

type Tpl = [number, string, ApprovalType, string, string, ApprovalLevel, ApprovalStatus, string, [string, string][], string?, string?];

const TEMPLATES: Tpl[] = [
  [300, "Reverse receipt RC-20931", "Payment reversal", "Finance Officer", "Finance", "Standard", "Pending",
    "Payment was posted to the wrong learner account and needs to be reversed.",
    [["Amount", "KES 12,000"], ["Learner", "Adm. 1042"], ["Receipt", "RC-20931"], ["Reason given", "Posted to the wrong admission number"]]],
  [1500, "Grade 11 Mathematics, End of Term 3", "Marks release", "Deputy: J. Mwangi", "Deputy", "Standard", "Pending",
    "Marks are complete for all Grade 11 streams and ready to be published to learners.",
    [["Class", "Grade 11A and 11B"], ["Learners", "80"], ["Mean score", "61.4%"], ["Marks entered", "All sets in"]]],
  [2900, "Term 4 fee structure, Grade 10", "Fee structure", "Finance Officer", "Finance", "Standard", "Pending",
    "Activity fee increased and a new ICT levy added for Term 4.",
    [["Total per learner", "KES 28,500"], ["Previous total", "KES 26,000"], ["Change", "+KES 2,500"], ["Applies to", "Grade 10, 86 learners"]]],
  [4300, "Hardship waiver, Adm. 1042", "Waiver", "Finance Officer", "Finance", "Escalated", "Pending",
    "Guardian has requested a partial waiver after a loss of income. Needs a decision before invoices go out.",
    [["Amount requested", "KES 8,000"], ["Balance", "KES 15,500"], ["Supporting documents", "2 attached"], ["Previous waivers", "None"]]],
  [5200, "Grade 12 report cards, Term 2", "Report cards", "Deputy: J. Mwangi", "Deputy", "Standard", "Pending",
    "Class teacher comments are complete for both streams.",
    [["Classes", "12A and 12B"], ["Learners", "74"], ["Comments done", "74 of 74"], ["Marks status", "Approved"]]],
  [6100, "Move Grade 11 Chemistry to Wednesday P2", "Timetable change", "Deputy: J. Mwangi", "Deputy", "Standard", "Pending",
    "Laboratory is unavailable on Tuesday afternoons for the rest of the term.",
    [["From", "Tuesday, Period 3"], ["To", "Wednesday, Period 2"], ["Teacher", "Mr. Otieno"], ["Clashes", "None found"]]],
  [8600, "Edit submitted marks, Grade 10B English", "Marks release", "Mr. Kamau", "Teacher", "Escalated", "Pending",
    "Teacher asked to change marks after submission, citing a data entry error.",
    [["Learner", "Adm. 1031"], ["Old mark", "58"], ["New mark", "65"], ["Reason given", "Data entry error"]]],
  [9800, "Grade 10 fee structure, Term 3", "Fee structure", "Finance Officer", "Finance", "Standard", "Approved",
    "Standard yearly review with no new fee lines.",
    [["Total per learner", "KES 26,000"], ["Applies to", "Grade 10, 86 learners"]], "Head of Institution", "Approved as submitted."],
  [14400, "Grade 12 Mathematics, CAT 2", "Marks release", "Mrs. Mwangi", "Teacher", "Standard", "Approved",
    "CAT 2 marks reviewed and published.",
    [["Class", "Grade 12A and 12B"], ["Mean score", "64.2%"]], "Head of Institution", "Published to learners."],
  [20200, "Waiver, Adm. 1019", "Waiver", "Finance Officer", "Finance", "Standard", "Rejected",
    "Request for a full waiver without supporting documents.",
    [["Amount requested", "KES 22,000"], ["Supporting documents", "None"]], "Head of Institution", "Please resubmit with supporting documents."],
  [26000, "Reverse receipt RC-20877", "Payment reversal", "Finance Officer", "Finance", "Standard", "Approved",
    "Duplicate payment refunded to the guardian.",
    [["Amount", "KES 9,500"], ["Receipt", "RC-20877"]], "Head of Institution", "Duplicate confirmed against the bank statement."],
  [34000, "Move Grade 12 Physics practical", "Timetable change", "Deputy: J. Mwangi", "Deputy", "Standard", "Rejected",
    "Request to move the practical into the exam week.",
    [["From", "Thursday, Period 5"], ["To", "Monday, Period 2"]], "Head of Institution", "Exam week must stay clear."],
];

function buildSample(): ApprovalItem[] {
  const now = Date.now();
  return TEMPLATES.map((t, i) => {
    const decided = t[6] !== "Pending";
    return {
      id: `ap-${100 + i}`,
      submitted: new Date(now - t[0] * 60000).toISOString(),
      title: t[1], type: t[2], from: t[3], fromRole: t[4], level: t[5], status: t[6], summary: t[7],
      details: t[8].map(([label, value]) => ({ label, value })),
      decidedBy: t[9],
      note: t[10],
      decidedAt: decided ? new Date(now - Math.max(t[0] - 240, 30) * 60000).toISOString() : undefined,
    };
  });
}

/* ---------- Helpers ---------- */

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const waitingDays = (iso: string) => Math.floor((Date.now() - +new Date(iso)) / 86400000);

/* ---------- Page ---------- */

function Approvals({ items, onDecide }: Props) {
  const [list, setList] = useState<ApprovalItem[]>(() => items ?? buildSample());
  const [tab, setTab] = useState<"Pending" | "Approved" | "Rejected" | "All">("Pending");
  const [type, setType] = useState<"all" | ApprovalType>("all");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"oldest" | "newest" | "escalated">("oldest");
  const [open, setOpen] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ id: string; mode: "Approved" | "Rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => ({
    Pending: list.filter((a) => a.status === "Pending").length,
    Approved: list.filter((a) => a.status === "Approved").length,
    Rejected: list.filter((a) => a.status === "Rejected").length,
    All: list.length,
    escalated: list.filter((a) => a.status === "Pending" && a.level === "Escalated").length,
    oldest: Math.max(0, ...list.filter((a) => a.status === "Pending").map((a) => waitingDays(a.submitted))),
  }), [list]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = list.filter((a) =>
      (tab === "All" || a.status === tab) &&
      (type === "all" || a.type === type) &&
      (!needle || `${a.title} ${a.type} ${a.from} ${a.summary}`.toLowerCase().includes(needle)),
    );
    return rows.sort((a, b) => {
      if (order === "escalated" && a.level !== b.level) return a.level === "Escalated" ? -1 : 1;
      const diff = +new Date(a.submitted) - +new Date(b.submitted);
      return order === "newest" ? -diff : diff;
    });
  }, [list, tab, type, q, order]);

  const startDecision = (id: string, mode: "Approved" | "Rejected") => {
    setDeciding({ id, mode });
    setNote("");
    setNoteError("");
    setOpen(id);
  };

  const cancelDecision = () => { setDeciding(null); setNote(""); setNoteError(""); };

  const confirm = async () => {
    if (!deciding) return;
    if (deciding.mode === "Rejected" && !note.trim()) {
      setNoteError("Give a reason so the sender knows what to fix.");
      return;
    }
    const item = list.find((a) => a.id === deciding.id);
    if (!item) return;
    setSaving(true);
    try {
      await onDecide?.(deciding.id, deciding.mode, note.trim());
      setList((prev) => prev.map((a) => a.id === deciding.id
        ? { ...a, status: deciding.mode, decidedAt: new Date().toISOString(), decidedBy: "Head of Institution", note: note.trim() || undefined }
        : a));
      setToast(`${deciding.mode === "Approved" ? "Approved" : "Rejected"}: ${item.title}`);
      cancelDecision();
    } catch {
      setNoteError("Could not save the decision. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const switchTab = (key: typeof tab) => { setTab(key); setOpen(null); cancelDecision(); };

  return (
    <DashboardLayout
      role="HOI"
      user={{ name: "Head of Institution", roleLabel: "HOI" }}
      title="Approvals"
      badges={{ approvals: counts.Pending }}
      notifications={counts.Pending}
    >
    
      <div className="ap-page">
        {/* Heading */}
        <div className="ap-head">
          <h2 className="ap-title">Approvals</h2>
          <p className="ap-sub">Marks, report cards, fees, waivers and reversals that need your decision before they take effect.</p>
        </div>

        {toast && <div className="ap-toast" role="status"><Ico name="check" size={16} /> {toast}</div>}

        {/* KPIs */}
        <div className="ap-kpis">
          <div className="ss-card ap-kpi">
            <span className="ap-kpi-icon"><Ico name="inbox" size={20} /></span>
            <div><small>Waiting for you</small><b>{counts.Pending}</b></div>
          </div>
          <div className="ss-card ap-kpi">
            <span className="ap-kpi-icon warn"><Ico name="alert" size={20} /></span>
            <div><small>Escalated</small><b>{counts.escalated}</b></div>
          </div>
          <div className="ss-card ap-kpi">
            <span className="ap-kpi-icon"><Ico name="clock" size={20} /></span>
            <div><small>Longest wait</small><b>{counts.oldest} {counts.oldest === 1 ? "day" : "days"}</b></div>
          </div>
          <div className="ss-card ap-kpi">
            <span className="ap-kpi-icon ok"><Ico name="check" size={20} /></span>
            <div><small>Decided</small><b>{counts.Approved + counts.Rejected}</b></div>
          </div>
        </div>

        {/* Tabs and filters */}
        <section className="ss-card ap-bar" aria-label="Filters">
          <div className="ap-tabs" role="tablist" aria-label="Approval status">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={tab === t.key ? "is-on" : ""} onClick={() => switchTab(t.key)}>
                {t.label} <b>{counts[t.key]}</b>
              </button>
            ))}
          </div>
          <div className="ap-filters">
            <label className="ap-search">
              <Ico name="search" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, sender or type..." aria-label="Search approvals" />
            </label>
            <label className="ap-sel">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as "all" | ApprovalType)}>
                <option value="all">All types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="ap-sel">
              <span>Sort</span>
              <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
                <option value="escalated">Escalated first</option>
              </select>
            </label>
          </div>
        </section>

        {/* List */}
        {visible.length === 0 ? (
          <div className="ss-card ap-empty">
            <Ico name="inbox" size={28} />
            <p>{tab === "Pending" && q === "" && type === "all" ? "Nothing is waiting for you. You are all caught up." : "No approvals match these filters."}</p>
          </div>
        ) : (
          <ul className="ap-list">
            {visible.map((a) => {
              const isOpen = open === a.id;
              const isDeciding = deciding?.id === a.id;
              const wait = waitingDays(a.submitted);
              return (
                <li key={a.id} className={`ss-card ap-item${a.level === "Escalated" && a.status === "Pending" ? " is-escalated" : ""}`}>
                  <div className="ap-row">
                    <span className="ap-type-icon"><Ico name={TYPE_ICON[a.type]} size={20} /></span>
                    <div className="ap-main">
                      <strong>{a.title}</strong>
                      <small>{a.type} · {a.from} · submitted {ago(a.submitted)}</small>
                    </div>
                    <div className="ap-badges">
                      {a.status === "Pending" && wait >= 3 && (
                        <span className="ap-wait"><Ico name="clock" size={13} /> {wait} days</span>
                      )}
                      {a.level === "Escalated" && <span className="ap-pill escalated">Escalated</span>}
                      <span className={`ap-pill ${a.status.toLowerCase()}`}>{a.status}</span>
                    </div>
                    <div className="ap-actions">
                      {a.status === "Pending" && (
                        <>
                          <button type="button" className="ss-btn ss-btn-sm ap-reject" onClick={() => startDecision(a.id, "Rejected")}
                            disabled={isDeciding && deciding?.mode === "Rejected"}>
                            <Ico name="close" size={14} /> Reject
                          </button>
                          <button type="button" className="ss-btn ss-btn-sm ss-btn-primary" onClick={() => startDecision(a.id, "Approved")}
                            disabled={isDeciding && deciding?.mode === "Approved"}>
                            <Ico name="check" size={14} /> Approve
                          </button>
                        </>
                      )}
                      <button type="button" className="ap-more" onClick={() => setOpen(isOpen ? null : a.id)}
                        aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} details for ${a.title}`}>
                        <Ico name="chevron" size={16} />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="ap-detail">
                      <p className="ap-summary">{a.summary}</p>
                      <dl className="ap-facts">
                        <div><dt>Submitted by</dt><dd>{a.from} ({a.fromRole})</dd></div>
                        <div><dt>Submitted</dt><dd>{fmtFull(a.submitted)}</dd></div>
                        {a.details.map((d) => (
                          <div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>
                        ))}
                      </dl>

                      {a.status !== "Pending" && a.decidedAt && (
                        <div className={`ap-decision ${a.status.toLowerCase()}`}>
                          <strong>{a.status} by {a.decidedBy ?? "Head of Institution"}</strong>
                          <small>{fmtFull(a.decidedAt)}</small>
                          {a.note && <p>{a.note}</p>}
                        </div>
                      )}

                      {isDeciding && deciding && (
                        <div className={`ap-confirm ${deciding.mode.toLowerCase()}`}>
                          <label htmlFor={`note-${a.id}`}>
                            {deciding.mode === "Approved" ? "Add a note (optional)" : "Reason for rejecting (required)"}
                          </label>
                          <textarea id={`note-${a.id}`} rows={3} value={note}
                            onChange={(e) => { setNote(e.target.value); setNoteError(""); }}
                            aria-invalid={noteError ? true : undefined}
                            placeholder={deciding.mode === "Approved" ? "e.g. Approved as submitted." : "Tell the sender what needs to change."} />
                          {noteError && <small className="ap-err" role="alert">{noteError}</small>}
                          <div className="ap-confirm-btns">
                            <button type="button" className="ss-btn ss-btn-sm" onClick={cancelDecision} disabled={saving}>Cancel</button>
                            <button type="button"
                              className={`ss-btn ss-btn-sm ${deciding.mode === "Approved" ? "ss-btn-primary" : "ap-danger"}`}
                              onClick={confirm} disabled={saving}>
                              {saving ? "Saving..." : deciding.mode === "Approved" ? "Confirm approval" : "Confirm rejection"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Approvals;
