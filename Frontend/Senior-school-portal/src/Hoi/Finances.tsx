import { useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "./HoiDashboard";

/* ---------- Types ---------- */

export interface MonthPoint { label: string; expected: number; collected: number }
export interface GradeFees { grade: string; learners: number; expected: number; collected: number }
export interface Tranche { name: string; term: string; share: number; received: number; date?: string }
export interface Slice { label: string; value: number }
export interface Aged { range: string; learners: number; amount: number }
export interface Txn { id: string; date: string; text: string; kind: "Fees" | "Capitation" | "Expense" | "Other"; amount: number }

export interface FinanceData {
  term: number;
  year: number;
  target: number; // collection target, %
  learners: number;
  feesExpected: number;
  months: MonthPoint[];
  byGrade: GradeFees[];
  methods: Slice[];
  otherIncome: number;
  capitationPerLearner: number; // yearly, per learner
  tranches: Tranche[];
  expenditure: Slice[];
  aging: Aged[];
  recent: Txn[];
}

interface Props {
  /** Replace the sample figures with data from your API. */
  data?: FinanceData;
}

/* ---------- Sample data (replace with API results) ---------- */

const SAMPLE: FinanceData = {
  term: 2,
  year: 2026,
  target: 85,
  learners: 412,
  feesExpected: 7_800_000,
  months: [
    { label: "May", expected: 1_950_000, collected: 2_150_000 },
    { label: "Jun", expected: 1_950_000, collected: 1_600_000 },
    { label: "Jul", expected: 1_950_000, collected: 1_350_000 },
    { label: "Aug", expected: 1_950_000, collected: 1_000_000 },
  ],
  byGrade: [
    { grade: "Grade 10", learners: 150, expected: 2_800_000, collected: 2_200_000 },
    { grade: "Grade 11", learners: 140, expected: 2_600_000, collected: 2_100_000 },
    { grade: "Grade 12", learners: 122, expected: 2_400_000, collected: 1_800_000 },
  ],
  methods: [
    { label: "M-Pesa", value: 3_050_000 },
    { label: "Bank", value: 2_135_000 },
    { label: "Cash", value: 610_000 },
    { label: "Cheque", value: 305_000 },
  ],
  otherIncome: 300_000,
  capitationPerLearner: 22_244,
  tranches: [
    { name: "Tranche 1", term: "Term 1", share: 0.5, received: 4_582_264, date: "12 Feb 2026" },
    { name: "Tranche 2", term: "Term 2", share: 0.3, received: 2_061_000, date: "18 May 2026" },
    { name: "Tranche 3", term: "Term 3", share: 0.2, received: 0 },
  ],
  expenditure: [
    { label: "Salaries (BOM staff)", value: 2_400_000 },
    { label: "Teaching and learning materials", value: 1_350_000 },
    { label: "Security and other", value: 950_000 },
    { label: "Repairs and maintenance", value: 780_000 },
    { label: "Administration", value: 710_000 },
    { label: "Utilities", value: 620_000 },
    { label: "Co-curricular activities", value: 540_000 },
  ],
  aging: [
    { range: "0 to 30 days", learners: 48, amount: 620_000 },
    { range: "31 to 60 days", learners: 41, amount: 540_000 },
    { range: "61 to 90 days", learners: 28, amount: 330_000 },
    { range: "Over 90 days", learners: 18, amount: 210_000 },
  ],
  recent: [
    { id: "t1", date: "Today, 10:42", text: "Fee payment, receipt RC-20944 (Adm. 1042)", kind: "Fees", amount: 18_500 },
    { id: "t2", date: "Today, 09:15", text: "M-Pesa batch, 14 payments", kind: "Fees", amount: 212_000 },
    { id: "t3", date: "Yesterday", text: "Electricity bill, KPLC", kind: "Expense", amount: -64_300 },
    { id: "t4", date: "18 May", text: "Capitation Tranche 2 received", kind: "Capitation", amount: 2_061_000 },
    { id: "t5", date: "16 May", text: "Hire of school hall", kind: "Other", amount: 45_000 },
    { id: "t6", date: "15 May", text: "Stationery and exam papers", kind: "Expense", amount: -138_000 },
  ],
};

/* ---------- Helpers ---------- */

const full = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
const short = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}KES ${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (a >= 1_000) return `${sign}KES ${Math.round(a / 1_000)}K`;
  return `${sign}KES ${Math.round(a)}`;
};
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ---------- Icons ---------- */

const PATHS = {
  wallet: "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7l2-3h12 M16 14h2",
  check: "M20 6L9 17l-5-5",
  alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  building: "M4 21V5l8-2 8 2v16 M9 21v-5h6v5 M8 9h2 M14 9h2 M8 13h2 M14 13h2",
  trend: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  down: "M3 7l6 6 4-4 8 8 M15 17h6v-6",
  scale: "M12 3v18 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z",
  coins: "M12 8a6 3 0 1 0 0-.01 M6 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8 M6 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4",
  print: "M7 9V4h10v5 M7 17H5v-6h14v6h-2 M7 14h10v6H7z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z M9 8h6 M9 12h6",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h4",
  chart: "M3 3v18h18 M7 15l4-4 3 3 5-6",
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

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="ss-card fo-panel">
      <header><h3>{title}</h3>{aside && <span className="fo-aside">{aside}</span>}</header>
      <div className="fo-body">{children}</div>
    </section>
  );
}

/* ---------- Charts (inline SVG, no chart library) ---------- */

function MonthlyChart({ months }: { months: MonthPoint[] }) {
  const W = 640, H = 250, L = 52, R = 12, T = 14, B = 32;
  const max = Math.max(...months.flatMap((m) => [m.expected, m.collected]));
  const top = Math.max(500_000, Math.ceil(max / 500_000) * 500_000);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const y = (v: number) => T + ((top - v) * (H - T - B)) / top;
  const gw = (W - L - R) / months.length;
  const bw = Math.min(34, gw * 0.28);
  const label = (t: number) => (t === 0 ? "0" : `${(t / 1_000_000).toFixed(1)}M`);

  return (
    <svg className="fo-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Monthly fees expected and collected. ${months.map((m) => `${m.label}: expected ${short(m.expected)}, collected ${short(m.collected)}`).join(". ")}.`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="fo-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="fo-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{label(t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = L + gw * i + gw / 2;
        return (
          <g key={m.label}>
            <rect className="fo-exp" x={cx - bw - 2} y={y(m.expected)} width={bw} height={y(0) - y(m.expected)} rx="4">
              <title>{`${m.label} expected: ${full(m.expected)}`}</title>
            </rect>
            <rect className="fo-col" x={cx + 2} y={y(m.collected)} width={bw} height={y(0) - y(m.collected)} rx="4">
              <title>{`${m.label} collected: ${full(m.collected)}`}</title>
            </rect>
            <text className="fo-axis" x={cx} y={H - 10} textAnchor="middle">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ slices, centre, sub }: { slices: { label: string; value: number; cls: string }[]; centre: string; sub: string }) {
  const r = 54, C = 2 * Math.PI * r;
  const total = sum(slices.map((s) => s.value));
  let cum = 0;
  return (
    <svg className="fo-donut" viewBox="0 0 160 160" role="img"
      aria-label={`Income sources. ${slices.map((s) => `${s.label}: ${Math.round(pct(s.value, total))} percent`).join(". ")}.`}>
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" r={r} fill="none" className="fo-donut-bg" strokeWidth="18" />
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.label} cx="80" cy="80" r={r} fill="none" className={s.cls} strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-cum}>
              <title>{`${s.label}: ${full(s.value)}`}</title>
            </circle>
          );
          cum += len;
          return el;
        })}
      </g>
      <text x="80" y="78" textAnchor="middle" className="fo-donut-n">{centre}</text>
      <text x="80" y="96" textAnchor="middle" className="fo-donut-s">{sub}</text>
    </svg>
  );
}

/* ---------- Page ---------- */

function Finances({ data = SAMPLE }: Props) {
  const navigate = useNavigate();

  const f = useMemo(() => {
    const collected = sum(data.months.map((m) => m.collected));
    const outstanding = data.feesExpected - collected;
    const rate = pct(collected, data.feesExpected);

    const annualCap = data.learners * data.capitationPerLearner;
    const trs = data.tranches.map((t) => ({ ...t, expected: Math.round(annualCap * t.share) }));
    const thisTr = trs[data.term - 1];
    const capReceivedYear = sum(trs.map((t) => t.received));

    const income = collected + (thisTr?.received ?? 0) + data.otherIncome;
    const spent = sum(data.expenditure.map((e) => e.value));
    const net = income - spent;

    const aged = sum(data.aging.map((a) => a.amount));
    const over90 = data.aging[data.aging.length - 1];
    const debtors = sum(data.aging.map((a) => a.learners));
    return { collected, outstanding, rate, annualCap, trs, thisTr, capReceivedYear, income, spent, net, aged, over90, debtors };
  }, [data]);

  const attention = useMemo(() => {
    const items: { id: string; tone: "danger" | "warn" | "info"; text: string; sub: string }[] = [];
    if (f.rate < data.target) {
      items.push({ id: "rate", tone: "danger", text: `Collection is ${(data.target - f.rate).toFixed(1)} points under the ${data.target}% target`, sub: `${full(f.outstanding)} is still to collect this term` });
    }
    if (f.thisTr && f.thisTr.received < f.thisTr.expected) {
      items.push({ id: "cap", tone: "warn", text: `${full(f.thisTr.expected - f.thisTr.received)} of ${f.thisTr.name} capitation not yet received`, sub: `Expected ${full(f.thisTr.expected)} for Term ${data.term}` });
    }
    if (f.over90 && f.over90.learners > 0) {
      items.push({ id: "aged", tone: "warn", text: `${f.over90.learners} learners owe fees older than 90 days`, sub: `${full(f.over90.amount)} in total` });
    }
    if (f.net < 0) {
      items.push({ id: "net", tone: "danger", text: "Spending is higher than income this term", sub: `Shortfall of ${full(-f.net)}` });
    }
    return items;
  }, [f, data]);

  const maxSpend = Math.max(...data.expenditure.map((e) => e.value));
  const maxAge = Math.max(...data.aging.map((a) => a.amount));
  const methodTotal = sum(data.methods.map((m) => m.value));

  const donutSlices = [
    { label: "School fees", value: f.collected, cls: "fo-s1" },
    { label: "Capitation", value: f.thisTr?.received ?? 0, cls: "fo-s2" },
    { label: "Other income", value: data.otherIncome, cls: "fo-s3" },
  ];

  const links: { label: string; desc: string; route: string; icon: IconName }[] = [
    { label: "Fee Management", desc: "Structures and items", route: "/Hoi/Finances/Fee", icon: "file" },
    { label: "Payments and Receipts", desc: "Transactions and receipts", route: "/Hoi/Finances/Payments", icon: "receipt" },
    { label: "Financial Reports", desc: "Expected vs collected", route: "/Finance/Reports", icon: "chart" },
  ];

  return (
    <DashboardLayout
      role="HOI"
      user={{ name: "Head of Institution", roleLabel: "HOI" }}
      title="Finance Overview"
    >
     
      <div className="fo-page">
        {/* Heading */}
        <div className="fo-head">
          <div>
            <h2 className="fo-title">Finance overview</h2>
            <p className="fo-sub">Fees, capitation, spending and balances for the term, in one place.</p>
          </div>
          <button type="button" className="ss-btn ss-btn-sm fo-noprint" onClick={() => window.print()}>
            <Ico name="print" size={15} /> Print report
          </button>
        </div>

        <div className="fo-chips">
          <span className="fo-chip on">Term {data.term} · {data.year}</span>
          <span className="fo-chip">{data.learners} learners</span>
          <span className="fo-chip">Collection target {data.target}%</span>
        </div>

        {/* KPIs */}
        <div className="fo-kpis">
          <div className="ss-card fo-kpi">
            <span className="fo-kpi-label"><Ico name="coins" size={15} /> Total income</span>
            <b>{short(f.income)}</b>
            <small>Fees, capitation and other income</small>
          </div>
          <div className="ss-card fo-kpi">
            <span className="fo-kpi-label"><Ico name="check" size={15} /> Fees collected</span>
            <b>{short(f.collected)}</b>
            <div className="fo-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, f.rate)}%` }} /></div>
            <small>{f.rate.toFixed(1)}% of {short(data.feesExpected)} expected</small>
          </div>
          <div className="ss-card fo-kpi">
            <span className="fo-kpi-label"><Ico name="building" size={15} /> Capitation received</span>
            <b>{short(f.thisTr?.received ?? 0)}</b>
            <div className="fo-bar" aria-hidden="true"><i className="alt" style={{ width: `${Math.min(100, pct(f.thisTr?.received ?? 0, f.thisTr?.expected ?? 0))}%` }} /></div>
            <small>of {short(f.thisTr?.expected ?? 0)} expected for Term {data.term}</small>
          </div>
          <div className="ss-card fo-kpi risk">
            <span className="fo-kpi-label"><Ico name="alert" size={15} /> Fees outstanding</span>
            <b>{short(f.outstanding)}</b>
            <small>{f.debtors} learners with a balance</small>
          </div>
          <div className="ss-card fo-kpi">
            <span className="fo-kpi-label"><Ico name="down" size={15} /> Expenditure</span>
            <b>{short(f.spent)}</b>
            <div className="fo-bar" aria-hidden="true"><i className="warn" style={{ width: `${Math.min(100, pct(f.spent, f.income))}%` }} /></div>
            <small>{pct(f.spent, f.income).toFixed(0)}% of income spent</small>
          </div>
          <div className={`ss-card fo-kpi ${f.net < 0 ? "risk" : "good"}`}>
            <span className="fo-kpi-label"><Ico name="scale" size={15} /> Net balance</span>
            <b>{short(f.net)}</b>
            <small>Income less expenditure this term</small>
          </div>
        </div>

        {/* Monthly collections + income sources */}
        <div className="fo-two">
          <Panel title="Fee collections by month" aside="Expected vs collected, KES">
            <MonthlyChart months={data.months} />
            <div className="fo-legend">
              <span><i className="fo-exp-key" />Expected</span>
              <span><i className="fo-col-key" />Collected</span>
            </div>
          </Panel>

          <Panel title="Income sources" aside="This term">
            <div className="fo-donut-wrap">
              <Donut slices={donutSlices} centre={short(f.income)} sub="total income" />
              <ul className="fo-donut-list">
                {donutSlices.map((s) => (
                  <li key={s.label}>
                    <i className={s.cls} />
                    <span>{s.label}</span>
                    <b>{short(s.value)}</b>
                    <small>{pct(s.value, f.income).toFixed(0)}%</small>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>

        {/* Grade + methods */}
        <div className="fo-two even">
          <Panel title="Collection by grade" aside="Share of billed fees paid">
            <ul className="fo-rows">
              {data.byGrade.map((g) => {
                const rate = pct(g.collected, g.expected);
                return (
                  <li key={g.grade}>
                    <div className="fo-row-top"><strong>{g.grade}</strong><b>{rate.toFixed(1)}%</b></div>
                    <div className="fo-bar" aria-hidden="true"><i className={rate >= data.target ? "alt" : ""} style={{ width: `${rate}%` }} /></div>
                    <small>{short(g.collected)} of {short(g.expected)} · {g.learners} learners · {short(g.expected - g.collected)} outstanding</small>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="How fees were paid" aside={short(methodTotal)}>
            <div className="fo-stack" role="img" aria-label={`Payment methods. ${data.methods.map((m) => `${m.label}: ${Math.round(pct(m.value, methodTotal))} percent`).join(". ")}.`}>
              {data.methods.map((m, i) => (
                <i key={m.label} className={`fo-m${i + 1}`} style={{ width: `${pct(m.value, methodTotal)}%` }} title={`${m.label}: ${full(m.value)}`} />
              ))}
            </div>
            <ul className="fo-methods">
              {data.methods.map((m, i) => (
                <li key={m.label}>
                  <i className={`fo-m${i + 1}`} />
                  <span>{m.label}</span>
                  <b>{short(m.value)}</b>
                  <small>{pct(m.value, methodTotal).toFixed(0)}%</small>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Capitation */}
        <Panel title="Capitation" aside={`${full(data.capitationPerLearner)} per learner each year (sample rate)`}>
          <div className="fo-cap-top">
            <div><small>Learners</small><b>{data.learners}</b></div>
            <div><small>Expected for the year</small><b>{short(f.annualCap)}</b></div>
            <div><small>Received so far</small><b>{short(f.capReceivedYear)}</b></div>
            <div><small>Still expected</small><b>{short(f.annualCap - f.capReceivedYear)}</b></div>
          </div>
          <div className="fo-scroll">
            <table className="fo-table">
              <thead>
                <tr>
                  <th scope="col">Tranche</th>
                  <th scope="col">Term</th>
                  <th scope="col" className="num">Expected</th>
                  <th scope="col" className="num">Received</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {f.trs.map((t) => {
                  const done = t.received >= t.expected;
                  const status = done ? "Received" : t.received > 0 ? "Part paid" : "Awaiting";
                  return (
                    <tr key={t.name}>
                      <td><strong>{t.name}</strong><small>{Math.round(t.share * 100)}% of the year</small></td>
                      <td>{t.term}</td>
                      <td className="num">{full(t.expected)}</td>
                      <td className="num">{full(t.received)}</td>
                      <td>
                        <div className="fo-bar sm" aria-hidden="true"><i className={done ? "alt" : ""} style={{ width: `${Math.min(100, pct(t.received, t.expected))}%` }} /></div>
                      </td>
                      <td>{t.date ?? "Not yet"}</td>
                      <td><span className={`fo-pill ${done ? "ok" : t.received > 0 ? "warn" : "muted"}`}>{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fo-note">Set the yearly per-learner rate from the current Ministry of Education circular. The tranche shares are 50%, 30% and 20% of the year.</p>
        </Panel>

        {/* Spending + aging */}
        <div className="fo-two even">
          <Panel title="Where the money went" aside={short(f.spent)}>
            <ul className="fo-rows">
              {data.expenditure.map((e) => (
                <li key={e.label}>
                  <div className="fo-row-top"><span>{e.label}</span><b>{short(e.value)}</b></div>
                  <div className="fo-bar" aria-hidden="true"><i className="warn" style={{ width: `${(e.value / maxSpend) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Outstanding fees by age" aside={`${short(f.aged)} · ${f.debtors} learners`}>
            <ul className="fo-rows">
              {data.aging.map((a, i) => (
                <li key={a.range}>
                  <div className="fo-row-top"><span>{a.range}</span><b>{short(a.amount)}</b></div>
                  <div className="fo-bar" aria-hidden="true"><i className={i >= 2 ? "danger" : ""} style={{ width: `${(a.amount / maxAge) * 100}%` }} /></div>
                  <small>{a.learners} learners</small>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Attention + recent */}
        <div className="fo-two even">
          <Panel title="Needs your attention" aside={`${attention.length} ${attention.length === 1 ? "item" : "items"}`}>
            {attention.length === 0 ? (
              <p className="fo-empty">Nothing needs attention right now.</p>
            ) : (
              <ul className="fo-alerts">
                {attention.map((a) => (
                  <li key={a.id} className={`tone-${a.tone}`}>
                    <Ico name="alert" size={17} />
                    <span><strong>{a.text}</strong><small>{a.sub}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent transactions" aside="Latest first">
            <ul className="fo-txns">
              {data.recent.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.text}</strong>
                    <small>{t.date} · {t.kind}</small>
                  </div>
                  <b className={t.amount < 0 ? "neg" : "pos"}>{t.amount < 0 ? "-" : "+"}{full(Math.abs(t.amount))}</b>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Quick links */}
        <div className="fo-links fo-noprint">
          {links.map((l) => (
            <button key={l.route} type="button" className="ss-card fo-link" onClick={() => navigate(l.route)}>
              <span className="fo-link-icon"><Ico name={l.icon} size={20} /></span>
              <span><strong>{l.label}</strong><small>{l.desc}</small></span>
              <Ico name="arrow" size={16} />
            </button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Finances;

