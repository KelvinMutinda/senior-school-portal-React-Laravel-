import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../AcademicOverview";     


type Grade = 10 | 11 | 12;

export interface ReportData {
  term: number;
  year: number;
  expected: number;                                   
  collected: number;                                  
  weekly: { label: string; collected: number; target: number }[];          
  byGrade: { grade: Grade; expected: number; collected: number }[];
  byMethod: { method: string; amount: number }[];
  voteHeads: { name: string; expected: number; collected: number }[];
  aging: { label: string; amount: number; learners: number }[];
  arrears: { id: string; name: string; admissionNo: string; className: string; grade: Grade; guardianPhone: string; balance: number; daysOverdue: number; lastPayment: string }[];
  transactions: { id: string; date: string; learner: string; className: string; reference: string; method: string; amount: number }[];
}


const API_URL = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const REPORT_PATH = "/finance/reports";               // called as GET {API_URL}/finance/reports?term=2&year=2026
const CURRENT_TERM = 2;
const CURRENT_YEAR = 2026;
const COLLECTION_TARGET = 85;                         // school target, % of billed fees collected

async function fetchReport(term: number, signal: AbortSignal): Promise<{ report: ReportData; sample: boolean }> {
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 500));
    return { report: sampleReport(term), sample: true };
  }
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${REPORT_PATH}?term=${term}&year=${CURRENT_YEAR}`, {
    signal,
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Your session has expired. Please sign in again." : `The server responded with ${res.status}.`);
  const json = await res.json();
  return { report: (json.data ?? json) as ReportData, sample: false };
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
const kesShort = (n: number) => (n >= 1_000_000 ? `KES ${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `KES ${Math.round(n / 1_000)}K` : `KES ${Math.round(n)}`);
const rate = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const f1 = (n: number) => n.toFixed(1);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const tone = (p: number) => (p >= 85 ? "hi" : p >= 70 ? "ok" : "lo");

function csv(rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const ICONS: Record<string, string> = {
  wallet: "M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 7l11-3v3M16 14h2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
  chart: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6",
  print: "M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Cumulative collections chart (inline SVG)                           */
/* ------------------------------------------------------------------ */

function CollectionChart({ weekly, expected }: { weekly: ReportData["weekly"]; expected: number }) {
  const W = 640, H = 250, L = 52, R = 16, T = 14, B = 30;
  const max = Math.max(expected, ...weekly.map((w) => w.collected), ...weekly.map((w) => w.target)) * 1.05;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, weekly.length - 1);
  const y = (v: number) => T + ((max - v) * (H - T - B)) / max;
  const stepM = max > 4_000_000 ? 2_000_000 : 1_000_000;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += stepM) ticks.push(t);
  const line = weekly.map((w, i) => `${x(i)},${y(w.collected)}`).join(" ");
  const area = `${L},${y(0)} ${line} ${x(weekly.length - 1)},${y(0)}`;
  const target = weekly.map((w, i) => `${x(i)},${y(w.target)}`).join(" ");
  const last = weekly[weekly.length - 1];
  return (
    <svg className="fr-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Cumulative fees collected over the term, ending at ${kesShort(last?.collected ?? 0)} against an expected ${kesShort(expected)}.`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="fr-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="fr-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{t === 0 ? "0" : `${t / 1_000_000}M`}</text>
        </g>
      ))}
      {weekly.map((w, i) => (i % 2 === 0 || i === weekly.length - 1) && <text key={w.label} className="fr-axis" x={x(i)} y={H - 8} textAnchor="middle">{w.label}</text>)}
      <polyline className="fr-target" points={target} />
      <polygon className="fr-area" points={area} />
      <polyline className="fr-line" points={line} />
      {weekly.map((w, i) => (
        <circle key={i} className="fr-dot" cx={x(i)} cy={y(w.collected)} r={i === weekly.length - 1 ? 4.5 : 3}>
          <title>{`${w.label}: ${kes(w.collected)} collected, pace target ${kes(w.target)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

type ArrSort = "balance" | "days";

function FinanceReports() {
  const navigate = useNavigate();
  const [term, setTerm] = useState(CURRENT_TERM);
  const [data, setData] = useState<ReportData | null>(null);
  const [sample, setSample] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [gradeF, setGradeF] = useState<"all" | Grade>("all");
  const [sort, setSort] = useState<{ key: ArrSort; dir: 1 | -1 }>({ key: "balance", dir: -1 });

  const load = useCallback((signal: AbortSignal) => {
    setState("loading");
    fetchReport(term, signal)
      .then((r) => { setData(r.report); setSample(r.sample); setState("ready"); })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "Something went wrong while loading the report.");
        setState("error");
      });
  }, [term]);

  useEffect(() => {
    const ctl = new AbortController();
    load(ctl.signal);
    return () => ctl.abort();
  }, [load, reload]);

  const outstanding = data ? Math.max(0, data.expected - data.collected) : 0;
  const collectionRate = data ? rate(data.collected, data.expected) : 0;
  const learnersInArrears = data ? data.aging.reduce((s, a) => s + a.learners, 0) : 0;
  const methodTotal = data ? data.byMethod.reduce((s, m) => s + m.amount, 0) : 0;
  const agingMax = data ? Math.max(1, ...data.aging.map((a) => a.amount)) : 1;

  const arrears = useMemo(() => {
    if (!data) return [];
    return data.arrears
      .filter((a) => gradeF === "all" || a.grade === gradeF)
      .sort((a, b) => (sort.key === "balance" ? a.balance - b.balance : a.daysOverdue - b.daysOverdue) * sort.dir);
  }, [data, gradeF, sort]);

  const toggleSort = (key: ArrSort) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  const sortBtn = (key: ArrSort, label: string) => (
    <button type="button" className="fr-sort" onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span></button>
  );

  const exportArrears = () => data && download(`fee-arrears-term-${data.term}-${data.year}.csv`,
    csv([["Admission no", "Learner", "Class", "Guardian phone", "Balance (KES)", "Days overdue", "Last payment"],
      ...arrears.map((a) => [a.admissionNo, a.name, a.className, a.guardianPhone, a.balance, a.daysOverdue, a.lastPayment])]));

  return (
    <Shell title="Financial Reports">
      <div className="fr-page">
        <div className="fr-head">
          <div>
            <h2>Financial reports</h2>
            <p>What has been billed and collected this term, where the money comes in, and who still owes fees.</p>
          </div>
          <div className="fr-actions fr-noprint">
            <label className="fr-lab">Term
              <select value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                <option value={1}>Term 1</option>
                <option value={2}>Term 2{CURRENT_TERM === 2 ? " (current)" : ""}</option>
                <option value={3}>Term 3</option>
              </select>
            </label>
            <button type="button" className="fr-btn" onClick={() => setReload((n) => n + 1)} disabled={state === "loading"}><Icon name="refresh" /> Refresh</button>
            <button type="button" className="fr-btn" onClick={() => window.print()} disabled={state !== "ready"}><Icon name="print" /> Print report</button>
          </div>
        </div>

        {sample && state === "ready" && (
          <div className="fr-note fr-noprint" role="status">
            <Icon name="alert" />
            <span>Showing sample figures. Set <code>VITE_API_URL</code> in your <code>.env</code> file and check <code>REPORT_PATH</code> in this file to load real data.</span>
          </div>
        )}

        {state === "error" && (
          <div className="fr-card fr-empty">
            <h4>The report could not be loaded</h4>
            <p>{error}</p>
            <button type="button" className="fr-btn fr-btn-primary" onClick={() => setReload((n) => n + 1)}>Try again</button>
          </div>
        )}

        {state === "loading" && (
          <>
            <div className="fr-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="fr-card fr-kpi fr-skel"><span /><b /><i /></div>)}</div>
            <div className="fr-card fr-skel-block" aria-label="Loading report" />
          </>
        )}

        {state === "ready" && data && (
          <>
            <div className="fr-chips">
              <span className="fr-tag">Term {data.term} · {data.year}</span>
              <span className="fr-tag muted">{learnersInArrears} learners with a balance</span>
            </div>

            {/* ── KPIs ── */}
            <div className="fr-kpis">
              <div className="fr-card fr-kpi">
                <div className="fr-kpi-l"><Icon name="wallet" /> Fees billed</div>
                <b>{kesShort(data.expected)}</b>
                <small>{kes(data.expected)} expected this term</small>
              </div>
              <div className="fr-card fr-kpi fr-kpi-green">
                <div className="fr-kpi-l"><Icon name="check" /> Collected</div>
                <b>{kesShort(data.collected)}</b>
                <div className="fr-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, collectionRate)}%` }} /></div>
                <small>{f1(collectionRate)}% of fees billed</small>
              </div>
              <div className="fr-card fr-kpi fr-kpi-red">
                <div className="fr-kpi-l"><Icon name="alert" /> Outstanding</div>
                <b>{kesShort(outstanding)}</b>
                <small>{kes(outstanding)} still to collect</small>
              </div>
              <div className="fr-card fr-kpi fr-kpi-gold">
                <div className="fr-kpi-l"><Icon name="chart" /> Collection rate</div>
                <b>{f1(collectionRate)}%</b>
                <small className={collectionRate >= COLLECTION_TARGET ? "fr-good" : "fr-bad"}>
                  {collectionRate >= COLLECTION_TARGET ? `${f1(collectionRate - COLLECTION_TARGET)} pts above` : `${f1(COLLECTION_TARGET - collectionRate)} pts under`} the {COLLECTION_TARGET}% target
                </small>
              </div>
            </div>

            {/* ── Trend + grade ── */}
            <div className="fr-two">
              <section className="fr-card fr-panel">
                <header><h3>Collections through the term</h3><span>Cumulative, KES</span></header>
                <div className="fr-pad">
                  <CollectionChart weekly={data.weekly} expected={data.expected} />
                  <div className="fr-legend">
                    <span className="fr-key"><i className="k-line" />Collected</span>
                    <span className="fr-key"><i className="k-target" />Pace needed to reach the billed amount</span>
                  </div>
                </div>
              </section>

              <section className="fr-card fr-panel">
                <header><h3>Collection by grade</h3><span>Share of billed fees paid</span></header>
                <div className="fr-pad fr-grades">
                  {data.byGrade.map((g) => {
                    const p = rate(g.collected, g.expected);
                    return (
                      <div key={g.grade} className="fr-grade">
                        <div className="fr-grade-top"><strong>Grade {g.grade}</strong><b>{f1(p)}%</b></div>
                        <div className="fr-bar" aria-hidden="true"><i className={`t-${tone(p)}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                        <small>{kesShort(g.collected)} of {kesShort(g.expected)} · {kesShort(g.expected - g.collected)} outstanding</small>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* ── Methods + vote heads ── */}
            <div className="fr-two fr-two-even">
              <section className="fr-card fr-panel">
                <header><h3>How fees are paid</h3><span>Share of money received</span></header>
                <div className="fr-pad">
                  <div className="fr-stack" role="img" aria-label={data.byMethod.map((m) => `${m.method} ${f1(rate(m.amount, methodTotal))}%`).join(", ")}>
                    {data.byMethod.map((m, i) => <i key={m.method} className={`m${i % 4}`} style={{ width: `${rate(m.amount, methodTotal)}%` }} />)}
                  </div>
                  <ul className="fr-methods">
                    {data.byMethod.map((m, i) => (
                      <li key={m.method}><span className={`fr-dot-k m${i % 4}`} /><strong>{m.method}</strong><em>{f1(rate(m.amount, methodTotal))}%</em><b>{kesShort(m.amount)}</b></li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="fr-card fr-panel">
                <header><h3>Fee structure</h3><span>Collected against billed, by item</span></header>
                <ul className="fr-votes">
                  {data.voteHeads.map((v) => {
                    const p = rate(v.collected, v.expected);
                    return (
                      <li key={v.name}>
                        <div className="fr-vote-top"><strong>{v.name}</strong><span>{kesShort(v.collected)} <small>of {kesShort(v.expected)}</small></span></div>
                        <div className="fr-bar" aria-hidden="true"><i className={`t-${tone(p)}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            {/* ── Arrears ── */}
            <section className="fr-card fr-panel">
              <header>
                <h3>Fee arrears</h3>
                <div className="fr-head-r fr-noprint">
                  <div className="fr-seg" role="group" aria-label="Filter arrears by grade">
                    {(["all", 10, 11, 12] as const).map((g) => <button key={g} type="button" aria-pressed={gradeF === g} onClick={() => setGradeF(g)}>{g === "all" ? "All" : g}</button>)}
                  </div>
                  <button type="button" className="fr-btn" onClick={exportArrears} disabled={!arrears.length}><Icon name="download" /> Export CSV</button>
                </div>
              </header>
              <div className="fr-pad fr-arrears">
                <div className="fr-aging">
                  <h4>By age of balance</h4>
                  {data.aging.map((a) => (
                    <div key={a.label} className="fr-age">
                      <div className="fr-age-top"><span>{a.label}</span><b>{kesShort(a.amount)}</b></div>
                      <div className="fr-bar" aria-hidden="true"><i className="t-lo" style={{ width: `${(a.amount / agingMax) * 100}%` }} /></div>
                      <small>{a.learners} learners</small>
                    </div>
                  ))}
                </div>
                <div className="fr-scroll">
                  {arrears.length === 0 ? (
                    <p className="fr-muted">No arrears to show for this grade.</p>
                  ) : (
                    <table className="fr-table">
                      <caption className="fr-sr">Learners with the largest fee balances</caption>
                      <thead>
                        <tr>
                          <th scope="col">Learner</th><th scope="col">Class</th>
                          <th scope="col" className="r">{sortBtn("balance", "Balance")}</th>
                          <th scope="col" className="r">{sortBtn("days", "Days overdue")}</th>
                          <th scope="col">Last payment</th><th scope="col" className="fr-noprint"><span className="fr-sr">Contact</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {arrears.map((a) => (
                          <tr key={a.id}>
                            <td data-label="Learner"><strong>{a.name}</strong><small>Adm. {a.admissionNo}</small></td>
                            <td data-label="Class">{a.className}</td>
                            <td data-label="Balance" className="r fr-bal">{kes(a.balance)}</td>
                            <td data-label="Days overdue" className={`r${a.daysOverdue > 60 ? " fr-bad" : ""}`}>{a.daysOverdue}</td>
                            <td data-label="Last payment">{a.lastPayment ? fmtDate(a.lastPayment) : "None"}</td>
                            <td className="fr-noprint">{a.guardianPhone && <a className="fr-btn fr-btn-sm" href={`tel:${a.guardianPhone.replace(/\s+/g, "")}`}><Icon name="phone" size={14} /> Call</a>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            {/* ── Recent payments ── */}
            <section className="fr-card fr-panel">
              <header><h3>Recent payments</h3>
                <button type="button" className="fr-link fr-noprint" onClick={() => navigate("/Hoi/Payments")}>All payments and receipts</button>
              </header>
              <div className="fr-scroll">
                <table className="fr-table">
                  <caption className="fr-sr">Most recent payments received</caption>
                  <thead><tr><th scope="col">Date</th><th scope="col">Learner</th><th scope="col">Reference</th><th scope="col">Method</th><th scope="col" className="r">Amount</th></tr></thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t.id}>
                        <td data-label="Date">{fmtDate(t.date)}</td>
                        <td data-label="Learner"><strong>{t.learner}</strong><small>{t.className}</small></td>
                        <td data-label="Reference"><code>{t.reference}</code></td>
                        <td data-label="Method">{t.method}</td>
                        <td data-label="Amount" className="r fr-paid">{kes(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

export default FinanceReports;

/* ================================================================== */
/* Sample data (used only while VITE_API_URL is not set)               */
/* ================================================================== */

function sampleReport(term: number): ReportData {
  const scale = term === 2 ? 1 : term === 1 ? 1.05 : 0.55;           // other terms: just different sample numbers
  const s = (n: number) => Math.round((n * scale) / 1000) * 1000;
  const expected = s(7_800_000), collected = s(6_100_000);
  const weights = [4, 9, 12, 14, 12, 10, 9, 8, 7, 6, 5, 4];            // share of money arriving each week
  const wsum = weights.reduce((a, b) => a + b, 0);
  let run = 0;
  const weekly = weights.map((w, i) => {
    run += (w / wsum) * collected;
    return { label: `Wk ${i + 1}`, collected: Math.round(run), target: Math.round(((i + 1) / weights.length) * expected) };
  });
  const names = ["Faith Mwangi", "Brian Njeru", "Mercy Kamau", "Kevin Muriithi", "Grace Kinyua", "Dennis Mugambi", "Linet Gitonga", "Victor Murithi", "Joy Karimi", "Samuel Mwenda"];
  const cls = ["10A", "11B", "10B", "12A", "11A", "12B", "10A", "11B", "12A", "10B"];
  const methods = ["M-Pesa", "Bank deposit", "M-Pesa", "Cash", "M-Pesa", "Bank deposit", "Cheque", "M-Pesa"];
  return {
    term, year: CURRENT_YEAR, expected, collected, weekly,
    byGrade: [{ grade: 10, expected: s(2_800_000), collected: s(2_200_000) }, { grade: 11, expected: s(2_600_000), collected: s(2_100_000) }, { grade: 12, expected: s(2_400_000), collected: s(1_800_000) }],
    byMethod: [{ method: "M-Pesa", amount: s(3_660_000) }, { method: "Bank deposit", amount: s(1_830_000) }, { method: "Cash", amount: s(427_000) }, { method: "Cheque", amount: s(183_000) }],
    voteHeads: [
      { name: "Tuition", expected: s(4_200_000), collected: s(3_400_000) }, { name: "Boarding and meals", expected: s(2_100_000), collected: s(1_620_000) },
      { name: "Activities", expected: s(600_000), collected: s(510_000) }, { name: "Exams and assessment", expected: s(450_000), collected: s(380_000) },
      { name: "Development", expected: s(450_000), collected: s(190_000) },
    ],
    aging: [{ label: "0 to 30 days", amount: s(620_000), learners: 58 }, { label: "31 to 60 days", amount: s(540_000), learners: 41 }, { label: "61 to 90 days", amount: s(330_000), learners: 22 }, { label: "Over 90 days", amount: s(210_000), learners: 14 }],
    arrears: names.map((name, i) => ({
      id: `a${i}`, name, admissionNo: String(2400 + i * 7), className: cls[i], grade: Number(cls[i].slice(0, 2)) as Grade,
      guardianPhone: `07${10 + i * 3} ${200 + i * 41} ${300 + i * 59}`, balance: s(62_000 - i * 4_300), daysOverdue: 112 - i * 11,
      lastPayment: i % 5 === 4 ? "" : `2026-0${3 + (i % 5)}-${10 + i}`,
    })),
    transactions: methods.map((m, i) => ({
      id: `t${i}`, date: `2026-11-${String(17 - i).padStart(2, "0")}`, learner: names[(i * 3) % 10], className: cls[(i * 3) % 10],
      reference: m === "M-Pesa" ? `SKL${(1_000_000 + i * 7919).toString(36).toUpperCase()}` : m === "Cash" ? `RCP-${1040 + i}` : `${m === "Cheque" ? "CHQ" : "BNK"}-${7200 + i * 13}`,
      method: m, amount: s(12_000 + i * 6_500),
    })),
  };
}