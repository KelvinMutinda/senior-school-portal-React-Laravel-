import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Learner {
  id: string;
  admNo: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface ExamType {
  id: string;
  name: string;
  max: number;
}

/** scores[learnerId][subjectId][examId] = "26" | "ABS" | "" (published marks only) */
export type ScoreSheet = Record<string, Record<string, Record<string, string>>>;

export interface ClassResults {
  id: string;
  label: string;
  learners: Learner[];
  subjects: Subject[];
  scores: ScoreSheet;
}

export interface YearResults {
  id: string;
  label: string;
  exams: ExamType[];
  classes: ClassResults[];
}

export interface ViewResultsProps {
  years?: YearResults[];
  schoolName?: string;
  termLabel?: string;
  userName?: string;
  theme?: "light" | "dark";
  onNavigate?: (key: string) => void;
}

/* ------------------------------------------------------------------ */
/* Sample data (remove when you connect the real API)                  */
/* ------------------------------------------------------------------ */

const NAMES = [
  "Grace Njeri", "Brian Otieno", "Faith Wanjiru", "Kevin Mutua", "Amina Hassan", "Joseph Kamau",
  "Mercy Achieng", "Daniel Kiprop", "Lucy Wambui", "Samuel Barasa", "Esther Chebet", "Peter Mwangi",
];

const EAST: Learner[] = NAMES.map((name, i) => ({ id: `e${i + 1}`, admNo: String(1001 + i), name }));
const WEST: Learner[] = [...NAMES].reverse().map((name, i) => ({ id: `w${i + 1}`, admNo: String(2001 + i), name }));

const SUBJECTS: Subject[] = [
  { id: "mat", name: "Mathematics" },
  { id: "eng", name: "English" },
  { id: "kis", name: "Kiswahili" },
  { id: "phy", name: "Physics" },
  { id: "bio", name: "Biology" },
];

const EXAMS_2026: ExamType[] = [
  { id: "cat1", name: "CAT 1", max: 30 },
  { id: "mid", name: "Mid-term test", max: 50 },
  { id: "exam", name: "End of term exam", max: 100 },
];

function makeScores(seed: number, learners: Learner[], subjects: Subject[], exams: ExamType[]): ScoreSheet {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: ScoreSheet = {};
  learners.forEach((l) => {
    const ability = 0.3 + rnd() * 0.6;
    out[l.id] = {};
    subjects.forEach((sub) => {
      out[l.id][sub.id] = {};
      exams.forEach((e) => {
        if (rnd() < 0.03) {
          out[l.id][sub.id][e.id] = "ABS";
          return;
        }
        const p = Math.min(1, Math.max(0.05, ability + (rnd() - 0.5) * 0.3));
        out[l.id][sub.id][e.id] = String(Math.round(p * e.max));
      });
    });
  });
  return out;
}

const SAMPLE_YEARS: YearResults[] = [
  {
    id: "y2026",
    label: "2026",
    exams: EXAMS_2026,
    classes: [
      { id: "g10e", label: "Grade 10 East", learners: EAST, subjects: SUBJECTS, scores: makeScores(7, EAST, SUBJECTS, EXAMS_2026) },
      { id: "g10w", label: "Grade 10 West", learners: WEST, subjects: SUBJECTS, scores: makeScores(21, WEST, SUBJECTS, EXAMS_2026) },
    ],
  },
  {
    id: "y2025",
    label: "2025",
    exams: [{ id: "exam", name: "End of term exam", max: 100 }],
    classes: [
      {
        id: "g9e",
        label: "Grade 9 East",
        learners: EAST,
        subjects: SUBJECTS,
        scores: makeScores(33, EAST, SUBJECTS, [{ id: "exam", name: "End of term exam", max: 100 }]),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Grading and analysis                                                */
/* ------------------------------------------------------------------ */

interface Band {
  min: number;
  code: string;
  level: "Exceeding" | "Meeting" | "Approaching" | "Below";
  points: number;
}

/** Adjust these cut-offs to match your school's grading policy. */
const BANDS: Band[] = [
  { min: 90, code: "EE1", level: "Exceeding", points: 8 },
  { min: 75, code: "EE2", level: "Exceeding", points: 7 },
  { min: 58, code: "ME1", level: "Meeting", points: 6 },
  { min: 41, code: "ME2", level: "Meeting", points: 5 },
  { min: 31, code: "AE1", level: "Approaching", points: 4 },
  { min: 21, code: "AE2", level: "Approaching", points: 3 },
  { min: 11, code: "BE1", level: "Below", points: 2 },
  { min: 0, code: "BE2", level: "Below", points: 1 },
];

const LEVELS: Band["level"][] = ["Exceeding", "Meeting", "Approaching", "Below"];
const MEETING_MARK = 41;

const gradeFor = (pct: number): Band => BANDS.find((b) => pct >= b.min) ?? BANDS[BANDS.length - 1];
const isNum = (n: number | null | undefined): n is number => typeof n === "number";
const fmt1 = (n: number | null | undefined) => (isNum(n) ? (Math.round(n * 10) / 10).toString() : "–");
const levelTag = (level: Band["level"]) => (level === "Below" ? "ss-tag warn" : level === "Approaching" ? "ss-tag" : "ss-tag ok");

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}

function subjectPct(scores: ScoreSheet, learnerId: string, subjectId: string, exams: ExamType[]): number | null {
  const pcts = exams
    .map((e) => {
      const n = toNumber(scores[learnerId]?.[subjectId]?.[e.id]);
      return n === null ? null : (n / e.max) * 100;
    })
    .filter(isNum);
  return pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
}

interface LearnerRow {
  learner: Learner;
  pcts: Record<string, number | null>;
  mean: number | null;
  points: number;
  band: Band | null;
  rank: number | null;
}

interface SubjectStat {
  subject: Subject;
  mean: number | null;
  high: number | null;
  low: number | null;
  meetingRate: number | null;
  count: number;
}

interface ClassAnalysis {
  rows: LearnerRow[];
  ranked: number;
  mean: number | null;
  high: number | null;
  low: number | null;
  meetingRate: number | null;
  subjectStats: SubjectStat[];
  distribution: { level: Band["level"]; count: number; pct: number }[];
}

function analyseClass(cls: ClassResults, exams: ExamType[], examId: string): ClassAnalysis {
  const list = examId === "all" ? exams : exams.filter((e) => e.id === examId);

  const rows: LearnerRow[] = cls.learners.map((learner) => {
    const pcts: Record<string, number | null> = {};
    let sum = 0;
    let count = 0;
    let points = 0;
    cls.subjects.forEach((s) => {
      const p = subjectPct(cls.scores, learner.id, s.id, list);
      pcts[s.id] = p;
      if (p !== null) {
        sum += p;
        count++;
        points += gradeFor(p).points;
      }
    });
    const mean = count ? sum / count : null;
    return { learner, pcts, mean, points, band: mean === null ? null : gradeFor(mean), rank: null };
  });

  const ranked = rows.filter((r) => isNum(r.mean)).sort((a, b) => (b.mean as number) - (a.mean as number));
  ranked.forEach((r, i) => {
    r.rank = i > 0 && r.mean === ranked[i - 1].mean ? ranked[i - 1].rank : i + 1;
  });
  const sorted = [...ranked, ...rows.filter((r) => r.mean === null)];

  const means = ranked.map((r) => r.mean as number);

  const subjectStats: SubjectStat[] = cls.subjects.map((subject) => {
    const vals = rows.map((r) => r.pcts[subject.id]).filter(isNum);
    return {
      subject,
      count: vals.length,
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      high: vals.length ? Math.max(...vals) : null,
      low: vals.length ? Math.min(...vals) : null,
      meetingRate: vals.length ? (vals.filter((v) => v >= MEETING_MARK).length / vals.length) * 100 : null,
    };
  });

  const allPcts = rows.flatMap((r) => Object.values(r.pcts)).filter(isNum);
  const distribution = LEVELS.map((level) => {
    const count = allPcts.filter((p) => gradeFor(p).level === level).length;
    return { level, count, pct: allPcts.length ? (count / allPcts.length) * 100 : 0 };
  });

  return {
    rows: sorted,
    ranked: ranked.length,
    mean: means.length ? means.reduce((a, b) => a + b, 0) / means.length : null,
    high: means.length ? Math.max(...means) : null,
    low: means.length ? Math.min(...means) : null,
    meetingRate: means.length ? (means.filter((m) => m >= MEETING_MARK).length / means.length) * 100 : null,
    subjectStats,
    distribution,
  };
}

function autoRemark(band: Band | null): string {
  if (!band) return "No marks have been recorded for this learner yet.";
  switch (band.level) {
    case "Exceeding":
      return "Excellent performance. Keep up the consistent effort and continue to challenge yourself.";
    case "Meeting":
      return "Good work. With a little more practice in the weaker subjects you can reach the next level.";
    case "Approaching":
      return "A fair performance. More revision and regular practice are needed, especially in the weaker subjects.";
    default:
      return "Performance is below expectation. Please meet the class teacher so a support plan can be agreed.";
  }
}

/* ------------------------------------------------------------------ */
/* Files: PDF and Excel                                                */
/* ------------------------------------------------------------------ */

type AutoTable = typeof import("jspdf-autotable").default;

interface CardData {
  schoolName: string;
  termLabel: string;
  yearLabel: string;
  classLabel: string;
  examLabel: string;
  learner: Learner;
  rows: { subject: string; pct: number | null; code: string; level: string; points: number | null; classMean: number | null }[];
  mean: number | null;
  points: number;
  code: string;
  rank: number | null;
  outOf: number;
  comment: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function finalY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function drawCard(doc: jsPDF, autoTable: AutoTable, c: CardData) {
  doc.setFillColor(12, 31, 61);
  doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(185, 142, 47);
  doc.rect(0, 30, 210, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(c.schoolName, 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Learner report card  ·  ${c.termLabel}`, 14, 21);

  doc.setTextColor(26, 36, 51);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Learner: ${c.learner.name}`, 14, 42);
  doc.setFont("helvetica", "normal");
  doc.text(`Adm. no: ${c.learner.admNo}`, 14, 48);
  doc.text(`Class: ${c.classLabel}`, 110, 42);
  doc.text(`Year: ${c.yearLabel}  ·  ${c.examLabel}`, 110, 48);

  autoTable(doc, {
    startY: 55,
    head: [["Subject", "Score %", "Grade", "Level", "Points", "Class mean %"]],
    body: c.rows.map((r) => [r.subject, fmt1(r.pct), r.code, r.level, r.points === null ? "–" : String(r.points), fmt1(r.classMean)]),
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.5, textColor: [26, 36, 51] },
    headStyles: { fillColor: [12, 31, 61], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  let y = finalY(doc, 120) + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `Mean: ${fmt1(c.mean)}%    Total points: ${c.points}    Overall: ${c.code}    Position: ${c.rank ?? "–"} of ${c.outOf}`,
    14,
    y,
  );

  y += 12;
  doc.text("Class teacher's comment", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(c.comment, 182), 14, y + 6);

  doc.setDrawColor(150, 160, 175);
  doc.line(14, 262, 80, 262);
  doc.line(120, 262, 186, 262);
  doc.setFontSize(9);
  doc.setTextColor(98, 112, 132);
  doc.text("Class teacher", 14, 267);
  doc.text("Head of Institution", 120, 267);
  doc.text("EE: Exceeding   ME: Meeting   AE: Approaching   BE: Below expectation", 14, 285);
}

async function loadPdf() {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  return { jsPDF, autoTable };
}

async function saveReportCards(cards: CardData[], filename: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  cards.forEach((c, i) => {
    if (i > 0) doc.addPage();
    drawCard(doc, autoTable, c);
  });
  doc.save(filename);
}

async function saveClassPdf(opts: {
  title: string;
  subtitle: string;
  head: string[];
  body: string[][];
  filename: string;
}) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  doc.setFillColor(12, 31, 61);
  doc.rect(0, 0, 297, 24, "F");
  doc.setFillColor(185, 142, 47);
  doc.rect(0, 24, 297, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(opts.title, 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(opts.subtitle, 12, 18);
  autoTable(doc, {
    startY: 31,
    head: [opts.head],
    body: opts.body,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [12, 31, 61], textColor: 255 },
  });
  doc.save(opts.filename);
}

/* ------------------------------------------------------------------ */
/* Icons and sidebar                                                   */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard" | "profile" | "classes" | "students" | "attendance" | "marks" | "results" | "comments"
  | "tools" | "insights" | "messages" | "announcements" | "download" | "menu" | "close" | "warn";

const ICONS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  classes: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A1.5 1.5 0 0 1 5.5 19H19M9 8h6" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.5 2.2 3.5 5.2" />
    </>
  ),
  attendance: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
    </>
  ),
  marks: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11h6M9 15h6" />
    </>
  ),
  results: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 16v-3M12 16V9M16 16v-5" />
    </>
  ),
  comments: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />,
  tools: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
  insights: <path d="M4 19h16M7 16v-4M12 16V8M17 16v-7" />,
  messages: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </>
  ),
  announcements: (
    <>
      <path d="M4 10v4h3l8 4V6L7 10H4z" />
      <path d="M18.5 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  warn: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
}

const MENU: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "profile", label: "My Profile", icon: "profile" },
    ],
  },
  {
    group: "Academics",
    items: [
      { key: "classes", label: "Classes", icon: "classes" },
      { key: "students", label: "Students", icon: "students" },
      { key: "attendance", label: "Attendance", icon: "attendance" },
      { key: "marks", label: "Marks Entry", icon: "marks" },
      { key: "results", label: "View Results", icon: "results" },
    ],
  },
  {
    group: "AI",
    items: [
      { key: "ai-tools", label: "AI Tools", icon: "tools" },
      { key: "ai-insights", label: "AI Insights", icon: "insights" },
    ],
  },
  {
    group: "Communication",
    items: [
      { key: "messages", label: "Messages", icon: "messages" },
      { key: "announcements", label: "Announcements", icon: "announcements" },
    ],
  },
];

function Sidebar({
  userName,
  open,
  onClose,
  onNavigate,
}: {
  userName: string;
  open: boolean;
  onClose: () => void;
  onNavigate?: (key: string) => void;
}) {
  return (
    <aside id="portal-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className="ss-logo" aria-hidden="true">
          <strong>SP</strong>
        </span>
        <div className="ss-brand-text">
          <strong>Senior School</strong>
          <em>Portal</em>
          <small>PORTAL</small>
        </div>
        <button type="button" className="ss-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="ss-nav" aria-label="Main navigation">
        {MENU.map((group) => (
          <div className="ss-group" key={group.group}>
            <p className="ss-group-label">{group.group}</p>
            {group.items.map((item) => {
              const active = item.key === "results";
              return (
                <a
                  key={item.key}
                  href={`#${item.key}`}
                  className={`ss-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    onClose();
                    if (onNavigate) {
                      e.preventDefault();
                      onNavigate(item.key);
                    }
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

      <div className="ss-side-foot">{userName}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Tab = "overview" | "results" | "analysis" | "cards";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "School overview" },
  { key: "results", label: "Class results" },
  { key: "analysis", label: "Analysis" },
  { key: "cards", label: "Report cards" },
];

export default function ViewResults({
  years = SAMPLE_YEARS,
  schoolName = "Senior School",
  termLabel = "Term 3, 2026",
  userName = "Mr. Otieno · Teacher",
  theme = "light",
  onNavigate,
}: ViewResultsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const [yearId, setYearId] = useState(years[0]?.id ?? "");
  const [classId, setClassId] = useState(years[0]?.classes[0]?.id ?? "");
  const [examId, setExamId] = useState("all");
  const [tab, setTab] = useState<Tab>("overview");

  const [query, setQuery] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const year = years.find((y) => y.id === yearId);
  const cls = year?.classes.find((c) => c.id === classId);
  const exams = year?.exams ?? [];
  const examLabel = examId === "all" ? "All exams combined" : exams.find((e) => e.id === examId)?.name ?? "";

  const analysis = useMemo(() => (cls && year ? analyseClass(cls, year.exams, examId) : null), [cls, year, examId]);

  const overview = useMemo(() => {
    if (!year) return { rows: [], schoolMean: null as number | null, learners: 0, meetingRate: null as number | null };
    let sum = 0;
    let count = 0;
    let meeting = 0;
    const rows = year.classes.map((c) => {
      const a = analyseClass(c, year.exams, examId);
      const means = a.rows.map((r) => r.mean).filter(isNum);
      sum += means.reduce((x, y) => x + y, 0);
      count += means.length;
      meeting += means.filter((m) => m >= MEETING_MARK).length;
      return { cls: c, a, top: a.rows.find((r) => r.rank === 1) };
    });
    return {
      rows,
      schoolMean: count ? sum / count : null,
      learners: year.classes.reduce((n, c) => n + c.learners.length, 0),
      meetingRate: count ? (meeting / count) * 100 : null,
    };
  }, [year, examId]);

  const activeRow = analysis?.rows.find((r) => r.learner.id === learnerId) ?? analysis?.rows[0];

  const visibleRows = useMemo(() => {
    if (!analysis) return [];
    const q = query.trim().toLowerCase();
    return analysis.rows.filter((r) => !q || r.learner.name.toLowerCase().includes(q) || r.learner.admNo.toLowerCase().includes(q));
  }, [analysis, query]);

  /* ----- selection ----- */

  const pickYear = (id: string) => {
    const y = years.find((x) => x.id === id);
    setYearId(id);
    setClassId(y?.classes[0]?.id ?? "");
    setExamId("all");
    setLearnerId("");
    setQuery("");
    setNotice(null);
    setError(null);
  };

  const pickClass = (id: string) => {
    setClassId(id);
    setLearnerId("");
    setQuery("");
    setNotice(null);
    setError(null);
  };

  const openClass = (id: string) => {
    pickClass(id);
    setTab("results");
  };

  /* ----- report card data ----- */

  const cardFor = (row: LearnerRow): CardData | null => {
    if (!cls || !year || !analysis) return null;
    return {
      schoolName,
      termLabel,
      yearLabel: year.label,
      classLabel: cls.label,
      examLabel,
      learner: row.learner,
      rows: cls.subjects.map((s) => {
        const p = row.pcts[s.id];
        const g = p === null ? null : gradeFor(p);
        return {
          subject: s.name,
          pct: p,
          code: g?.code ?? "–",
          level: g?.level ?? "–",
          points: g?.points ?? null,
          classMean: analysis.subjectStats.find((x) => x.subject.id === s.id)?.mean ?? null,
        };
      }),
      mean: row.mean,
      points: row.points,
      code: row.band?.code ?? "–",
      rank: row.rank,
      outOf: analysis.ranked,
      comment: comments[row.learner.id] ?? autoRemark(row.band),
    };
  };

  /* ----- downloads ----- */

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(done);
    } catch {
      setError("The file could not be created. Check that jspdf, jspdf-autotable and xlsx are installed, then try again.");
    } finally {
      setBusy(false);
    }
  };

  const base = cls && year ? `${slug(year.label)}-${slug(cls.label)}-${slug(examLabel)}` : "results";

  const downloadOneCard = () => {
    const card = activeRow ? cardFor(activeRow) : null;
    if (!card) return;
    void run(() => saveReportCards([card], `report-card-${slug(card.learner.name)}-${base}.pdf`), `Report card for ${card.learner.name} downloaded.`);
  };

  const downloadAllCards = () => {
    if (!analysis) return;
    const cards = analysis.rows.map(cardFor).filter((c): c is CardData => c !== null);
    void run(() => saveReportCards(cards, `report-cards-${base}.pdf`), `${cards.length} report cards downloaded in one PDF.`);
  };

  const classTable = () => {
    if (!cls || !analysis) return { head: [] as string[], body: [] as string[][] };
    return {
      head: ["Pos", "Adm. no", "Learner", ...cls.subjects.map((s) => `${s.name} %`), "Mean %", "Grade", "Points"],
      body: analysis.rows.map((r) => [
        r.rank === null ? "–" : String(r.rank),
        r.learner.admNo,
        r.learner.name,
        ...cls.subjects.map((s) => fmt1(r.pcts[s.id])),
        fmt1(r.mean),
        r.band?.code ?? "–",
        String(r.points),
      ]),
    };
  };

  const downloadClassPdf = () => {
    if (!cls || !year) return;
    const { head, body } = classTable();
    void run(
      () => saveClassPdf({ title: `${schoolName} · Results analysis`, subtitle: `${year.label} · ${cls.label} · ${examLabel} · ${termLabel}`, head, body, filename: `results-${base}.pdf` }),
      "Results PDF downloaded.",
    );
  };

  const downloadClassExcel = () => {
    const { head, body } = classTable();
    void run(async () => {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
      ws["!cols"] = head.map((h, i) => ({ wch: i === 2 ? 26 : Math.max(9, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `results-${base}.xlsx`);
    }, "Results Excel file downloaded.");
  };

  /* ------------------------------------------------------------------ */

  const needsClass = !cls || !analysis;
  const pickClassMessage = (
    <p className="ss-empty" style={{ margin: "24px 0 8px", textAlign: "center" }}>
      Choose a class above to see this view.
    </p>
  );

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar userName={userName} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <header className="ss-header">
          <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="portal-sidebar" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="ss-h-title">
            <p className="ss-h-name">View Results</p>
            <span>Academics</span>
          </div>
        </header>

        <main className="ss-content">
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Results</h2>
            <p className="ss-note" style={{ marginTop: 6, maxWidth: "68ch" }}>
              See results for the whole senior school, analyse a class, and download report cards as PDF. Only published results are shown here.
            </p>
          </div>

          {/* ---------- Filters ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="vr-filter-title">
            <header>
              <h3 id="vr-filter-title">Choose the results</h3>
              <span className="ss-count">{termLabel}</span>
            </header>
            <div className="ss-mk-pick">
              <label className="ss-lab">
                Year
                <select className="ss-input" value={yearId} onChange={(e) => pickYear(e.target.value)}>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ss-lab">
                Class / Grade
                <select className="ss-input" value={classId} onChange={(e) => pickClass(e.target.value)} disabled={!year}>
                  <option value="">Select class</option>
                  {year?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ss-lab">
                Exam type
                <select className="ss-input" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!year}>
                  <option value="all">All exams combined</option>
                  {exams.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} (out of {x.max})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ss-note">
              Scores are shown as percentages. "All exams combined" averages each learner's percentages across the exams, and absent (ABS) marks are left out.
            </p>
          </section>

          {notice ? (
            <p className="ss-sent" role="status" style={{ margin: 0 }}>
              {notice}
            </p>
          ) : null}
          {error ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-warn" role="alert">
                <Icon name="warn" />
                <span>{error}</span>
              </li>
            </ul>
          ) : null}

          {/* ---------- Tabs and content ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="vr-title">
            <header>
              <h3 id="vr-title">{year ? `${year.label} · ${cls ? cls.label : "All classes"} · ${examLabel}` : "Results"}</h3>
              {analysis && tab !== "overview" ? <span className="ss-count">{cls?.learners.length} learners</span> : null}
            </header>

            <div className="ss-pbody">
              <div className="ss-seg ss-mk-tabs" role="tablist" aria-label="Results views">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-on" : ""} onClick={() => setTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ===== School overview ===== */}
              {tab === "overview" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="ss-mk-stats">
                    <div>
                      <span>Classes</span>
                      <b>{overview.rows.length}</b>
                    </div>
                    <div>
                      <span>Learners</span>
                      <b>{overview.learners}</b>
                    </div>
                    <div>
                      <span>School mean</span>
                      <b>{fmt1(overview.schoolMean)}%</b>
                    </div>
                    <div>
                      <span>Meeting or above</span>
                      <b>{fmt1(overview.meetingRate)}%</b>
                    </div>
                  </div>

                  <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label="All classes">
                    <table className="ss-table" style={{ marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th scope="col">Class / Grade</th>
                          <th scope="col" className="ss-num">Learners</th>
                          <th scope="col" className="ss-num">Mean %</th>
                          <th scope="col" className="ss-num">Meeting or above</th>
                          <th scope="col">Top learner</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {overview.rows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="ss-empty" style={{ textAlign: "center", padding: 24 }}>
                              No results for this year yet.
                            </td>
                          </tr>
                        ) : (
                          overview.rows.map(({ cls: c, a, top }) => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.label}</strong>
                              </td>
                              <td className="ss-num">{c.learners.length}</td>
                              <td className="ss-num">{fmt1(a.mean)}</td>
                              <td className="ss-num">{fmt1(a.meetingRate)}%</td>
                              <td>{top ? `${top.learner.name} (${fmt1(top.mean)}%)` : "–"}</td>
                              <td className="ss-num">
                                <button type="button" className="ss-btn ss-btn-sm" onClick={() => openClass(c.id)}>
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* ===== Class results ===== */}
              {tab === "results" ? (
                needsClass ? (
                  pickClassMessage
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="ss-mk-stats">
                      <div>
                        <span>Class mean</span>
                        <b>{fmt1(analysis.mean)}%</b>
                      </div>
                      <div>
                        <span>Highest</span>
                        <b>{fmt1(analysis.high)}%</b>
                      </div>
                      <div>
                        <span>Lowest</span>
                        <b>{fmt1(analysis.low)}%</b>
                      </div>
                      <div>
                        <span>Meeting or above</span>
                        <b>{fmt1(analysis.meetingRate)}%</b>
                      </div>
                    </div>

                    <div className="ss-toolbar" style={{ margin: 0 }}>
                      <input
                        className="ss-input ss-input-auto"
                        type="search"
                        placeholder="Search name or admission number"
                        aria-label="Search learners"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <div className="ss-btn-row">
                        <button type="button" className="ss-btn" onClick={downloadClassExcel} disabled={busy}>
                          <Icon name="download" size={16} /> Excel
                        </button>
                        <button type="button" className="ss-btn" onClick={downloadClassPdf} disabled={busy}>
                          <Icon name="download" size={16} /> PDF
                        </button>
                      </div>
                    </div>

                    <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label="Class results">
                      <table className="ss-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr>
                            <th scope="col">Pos</th>
                            <th scope="col">Adm. no</th>
                            <th scope="col">Learner</th>
                            {cls.subjects.map((s) => (
                              <th key={s.id} scope="col" className="ss-num">
                                {s.name}
                              </th>
                            ))}
                            <th scope="col" className="ss-num">Mean %</th>
                            <th scope="col">Grade</th>
                            <th scope="col" className="ss-num">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.length === 0 ? (
                            <tr>
                              <td colSpan={cls.subjects.length + 6} className="ss-empty" style={{ textAlign: "center", padding: 24 }}>
                                No learners match your search.
                              </td>
                            </tr>
                          ) : (
                            visibleRows.map((r) => (
                              <tr key={r.learner.id}>
                                <td>
                                  <span className={`ss-vr-pos${r.rank !== null && r.rank <= 3 ? " top" : ""}`}>{r.rank ?? "–"}</span>
                                </td>
                                <td>{r.learner.admNo}</td>
                                <td>
                                  <strong>{r.learner.name}</strong>
                                </td>
                                {cls.subjects.map((s) => (
                                  <td key={s.id} className="ss-num">
                                    {fmt1(r.pcts[s.id])}
                                  </td>
                                ))}
                                <td className="ss-num">
                                  <strong>{fmt1(r.mean)}</strong>
                                </td>
                                <td>{r.band ? <span className={levelTag(r.band.level)}>{r.band.code}</span> : "–"}</td>
                                <td className="ss-num">{r.points}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : null}

              {/* ===== Analysis ===== */}
              {tab === "analysis" ? (
                needsClass ? (
                  pickClassMessage
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <strong style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Subject performance</strong>
                      <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label="Subject performance">
                        <table className="ss-table" style={{ marginTop: 0 }}>
                          <thead>
                            <tr>
                              <th scope="col">Subject</th>
                              <th scope="col">Mean</th>
                              <th scope="col" className="ss-num">Mean %</th>
                              <th scope="col" className="ss-num">Highest</th>
                              <th scope="col" className="ss-num">Lowest</th>
                              <th scope="col" className="ss-num">Meeting or above</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.subjectStats.map((s) => (
                              <tr key={s.subject.id}>
                                <td>
                                  <strong>{s.subject.name}</strong>
                                </td>
                                <td style={{ minWidth: 120 }}>
                                  <div className="ss-bar sm">
                                    <i style={{ width: `${Math.min(100, s.mean ?? 0)}%` }} />
                                  </div>
                                </td>
                                <td className="ss-num">{fmt1(s.mean)}</td>
                                <td className="ss-num">{fmt1(s.high)}</td>
                                <td className="ss-num">{fmt1(s.low)}</td>
                                <td className="ss-num">{fmt1(s.meetingRate)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <strong style={{ display: "block", fontWeight: 600 }}>Performance levels</strong>
                      <p className="ss-muted" style={{ margin: "2px 0 0" }}>
                        Share of all subject results in each level.
                      </p>
                      <div className="ss-results">
                        {analysis.distribution.map((d) => (
                          <div className="ss-result" key={d.level}>
                            <span className="ss-result-subject">{d.level}</span>
                            <div className="ss-bar">
                              <i className={d.level === "Below" || d.level === "Approaching" ? "" : "gold"} style={{ width: `${d.pct}%` }} />
                            </div>
                            <span className="ss-result-score">{d.count}</span>
                            <span className="ss-result-change flat">{fmt1(d.pct)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ss-two">
                      <div>
                        <strong style={{ display: "block", fontWeight: 600 }}>Top performers</strong>
                        <ul className="ss-list" style={{ marginTop: 6 }}>
                          {analysis.rows.filter((r) => r.rank !== null).slice(0, 5).map((r) => (
                            <li key={r.learner.id}>
                              <span className={`ss-vr-pos${(r.rank ?? 9) <= 3 ? " top" : ""}`}>{r.rank}</span>
                              <div>
                                <strong>{r.learner.name}</strong>
                                <small>Adm. {r.learner.admNo}</small>
                              </div>
                              <span className="ss-tag ok">{fmt1(r.mean)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong style={{ display: "block", fontWeight: 600 }}>Needs support</strong>
                        <ul className="ss-list" style={{ marginTop: 6 }}>
                          {[...analysis.rows.filter((r) => r.rank !== null)].reverse().slice(0, 5).map((r) => (
                            <li key={r.learner.id}>
                              <span className="ss-vr-pos">{r.rank}</span>
                              <div>
                                <strong>{r.learner.name}</strong>
                                <small>Adm. {r.learner.admNo}</small>
                              </div>
                              <span className={r.band ? levelTag(r.band.level) : "ss-tag"}>{fmt1(r.mean)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="ss-btn-row">
                      <button type="button" className="ss-btn" onClick={downloadClassPdf} disabled={busy}>
                        <Icon name="download" size={16} /> Download analysis as PDF
                      </button>
                    </div>
                  </div>
                )
              ) : null}

              {/* ===== Report cards ===== */}
              {tab === "cards" ? (
                needsClass || !activeRow ? (
                  pickClassMessage
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="ss-toolbar" style={{ margin: 0 }}>
                      <select className="ss-input ss-input-auto" aria-label="Learner" value={activeRow.learner.id} onChange={(e) => setLearnerId(e.target.value)}>
                        {analysis.rows.map((r) => (
                          <option key={r.learner.id} value={r.learner.id}>
                            {r.learner.name} ({r.learner.admNo})
                          </option>
                        ))}
                      </select>
                      <div className="ss-btn-row">
                        <button type="button" className="ss-btn" onClick={downloadOneCard} disabled={busy}>
                          <Icon name="download" size={16} /> This report card (PDF)
                        </button>
                        <button type="button" className="ss-btn ss-btn-primary" onClick={downloadAllCards} disabled={busy}>
                          {busy ? "Working…" : `All ${analysis.rows.length} report cards (PDF)`}
                        </button>
                      </div>
                    </div>

                    <article className="ss-vr-card" aria-label={`Report card for ${activeRow.learner.name}`}>
                      <div className="ss-vr-card-head">
                        <h4>{schoolName}</h4>
                        <p>Learner report card · {termLabel}</p>
                      </div>
                      <div className="ss-vr-meta">
                        <div>
                          <span>Learner</span>
                          <b>{activeRow.learner.name}</b>
                        </div>
                        <div>
                          <span>Adm. no</span>
                          <b>{activeRow.learner.admNo}</b>
                        </div>
                        <div>
                          <span>Class</span>
                          <b>{cls.label}</b>
                        </div>
                        <div>
                          <span>Year · Exam</span>
                          <b>
                            {year?.label} · {examLabel}
                          </b>
                        </div>
                      </div>

                      <div className="ss-vr-body">
                        <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label="Subject scores">
                          <table className="ss-table" style={{ marginTop: 0 }}>
                            <thead>
                              <tr>
                                <th scope="col">Subject</th>
                                <th scope="col" className="ss-num">Score %</th>
                                <th scope="col">Grade</th>
                                <th scope="col">Level</th>
                                <th scope="col" className="ss-num">Points</th>
                                <th scope="col" className="ss-num">Class mean %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cls.subjects.map((s) => {
                                const p = activeRow.pcts[s.id];
                                const g = p === null ? null : gradeFor(p);
                                return (
                                  <tr key={s.id}>
                                    <td>
                                      <strong>{s.name}</strong>
                                    </td>
                                    <td className="ss-num">{fmt1(p)}</td>
                                    <td>{g ? <span className={levelTag(g.level)}>{g.code}</span> : "–"}</td>
                                    <td>{g?.level ?? "–"}</td>
                                    <td className="ss-num">{g?.points ?? "–"}</td>
                                    <td className="ss-num">{fmt1(analysis.subjectStats.find((x) => x.subject.id === s.id)?.mean)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="ss-mk-stats" style={{ marginTop: 14 }}>
                          <div>
                            <span>Mean</span>
                            <b>{fmt1(activeRow.mean)}%</b>
                          </div>
                          <div>
                            <span>Total points</span>
                            <b>{activeRow.points}</b>
                          </div>
                          <div>
                            <span>Overall grade</span>
                            <b>{activeRow.band?.code ?? "–"}</b>
                          </div>
                          <div>
                            <span>Position</span>
                            <b>
                              {activeRow.rank ?? "–"} of {analysis.ranked}
                            </b>
                          </div>
                        </div>

                        <label className="ss-lab" style={{ marginTop: 14 }}>
                          Class teacher's comment (printed on the PDF)
                          <textarea
                            className="ss-input"
                            rows={3}
                            value={comments[activeRow.learner.id] ?? autoRemark(activeRow.band)}
                            onChange={(e) => setComments((c) => ({ ...c, [activeRow.learner.id]: e.target.value }))}
                          />
                        </label>

                        <div className="ss-vr-sign">
                          <div>Class teacher</div>
                          <div>Head of Institution</div>
                        </div>
                      </div>
                    </article>
                    <p className="ss-note" style={{ margin: 0 }}>
                      Grades: EE Exceeding, ME Meeting, AE Approaching, BE Below expectation. Comments you edit here are kept while this page is open and are used in the PDFs.
                    </p>
                  </div>
                )
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}