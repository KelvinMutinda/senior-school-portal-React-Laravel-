import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

/* All styling for this page lives in the STYLES string at the bottom of this file, so nothing else is imported. */

export type Grade = 10 | 11 | 12;
type GradeFilter = "all" | Grade;

export interface ClassRow {
  id: string;
  grade: Grade;
  teacher: string;
  learners: number;
}

export interface TermData {
  term: number;                      // 1, 2 or 3
  year: number;
  classes: ClassRow[];
  subjects: string[];
  means: number[][];                 // [class][subject] mean score (%) this term
  prev: number[][];                  // same shape, previous term (for the change arrows)
  attendance: number[];              // per class, %
  submitted: boolean[][];            // [class][subject] has the teacher entered marks?
  trend: { labels: string[]; byGrade: Record<Grade, number[]> };
}

interface Props {
  getTermData?: (term: number) => TermData;
  currentTerm?: number;
  onNavigate?: (target: "results") => void;
  /** Set to false if this page is already rendered inside a layout that has the sidebar and header. */
  withShell?: boolean;
}

/* ================================================================== */
/* Sidebar + header (the Head of Institution shell)                    */
/* ================================================================== */

interface NavItem { label: string; to: string; icon: string; badge?: "approvals" | "messages"; title?: string }

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [
    { label: "Dashboard", to: "/Hoi/Dashboard", icon: "home", title: "Head of Institution Dashboard" },
    { label: "Approvals", to: "/Hoi/Approvals", icon: "shield", badge: "approvals" },
  ] },
  { section: "Academics", items: [
    { label: "Academic Overview", to: "/Academic/Overview", icon: "chart" },
    {label:"Admit New Learner", to:"/Register/Learner",icon:"pen"},
    {label:"Register Teacher", to:"/Register/Teacher",icon:"user"},
    { label: "Students", to: "/Students", icon: "cap" },
    { label: "Attendance", to: "/Hoi/Attendance", icon: "clipboard" },
    { label: "Academic Results", to: "/Results/View/Results", icon: "pen" },
  ] },
  { section: "Finance", items: [
   
    { label: "Financial Reports", to: "/Finance/Reports", icon: "chart" },
  ] },
  { section: "AI", items: [
    { label: "AI Insights", to: "/Hoi/AI/Insights", icon: "bolt" },
    { label: "AI Controls", to: "/Hoi/AI/Controls", icon: "toggle" },
  ] },
  { section: "Communication", items: [
    { label: "Messages", to: "/Hoi/Messages", icon: "chat", badge: "messages" },
    { label: "Announcements", to: "/Hoi/Announcements", icon: "megaphone" },
  ] },
  { section: "Administration", items: [
    { label: "User Management", to: "/Hoi/Users", icon: "user" },
    { label: "Audit Log and Settings", to: "/Hoi/Audit", icon: "audit" },
    {label: "Permissions", to:"", icon:"audit"},
  ] },
  { section: "Account", items: [{ label: "My Profile", to: "/Hoi/Profile", icon: "profile" }] },
];

const NAV_ICONS: Record<string, string> = {
  home: "M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2.2 2.2L15.5 10",
  chart: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6",
  cap: "M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5",
  clipboard: "M9 4h6v3H9zM7 6H5v14h14V6h-2M9 12h6M9 16h4",
  pen: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  wallet: "M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 7l11-3v3M16 14h2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  toggle: "M7 8h10a4 4 0 010 8H7a4 4 0 010-8zM16 12h.01",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  megaphone: "M4 10v4h3l8 4V6L7 10zM18 9a4 4 0 010 6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1-4 4-6 8-6s7 2 8 6",
  audit: "M5 4h14v16H5zM9 12l2 2 4-4",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1-4 4-6 8-6s7 2 8 6",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM16 16l5 5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
};

function Ico({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={NAV_ICONS[name] ?? NAV_ICONS.chart} />
    </svg>
  );
}

function ShellInner({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("ssp-theme") === "dark");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const badges = { approvals: 4, messages: 3 };
  const notifications = 7;
  const userName = "Head of Institution";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("ssp-theme", dark ? "dark" : "light"); } catch { /* storage blocked */ }
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/Students?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="hoi-shell">
      <a className="hoi-skip" href="#hoi-main">Skip to content</a>
      {open && <div className="hoi-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`hoi-side${open ? " is-open" : ""}`} aria-label="Main navigation">
        <div className="hoi-brand">
          <span className="hoi-logo"><Ico name="cap" size={22} /></span>
          <span className="hoi-brand-t"><b>Stephen</b><em>Kanja Senior School</em><small>Aim higher</small></span>
          <button type="button" className="hoi-icon-btn hoi-close" onClick={() => setOpen(false)} aria-label="Close menu"><Ico name="close" /></button>
        </div>
        <nav className="hoi-nav">
          {NAV.map((sec) => (
            <div key={sec.section} className="hoi-sec">
              <p className="hoi-sec-t">{sec.section}</p>
              {sec.items.map((it) => {
                const count = it.badge ? badges[it.badge] : 0;
                return (
                  <NavLink key={it.to} to={it.to} onClick={() => setOpen(false)} className={({ isActive }) => `hoi-link${isActive ? " is-active" : ""}`}>
                    <Ico name={it.icon} />
                    <span>{it.label}</span>
                    {!!count && <i className="hoi-badge" aria-label={`${count} new`}>{count}</i>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hoi-side-foot">Senior School Portal · v1.0</div>
      </aside>

      <div className="hoi-col">
        <header className="hoi-top">
          <button type="button" className="hoi-icon-btn hoi-burger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Ico name="menu" /></button>
          <div className="hoi-title"><h1>{title}</h1><small>{today}</small></div>
          <form className="hoi-search" role="search" onSubmit={submitSearch}>
            <Ico name="search" size={16} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search learners, staff, records..." aria-label="Search learners, staff, records" />
            <kbd aria-hidden="true">/</kbd>
          </form>
          <div className="hoi-actions">
            <button type="button" className="hoi-approvals" onClick={() => navigate("/Hoi/Approvals")}><Ico name="check" size={16} /> <span>Approvals</span></button>
            <button type="button" className="hoi-icon-btn hoi-bell" onClick={() => navigate("/Hoi/Announcements")} aria-label={`Notifications, ${notifications} unread`}>
              <Ico name="bell" /><i className="hoi-badge sm">{notifications}</i>
            </button>
            <button type="button" className="hoi-icon-btn" onClick={() => setDark((d) => !d)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>
              <Ico name={dark ? "sun" : "moon"} />
            </button>
            <button type="button" className="hoi-user" onClick={() => navigate("/Hoi/Profile")} aria-label="Open my profile">
              <span className="hoi-avatar">HO</span>
              <span className="hoi-user-t"><b>{userName}</b><small>HOI</small></span>
            </button>
          </div>
        </header>
        <main id="hoi-main" className="hoi-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

/** Sidebar + header + styles. Import this in any other Head of Institution page. */
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
     
      <ShellInner title={title}>{children}</ShellInner>
    </>
  );
}



const TARGET = 65;                    // school target mean (%)
const PASS = 50;
const SD = 14;                        // assumed spread of learner scores around a class mean
const GRADES: Grade[] = [10, 11, 12];

const DEPARTMENTS: { name: string; subjects: string[] }[] = [
  { name: "Mathematics & Sciences", subjects: ["Mathematics", "Physics", "Chemistry", "Biology"] },
  { name: "Languages", subjects: ["English", "Kiswahili"] },
  { name: "Humanities", subjects: ["History", "Geography", "CRE"] },
  { name: "Business", subjects: ["Business"] },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const wavg = (vals: number[], weights: number[]) => {
  const w = weights.reduce((a, b) => a + b, 0);
  return w ? vals.reduce((s, v, i) => s + v * weights[i], 0) / w : 0;
};
const f1 = (n: number) => n.toFixed(1);

function erf(x: number) {
  const s = Math.sign(x); const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const passRate = (mean: number) => (1 - phi((PASS - mean) / SD)) * 100;
const bandShare = (m: number) => {
  const b40 = phi((40 - m) / SD), b50 = phi((50 - m) / SD), b80 = phi((80 - m) / SD);
  return { below: b40, approaching: b50 - b40, meeting: b80 - b50, exceeding: 1 - b80 };
};
const tier = (v: number) => (v >= 75 ? 5 : v >= 65 ? 4 : v >= 55 ? 3 : v >= 45 ? 2 : 1);
const barTone = (v: number) => (v >= 65 ? "hi" : v >= 55 ? "ok" : "lo");

const ICONS: Record<string, string> = {
  chart: "M4 19V5M4 19h16M8 15l4-4 3 3 5-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clip: "M9 4h6v3H9zM7 6H5v14h14V6h-2M9 12h6M9 16h4",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
  print: "M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  trophy: "M8 4h8v5a4 4 0 01-8 0zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M9 20h6",
};
function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* up / down arrow with the change in percentage points. `invert` = lower is better */
function Delta({ v, invert = false, unit = " pts" }: { v: number; invert?: boolean; unit?: string }) {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return <span className="ao-delta flat">– 0{unit}</span>;
  const good = invert ? r < 0 : r > 0;
  return (
    <span className={`ao-delta ${good ? "up" : "down"}`}>
      {r > 0 ? "▲" : "▼"} {r > 0 ? "+" : "−"}{Math.abs(r).toFixed(1)}{unit}
    </span>
  );
}

function Panel({ id, title, aside, children }: { id?: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="ss-card ss-panel ao-panel" aria-labelledby={id ? `${id}-t` : undefined}>
      <header><h3 id={id ? `${id}-t` : undefined}>{title}</h3>{aside}</header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trend chart (inline SVG, no chart library)                          */
/* ------------------------------------------------------------------ */

function TrendChart({ labels, series, focus }: { labels: string[]; series: { grade: Grade; values: number[] }[]; focus: GradeFilter }) {
  const W = 640, H = 240, L = 40, R = 42, T = 14, B = 32;
  const all = series.flatMap((s) => s.values).concat(TARGET);
  const lo = Math.floor(Math.min(...all) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...all) / 5) * 5 + 5;
  const x = (i: number) => L + (i * (W - L - R)) / (labels.length - 1);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 5) ticks.push(t);

  /* end-of-line labels: keep at least 13px apart so G10/G11/G12 never overlap */
  const ends = series.map((s) => ({ grade: s.grade, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  const labelY = (g: Grade) => ends.find((e) => e.grade === g)!.y;

  return (
    <svg className="ao-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Mean score by assessment. ${series.map((s) => `Grade ${s.grade}: ${s.values.map(f1).join(", ")}`).join(". ")}. School target ${TARGET} percent.`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="ao-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="ao-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={l} className="ao-axis" x={x(i)} y={H - 10} textAnchor="middle">{l}</text>
      ))}
      <line className="ao-target" x1={L} x2={W - R} y1={y(TARGET)} y2={y(TARGET)} />
      <text className="ao-axis ao-target-l" x={L + 6} y={y(TARGET) - 6}>Target {TARGET}%</text>
      {series.map((s, si) => {
        const dim = focus !== "all" && focus !== s.grade;
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={s.grade} className={`ao-line ao-s${si + 1}${dim ? " is-dim" : ""}`}>
            <polyline points={pts} />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={i === s.values.length - 1 ? 4.5 : 3.2}>
                <title>{`Grade ${s.grade} · ${labels[i]}: ${f1(v)}%`}</title>
              </circle>
            ))}
            <text x={x(s.values.length - 1) + 10} y={labelY(s.grade) + 4}>G{s.grade}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page content                                                        */
/* ------------------------------------------------------------------ */

type SortKey = "class" | "learners" | "mean" | "change" | "pass" | "attendance" | "marks";

function AcademicOverviewContent({ getTermData = sampleTermData, currentTerm = 2, onNavigate }: Omit<Props, "withShell">) {
  const [term, setTerm] = useState(currentTerm);
  const [grade, setGrade] = useState<GradeFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "mean", dir: -1 });

  const data = useMemo(() => getTermData(term), [getTermData, term]);

  /* one row per class with everything the page needs */
  const rows = useMemo(() => data.classes.map((c, i) => {
    const mean = avg(data.means[i]);
    const prevMean = avg(data.prev[i]);
    const done = data.submitted[i].filter(Boolean).length;
    return {
      ...c, idx: i, mean, prevMean, change: mean - prevMean,
      pass: passRate(mean), attendance: data.attendance[i],
      marks: (done / data.subjects.length) * 100, done,
    };
  }), [data]);

  const visible = rows.filter((r) => grade === "all" || r.grade === grade);
  const learners = visible.map((r) => r.learners);

  /* ---- headline numbers ---- */
  const k = useMemo(() => {
    const mean = wavg(visible.map((r) => r.mean), learners);
    const prevMean = wavg(visible.map((r) => r.prevMean), learners);
    const pass = wavg(visible.map((r) => r.pass), learners);
    const prevPass = wavg(visible.map((r) => passRate(r.prevMean)), learners);
    const below = visible.reduce((s, r) => s + r.learners * bandShare(r.mean).below, 0);
    const prevBelow = visible.reduce((s, r) => s + r.learners * bandShare(r.prevMean).below, 0);
    const total = learners.reduce((a, b) => a + b, 0);
    const sets = visible.length * data.subjects.length;
    const done = visible.reduce((s, r) => s + r.done, 0);
    return { mean, prevMean, pass, prevPass, below: Math.round(below), prevBelow: Math.round(prevBelow), total, sets, done, outstanding: sets - done };
  }, [visible, learners, data.subjects.length]);

  /* ---- subjects ranked by learner-weighted mean ---- */
  const subjects = useMemo(() => data.subjects.map((name, si) => {
    const m = wavg(visible.map((r) => data.means[r.idx][si]), learners);
    const p = wavg(visible.map((r) => data.prev[r.idx][si]), learners);
    return { name, mean: m, change: m - p };
  }).sort((a, b) => b.mean - a.mean), [data, visible, learners]);

  /* ---- performance bands per grade ---- */
  const bandRows = GRADES.map((g) => {
    const rs = rows.filter((r) => r.grade === g);
    const n = rs.reduce((s, r) => s + r.learners, 0);
    const share = { below: 0, approaching: 0, meeting: 0, exceeding: 0 };
    rs.forEach((r) => { const b = bandShare(r.mean); (Object.keys(share) as (keyof typeof share)[]).forEach((key) => { share[key] += (b[key] * r.learners) / n; }); });
    return { grade: g, n, share };
  });

  /* ---- pass rate per grade ---- */
  const passByGrade = GRADES.map((g) => {
    const rs = rows.filter((r) => r.grade === g);
    const w = rs.map((r) => r.learners);
    return { grade: g, pass: wavg(rs.map((r) => r.pass), w), change: wavg(rs.map((r) => r.pass), w) - wavg(rs.map((r) => passRate(r.prevMean)), w) };
  });

  /* ---- marks submission ---- */
  const outstanding = visible.flatMap((r) => data.subjects.map((s, si) => (!data.submitted[r.idx][si] ? { cls: r.id, subject: s } : null)).filter(Boolean) as { cls: string; subject: string }[]);
  const depts = DEPARTMENTS.map((d) => {
    const cols = d.subjects.map((s) => data.subjects.indexOf(s)).filter((i) => i >= 0);
    const total = visible.length * cols.length;
    const done = visible.reduce((s, r) => s + cols.filter((c) => data.submitted[r.idx][c]).length, 0);
    return { name: d.name, done, total, pct: total ? (done / total) * 100 : 100 };
  });

  /* ---- things that need the head's attention ---- */
  const attention = useMemo(() => {
    const items: { id: string; tone: "danger" | "warn" | "info"; text: string; sub: string; to: "heatmap" | "classes" | "marks" }[] = [];
    const drops: { cls: string; subject: string; from: number; to: number }[] = [];
    visible.forEach((r) => data.subjects.forEach((s, si) => {
      const d = data.means[r.idx][si] - data.prev[r.idx][si];
      if (d <= -5) drops.push({ cls: r.id, subject: s, from: data.prev[r.idx][si], to: data.means[r.idx][si] });
    }));
    drops.sort((a, b) => (a.to - a.from) - (b.to - b.from)).slice(0, 2).forEach((d) =>
      items.push({ id: `d-${d.cls}-${d.subject}`, tone: "danger", text: `${d.subject} in ${d.cls} fell ${f1(d.from - d.to)} points`, sub: `From ${f1(d.from)}% to ${f1(d.to)}% since last term`, to: "heatmap" }));
    const low = [...visible].sort((a, b) => a.mean - b.mean)[0];
    if (low && low.mean < 58) items.push({ id: "low", tone: "warn", text: `Class ${low.id} is the lowest at ${f1(low.mean)}%`, sub: `${f1(TARGET - low.mean)} points under the school target of ${TARGET}%`, to: "classes" });
    if (k.outstanding > 0) items.push({ id: "marks", tone: "warn", text: `${k.outstanding} mark ${k.outstanding === 1 ? "set is" : "sets are"} still outstanding`, sub: "Results cannot be finalised until every set is in", to: "marks" });
    const lowAtt = visible.filter((r) => r.attendance < 90).sort((a, b) => a.attendance - b.attendance)[0];
    if (lowAtt) items.push({ id: "att", tone: "warn", text: `Attendance in ${lowAtt.id} is ${f1(lowAtt.attendance)}%`, sub: "Below the 90% expectation", to: "classes" });
    const best = [...subjects].sort((a, b) => b.change - a.change)[0];
    if (best && best.change >= 2) items.push({ id: "up", tone: "info", text: `${best.name} is up ${f1(best.change)} points`, sub: "The biggest improvement across the school this term", to: "heatmap" });
    return items.slice(0, 5);
  }, [visible, data, subjects, k.outstanding]);

  /* ---- sorted class table ---- */
  const sorted = useMemo(() => [...visible].sort((a, b) => {
    const val = (r: typeof a) => ({ class: r.id, learners: r.learners, mean: r.mean, change: r.change, pass: r.pass, attendance: r.attendance, marks: r.marks })[sort.key];
    const va = val(a), vb = val(b);
    return (typeof va === "string" ? (va as string).localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir;
  }), [visible, sort]);

  const setSortKey = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "class" ? 1 : -1 }));
  const aria = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const jump = (to: "heatmap" | "classes" | "marks") => goTo(`ao-${to}`);

  const trendSeries = GRADES.map((g) => ({ grade: g, values: data.trend.byGrade[g] }));
  const bestSubject = subjects[0]?.name, weakestSubject = subjects[subjects.length - 1]?.name;
  /* plain function (not a component) so the header buttons keep keyboard focus after a sort */
  const sortTh = (key: SortKey, label: string, num?: boolean) => (
    <th key={key} scope="col" aria-sort={aria(key)} className={num ? "ss-num" : undefined}>
      <button type="button" className={`ao-sort${sort.key === key ? " is-on" : ""}`} onClick={() => setSortKey(key)}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="ao-page">
      {/* ── Heading + filters ── */}
      <div className="ao-head">
        <div>
          <h2 className="ao-title">Academic overview</h2>
          <p className="ao-sub">How the school is performing this term, where it is improving, and where to step in.</p>
        </div>
        <div className="ao-filters ao-noprint">
          <label className="ss-lab">Term
            <select className="ss-input" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
              <option value={1}>Term 1</option>
              <option value={2}>Term 2{currentTerm === 2 ? " (current)" : ""}</option>
            </select>
          </label>
          <div className="ss-lab">Grade
            <div className="ss-seg ao-seg" role="group" aria-label="Filter by grade">
              {(["all", ...GRADES] as GradeFilter[]).map((g) => (
                <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)}>{g === "all" ? "All" : g}</button>
              ))}
            </div>
          </div>
          <button type="button" className="ss-btn ss-btn-sm" onClick={() => window.print()}><Icon name="print" size={15} /> Print report</button>
        </div>
      </div>

      <div className="ss-chips ao-context">
        <span className="ss-tag">Term {data.term} · {data.year}</span>
        <span className="ss-tag muted">Compared with {data.term === 1 ? "Term 3 last year" : `Term ${data.term - 1}`}</span>
        <span className="ss-tag muted">{visible.length} {visible.length === 1 ? "class" : "classes"} · {k.total} learners</span>
      </div>

      {/* ── KPIs ── */}
      <div className="ss-kpis">
        <div className="ss-card ss-kpi">
          <div className="ss-kpi-label"><Icon name="chart" size={15} /> School mean score</div>
          <b>{f1(k.mean)}%</b>
          <div className="ss-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, k.mean)}%` }} /></div>
          <small><Delta v={k.mean - k.prevMean} /> vs previous term · target {TARGET}%</small>
        </div>
        <div className="ss-card ss-kpi">
          <div className="ss-kpi-label"><Icon name="check" size={15} /> Pass rate (50% and above)</div>
          <b>{Math.round(k.pass)}%</b>
          <div className="ss-bar" aria-hidden="true"><i className="gold" style={{ width: `${Math.min(100, k.pass)}%` }} /></div>
          <small><Delta v={k.pass - k.prevPass} unit=" pts" /> vs previous term</small>
        </div>
        <div className="ss-card ss-kpi">
          <div className="ss-kpi-label"><Icon name="clip" size={15} /> Marks submitted</div>
          <b>{k.sets ? Math.round((k.done / k.sets) * 100) : 0}%</b>
          <div className="ss-bar" aria-hidden="true"><i style={{ width: `${k.sets ? (k.done / k.sets) * 100 : 0}%` }} /></div>
          <small>{k.done} of {k.sets} class-subject sets{k.outstanding ? ` · ${k.outstanding} outstanding` : " · all in"}</small>
        </div>
        <div className="ss-card ss-kpi ao-kpi-risk">
          <div className="ss-kpi-label"><Icon name="alert" size={15} /> Learners below 40%</div>
          <b>{k.below}</b>
          <div className="ss-bar" aria-hidden="true"><i className="risk" style={{ width: `${k.total ? Math.min(100, (k.below / k.total) * 100 * 3) : 0}%` }} /></div>
          <small><Delta v={k.below - k.prevBelow} invert unit="" /> vs previous term · {k.total ? Math.round((k.below / k.total) * 100) : 0}% of learners</small>
        </div>
      </div>

      {/* ── Trend + bands ── */}
      <div className="ss-two">
        <Panel title="Performance trend" aside={<span className="ss-muted">Mean score by assessment</span>}>
          <div className="ao-pad">
            <div className="ao-chart-wrap"><TrendChart labels={data.trend.labels} series={trendSeries} focus={grade} /></div>
            <div className="ao-legend">
              {trendSeries.map((s, i) => <span key={s.grade} className={`ao-key ao-s${i + 1}`}><i />Grade {s.grade}</span>)}
              <span className="ao-key ao-kt"><i />School target {TARGET}%</span>
            </div>
          </div>
        </Panel>

        <Panel title="Performance bands" aside={<span className="ss-muted">Share of learners</span>}>
          <div className="ao-pad">
            <div className="ao-bands">
              {bandRows.map((b) => (
                <div key={b.grade} className={`ao-band-row${grade !== "all" && grade !== b.grade ? " is-dim" : ""}`}>
                  <span className="ao-band-l">Grade {b.grade}<small>{b.n} learners</small></span>
                  <div className="ao-stack" role="img" aria-label={`Grade ${b.grade}: ${Math.round(b.share.exceeding * 100)}% exceeding, ${Math.round(b.share.meeting * 100)}% meeting, ${Math.round(b.share.approaching * 100)}% approaching, ${Math.round(b.share.below * 100)}% below expectation`}>
                    {(["exceeding", "meeting", "approaching", "below"] as const).map((key) => (
                      <i key={key} className={`b-${key}`} style={{ width: `${b.share[key] * 100}%` }}>{b.share[key] >= 0.09 ? `${Math.round(b.share[key] * 100)}%` : ""}</i>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="ao-legend">
              <span className="ao-key"><i className="b-exceeding" />80+ Exceeding</span>
              <span className="ao-key"><i className="b-meeting" />50–79 Meeting</span>
              <span className="ao-key"><i className="b-approaching" />40–49 Approaching</span>
              <span className="ao-key"><i className="b-below" />Below 40</span>
            </div>
            <h4 className="ss-h4 ao-subhead">Pass rate by grade</h4>
            <div className="ao-passrows">
              {passByGrade.map((g) => (
                <div key={g.grade} className={`ao-passrow${grade !== "all" && grade !== g.grade ? " is-dim" : ""}`}>
                  <span>Grade {g.grade}</span>
                  <div className="ss-bar" aria-hidden="true"><i className="gold" style={{ width: `${g.pass}%` }} /></div>
                  <b>{Math.round(g.pass)}%</b>
                  <Delta v={g.change} />
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Subjects + attention ── */}
      <div className="ss-two ao-two-b">
        <Panel title="Subject performance" aside={<span className="ss-muted">Ranked by school mean</span>}>
          <ol className="ao-subjects">
            {subjects.map((s, i) => (
              <li key={s.name}>
                <span className="ao-rank">{i + 1}</span>
                <div className="ao-subj-main">
                  <div className="ao-subj-top">
                    <strong>{s.name}</strong>
                    {s.name === bestSubject && <span className="ss-tag ok">Strongest</span>}
                    {s.name === weakestSubject && <span className="ss-tag warn">Needs support</span>}
                  </div>
                  <div className="ss-bar" aria-hidden="true"><i className={`ao-b-${barTone(s.mean)}`} style={{ width: `${s.mean}%` }} /></div>
                </div>
                <b className="ao-subj-n">{f1(s.mean)}%</b>
                <Delta v={s.change} />
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Needs your attention" aside={<span className="ss-muted">{attention.length} {attention.length === 1 ? "item" : "items"}</span>}>
          {attention.length === 0 ? (
            <p className="ss-empty ao-pad">Nothing needs attention for this selection.</p>
          ) : (
            <ul className="ss-alerts ao-alerts">
              {attention.map((a) => (
                <li key={a.id} className={`tone-${a.tone}`}>
                  <Icon name={a.tone === "info" ? "trophy" : "alert"} size={17} />
                  <span><strong>{a.text}</strong><small>{a.sub}</small></span>
                  <button type="button" className="ss-link-btn ao-noprint" onClick={() => jump(a.to)}>View <Icon name="arrow" size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Heatmap ── */}
      <Panel id="ao-heatmap" title="Class by subject" aside={<span className="ss-muted">Mean score % · arrows show change from last term</span>}>
        <div className="ao-pad">
          <div className="ss-scroll ao-scroll">
            <table className="ao-heat">
              <caption className="ss-sr">Mean score by class and subject</caption>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  {data.subjects.map((s) => <th key={s} scope="col" className="ss-num"><span>{s}</span></th>)}
                  <th scope="col" className="ss-num">Mean</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.id}</th>
                    {data.subjects.map((s, si) => {
                      const v = data.means[r.idx][si], d = v - data.prev[r.idx][si];
                      return (
                        <td key={s} className={`t${tier(v)}`} title={`${s} · ${r.id}: ${f1(v)}% (${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} vs last term)`}>
                          {Math.round(v)}
                          {Math.abs(d) >= 4 && <em className={d > 0 ? "up" : "down"} aria-label={d > 0 ? "up" : "down"}>{d > 0 ? "▲" : "▼"}</em>}
                        </td>
                      );
                    })}
                    <td className={`ao-heat-mean t${tier(r.mean)}`}>{f1(r.mean)}</td>
                  </tr>
                ))}
                <tr className="ao-heat-foot">
                  <th scope="row">School</th>
                  {data.subjects.map((s) => { const m = subjects.find((x) => x.name === s)!.mean; return <td key={s}>{Math.round(m)}</td>; })}
                  <td>{f1(k.mean)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="ao-legend ao-scale">
            <span className="ao-key"><i className="t1" />Below 45</span>
            <span className="ao-key"><i className="t2" />45–54</span>
            <span className="ao-key"><i className="t3" />55–64</span>
            <span className="ao-key"><i className="t4" />65–74</span>
            <span className="ao-key"><i className="t5" />75+</span>
            <span className="ao-key"><em className="down">▼</em>/<em className="up">▲</em> change of 4 pts or more</span>
          </div>
        </div>
      </Panel>

      {/* ── Classes ── */}
      <Panel id="ao-classes" title="Classes" aside={<span className="ss-muted">Select a heading to sort</span>}>
        <div className="ao-pad">
          <div className="ss-scroll ao-scroll">
            <table className="ss-table ao-table">
              <caption className="ss-sr">Class results summary</caption>
              <thead>
                <tr>
                  {sortTh("class", "Class")}
                  {sortTh("learners", "Learners", true)}
                  {sortTh("mean", "Mean")}
                  {sortTh("change", "Change", true)}
                  {sortTh("pass", "Pass rate", true)}
                  {sortTh("attendance", "Attendance", true)}
                  {sortTh("marks", "Marks in")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Class"><strong>{r.id}</strong><small>{r.teacher}</small></td>
                    <td data-label="Learners" className="ss-num">{r.learners}</td>
                    <td data-label="Mean">
                      <div className="ao-meancell"><div className="ss-bar sm" aria-hidden="true"><i className={`ao-b-${barTone(r.mean)}`} style={{ width: `${r.mean}%` }} /></div><b>{f1(r.mean)}%</b></div>
                    </td>
                    <td data-label="Change" className="ss-num"><Delta v={r.change} /></td>
                    <td data-label="Pass rate" className="ss-num">{Math.round(r.pass)}%</td>
                    <td data-label="Attendance" className={`ss-num${r.attendance < 90 ? " ao-low" : ""}`}>{f1(r.attendance)}%</td>
                    <td data-label="Marks in">
                      {r.done === data.subjects.length
                        ? <span className="ss-tag ok">Complete</span>
                        : <span className="ss-tag warn">{r.done}/{data.subjects.length} subjects</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {/* ── Marks submission ── */}
      <Panel id="ao-marks" title="Marks submission" aside={<span className="ss-muted">{k.outstanding === 0 ? "Every set is in" : `${k.outstanding} outstanding`}</span>}>
        <div className="ao-pad ao-marks">
          <div className="ao-depts">
            <h4 className="ss-h4">By department</h4>
            {depts.map((d) => (
              <div key={d.name} className="ao-dept">
                <div className="ao-dept-top"><span>{d.name}</span><b>{d.done}/{d.total}</b></div>
                <div className="ss-bar" aria-hidden="true"><i className={d.pct === 100 ? "gold" : ""} style={{ width: `${d.pct}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="ao-out">
            <h4 className="ss-h4">Still to enter</h4>
            {outstanding.length === 0 ? (
              <p className="ss-empty">Nothing outstanding. Results can be finalised.</p>
            ) : (
              <>
                <div className="ss-chips">
                  {outstanding.slice(0, 8).map((o) => <span key={o.cls + o.subject} className="ss-tag warn">{o.subject} · {o.cls}</span>)}
                  {outstanding.length > 8 && <span className="ss-tag muted">+{outstanding.length - 8} more</span>}
                </div>
                <p className="ss-note">Teachers are reminded from the marks page. Results can be released once every set is in.</p>
              </>
            )}
            {onNavigate && <button type="button" className="ss-btn ss-btn-primary ss-btn-sm ao-noprint ao-go" onClick={() => onNavigate("results")}>Open results <Icon name="arrow" size={14} /></button>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Default export: the page with its sidebar and header                */
/* ------------------------------------------------------------------ */

function AcademicOverview({ withShell = true, onNavigate, ...rest }: Props) {
  const navigate = useNavigate();
  const go = onNavigate ?? (() => navigate("/Results/View/Results"));
  const content = <AcademicOverviewContent {...rest} onNavigate={go} />;
  return withShell ? <Shell title="Academic Overview">{content}</Shell> : <><style>{STYLES}</style>{content}</>;
}

export default AcademicOverview;

/** Optional: use as the element for sidebar links whose pages are not built yet. */
export function ComingSoon() {
  const { pathname } = useLocation();
  return (
    <Shell title="Coming soon">
      <div style={{ maxWidth: 520, margin: "10vh auto", textAlign: "center" }}>
        <h2>This page is not built yet</h2>
        <p style={{ color: "var(--ink-2)" }}>The link works. Replace this route with the real page when it is ready.</p>
        <code>{pathname}</code>
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Sample data. Deterministic, so the page looks the same on every load.
   Replace with a call to your API that returns a TermData.
   ========================================================================== */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_SUBJECTS = ["Mathematics", "English", "Kiswahili", "Physics", "Chemistry", "Biology", "History", "Geography", "Business", "CRE"];
const SAMPLE_BASE = [58, 66, 63, 52, 55, 60, 67, 64, 66, 72];
const SAMPLE_CLASSES: ClassRow[] = [
  { id: "10A", grade: 10, teacher: "Ms. Achieng", learners: 44 },
  { id: "10B", grade: 10, teacher: "Mr. Kamau", learners: 42 },
  { id: "11A", grade: 11, teacher: "Ms. Wanjiru", learners: 40 },
  { id: "11B", grade: 11, teacher: "Mr. Otieno", learners: 40 },
  { id: "12A", grade: 12, teacher: "Mrs. Mwangi", learners: 38 },
  { id: "12B", grade: 12, teacher: "Mr. Kiptoo", learners: 36 },
];
const GRADE_ADJ: Record<Grade, number> = { 10: 2, 11: 0, 12: -2 };
const CLASS_ADJ = [1.5, -1, 2, -2, 3, -0.5];
const CURRENT = 2;

function sampleMeans(term: number): number[][] {
  return SAMPLE_CLASSES.map((c, ci) => SAMPLE_SUBJECTS.map((s, si) => {
    let v = SAMPLE_BASE[si] + GRADE_ADJ[c.grade] + CLASS_ADJ[ci] + term * 0.9 + (rng(1000 + ci * 97 + si * 13 + term * 7919)() - 0.5) * 8;
    if (c.id === "11B" && s === "Chemistry" && term >= 2) v -= 9;
    if (c.id === "12A" && s === "Mathematics" && term >= 2) v += 5;
    if (c.id === "10B" && s === "English" && term >= 2) v -= 6;
    return Math.round(Math.max(28, Math.min(92, v)) * 10) / 10;
  }));
}

function sampleTermData(term: number): TermData {
  const means = sampleMeans(term);
  const prev = sampleMeans(term - 1);
  const gradeMean = (m: number[][], g: Grade) => {
    const idx = SAMPLE_CLASSES.map((c, i) => (c.grade === g ? i : -1)).filter((i) => i >= 0);
    return wavg(idx.map((i) => avg(m[i])), idx.map((i) => SAMPLE_CLASSES[i].learners));
  };
  const labels = ["Opener", "CAT 1", "Mid-term", "CAT 2", "End of term"];
  const byGrade = {} as Record<Grade, number[]>;
  GRADES.forEach((g, gi) => {
    const from = gradeMean(prev, g), to = gradeMean(means, g);
    byGrade[g] = labels.map((_, i) => {
      const base = from + ((to - from) * i) / (labels.length - 1);
      const noise = i === labels.length - 1 ? 0 : (rng(77 + gi * 11 + i * 5 + term)() - 0.5) * 3;
      return Math.round((base + noise) * 10) / 10;
    });
  });
  return {
    term, year: 2026, classes: SAMPLE_CLASSES, subjects: SAMPLE_SUBJECTS, means, prev,
    attendance: SAMPLE_CLASSES.map((c, i) => Math.round((c.id === "11B" ? 87.6 : 91 + rng(300 + i + term)() * 6) * 10) / 10),
    submitted: SAMPLE_CLASSES.map((_, ci) => SAMPLE_SUBJECTS.map((__, si) => (term === CURRENT ? rng(500 + ci * 31 + si)() > 0.13 : true))),
    trend: { labels, byGrade },
  };
}

/* ==========================================================================
   Styles (sidebar, header and page). Injected by the <style> tag above.
   ========================================================================== */

