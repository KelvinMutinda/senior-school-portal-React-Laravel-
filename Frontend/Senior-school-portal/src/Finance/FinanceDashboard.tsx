import { useState } from "react";
import { DashboardLayout, type LayoutUser } from "../Hoi/HoiDashboard";

/* ==========================================================================
   FinanceDashboard
   Uses the shared DashboardLayout (permission-driven sidebar + HeaderSection)
   and the .ss-* styles in App.css.
   Privacy: Finance sees name, class, guardian contact and balance only.
   No marks, attendance detail or AI data appear on this page.
   Receipts are never edited or deleted: mistakes go through a reversal that
   needs HOI approval.
   ========================================================================== */

/* ---------- Types ---------- */

type Method = "Cash" | "Bank deposit" | "Mobile money";

interface Transaction {
  receipt: string;
  learner: string;
  admNo: string;
  method: Method;
  amount: number;
  time: string;
}

interface OverdueAccount {
  id: string;
  learner: string;
  className: string;
  guardian: string;
  phone: string;
  balance: number;
  daysOverdue: number;
}

interface FeeStructure {
  grade: string;
  termFee: number;
  version: string;
  status: "Active" | "Awaiting approval";
}

interface FeeQuery {
  id: string;
  from: "Parent" | "Learner";
  learner: string;
  subject: string;
  age: string;
  status: "Open" | "With HOI";
}

interface TrendPoint {
  month: string;
  expected: number;
  collected: number;
}

export interface FinanceData {
  expected: number;
  collected: number;
  overdueCount: number;
  trend: TrendPoint[];
  transactions: Transaction[];
  overdue: OverdueAccount[];
  structures: FeeStructure[];
  queries: FeeQuery[];
  reconciliation: { matchedPct: number; unmatched: number; periodLocked: boolean; period: string };
}

export interface PaymentInput {
  learner: string;
  amount: number;
  method: Method;
  reference: string;
}

export interface FinanceDashboardProps {
  data?: FinanceData;
  user?: LayoutUser;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  onRecordPayment?: (payment: PaymentInput) => void | Promise<void>;
  onExport?: (format: "pdf" | "excel") => void | Promise<void>;
  onSendReminder?: (accountId: string) => void | Promise<void>;
  onRequestReversal?: (receipt: string) => void | Promise<void>;
}

/* ---------- Sample data (replace with API results) ---------- */

const SAMPLE: FinanceData = {
  expected: 7_800_000,
  collected: 6_100_000,
  overdueCount: 23,
  trend: [
    { month: "Jun", expected: 1_100_000, collected: 940_000 },
    { month: "Jul", expected: 1_300_000, collected: 1_020_000 },
    { month: "Aug", expected: 1_400_000, collected: 1_180_000 },
    { month: "Sep", expected: 1_350_000, collected: 1_060_000 },
    { month: "Oct", expected: 1_300_000, collected: 960_000 },
    { month: "Nov", expected: 1_350_000, collected: 940_000 },
  ],
  transactions: [
    { receipt: "RC-20944", learner: "Achieng Otieno", admNo: "1021", method: "Mobile money", amount: 18_500, time: "10:42 AM" },
    { receipt: "RC-20943", learner: "Brian Kiptoo", admNo: "1022", method: "Bank deposit", amount: 45_000, time: "9:15 AM" },
    { receipt: "RC-20942", learner: "Grace Akinyi", admNo: "1051", method: "Cash", amount: 6_000, time: "Yesterday" },
    { receipt: "RC-20941", learner: "Kevin Omondi", admNo: "0981", method: "Mobile money", amount: 22_000, time: "Yesterday" },
    { receipt: "RC-20940", learner: "Lucy Nyambura", admNo: "0982", method: "Bank deposit", amount: 31_500, time: "Yesterday" },
  ],
  overdue: [
    { id: "o1", learner: "Daniel Njoroge", className: "Grade 11A", guardian: "Mr. J. Njoroge", phone: "0712 345 678", balance: 38_500, daysOverdue: 47 },
    { id: "o2", learner: "Hassan Ali", className: "Grade 11B", guardian: "Mrs. F. Ali", phone: "0722 410 902", balance: 27_000, daysOverdue: 38 },
    { id: "o3", learner: "Mark Kariuki", className: "Grade 12A", guardian: "Mr. P. Kariuki", phone: "0733 118 455", balance: 21_200, daysOverdue: 33 },
    { id: "o4", learner: "Irene Chebet", className: "Grade 11B", guardian: "Mrs. R. Chebet", phone: "0701 882 310", balance: 15_800, daysOverdue: 31 },
  ],
  structures: [
    { grade: "Grade 10", termFee: 52_000, version: "v3", status: "Active" },
    { grade: "Grade 11", termFee: 54_500, version: "v3", status: "Active" },
    { grade: "Grade 12", termFee: 57_000, version: "v2", status: "Awaiting approval" },
  ],
  queries: [
    { id: "q1", from: "Parent", learner: "Esther Wambui", subject: "Activity fee charged twice", age: "2 hours", status: "Open" },
    { id: "q2", from: "Learner", learner: "Felix Mutua", subject: "Bank payment not showing", age: "1 day", status: "Open" },
    { id: "q3", from: "Parent", learner: "Naomi Jepkoech", subject: "Hardship waiver request", age: "3 days", status: "With HOI" },
  ],
  reconciliation: { matchedPct: 92, unmatched: 6, periodLocked: false, period: "November 2026" },
};

const METHODS: Method[] = ["Cash", "Bank deposit", "Mobile money"];

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const kesShort = (n: number) => (n >= 1_000_000 ? `KES ${(n / 1_000_000).toFixed(1)}M` : `KES ${Math.round(n / 1000)}K`);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/* ---------- Component ---------- */

function FinanceDashboard({
  data = SAMPLE,
  user = { name: "Finance Officer", roleLabel: "Finance" },
  onNavigate,
  onLogout,
  onRecordPayment,
  onExport,
  onSendReminder,
  onRequestReversal,
}: FinanceDashboardProps) {
  const go = (route: string, key = "") => onNavigate?.(route, key);

  /* derived */
  const outstanding = data.expected - data.collected;
  const rate = Math.round((data.collected / Math.max(1, data.expected)) * 100);
  const openQueries = data.queries.length;
  const maxTrend = Math.max(...data.trend.map((t) => Math.max(t.expected, t.collected)), 1);

  /* record payment form */
  const [learner, setLearner] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("Mobile money");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paid, setPaid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submitPayment = async () => {
    const e: Record<string, string> = {};
    if (!learner.trim()) e.learner = "Enter the learner's name or admission number";
    const value = Number(amount.replace(/,/g, ""));
    if (!value || value <= 0) e.amount = "Enter an amount greater than zero";
    if (method !== "Cash" && !reference.trim()) e.reference = "Enter the bank or mobile money reference";
    setErrors(e);
    setPaid(null);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onRecordPayment?.({ learner: learner.trim(), amount: value, method, reference: reference.trim() });
      setPaid(`Payment of ${kes(value)} recorded for ${learner.trim()}. The system issues a numbered receipt and updates the balance.`);
      setLearner("");
      setAmount("");
      setReference("");
    } finally {
      setSaving(false);
    }
  };

  const focusPayment = () => {
    const el = document.getElementById("record-payment");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("pay-learner")?.focus();
  };

  /* reminders sent (local feedback only) */
  const [reminded, setReminded] = useState<string[]>([]);
  const remind = async (id: string) => {
    await onSendReminder?.(id);
    setReminded((r) => [...r, id]);
  };

  return (
    <DashboardLayout
      role="FINANCE"
      user={user}
      title="Finance Dashboard"
      activeKey="dashboard"
      notifications={data.overdueCount + openQueries}
      badges={{ overdue: data.overdueCount, queries: openQueries, messages: 1 }}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerAction={{ label: "Record payment", icon: "wallet", onClick: focusPayment }}
    >
      {/* Hero */}
      <section className="ss-hero">
        <div className="ss-hero-text">
          <span className="ss-eyebrow">Finance office</span>
          <h2>{greeting()}, welcome back</h2>
          <p>
            Collection stands at <strong>{rate}%</strong> of the {kesShort(data.expected)} expected this term.{" "}
            <strong>{data.overdueCount} learners</strong> are overdue and <strong>{openQueries} fee queries</strong> need a reply.
          </p>
          <div className="ss-hero-btns">
            <button type="button" className="ss-btn ss-btn-gold" onClick={focusPayment}>Record payment</button>
            <button type="button" className="ss-btn ss-btn-ghost" onClick={() => go("/finance/invoices", "invoices")}>Generate invoice</button>
          </div>
        </div>
        <div className="ss-hero-stats">
          <div><span>Expected</span><b>{kesShort(data.expected)}</b></div>
          <div><span>Collected</span><b>{kesShort(data.collected)}</b></div>
          <div><span>Outstanding</span><b>{kesShort(outstanding)}</b></div>
        </div>
      </section>

      {/* KPIs */}
      <section className="ss-kpis" aria-label="Key indicators">
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Collection rate</span>
          <b>{rate}%</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${rate}%` }} /></div>
          <small>{kes(data.collected)} collected</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Outstanding balance</span>
          <b>{kesShort(outstanding)}</b>
          <div className="ss-bar"><i style={{ width: `${100 - rate}%` }} /></div>
          <small>Across all invoiced learners</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Overdue learners</span>
          <b>{data.overdueCount}</b>
          <div className="ss-bar"><i style={{ width: `${Math.min(100, data.overdueCount * 3)}%` }} /></div>
          <small>Past due date, reminders available</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Open fee queries</span>
          <b>{openQueries}</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${Math.min(100, openQueries * 20)}%` }} /></div>
          <small>From learners and parents</small>
        </article>
      </section>

      {/* Trend + record payment */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Payment trend</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/reports", "fin-reports")}>Reports</button>
          </header>
          <div className="ss-legend">
            <span><i className="exp" /> Expected</span>
            <span><i className="col" /> Collected</span>
          </div>
          <div className="ss-cols" role="img" aria-label="Expected versus collected fees by month">
            {data.trend.map((t) => (
              <div className="ss-col" key={t.month} title={`${t.month}: ${kes(t.collected)} of ${kes(t.expected)}`}>
                <div className="ss-col-bars">
                  <i className="exp" style={{ height: `${(t.expected / maxTrend) * 100}%` }} />
                  <i className="col" style={{ height: `${(t.collected / maxTrend) * 100}%` }} />
                </div>
                <small>{t.month}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="ss-card ss-panel" id="record-payment">
          <header><h3>Record payment</h3></header>
          <div className="ss-payform">
            <label className="ss-lab">Learner
              <input id="pay-learner" className="ss-input" value={learner} onChange={(e) => setLearner(e.target.value)}
                placeholder="Name or admission number" aria-invalid={errors.learner ? true : undefined} />
              {errors.learner && <span className="ss-field-err" role="alert">{errors.learner}</span>}
            </label>
            <div className="ss-payrow">
              <label className="ss-lab">Amount (KES)
                <input className="ss-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 18500" aria-invalid={errors.amount ? true : undefined} />
                {errors.amount && <span className="ss-field-err" role="alert">{errors.amount}</span>}
              </label>
              <label className="ss-lab">Method
                <select className="ss-input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <label className="ss-lab">{method === "Cash" ? "Reference (optional)" : "Reference"}
              <input className="ss-input" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder={method === "Mobile money" ? "Transaction code" : "Slip or bank reference"}
                aria-invalid={errors.reference ? true : undefined} />
              {errors.reference && <span className="ss-field-err" role="alert">{errors.reference}</span>}
            </label>
            <button type="button" className="ss-btn ss-btn-primary" onClick={submitPayment} disabled={saving}>
              {saving ? "Saving..." : "Record payment"}
            </button>
          </div>
          {paid && <p className="ss-sent" role="status">{paid}</p>}
        </article>
      </section>

      {/* Transactions + overdue */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Recent transactions</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/payments", "payments")}>All payments</button>
          </header>
          <table className="ss-table">
            <thead>
              <tr><th>Receipt</th><th>Learner</th><th>Method</th><th>Amount</th><th /></tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.receipt}>
                  <td><strong>{t.receipt}</strong><br /><small>{t.time}</small></td>
                  <td>{t.learner}<br /><small>Adm. {t.admNo}</small></td>
                  <td>{t.method}</td>
                  <td>{kes(t.amount)}</td>
                  <td><button type="button" className="ss-link-btn" onClick={() => onRequestReversal?.(t.receipt)}>Request reversal</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ss-note">Receipts cannot be edited or deleted. A reversal is a new entry and needs HOI approval.</p>
        </article>

        <article className="ss-card ss-panel">
          <header>
            <h3>Overdue accounts</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/overdue", "overdue")}>View all</button>
          </header>
          <ul className="ss-list">
            {data.overdue.map((o) => (
              <li key={o.id}>
                <div>
                  <strong>{o.learner} · {o.className}</strong>
                  <small>{o.guardian} · {o.phone}</small>
                </div>
                <div className="ss-owed">
                  <strong>{kes(o.balance)}</strong>
                  <small>{o.daysOverdue} days overdue</small>
                </div>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => remind(o.id)} disabled={reminded.includes(o.id)}>
                  {reminded.includes(o.id) ? "Reminder sent" : "Send reminder"}
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* Fee structures + queries */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Fee structures</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/fees", "fees")}>Manage</button>
          </header>
          <table className="ss-table">
            <thead>
              <tr><th>Grade</th><th>Term fee</th><th>Version</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.structures.map((s) => (
                <tr key={s.grade}>
                  <td><strong>{s.grade}</strong></td>
                  <td>{kes(s.termFee)}</td>
                  <td>{s.version}</td>
                  <td><span className={`ss-tag ${s.status === "Active" ? "" : "warn"}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ss-note">Only an approved structure can generate invoices. Changes mid-term create a new version.</p>
        </article>

        <article className="ss-card ss-panel">
          <header>
            <h3>Fee queries</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/queries", "queries")}>Inbox</button>
          </header>
          <ul className="ss-list">
            {data.queries.map((q) => (
              <li key={q.id}>
                <div>
                  <strong>{q.subject}</strong>
                  <small>{q.from} · {q.learner} · {q.age} ago</small>
                </div>
                <span className={`ss-tag ${q.status === "With HOI" ? "warn" : ""}`}>{q.status}</span>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => go("/finance/queries", "queries")}>Reply</button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* Reconciliation + quick actions */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Reconciliation, {data.reconciliation.period}</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/finance/reconciliation", "reconcile")}>Open</button>
          </header>
          <div className="ss-progress">
            <div className="ss-bar"><i style={{ width: `${data.reconciliation.matchedPct}%` }} /></div>
            <small>
              {data.reconciliation.matchedPct}% of statement lines matched, {data.reconciliation.unmatched} unmatched items to resolve.
            </small>
          </div>
          <p className="ss-note">
            Period status:{" "}
            <span className={`ss-tag ${data.reconciliation.periodLocked ? "" : "warn"}`}>
              {data.reconciliation.periodLocked ? "Locked" : "Open"}
            </span>{" "}
            A locked period can only change with HOI approval.
          </p>
        </article>

        <article className="ss-card ss-panel">
          <header><h3>Quick actions</h3></header>
          <div className="ss-actions-row">
            <button type="button" className="ss-btn" onClick={focusPayment}>Record payment</button>
            <button type="button" className="ss-btn" onClick={() => go("/finance/invoices", "invoices")}>Generate invoice</button>
            <button type="button" className="ss-btn" onClick={() => onExport?.("pdf")}>Export PDF</button>
            <button type="button" className="ss-btn" onClick={() => onExport?.("excel")}>Export Excel</button>
            <button type="button" className="ss-btn" onClick={() => go("/announcements", "announcements")}>Fee notice</button>
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}

export default FinanceDashboard;