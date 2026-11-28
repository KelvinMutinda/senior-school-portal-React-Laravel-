import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiUrl, authHeaders, clearSession, getUser } from "../api/authApi"; // <- adjust this path to where authApi.ts lives

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
  format: "csv" | "pdf" | "print";
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
  /** Optional override (for testing). When omitted, the page loads the teacher's classes from the API. */
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
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function fetchProgress(signal: AbortSignal): Promise<ProgressClass[]> {
  const res = await fetch(apiUrl("/teacher/progress"), {
    signal,
    headers: authHeaders(),
  });

  if (!res.ok) {
    let message = "Could not load progress records.";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* response was not JSON */
    }
    throw new ApiError(message, res.status);
  }

  const json = await res.json();
  return (json.classes ?? []) as ProgressClass[];
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
  materials: "/Teacher/materials",
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
/* Performance levels (CBE senior school scale; edit to match yours)   */
/* ------------------------------------------------------------------ */

type LevelTone = "a" | "b" | "c" | "d";

interface Level {
  code: string;
  label: string;
  min: number; // lowest percentage that earns this level
  points: number;
  tone: LevelTone;
}

/** Highest level first. A score gets the first level whose min it reaches. */
const LEVELS: Level[] = [
  { code: "EE1", label: "Exceeding Expectation 1", min: 90, points: 8, tone: "a" },
  { code: "EE2", label: "Exceeding Expectation 2", min: 75, points: 7, tone: "a" },
  { code: "ME1", label: "Meeting Expectation 1", min: 58, points: 6, tone: "b" },
  { code: "ME2", label: "Meeting Expectation 2", min: 41, points: 5, tone: "b" },
  { code: "AE1", label: "Approaching Expectation 1", min: 31, points: 4, tone: "c" },
  { code: "AE2", label: "Approaching Expectation 2", min: 21, points: 3, tone: "c" },
  { code: "BE1", label: "Below Expectation 1", min: 11, points: 2, tone: "d" },
  { code: "BE2", label: "Below Expectation 2", min: 0, points: 1, tone: "d" },
];

function levelOf(score: number): Level {
  return LEVELS.find((l) => score >= l.min) ?? LEVELS[LEVELS.length - 1];
}

/** "90-100%", "75-89%" ... */
function levelRange(i: number): string {
  const top = i === 0 ? 100 : LEVELS[i - 1].min - 1;
  return `${LEVELS[i].min}-${top}%`;
}

/** PDF cell fill colours per tone (light shades) */
const TONE_RGB: Record<LevelTone, [number, number, number]> = {
  a: [209, 242, 224],
  b: [215, 230, 250],
  c: [255, 236, 200],
  d: [250, 215, 215],
};

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

const lastOf = (xs: (number | null)[]): number | null => {
  for (let i = xs.length - 1; i >= 0; i--) {
    const v = xs[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

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
/* Export (CSV and PDF)                                                */
/* ------------------------------------------------------------------ */

interface ExportItem {
  c: ProgressClass;
  rows: Row[];
  note?: string;
}

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
  const lastMean = lastOf(means);
  const lines: string[] = [
    csvLine(["Progress records"]),
    csvLine(["Class", c.name]),
    csvLine(["Subject", c.subject]),
    csvLine(["Exported", stamp]),
  ];
  if (filterNote) lines.push(csvLine(["Filter", filterNote]));
  lines.push("");
  lines.push(csvLine(["Adm No", "Learner", ...c.assessments.map((a) => `${a.name} (${a.date})`), "Latest", "Latest level", `Change (last 3, pts)`, "Trend", "Needs attention"]));
  rows.forEach((r) => {
    lines.push(
      csvLine([
        r.admNo,
        r.name,
        ...c.assessments.map((_, i) => r.scores[i] ?? ""),
        r.latest ?? "",
        r.latest === null ? "" : levelOf(r.latest).code,
        r.delta === null ? "" : Math.round(r.delta * 10) / 10,
        TREND_LABEL[r.trend],
        r.attention ? "Yes" : "No",
      ]),
    );
  });
  lines.push(csvLine(["", "Class mean", ...means.map((m) => m ?? ""), lastMean ?? "", lastMean === null ? "" : levelOf(lastMean).code, "", "", ""]));
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

/** Builds a landscape A4 PDF (one class per page set) and downloads it. The libraries load only when needed. */
async function downloadPdf(filename: string, items: ExportItem[], meta: { teacher: string; printed: string }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  items.forEach(({ c, rows, note }, idx) => {
    if (idx > 0) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Progress records", 14, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${c.name} - ${c.subject}`, 14, 23);
    doc.text(`Teacher: ${meta.teacher}    Printed: ${meta.printed}`, 14, 28);
    if (note) doc.text(`Showing: ${note}`, 14, 33);

    const nA = c.assessments.length;
    const means = classMeans(c);
    const lastMean = lastOf(means);

    const head = [["Adm", "Learner", ...c.assessments.map((a) => `${a.name}\n${shortDate(a.date)}`), "Latest", "Level", "Trend"]];

    const body = rows.map((r) => [
      r.admNo,
      r.name,
      ...c.assessments.map((_, i) => {
        const s = r.scores[i];
        return s === null || s === undefined ? "-" : `${s} ${levelOf(s).code}`;
      }),
      r.latest === null ? "-" : `${r.latest}%`,
      r.latest === null ? "-" : levelOf(r.latest).code,
      r.delta === null ? TREND_LABEL[r.trend] : `${TREND_LABEL[r.trend]} ${signed(r.delta)}`,
    ]);

    const foot = [
      [
        "",
        "Class mean",
        ...means.map((m) => (m === null ? "-" : `${m}% ${levelOf(m).code}`)),
        lastMean === null ? "-" : `${lastMean}%`,
        lastMean === null ? "-" : levelOf(lastMean).code,
        "",
      ],
    ];

    autoTable(doc, {
      startY: note ? 37 : 32,
      head,
      body,
      foot,
      theme: "grid",
      showFoot: "lastPage",
      margin: { left: 14, right: 14, bottom: 16 },
      styles: { fontSize: 8, cellPadding: 1.8, valign: "middle" },
      headStyles: { fillColor: [11, 27, 51], textColor: 255, halign: "center" },
      footStyles: { fillColor: [238, 241, 246], textColor: 20, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 46 } },
      didParseCell: (data) => {
        if (data.section === "body") {
          const row = rows[data.row.index];
          if (data.column.index >= 2 && data.column.index < 2 + nA) {
            const s = row.scores[data.column.index - 2];
            if (s !== null && s !== undefined) data.cell.styles.fillColor = TONE_RGB[levelOf(s).tone];
            data.cell.styles.halign = "center";
          }
          if (data.column.index === 1 && row.attention) {
            data.cell.styles.textColor = [160, 40, 40];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if ((data.section === "body" || data.section === "foot") && data.column.index >= 2 && data.column.index < 2 + nA + 2) {
          data.cell.styles.halign = "center";
        }
      },
    });

    // Levels key under the table
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
    let y = finalY + 7;
    if (y > pageH - 22) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Performance levels", 14, y);
    doc.setFont("helvetica", "normal");
    const key = LEVELS.map((l, i) => `${l.code} ${levelRange(i)}`).join("   |   ");
    doc.text(key, 14, y + 4.5);
    doc.text("Names in red need attention (latest score below 40%, or a sharp drop). A dash means no score recorded.", 14, y + 9);
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 8, { align: "right" });
  }

  doc.save(filename);
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

type LoadStatus = "loading" | "ready" | "error";

export default function ProgressRecords({ data, user, theme = "light", onExport, onNavigate, onLogout }: ProgressRecordsProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  /* Data loading */
  const [classes, setClasses] = useState<ProgressClass[]>(data ?? []);
  const [status, setStatus] = useState<LoadStatus>(data ? "ready" : "loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (data) {
      setClasses(data);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setLoadError("");

    fetchProgress(controller.signal)
      .then((result) => {
        setClasses(result);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession(); // token is missing, expired or revoked
          onLogout?.();
        }
        setLoadError(err instanceof Error ? err.message : "Could not load progress records.");
        setStatus("error");
      });

    return () => controller.abort();
    // onLogout is intentionally left out so a new function identity does not refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reloadKey]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(params.get("class") ?? "");
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [allClasses, setAllClasses] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const signedIn = getUser();
  const me: TeacherUser = user ?? { name: signedIn?.name ?? "Teacher", roleLabel: "Subject teacher" };
  const go = (route: string, key: string) => {
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  // Falls back to the first class when the URL's class is missing or not one of this teacher's
  const cls = classes.find((c) => c.id === selectedId) ?? classes[0] ?? null;
  const classId = cls?.id ?? "";

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

  /* How many learners sit at each level on their latest score */
  const levelCounts = useMemo(() => {
    const out: Record<string, number> = {};
    LEVELS.forEach((l) => {
      out[l.code] = 0;
    });
    analysed.forEach((r) => {
      if (r.latest !== null) out[levelOf(r.latest).code] += 1;
    });
    return out;
  }, [analysed]);

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
  const latestMeanLevel = latestMean !== null ? levelOf(latestMean) : null;

  const changeSelectClass = (id: string) => {
    setSelectedId(id);
    setFilter("all");
    setNotice(null);
    setParams({ class: id }, { replace: true });
  };

  /* Export */
  const buildTargets = (): { stamp: string; items: ExportItem[] } => {
    const list = allClasses ? classes : cls ? [cls] : [];
    const items = list.map((c) => {
      const current = !allClasses && cls !== null && c.id === cls.id;
      const rows = current ? visible : sortRows(c.learners.map(analyse), "name");
      const note = current && (filter !== "all" || term) ? `${FILTER_LABEL[filter]}${term ? `, search "${q.trim()}"` : ""}` : undefined;
      return { c, rows, note };
    });
    return { stamp: todayISO(), items };
  };

  const exportCsv = () => {
    const { stamp, items } = buildTargets();
    if (!items.length) return;

    const learnersOut = items.reduce((n, it) => n + it.rows.length, 0);
    const filename = allClasses ? `progress-records-all-classes-${stamp}.csv` : `progress-records-${slug(cls?.id ?? "class")}-${stamp}.csv`;
    downloadCsv(filename, items.map((it) => csvBlock(it.c, it.rows, stamp, it.note)).join("\r\n\r\n"));
    setNotice(`Downloaded ${filename} with ${learnersOut} ${learnersOut === 1 ? "learner" : "learners"}. It opens in Excel and Google Sheets.`);
    onExport?.({ format: "csv", scope: allClasses ? "all" : "class", classId: cls?.id ?? "", learners: learnersOut });
  };

  const exportPdf = async () => {
    const { stamp, items } = buildTargets();
    if (!items.length || pdfBusy) return;

    const learnersOut = items.reduce((n, it) => n + it.rows.length, 0);
    const filename = allClasses ? `progress-records-all-classes-${stamp}.pdf` : `progress-records-${slug(cls?.id ?? "class")}-${stamp}.pdf`;

    setPdfBusy(true);
    setNotice(null);
    try {
      await downloadPdf(filename, items, { teacher: me.name, printed: longDate(new Date()) });
      setNotice(`Downloaded ${filename} with ${learnersOut} ${learnersOut === 1 ? "learner" : "learners"}.`);
      onExport?.({ format: "pdf", scope: allClasses ? "all" : "class", classId: cls?.id ?? "", learners: learnersOut });
    } catch {
      setNotice("Could not create the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
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
          action={{ label: "Export CSV", onClick: exportCsv, disabled: status !== "ready" || !cls }}
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
          {status === "ready" && cls ? (
            <div className="pr-printhead">
              <h2>Progress records</h2>
              <p>
                {cls.name} · {cls.subject} · {me.name} · Printed {longDate(now)}
                {filter !== "all" || term ? ` · Showing: ${FILTER_LABEL[filter]}${term ? `, search "${q.trim()}"` : ""}` : ""}
              </p>
            </div>
          ) : null}

          {status === "loading" ? (
            <div className="ss-card pr-empty" role="status" aria-live="polite">
              <Icon name="progress" size={28} />
              <h3>Loading progress records</h3>
              <p>Fetching your classes and marks.</p>
            </div>
          ) : status === "error" ? (
            <div className="ss-card pr-empty" role="alert">
              <Icon name="close" size={28} />
              <h3>Could not load progress records</h3>
              <p>{loadError}</p>
              <button type="button" className="ss-btn" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          ) : !cls ? (
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
                    {classes.map((c) => (
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
                    <button type="button" className="ss-btn ss-btn-primary" onClick={exportPdf} disabled={pdfBusy} style={pdfBusy ? { opacity: 0.7, cursor: "progress" } : undefined}>
                      <Icon name="download" size={16} />
                      {pdfBusy ? "Creating PDF..." : "Download PDF"}
                    </button>
                    <button type="button" className="ss-btn" onClick={printPage}>
                      <Icon name="print" size={16} />
                      Print
                    </button>
                  </div>
                  <label className="pr-check">
                    <input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} />
                    Include all my classes in the CSV and PDF
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
                  {latestMeanLevel ? <small>Level {latestMeanLevel.code}</small> : null}
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
                          visible.map((r) => {
                            const latestLevel = r.latest === null ? null : levelOf(r.latest);
                            return (
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
                                  const lv = s === null || s === undefined ? null : levelOf(s);
                                  return (
                                    <td key={a.id} className="ss-num">
                                      {lv === null || s === null || s === undefined ? (
                                        <span className="pr-miss" title="No score recorded">
                                          –
                                        </span>
                                      ) : (
                                        <>
                                          <span className="pr-score" data-tone={lv.tone} title={lv.label}>
                                            {s}
                                          </span>
                                          <small className="pr-lv">{lv.code}</small>
                                        </>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="ss-num">
                                  {r.latest === null || latestLevel === null ? (
                                    <span className="pr-miss">–</span>
                                  ) : (
                                    <>
                                      <strong>{r.latest}%</strong>
                                      <small className="pr-lv" title={latestLevel.label}>
                                        {latestLevel.code}
                                      </small>
                                    </>
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
                            );
                          })
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
                              {m === null ? null : <small className="pr-lv">{levelOf(m).code}</small>}
                            </td>
                          ))}
                          <td className="ss-num">
                            <strong>{latestMean === null ? "–" : `${latestMean}%`}</strong>
                            {latestMeanLevel ? <small className="pr-lv">{latestMeanLevel.code}</small> : null}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>

              {/* Performance levels, with how many learners are at each on their latest score */}
              <div className="pr-legend" aria-label="Performance levels">
                {LEVELS.map((l, i) => (
                  <span key={l.code} title={l.label} className="pr-lv-legend">
                    <i data-tone={l.tone} /> {l.code} {levelRange(i)}
                    <b>{levelCounts[l.code]}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}