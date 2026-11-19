import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface AssessmentInfo {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
}

export interface ProgressLearner {
  id: string;
  name: string;
  admNo: string;
  /** Percentage score per assessment, same order as the class's assessments. null = absent or not marked. */
  scores: (number | null)[];
}

export interface ProgressClass {
  id: string;
  name: string;
  subject: string;
  assessments: AssessmentInfo[]; // oldest first
  learners: ProgressLearner[];
}

export interface ExportEvent {
  format: "csv" | "print";
  scope: "class" | "all";
  classId: string;
  learners: number;
}

export interface TeacherUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface ProgressRecordsProps {
  data?: ProgressClass[];
  user?: TeacherUser;
  theme?: "light" | "dark";
  /** Optional hook, for example to log exports. Called after the file is created or the print dialog opens. */
  onExport?: (event: ExportEvent) => void;
  /** Optional. If omitted, react-router's navigate() is used. */
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
}

/* ------------------------------------------------------------------ */
/* Routes (same object as the other teacher pages)                     */
/* ------------------------------------------------------------------ */

const ROUTE = {
  dashboard: "/Teacher/Dashboard",
  classes: "/Academics/classes",
  students: "/Students",
  attendance: "/Academics/Attendance",
  marks: "/Results/Upload/Results",
  results: "/Results/View/Results",
  progress: "/Academics/Progress",
  timetable: "/Academics/Timetable",
  materials: "/Academic/LearningMaterials",
  upload: "/Upload/LearningMaterial",
  generate: "/AI/Chat",
  tutor: "/AI/Chat",
  announcements: "/Announcements",
} as const;

/* ------------------------------------------------------------------ */
/* Rules for trend and attention (change these to suit your school)    */
/* ------------------------------------------------------------------ */

const TREND_STEP = 3; // points gained or lost over the last 3 scored assessments to count as improving or declining
const DROP_ALERT = 8; // a drop of this many points flags the learner as needing attention
const LOW_MARK = 40; // a latest score below this flags the learner as needing attention

/* ------------------------------------------------------------------ */
/* Sample data (replace with API results)                              */
/* ------------------------------------------------------------------ */

const ASSESSMENTS: AssessmentInfo[] = [
  { id: "a1", name: "T2 Exam", date: "2026-08-14" },
  { id: "a2", name: "CAT 1", date: "2026-09-09" },
  { id: "a3", name: "Mid-term", date: "2026-09-30" },
  { id: "a4", name: "CAT 2", date: "2026-10-28" },
  { id: "a5", name: "CAT 3", date: "2026-11-16" },
];

const SAMPLE: ProgressClass[] = [
  {
    id: "11A",
    name: "Grade 11A",
    subject: "Mathematics",
    assessments: ASSESSMENTS,
    learners: [
      { id: "s1", name: "Achieng Otieno", admNo: "1021", scores: [72, 75, 78, 80, 84] },
      { id: "s2", name: "Brian Kiptoo", admNo: "1022", scores: [48, 45, 41, 38, 35] },
      { id: "s3", name: "Cynthia Mwende", admNo: "1023", scores: [61, 63, 62, 64, 63] },
      { id: "s4", name: "Daniel Njoroge", admNo: "1024", scores: [55, 58, 60, 66, 70] },
      { id: "s5", name: "Esther Wambui", admNo: "1025", scores: [40, 44, 43, 47, 52] },
      { id: "s6", name: "Felix Mutua", admNo: "1026", scores: [63, 64, null, 66, 65] },
    ],
  },
  {
    id: "11B",
    name: "Grade 11B",
    subject: "Mathematics",
    assessments: ASSESSMENTS,
    learners: [
      { id: "s7", name: "Grace Akinyi", admNo: "1051", scores: [70, 66, 68, 65, 62] },
      { id: "s8", name: "Hassan Ali", admNo: "1052", scores: [55, 54, 56, 55, 55] },
      { id: "s9", name: "Irene Chebet", admNo: "1053", scores: [38, 35, 36, 33, 30] },
      { id: "s10", name: "James Maina", admNo: "1054", scores: [60, 58, 62, 64, 68] },
    ],
  },
  {
    id: "12A",
    name: "Grade 12A",
    subject: "Physics",
    assessments: ASSESSMENTS,
    learners: [
      { id: "s11", name: "Kevin Omondi", admNo: "0981", scores: [66, 68, 70, 71, 74] },
      { id: "s12", name: "Lucy Nyambura", admNo: "0982", scores: [58, 60, 61, 61, 62] },
      { id: "s13", name: "Mark Kariuki", admNo: "0983", scores: [72, 70, 66, 63, 60] },
      { id: "s14", name: "Naomi Jepkoech", admNo: "0984", scores: [null, null, 45, 52, 58] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Analysis helpers                                                    */
/* ------------------------------------------------------------------ */

type Trend = "up" | "steady" | "down" | "new";
type Filter = "all" | "up" | "steady" | "down" | "attention";
type SortKey = "name" | "latest" | "change" | "attention";

interface Row extends ProgressLearner {
  latest: number | null;
  delta: number | null; // change over the last 3 scored assessments
  trend: Trend;
  attention: boolean;
}

const TREND_LABEL: Record<Trend, string> = { up: "Improving", steady: "Steady", down: "Declining", new: "New" };
const FILTER_LABEL: Record<Filter, string> = { all: "All learners", up: "Improving", steady: "Steady", down: "Declining", attention: "Needs attention" };
const SORT_LABEL: Record<SortKey, string> = {
  name: "Learner name",
  latest: "Highest latest score",
  change: "Biggest improvement",
  attention: "Needs attention first",
};

function analyse(l: ProgressLearner): Row {
  const scored = l.scores.filter((s): s is number => s !== null);
  const latest = scored.length ? scored[scored.length - 1] : null;
  if (latest === null || scored.length < 2) {
    return { ...l, latest, delta: null, trend: "new", attention: latest !== null && latest < LOW_MARK };
  }
  const ref = scored[Math.max(0, scored.length - 3)];
  const delta = latest - ref;
  const trend: Trend = delta >= TREND_STEP ? "up" : delta <= -TREND_STEP ? "down" : "steady";
  return { ...l, latest, delta, trend, attention: latest < LOW_MARK || delta <= -DROP_ALERT };
}

function sortRows(rows: Row[], sort: SortKey): Row[] {
  const r = [...rows];
  r.sort((a, b) => {
    if (sort === "latest") return (b.latest ?? -1) - (a.latest ?? -1);
    if (sort === "change") return (b.delta ?? -999) - (a.delta ?? -999);
    if (sort === "attention") {
      if (a.attention !== b.attention) return a.attention ? -1 : 1;
      return (a.latest ?? 101) - (b.latest ?? 101);
    }
    return a.name.localeCompare(b.name);
  });
  return r;
}

function classMeans(c: ProgressClass): (number | null)[] {
  return c.assessments.map((_, i) => {
    const xs = c.learners.map((l) => l.scores[i]).filter((s): s is number => s !== null && s !== undefined);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  });
}

const tone = (score: number) => (score >= 70 ? "a" : score >= 50 ? "b" : score >= 40 ? "c" : "d");
const signed = (d: number) => `${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}`;

type Kind = "up" | "down" | "flat";
function change(d: number, unit = ""): { kind: Kind; label: string } {
  const r = Math.round(d * 10) / 10;
  if (r > 0) return { kind: "up", label: `Up ${r}${unit}` };
  if (r < 0) return { kind: "down", label: `Down ${Math.abs(r)}${unit}` };
  return { kind: "flat", label: "No change" };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const longDate = (d: Date) => d.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

/** Quotes a CSV cell. Text starting with = + - @ is prefixed so spreadsheets never run it as a formula. */
function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvLine = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");

function csvBlock(c: ProgressClass, rows: Row[], stamp: string, filterNote?: string): string {
  const means = classMeans(c);
  const lastMean = [...means].reverse().find((m): m is number => m !== null);
  const lines: string[] = [
    csvLine(["Progress records"]),
    csvLine(["Class", c.name]),
    csvLine(["Subject", c.subject]),
    csvLine(["Exported", stamp]),
  ];
  if (filterNote) lines.push(csvLine(["Filter", filterNote]));
  lines.push("");
  lines.push(csvLine(["Adm No", "Learner", ...c.assessments.map((a) => `${a.name} (${a.date})`), "Latest", `Change (last 3, pts)`, "Trend", "Needs attention"]));
  rows.forEach((r) => {
    lines.push(
      csvLine([
        r.admNo,
        r.name,
        ...c.assessments.map((_, i) => r.scores[i] ?? ""),
        r.latest ?? "",
        r.delta === null ? "" : Math.round(r.delta * 10) / 10,
        TREND_LABEL[r.trend],
        r.attention ? "Yes" : "No",
      ]),
    );
  });
  lines.push(csvLine(["", "Class mean", ...means.map((m) => m ?? ""), lastMean ?? "", "", "", ""]));
  return lines.join("\r\n");
}

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "class";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard"
  | "classes"
  | "students"
  | "attendance"
  | "marks"
  | "results"
  | "progress"
  | "timetable"
  | "materials"
  | "upload"
  | "generate"
  | "tutor"
  | "announcements"
  | "settings"
  | "bell"
  | "search"
  | "logout"
  | "chevron"
  | "menu"
  | "close"
  | "download"
  | "print";

const ICON_PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  classes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M17 14.5c2.5 0 4.5 1.5 4.5 4.5" />
    </>
  ),
  students: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  attendance: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
    </>
  ),
  marks: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3" />,
  results: <path d="M5 20V11M12 20V4M19 20v-6" />,
  progress: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  timetable: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  materials: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  upload: <path d="M12 20V9M7 13l5-5 5 5M5 4h14" />,
  generate: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  tutor: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />
    </>
  ),
  announcements: (
    <>
      <path d="M4 10v4h3l8 4V6L7 10H4z" />
      <path d="M18.5 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </>
  ),
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  print: (
    <>
      <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </>
  ),
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: IconName;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function buildMenu(): NavGroup[] {
  return [
    {
      group: "Overview",
      items: [{ key: "dashboard", label: "Dashboard", route: ROUTE.dashboard, icon: "dashboard" }],
    },
    {
      group: "Class management",
      items: [
        { key: "classes", label: "My classes", route: ROUTE.classes, icon: "classes" },
        { key: "students", label: "Learners", route: ROUTE.students, icon: "students" },
        { key: "attendance", label: "Attendance", route: ROUTE.attendance, icon: "attendance" },
      ],
    },
    {
      group: "Assessment",
      items: [
        { key: "marks-entry", label: "Upload marks", route: ROUTE.marks, icon: "marks" },
        { key: "results", label: "View marks", route: ROUTE.results, icon: "results" },
        { key: "progress", label: "Progress records", route: ROUTE.progress, icon: "progress" },
      ],
    },
    {
      group: "Teaching",
      items: [
        { key: "timetable", label: "Timetable", route: ROUTE.timetable, icon: "timetable" },
        { key: "materials", label: "Learning materials", route: ROUTE.materials, icon: "materials" },
        { key: "materials-upload", label: "Upload learning materials", route: ROUTE.upload, icon: "upload" },
        { key: "ai-tools", label: "Generate learning material", route: ROUTE.generate, icon: "generate" },
      ],
    },
    {
      group: "AI",
      items: [{ key: "ai-tutor", label: "AI Mwalimu", route: ROUTE.tutor, icon: "tutor" }],
    },
    {
      group: "Communication",
      items: [{ key: "announcements", label: "Announcements", route: ROUTE.announcements, icon: "announcements" }],
    },
  ];
}

function Sidebar({
  menu,
  user,
  open,
  activeKey,
  onClose,
  onGo,
}: {
  menu: NavGroup[];
  user: TeacherUser;
  open: boolean;
  activeKey: string;
  onClose: () => void;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <aside id="teacher-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className="ss-logo" aria-hidden="true">
          <strong>SP</strong>
        </span>
        <div className="ss-brand-text">
          <strong>Senior School</strong>
          <em>Teacher</em>
          <small>PORTAL</small>
        </div>
        <button type="button" className="ss-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="ss-nav" aria-label="Teacher navigation">
        {menu.map((group) => (
          <div className="ss-group" key={group.group}>
            <p className="ss-group-label">{group.group}</p>
            {group.items.map((item) => {
              const active = item.key === activeKey;
              return (
                <a
                  key={item.key}
                  href={item.route}
                  className={`ss-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                    onGo(item.route, item.key);
                  }}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ss-side-foot">
        {user.name} · {user.roleLabel}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({
  title,
  dateLabel,
  user,
  action,
  onOpenMenu,
  onSearch,
  onGo,
  onLogout,
}: {
  title: string;
  dateLabel: string;
  user: TeacherUser;
  action: { label: string; onClick: () => void; disabled?: boolean };
  onOpenMenu: () => void;
  onSearch: (q: string) => void;
  onGo: (route: string, key: string) => void;
  onLogout?: () => void;
}) {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(q.trim());
  };

  return (
    <header className="ss-header">
      <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="teacher-sidebar" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      <div className="ss-h-title">
        <h1>{title}</h1>
        <span>{dateLabel}</span>
      </div>

      <form className="ss-h-search" role="search" onSubmit={submit}>
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search learners in this class"
          aria-label="Search learners"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onSearch(e.target.value.trim());
          }}
        />
      </form>

      <div className="ss-h-actions">
        <button type="button" className="ss-h-icon" aria-label="Notifications" onClick={() => onGo("/notifications", "notifications")}>
          <Icon name="bell" />
        </button>
        <button type="button" className="ss-h-primary" onClick={action.onClick} disabled={action.disabled} style={action.disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
          <Icon name="download" size={16} />
          <span>{action.label}</span>
        </button>

        <div
          className="ss-h-user"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false);
          }}
        >
          <button type="button" className="ss-h-userbtn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <span className="ss-h-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}</span>
            <span className="ss-h-who">
              <strong>{user.name}</strong>
              <small>{user.roleLabel}</small>
            </span>
            <Icon name="chevron" size={14} />
          </button>
          {menu ? (
            <div className="ss-h-menu" role="menu" onMouseDown={(e) => e.preventDefault()}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onGo("/profile", "profile");
                }}
              >
                <Icon name="students" size={16} />
                My profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onGo("/settings", "settings");
                }}
              >
                <Icon name="settings" size={16} />
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="ss-h-danger"
                onClick={() => {
                  setMenu(false);
                  onLogout?.();
                }}
              >
                <Icon name="logout" size={16} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function Sparkline({ points, label }: { points: (number | null)[]; label: string }) {
  const vals = points.filter((p): p is number => p !== null);
  if (vals.length < 2) return <span className="pr-miss">n/a</span>;
  const W = 120;
  const H = 36;
  const P = 4;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => P + (i * (W - 2 * P)) / (vals.length - 1);
  const y = (v: number) => (hi === lo ? H / 2 : H - P - ((v - lo) / (hi - lo)) * (H - 2 * P));
  const last = vals.length - 1;
  return (
    <svg className="ss-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <polyline points={vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
      <circle cx={x(last)} cy={y(vals[last])} r="3" />
    </svg>
  );
}

function TrendChart({ labels, means }: { labels: string[]; means: (number | null)[] }) {
  const W = 640;
  const H = 230;
  const L = 38;
  const R = 18;
  const T = 22;
  const B = 36;
  const vals = means.filter((m): m is number => m !== null);
  if (!vals.length) return <p className="ss-empty">No scores recorded yet.</p>;

  const lo = Math.max(0, Math.floor(Math.min(...vals) / 10) * 10 - 10);
  const hi = Math.min(100, Math.ceil(Math.max(...vals) / 10) * 10 + 10);
  const x = (i: number) => (means.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (means.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, Math.round(lo + (hi - lo) / 2), hi];

  const pts: { x: number; y: number; m: number }[] = [];
  means.forEach((m, i) => {
    if (m !== null) pts.push({ x: x(i), y: y(m), m });
  });

  const summary = means.map((m, i) => `${labels[i]} ${m === null ? "no data" : `${m}%`}`).join(", ");

  return (
    <svg className="pr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Class mean by assessment: ${summary}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="pr-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="pr-axis" x={L - 8} y={y(t) + 4} textAnchor="end">
            {t}%
          </text>
        </g>
      ))}
      <polyline className="pr-line" points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle className="pr-pt" cx={p.x} cy={p.y} r="4.5" />
          <text className="pr-pt-l" x={p.x} y={p.y - 11} textAnchor="middle">
            {p.m}
          </text>
        </g>
      ))}
      {labels.map((lab, i) => (
        <text key={i} className="pr-axis" x={x(i)} y={H - 12} textAnchor="middle">
          {lab}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProgressRecords({ data = SAMPLE, user, theme = "light", onExport, onNavigate, onLogout }: ProgressRecordsProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialClass = data.find((c) => c.id === params.get("class"))?.id ?? data[0]?.id ?? "";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [classId, setClassId] = useState(initialClass);
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [allClasses, setAllClasses] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const me: TeacherUser = user ?? { name: "Teacher", roleLabel: "Subject teacher" };
  const go = (route: string, key: string) => {
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  const cls = data.find((c) => c.id === classId) ?? null;
  const analysed = useMemo(() => (cls ? cls.learners.map(analyse) : []), [cls]);
  const means = useMemo(() => (cls ? classMeans(cls) : []), [cls]);

  const counts = useMemo(
    () => ({
      all: analysed.length,
      up: analysed.filter((r) => r.trend === "up").length,
      steady: analysed.filter((r) => r.trend === "steady").length,
      down: analysed.filter((r) => r.trend === "down").length,
      attention: analysed.filter((r) => r.attention).length,
    }),
    [analysed],
  );

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => {
    const filtered = analysed.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term) && !r.admNo.includes(term)) return false;
      if (filter === "all") return true;
      if (filter === "attention") return r.attention;
      return r.trend === filter;
    });
    return sortRows(filtered, sort);
  }, [analysed, term, filter, sort]);

  /* Latest class mean and the one before it */
  const scoredIdx = means.map((m, i) => (m === null ? -1 : i)).filter((i) => i >= 0);
  const lastIdx = scoredIdx.length ? scoredIdx[scoredIdx.length - 1] : -1;
  const prevIdx = scoredIdx.length > 1 ? scoredIdx[scoredIdx.length - 2] : -1;
  const latestMean = lastIdx >= 0 ? (means[lastIdx] as number) : null;
  const prevMean = prevIdx >= 0 ? (means[prevIdx] as number) : null;
  const meanChange = latestMean !== null && prevMean !== null ? change(latestMean - prevMean, " pts") : null;

  const changeSelectClass = (id: string) => {
    setClassId(id);
    setFilter("all");
    setNotice(null);
    setParams({ class: id }, { replace: true });
  };

  /* Export */
  const exportCsv = () => {
    const stamp = todayISO();
    const targets = allClasses ? data : cls ? [cls] : [];
    if (!targets.length) return;

    const blocks: string[] = [];
    let learnersOut = 0;
    targets.forEach((c) => {
      const rows = !allClasses && cls && c.id === cls.id ? visible : sortRows(c.learners.map(analyse), "name");
      const filterNote = !allClasses && (filter !== "all" || term) ? `${FILTER_LABEL[filter]}${term ? `, search "${q.trim()}"` : ""}` : undefined;
      blocks.push(csvBlock(c, rows, stamp, filterNote));
      learnersOut += rows.length;
    });

    const filename = allClasses ? `progress-records-all-classes-${stamp}.csv` : `progress-records-${slug(cls?.id ?? "class")}-${stamp}.csv`;
    downloadCsv(filename, blocks.join("\r\n\r\n"));
    setNotice(`Downloaded ${filename} with ${learnersOut} ${learnersOut === 1 ? "learner" : "learners"}. It opens in Excel and Google Sheets.`);
    onExport?.({ format: "csv", scope: allClasses ? "all" : "class", classId: cls?.id ?? "", learners: learnersOut });
  };

  const printPage = () => {
    onExport?.({ format: "print", scope: "class", classId: cls?.id ?? "", learners: visible.length });
    window.print();
  };

  const menu = useMemo(() => buildMenu(), []);
  const now = new Date();

  const splitRows: { t: Trend; n: number }[] = [
    { t: "up", n: counts.up },
    { t: "steady", n: counts.steady },
    { t: "down", n: counts.down },
  ];

  const chips: { key: Filter; n: number }[] = [
    { key: "all", n: counts.all },
    { key: "up", n: counts.up },
    { key: "steady", n: counts.steady },
    { key: "down", n: counts.down },
    { key: "attention", n: counts.attention },
  ];

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} user={me} open={sidebarOpen} activeKey="progress" onClose={() => setSidebarOpen(false)} onGo={go} />
      <div className={`ss-scrim${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <Header
          title="Progress records"
          dateLabel={longDate(now)}
          user={me}
          action={{ label: "Export CSV", onClick: exportCsv, disabled: !cls }}
          onOpenMenu={() => setSidebarOpen(true)}
          onSearch={setQ}
          onGo={go}
          onLogout={onLogout}
        />

        <main className="ss-content" id="main">
          <div className="ss-sec-head pr-noprint">
            <h2>Progress records</h2>
            <p>See how each class and learner is moving across assessments, then export the records.</p>
          </div>

          {/* Shown on paper only */}
          {cls ? (
            <div className="pr-printhead">
              <h2>Progress records</h2>
              <p>
                {cls.name} · {cls.subject} · {me.name} · Printed {longDate(now)}
                {filter !== "all" || term ? ` · Showing: ${FILTER_LABEL[filter]}${term ? `, search "${q.trim()}"` : ""}` : ""}
              </p>
            </div>
          ) : null}

          {!cls ? (
            <div className="ss-card pr-empty">
              <Icon name="progress" size={28} />
              <h3>No classes assigned</h3>
              <p>When you are assigned classes, their progress records appear here.</p>
              <button type="button" className="ss-btn" onClick={() => go(ROUTE.classes, "classes")}>
                Go to My classes
              </button>
            </div>
          ) : (
            <>
              {/* Controls and export */}
              <section className="ss-card pr-controls pr-noprint" aria-label="Class and export options">
                <label className="ss-lab">
                  Class
                  <select className="ss-input" value={classId} onChange={(e) => changeSelectClass(e.target.value)}>
                    {data.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.subject}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ss-lab">
                  Sort learners by
                  <select className="ss-input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pr-export">
                  <span className="pr-export-label">Export</span>
                  <div className="pr-export-btns">
                    <button type="button" className="ss-btn ss-btn-primary" onClick={exportCsv}>
                      <Icon name="download" size={16} />
                      Download CSV
                    </button>
                    <button type="button" className="ss-btn" onClick={printPage}>
                      <Icon name="print" size={16} />
                      Print / Save PDF
                    </button>
                  </div>
                  <label className="pr-check">
                    <input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} />
                    Include all my classes in the CSV
                  </label>
                </div>
              </section>

              {notice ? (
                <p className="ss-sent pr-noprint" role="status">
                  {notice}
                </p>
              ) : null}

              {/* Summary */}
              <section className="ss-kpis" aria-label="Summary">
                <article className="ss-card ss-kpi">
                  <span className="ss-kpi-label">
                    <Icon name="results" size={16} /> Class mean
                  </span>
                  <b>{latestMean === null ? "n/a" : `${latestMean}%`}</b>
                  {meanChange ? <small className={`ss-result-change ${meanChange.kind}`}>{meanChange.label} on the previous assessment</small> : <small>{lastIdx >= 0 ? cls.assessments[lastIdx].name : "No scores yet"}</small>}
                </article>
                <article className="ss-card ss-kpi">
                  <span className="ss-kpi-label">
                    <Icon name="progress" size={16} /> Improving
                  </span>
                  <b>{counts.up}</b>
                  <small>of {counts.all} learners</small>
                </article>
                <article className="ss-card ss-kpi">
                  <span className="ss-kpi-label">
                    <Icon name="chevron" size={16} /> Declining
                  </span>
                  <b>{counts.down}</b>
                  <small>of {counts.all} learners</small>
                </article>
                <article className="ss-card ss-kpi">
                  <span className="ss-kpi-label">
                    <Icon name="bell" size={16} /> Needs attention
                  </span>
                  <b>{counts.attention}</b>
                  <small>
                    Below {LOW_MARK}% or down {DROP_ALERT}+ pts
                  </small>
                </article>
              </section>

              {/* Chart and trend split */}
              <div className="ss-two">
                <section className="ss-card ss-panel" aria-labelledby="pr-chart-title">
                  <header>
                    <h3 id="pr-chart-title">Class mean by assessment</h3>
                    <span className="ss-count">{cls.name}</span>
                  </header>
                  <div className="ss-pbody">
                    <TrendChart labels={cls.assessments.map((a) => a.name)} means={means} />
                  </div>
                </section>

                <section className="ss-card ss-panel" aria-labelledby="pr-split-title">
                  <header>
                    <h3 id="pr-split-title">Learner trends</h3>
                    <span className="ss-count">Last 3 assessments</span>
                  </header>
                  <div className="ss-pbody pr-split">
                    {splitRows.map((s) => (
                      <div className="pr-split-row" data-t={s.t} key={s.t}>
                        <span>{TREND_LABEL[s.t]}</span>
                        <div className="ss-bar" role="progressbar" aria-valuenow={s.n} aria-valuemin={0} aria-valuemax={counts.all} aria-label={`${TREND_LABEL[s.t]} learners`}>
                          <i style={{ width: `${counts.all ? (s.n / counts.all) * 100 : 0}%` }} />
                        </div>
                        <b>{s.n}</b>
                      </div>
                    ))}
                    <p className="ss-note">A learner is improving or declining when their score moves by {TREND_STEP}+ points over their last three scored assessments.</p>
                  </div>
                </section>
              </div>

              {/* Filters */}
              <div className="pr-filters pr-noprint" role="group" aria-label="Filter learners">
                {chips.map((c) => (
                  <button key={c.key} type="button" className={`pr-chip${filter === c.key ? " is-on" : ""}`} aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                    {FILTER_LABEL[c.key]}
                    <b>{c.n}</b>
                  </button>
                ))}
              </div>

              {/* Learner table */}
              <section className="ss-card ss-panel" aria-labelledby="pr-table-title">
                <header>
                  <h3 id="pr-table-title">
                    {cls.name} · {cls.subject}
                  </h3>
                  <span className="ss-count" role="status">
                    Showing {visible.length} of {counts.all}
                  </span>
                </header>
                <div className="ss-pbody">
                  <div className="ss-scroll pr-scroll">
                    <table className="ss-table pr-table">
                      <thead>
                        <tr>
                          <th>Learner</th>
                          {cls.assessments.map((a) => (
                            <th key={a.id} className="ss-num">
                              {a.name}
                              <small className="pr-th-date">{shortDate(a.date)}</small>
                            </th>
                          ))}
                          <th className="ss-num">Latest</th>
                          <th>Trend</th>
                          <th>Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.length ? (
                          visible.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.name}</strong>
                                <small className="pr-adm">
                                  Adm. {r.admNo}
                                  {r.attention ? <span className="ss-tag warn pr-flag">Needs attention</span> : null}
                                </small>
                              </td>
                              {cls.assessments.map((a, i) => {
                                const s = r.scores[i];
                                return (
                                  <td key={a.id} className="ss-num">
                                    {s === null || s === undefined ? (
                                      <span className="pr-miss" title="No score recorded">
                                        –
                                      </span>
                                    ) : (
                                      <span className="pr-score" data-tone={tone(s)}>
                                        {s}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="ss-num">
                                {r.latest === null ? (
                                  <span className="pr-miss">–</span>
                                ) : (
                                  <strong>{r.latest}%</strong>
                                )}
                              </td>
                              <td>
                                <span className="pr-trend" data-t={r.trend}>
                                  {TREND_LABEL[r.trend]}
                                  {r.delta !== null ? ` ${signed(r.delta)}` : ""}
                                </span>
                              </td>
                              <td>
                                <Sparkline points={r.scores} label={`${r.name} scores across assessments`} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={cls.assessments.length + 4} className="ss-empty pr-none">
                              {counts.all === 0 ? "This class has no learners yet." : "No learners match these filters."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="ss-total">
                          <td>
                            <strong>Class mean</strong>
                          </td>
                          {means.map((m, i) => (
                            <td key={cls.assessments[i].id} className="ss-num">
                              <strong>{m === null ? "–" : `${m}%`}</strong>
                            </td>
                          ))}
                          <td className="ss-num">
                            <strong>{latestMean === null ? "–" : `${latestMean}%`}</strong>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>

              <div className="pr-legend pr-noprint" aria-label="Score colours">
                <span>
                  <i data-tone="a" /> 70% and above
                </span>
                <span>
                  <i data-tone="b" /> 50 to 69%
                </span>
                <span>
                  <i data-tone="c" /> 40 to 49%
                </span>
                <span>
                  <i data-tone="d" /> Below 40%
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}