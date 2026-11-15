import { useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

/* Styles live in the shared portal stylesheet (section "Learner dashboard
   additions"). Import that stylesheet once at the app root. */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SubjectScore {
  subject: string;
  /** Short subject code shown in the results table. Falls back to the first letters of the subject. */
  code?: string;
  /** The learner's score, out of 100. */
  score: number;
  /** Average of the learner's stream for this subject. */
  stream: number;
  /** Average of the whole grade for this subject. */
  grade: number;
}

export interface ExamRecord {
  id: string;
  name: string;
  /** Short label for chart and heatmap axes, e.g. "T3 Mid". */
  short: string;
  term: string;
  /** ISO date, e.g. "2026-10-30". */
  date: string;
  scores: SubjectScore[];
  streamPosition: number;
  streamSize: number;
  gradePosition: number;
  gradeSize: number;
  /** If set, the report card button becomes a real PDF download link. */
  reportUrl?: string;
}

export type MaterialKind = "Notes" | "Past paper" | "Worksheet" | "Revision pack";

export interface Material {
  id: string;
  subject: string;
  title: string;
  kind: MaterialKind;
  sizeLabel: string;
  addedLabel: string;
  /** If set, the button becomes a real PDF download link. */
  url?: string;
}

export interface FeeLine {
  name: string;
  amount: number;
}

export interface FeeTerm {
  term: string;
  dueLabel: string;
  /** Amount of this term's balance that is past its due date. */
  overdue: number;
  lines: FeeLine[];
}

export interface FeePayment {
  id: string;
  /** ISO date. */
  date: string;
  reference: string;
  method: string;
  term: string;
  amount: number;
  receiptNo: string;
  receiptUrl?: string;
}

export interface Topic {
  subject: string;
  topic: string;
  action: string;
  key: string;
}

export interface StudyTask {
  id: string;
  day: string;
  text: string;
  mins: number;
  done: boolean;
}

export interface Notice {
  id: string;
  tag: "School" | "Class" | "Finance";
  title: string;
  meta: string;
  unread: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  when: string;
}

export interface PathItem {
  subject: string;
  topic: string;
  percent: number;
}

export interface CareerPathway {
  id: string;
  title: string;
  /** How well the pathway fits the learner, 0 to 100. */
  match: number;
  /** One plain sentence on why this pathway was suggested. */
  why: string;
  /** Subjects the pathway builds on. */
  subjects: string[];
}

export type TutorMode = "teach" | "practice" | "revise";

export interface TutorRequest {
  subject: string;
  topic: string;
  mode: TutorMode;
}

export type DownloadKind = "material" | "report-card" | "receipt" | "fee-structure";

export interface LearnerDashboardData {
  learner: { firstName: string; fullName: string; classLabel: string };
  termLabel: string;
  dateLabel: string;
  attendance: { percent: number; present: number; total: number };
  /** All exams, in any order. The dashboard sorts them. */
  exams: ExamRecord[];
  materials: Material[];
  fees: {
    currency: string;
    /** Must match one FeeTerm.term. Opens first in the structure tab. */
    currentTerm: string;
    structure: FeeTerm[];
    payments: FeePayment[];
  };
  ai: {
    consentOnRecord: boolean;
    chat: { recent: ChatThread[]; suggestions: string[] };
    tutor: { resumeTopic: string; resumeWhen: string; savedCount: number; path: PathItem[] };
  };
  career: { profilePercent: number; pathways: CareerPathway[] };
  topics: Topic[];
  tasks: StudyTask[];
  notices: Notice[];
  badges: { messages: number; announcements: number };
}

export interface LearnerDashboardProps {
  data?: LearnerDashboardData;
  theme?: "light" | "dark";
  /**
   * Called for links to other pages and for action buttons, with a key such as
   * "profile", "timetable", "messages", "privacy", "fees", "fees-structure",
   * "fees-invoices", "fees-query", "chat", "chat-<id>", "tutor-resume",
   * "tutor-saved", "career-recommender", "career-pathways", "career-profile",
   * "career-pathway-<id>" or a topic key. In-page sections scroll without calling this.
   */
  onNavigate?: (key: string) => void;
  /** Called when a study task is ticked or unticked, so you can persist it. */
  onTaskToggle?: (id: string, done: boolean) => void;
  /** Called when the learner sends a message in AI Chat. */
  onAskChat?: (question: string) => void;
  /** Called when the learner starts a lesson with the AI Tutor. */
  onStartTutor?: (request: TutorRequest) => void;
  /**
   * Called for download buttons that have no direct url. id is the material id,
   * exam id (or "all"), payment id or term name, depending on kind.
   */
  onDownload?: (kind: DownloadKind, id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Sample data. Replace with API data.                                 */
/* ------------------------------------------------------------------ */

const SUBJECTS = ["Mathematics", "English", "Kiswahili", "Biology", "Chemistry", "Physics"];
const CODES = ["MATH", "ENG", "KISW", "BIO", "CHEM", "PHYS"];
/* Sample only: how far the stream and grade averages sit below the learner. */
const STREAM_GAP = [3, -2, 4, -1, 2, -3];
const GRADE_GAP = [6, 1, 7, 2, 5, 0];

function sampleExam(
  i: number,
  id: string,
  name: string,
  short: string,
  term: string,
  date: string,
  scores: number[],
  streamPosition: number,
  gradePosition: number,
): ExamRecord {
  return {
    id,
    name,
    short,
    term,
    date,
    scores: SUBJECTS.map((subject, j) => ({
      subject,
      code: CODES[j],
      score: scores[j],
      stream: Math.round(scores[j] - STREAM_GAP[j] + ((i + j) % 3) - 1),
      grade: Math.round(scores[j] - GRADE_GAP[j] + ((i + j) % 3) - 1),
    })),
    streamPosition,
    streamSize: 42,
    gradePosition,
    gradeSize: 168,
  };
}

const FEE_LINES: FeeLine[] = [
  { name: "Tuition", amount: 15000 },
  { name: "Lunch programme", amount: 5000 },
  { name: "Activity fees", amount: 2500 },
  { name: "Library and ICT", amount: 1500 },
  { name: "Medical and insurance", amount: 1000 },
];

export const SAMPLE_DATA: LearnerDashboardData = {
  learner: { firstName: "Grace", fullName: "Grace Njeri", classLabel: "Grade 10 · East stream" },
  termLabel: "Term 3, 2026",
  dateLabel: "Sunday 15 November 2026",
  attendance: { percent: 94, present: 47, total: 50 },
  exams: [
    sampleExam(0, "e1", "Term 1 Opener exam", "T1 Opener", "Term 1, 2026", "2026-02-20", [64, 63, 72, 60, 56, 64], 11, 58),
    sampleExam(1, "e2", "Term 1 End of term exam", "T1 End", "Term 1, 2026", "2026-04-03", [66, 66, 75, 61, 60, 66], 9, 47),
    sampleExam(2, "e3", "Term 2 Mid-term exam", "T2 Mid", "Term 2, 2026", "2026-06-12", [69, 66, 73, 62, 62, 63], 8, 41),
    sampleExam(3, "e4", "Term 2 End of term exam", "T2 End", "Term 2, 2026", "2026-08-07", [72, 68, 75, 58, 64, 61], 7, 36),
    sampleExam(4, "e5", "Term 3 CAT 1", "T3 CAT", "Term 3, 2026", "2026-10-02", [71, 70, 74, 59, 66, 60], 6, 31),
    sampleExam(5, "e6", "Term 3 Mid-term exam", "T3 Mid", "Term 3, 2026", "2026-10-30", [74, 71, 76, 61, 67, 59], 5, 27),
  ],
  materials: [
    { id: "m1", subject: "Physics", title: "Electromagnetic induction: summary notes", kind: "Notes", sizeLabel: "1.2 MB", addedLabel: "Added 10 Nov" },
    { id: "m2", subject: "Physics", title: "Physics Paper 1, Term 2 2026, with marking scheme", kind: "Past paper", sizeLabel: "2.4 MB", addedLabel: "Added 3 Nov" },
    { id: "m3", subject: "Biology", title: "Monohybrid crosses practice worksheet", kind: "Worksheet", sizeLabel: "640 KB", addedLabel: "Added 6 Nov" },
    { id: "m4", subject: "Chemistry", title: "The mole concept: worked notes", kind: "Notes", sizeLabel: "980 KB", addedLabel: "Added 28 Oct" },
    { id: "m5", subject: "Mathematics", title: "Mathematics Paper 2, Term 2 2026", kind: "Past paper", sizeLabel: "1.8 MB", addedLabel: "Added 25 Oct" },
    { id: "m6", subject: "Mathematics", title: "Term 3 revision pack: algebra and geometry", kind: "Revision pack", sizeLabel: "3.1 MB", addedLabel: "Added 12 Nov" },
    { id: "m7", subject: "English", title: "Summary writing, step by step", kind: "Notes", sizeLabel: "760 KB", addedLabel: "Added 20 Oct" },
    { id: "m8", subject: "Kiswahili", title: "Insha na ufahamu: revision pack", kind: "Revision pack", sizeLabel: "1.1 MB", addedLabel: "Added 14 Oct" },
  ],
  fees: {
    currency: "KES",
    currentTerm: "Term 3",
    structure: [
      { term: "Term 1", dueLabel: "27 February", overdue: 0, lines: FEE_LINES },
      { term: "Term 2", dueLabel: "29 May", overdue: 0, lines: FEE_LINES },
      { term: "Term 3", dueLabel: "28 November", overdue: 0, lines: FEE_LINES },
    ],
    payments: [
      { id: "p1", date: "2026-01-12", reference: "SBC4H7K2L9", method: "M-Pesa", term: "Term 1", amount: 15000, receiptNo: "RCP-2026-0042" },
      { id: "p2", date: "2026-02-14", reference: "BNK-20260214-31", method: "Bank transfer", term: "Term 1", amount: 10000, receiptNo: "RCP-2026-0118" },
      { id: "p3", date: "2026-05-05", reference: "SEF9J2M5Q1", method: "M-Pesa", term: "Term 2", amount: 12500, receiptNo: "RCP-2026-0391" },
      { id: "p4", date: "2026-05-28", reference: "SFA3N8P6R4", method: "M-Pesa", term: "Term 2", amount: 12500, receiptNo: "RCP-2026-0457" },
      { id: "p5", date: "2026-09-03", reference: "SIC7T1V9W2", method: "M-Pesa", term: "Term 3", amount: 12500, receiptNo: "RCP-2026-0733" },
    ],
  },
  ai: {
    consentOnRecord: true,
    chat: {
      recent: [
        { id: "c1", title: "Explain Lenz's law with an example", when: "Yesterday" },
        { id: "c2", title: "Help me plan revision for Term 3 exams", when: "Thursday" },
        { id: "c3", title: "Check my summary paragraph", when: "2 November" },
      ],
      suggestions: ["Help me plan revision for my exams", "Explain this topic in simple words", "Check my essay for clarity"],
    },
    tutor: {
      resumeTopic: "Electromagnetic induction",
      resumeWhen: "Yesterday",
      savedCount: 7,
      path: [
        { subject: "Physics", topic: "Electromagnetic induction", percent: 70 },
        { subject: "Biology", topic: "Monohybrid crosses", percent: 40 },
        { subject: "Chemistry", topic: "The mole concept", percent: 20 },
      ],
    },
  },
  career: {
    profilePercent: 60,
    pathways: [
      {
        id: "software-engineering",
        title: "Software engineering",
        match: 88,
        why: "Fits your Mathematics results and your interest in solving problems step by step.",
        subjects: ["Mathematics", "Physics"],
      },
      {
        id: "civil-engineering",
        title: "Civil engineering",
        match: 81,
        why: "Builds on Mathematics and Physics, and your interest in designing things that last.",
        subjects: ["Mathematics", "Physics"],
      },
      {
        id: "biomedical-science",
        title: "Biomedical science",
        match: 74,
        why: "Matches your interest in how the body works. Biology topics are a good place to build up first.",
        subjects: ["Biology", "Chemistry"],
      },
    ],
  },
  topics: [
    { subject: "Physics", topic: "Electromagnetic induction", action: "Try 3 practice questions", key: "quiz-physics" },
    { subject: "Biology", topic: "Monohybrid crosses", action: "Replay saved explanation", key: "tutor-saved" },
    { subject: "Chemistry", topic: "The mole concept", action: "Take a 5-question quiz", key: "quiz-chemistry" },
  ],
  tasks: [
    { id: "t1", day: "Mon", text: "Physics: induction worked examples", mins: 25, done: true },
    { id: "t2", day: "Tue", text: "Biology: genetics quiz", mins: 15, done: true },
    { id: "t3", day: "Wed", text: "Chemistry: mole concept flashcards", mins: 20, done: true },
    { id: "t4", day: "Thu", text: "Mathematics: past paper, section B", mins: 40, done: true },
    { id: "t5", day: "Fri", text: "English: summary writing practice", mins: 30, done: false },
    { id: "t6", day: "Sat", text: "Biology: review saved explanation", mins: 15, done: false },
  ],
  notices: [
    { id: "n1", tag: "School", title: "Term 3 examinations start on Monday 24 November", meta: "Head of Institution · 12 November", unread: true },
    { id: "n2", tag: "Class", title: "Physics practical on Wednesday: bring your lab coat", meta: "Class teacher, Grade 10 East · 13 November", unread: true },
    { id: "n3", tag: "Finance", title: "Term 3 fee balance is due on 28 November", meta: "Finance office · 10 November", unread: false },
  ],
  badges: { messages: 2, announcements: 2 },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => n.toLocaleString("en-KE");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

type Kind = "up" | "down" | "flat";

/** Change between two averages, e.g. "Up 2.4 pts". */
function change(d: number, unit = ""): { kind: Kind; label: string } {
  const r = Math.round(d * 10) / 10;
  if (r > 0) return { kind: "up", label: `Up ${r}${unit}` };
  if (r < 0) return { kind: "down", label: `Down ${Math.abs(r)}${unit}` };
  return { kind: "flat", label: "No change" };
}

/** Gap to a benchmark, e.g. "3 above". */
function gap(d: number): { kind: Kind; label: string } {
  const r = Math.round(d);
  if (r > 0) return { kind: "up", label: `${r} above` };
  if (r < 0) return { kind: "down", label: `${Math.abs(r)} below` };
  return { kind: "flat", label: "Level" };
}

/* Performance bands and heat levels. Adjust the cut-offs to your school's
   grading scheme. */
const BANDS = [
  { min: 90, label: "EE1" },
  { min: 75, label: "EE2" },
  { min: 58, label: "ME1" },
  { min: 41, label: "ME2" },
  { min: 31, label: "AE1" },
  { min: 21, label: "AE2" },
  { min: 11, label: "BE1" },
  { min: 0, label: "BE2" },
];
const bandFor = (n: number) => (BANDS.find((b) => n >= b.min) ?? BANDS[BANDS.length - 1]).label;
const heatLevel = (n: number) => (n >= 90 ? 5 : n >= 75 ? 4 : n >= 58 ? 3 : n >= 41 ? 2 : 1);

interface ExamStat {
  exam: ExamRecord;
  me: number;
  stream: number;
  grade: number;
}

interface Progress {
  /** Oldest first. */
  stats: ExamStat[];
  subjects: string[];
}

function buildProgress(exams: ExamRecord[]): Progress {
  const chrono = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const stats = chrono.map((exam) => ({
    exam,
    me: avg(exam.scores.map((s) => s.score)),
    stream: avg(exam.scores.map((s) => s.stream)),
    grade: avg(exam.scores.map((s) => s.grade)),
  }));
  const subjects: string[] = [];
  chrono.forEach((e) =>
    e.scores.forEach((s) => {
      if (!subjects.includes(s.subject)) subjects.push(s.subject);
    }),
  );
  return { stats, subjects };
}

interface FeeRow {
  term: string;
  dueLabel: string;
  overdue: number;
  billed: number;
  paid: number;
  balance: number;
}

interface FeeSummary {
  rows: FeeRow[];
  billed: number;
  paid: number;
  outstanding: number;
  overdue: number;
}

function buildFeeSummary(fees: LearnerDashboardData["fees"]): FeeSummary {
  const rows = fees.structure.map((t) => {
    const billed = sum(t.lines.map((l) => l.amount));
    const paid = sum(fees.payments.filter((p) => p.term === t.term).map((p) => p.amount));
    return { term: t.term, dueLabel: t.dueLabel, overdue: t.overdue, billed, paid, balance: Math.max(billed - paid, 0) };
  });
  return {
    rows,
    billed: sum(rows.map((r) => r.billed)),
    paid: sum(fees.payments.map((p) => p.amount)),
    outstanding: sum(rows.map((r) => r.balance)),
    overdue: sum(rows.map((r) => r.overdue)),
  };
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard"
  | "profile"
  | "progress"
  | "heatmap"
  | "exams"
  | "plan"
  | "timetable"
  | "materials"
  | "download"
  | "structure"
  | "payments"
  | "balance"
  | "receipt"
  | "analysis"
  | "chat"
  | "tutor"
  | "career"
  | "pathways"
  | "messages"
  | "announcements"
  | "privacy"
  | "menu"
  | "close";

const ICON_PATHS: Record<IconName, ReactNode> = {
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
  progress: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  heatmap: (
    <>
      {[3, 10, 17].flatMap((x) =>
        [3, 10, 17].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="1" />),
      )}
    </>
  ),
  exams: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </>
  ),
  plan: <path d="M9 6h11M9 12h11M9 18h11M4.5 6.5l1 1 2-2M4.5 12.5l1 1 2-2M4.5 18.5l1 1 2-2" />,
  timetable: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  materials: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  structure: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h7" />
    </>
  ),
  payments: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  balance: <path d="M12 4v16M6 20h12M5 8h14M5 8l-3 7a3 3 0 0 0 6 0zM19 8l-3 7a3 3 0 0 0 6 0z" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  analysis: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />,
  tutor: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />
    </>
  ),
  career: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  pathways: <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 5-12 2-12 6" />,
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
  privacy: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
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
/* Sidebar and header                                                  */
/* ------------------------------------------------------------------ */

type FeesTab = "structure" | "payments" | "balances" | "receipts" | "analysis";

const FEES_TABS: { key: FeesTab; label: string }[] = [
  { key: "structure", label: "Fee structure" },
  { key: "payments", label: "Payment records" },
  { key: "balances", label: "Balances" },
  { key: "receipts", label: "Receipts" },
  { key: "analysis", label: "Analysis" },
];

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Id of an in-page section to scroll to. Without it, the link opens another page. */
  section?: string;
  /** Fees tab to open when the link is used. */
  feesTab?: FeesTab;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function buildMenu(badges: LearnerDashboardData["badges"]): NavGroup[] {
  return [
    {
      group: "Overview",
      items: [
        { key: "dashboard", label: "Dashboard", icon: "dashboard", section: "top" },
        { key: "profile", label: "My Profile", icon: "profile" },
      ],
    },
    {
      group: "Academic progress",
      items: [
        { key: "progress", label: "Progress and analytics", icon: "progress", section: "progress" },
        { key: "heatmap", label: "Subject heatmap", icon: "heatmap", section: "heatmap" },
        { key: "exams", label: "Exam results", icon: "exams", section: "exams" },
        { key: "plan", label: "Study plan", icon: "plan", section: "plan" },
        { key: "timetable", label: "Timetable", icon: "timetable" },
      ],
    },
    {
      group: "Learning materials",
      items: [
        { key: "materials", label: "Notes and past papers", icon: "materials", section: "materials" },
        { key: "downloads", label: "Results downloads", icon: "download", section: "downloads" },
      ],
    },
    {
      group: "Fees",
      items: [
        { key: "fees-structure", label: "Fee structure", icon: "structure", section: "fees", feesTab: "structure" },
        { key: "fees-payments", label: "Payment records", icon: "payments", section: "fees", feesTab: "payments" },
        { key: "fees-balances", label: "Fee balances", icon: "balance", section: "fees", feesTab: "balances" },
        { key: "fees-receipts", label: "Receipts", icon: "receipt", section: "fees", feesTab: "receipts" },
        { key: "fees-analysis", label: "Fees analysis", icon: "analysis", section: "fees", feesTab: "analysis" },
      ],
    },
    {
      group: "AI",
      items: [
        { key: "ai-chat", label: "AI Chat", icon: "chat", section: "ai-chat" },
        { key: "ai-tutor", label: "AI Tutor", icon: "tutor", section: "ai-tutor" },
      ],
    },
    {
      group: "Career",
      items: [
        { key: "career-recommender", label: "Career recommender", icon: "career" },
        { key: "career-pathways", label: "Explore pathways", icon: "pathways" },
      ],
    },
    {
      group: "Communication",
      items: [
        { key: "messages", label: "Messages", icon: "messages", badge: badges.messages },
        { key: "announcements", label: "Announcements", icon: "announcements", badge: badges.announcements, section: "announcements" },
      ],
    },
    {
      group: "Account",
      items: [{ key: "privacy", label: "Settings and Privacy", icon: "privacy" }],
    },
  ];
}

interface SidebarProps {
  data: LearnerDashboardData;
  open: boolean;
  activeKey: string;
  onClose: () => void;
  onSelect: (item: NavItem) => void;
  onNavigate?: (key: string) => void;
}

function Sidebar({ data, open, activeKey, onClose, onSelect, onNavigate }: SidebarProps) {
  const menu = useMemo(() => buildMenu(data.badges), [data.badges]);

  return (
    <aside id="learner-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className="ss-logo" aria-hidden="true">
          <strong>SP</strong>
        </span>
        <div className="ss-brand-text">
          <strong>Senior School</strong>
          <em>Learner</em>
          <small>PORTAL</small>
        </div>
        <button type="button" className="ss-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="ss-nav" aria-label="Learner navigation">
        {menu.map((group) => (
          <div className="ss-group" key={group.group}>
            <p className="ss-group-label">{group.group}</p>
            {group.items.map((item) => {
              const active = item.key === activeKey;
              return (
                <a
                  key={item.key}
                  href={`#${item.section ?? item.key}`}
                  className={`ss-link${active ? " is-active" : ""}`}
                  aria-current={active ? "location" : undefined}
                  onClick={(e) => {
                    if (item.section) {
                      e.preventDefault();
                      onSelect(item);
                      return;
                    }
                    onClose();
                    if (onNavigate) {
                      e.preventDefault();
                      onNavigate(item.key);
                    }
                  }}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <em className="ss-badge" style={{ fontStyle: "normal" }}>
                      {item.badge}
                    </em>
                  ) : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ss-side-foot">
        {data.learner.fullName} · {data.learner.classLabel}
      </div>
    </aside>
  );
}

function PageHeader({ dateLabel, onOpenMenu }: { dateLabel: string; onOpenMenu: () => void }) {
  return (
    <header className="ss-header">
      <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="learner-sidebar" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      <div className="ss-h-title">
        <h1>Dashboard</h1>
        <span>{dateLabel}</span>
      </div>
    </header>
  );
}

function SectionHead({ id, title, note }: { id?: string; title: string; note?: string }) {
  return (
    <div className="ss-sec-head" id={id}>
      <h2>{title}</h2>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function DownloadButton({
  kind,
  id,
  label,
  what,
  url,
  small = true,
  onDownload,
}: {
  kind: DownloadKind;
  id: string;
  label: string;
  what?: string;
  url?: string;
  small?: boolean;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const cls = `ss-btn${small ? " ss-btn-sm" : ""}`;
  const aria = what ? `${label}: ${what}` : undefined;
  const inner = (
    <>
      <Icon name="download" size={14} />
      {label}
    </>
  );
  if (url) {
    return (
      <a className={cls} href={url} download aria-label={aria}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} aria-label={aria} onClick={() => onDownload?.(kind, id)}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Hero and KPIs                                                       */
/* ------------------------------------------------------------------ */

function Hero({
  data,
  latest,
  outstanding,
  tasksLeft,
  onGoto,
}: {
  data: LearnerDashboardData;
  latest?: ExamStat;
  outstanding: number;
  tasksLeft: number;
  onGoto: (id: string) => void;
}) {
  return (
    <section className="ss-hero" aria-label="Welcome">
      <div className="ss-hero-text">
        <span className="ss-eyebrow">
          {data.learner.classLabel} · {data.termLabel}
        </span>
        <h2>
          {greeting()}, {data.learner.firstName}
        </h2>
        <p>
          You have <strong>{tasksLeft}</strong> study {tasksLeft === 1 ? "task" : "tasks"} left this week. Your AI Tutor is ready when you
          are.
        </p>
        <div className="ss-hero-btns">
          <button type="button" className="ss-btn ss-btn-gold" onClick={() => onGoto("ai-tutor")}>
            <Icon name="tutor" size={16} />
            Start a tutor lesson
          </button>
          <button type="button" className="ss-btn ss-btn-ghost" onClick={() => onGoto("progress")}>
            See my progress
          </button>
        </div>
      </div>
      <div className="ss-hero-stats">
        <div>
          <span>Average</span>
          <b>{latest ? `${Math.round(latest.me)}%` : "–"}</b>
        </div>
        <div>
          <span>Stream rank</span>
          <b>{latest ? ordinal(latest.exam.streamPosition) : "–"}</b>
        </div>
        <div>
          <span>Balance ({data.fees.currency})</span>
          <b>{fmt(outstanding)}</b>
        </div>
      </div>
    </section>
  );
}

function KpiRow({ stats, attendance }: { stats: ExamStat[]; attendance: LearnerDashboardData["attendance"] }) {
  const latest = stats[stats.length - 1];
  const prev = stats[stats.length - 2];
  if (!latest) return null;
  const ch = prev ? change(latest.me - prev.me, " pts") : null;
  const vsStream = gap(latest.me - latest.stream);
  const vsGrade = gap(latest.me - latest.grade);

  return (
    <div className="ss-kpis">
      <div className="ss-card ss-kpi">
        <span className="ss-kpi-label">Latest average</span>
        <b>{latest.me.toFixed(1)}%</b>
        <small>
          {latest.exam.name} · {bandFor(latest.me)}
        </small>
        {ch && prev ? (
          <small className={`ss-result-change ${ch.kind}`}>
            {ch.label} since {prev.exam.short}
          </small>
        ) : null}
      </div>
      <div className="ss-card ss-kpi">
        <span className="ss-kpi-label">Position in stream</span>
        <b>{ordinal(latest.exam.streamPosition)}</b>
        <small>of {latest.exam.streamSize} learners</small>
        <small>
          Stream average {latest.stream.toFixed(1)}%: you are {vsStream.label.toLowerCase()}
        </small>
      </div>
      <div className="ss-card ss-kpi">
        <span className="ss-kpi-label">Position in grade</span>
        <b>{ordinal(latest.exam.gradePosition)}</b>
        <small>of {latest.exam.gradeSize} learners</small>
        <small>
          Grade average {latest.grade.toFixed(1)}%: you are {vsGrade.label.toLowerCase()}
        </small>
      </div>
      <div className="ss-card ss-kpi">
        <span className="ss-kpi-label">Attendance</span>
        <b>{attendance.percent}%</b>
        <small>
          {attendance.present} of {attendance.total} school days this term
        </small>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Academic progress                                                   */
/* ------------------------------------------------------------------ */

function TrendChart({ stats }: { stats: ExamStat[] }) {
  const W = 640;
  const H = 250;
  const L = 38;
  const R = 18;
  const T = 18;
  const B = 34;

  const values = stats.flatMap((s) => [s.me, s.stream, s.grade]);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10);
  const step = hi - lo > 40 ? 20 : 10;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  const n = stats.length;
  const x = (i: number) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = (key: "me" | "stream" | "grade") =>
    stats.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(" ");

  const last = stats[n - 1];
  const summary = `Average score by exam. Latest: you ${last.me.toFixed(1)}, stream ${last.stream.toFixed(1)}, grade ${last.grade.toFixed(1)}.`;

  return (
    <>
      <div className="ss-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="ss-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text className="ss-axis" x={L - 8} y={y(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {stats.map((s, i) => (
            <text key={s.exam.id} className="ss-axis" x={x(i)} y={H - 10} textAnchor="middle">
              {s.exam.short}
            </text>
          ))}
          <path className="ss-ln grade" d={path("grade")} />
          <path className="ss-ln stream" d={path("stream")} />
          <path className="ss-ln me" d={path("me")} />
          {stats.map((s, i) => (
            <g key={s.exam.id}>
              <circle className="ss-pt" cx={x(i)} cy={y(s.me)} r={4} />
              <text className="ss-pt-label" x={x(i)} y={y(s.me) - 10}>
                {Math.round(s.me)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="ss-legend">
        <span>
          <i className="me" />
          You
        </span>
        <span>
          <i className="stream" />
          Stream average
        </span>
        <span>
          <i className="grade" />
          Grade average
        </span>
      </div>
      <table className="ss-sr">
        <caption>Average score by exam</caption>
        <thead>
          <tr>
            <th>Exam</th>
            <th>You</th>
            <th>Stream average</th>
            <th>Grade average</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.exam.id}>
              <td>{s.exam.name}</td>
              <td>{s.me.toFixed(1)}</td>
              <td>{s.stream.toFixed(1)}</td>
              <td>{s.grade.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function TrendCard({ stats }: { stats: ExamStat[] }) {
  return (
    <section className="ss-card ss-panel" aria-labelledby="trend-title">
      <header>
        <h3 id="trend-title">Average score by exam</h3>
        <span className="ss-count">You, stream and grade</span>
      </header>
      <div className="ss-pbody">{stats.length ? <TrendChart stats={stats} /> : <p className="ss-empty">No exams recorded yet.</p>}</div>
    </section>
  );
}

function SubjectCompareCard({ stats }: { stats: ExamStat[] }) {
  const [bm, setBm] = useState<"stream" | "grade">("stream");
  const latest = stats[stats.length - 1];
  const bmLabel = bm === "stream" ? "Stream" : "Grade";

  return (
    <section className="ss-card ss-panel" aria-labelledby="subjects-title">
      <header>
        <h3 id="subjects-title">Subjects in your latest exam</h3>
        {latest ? <span className="ss-count">{latest.exam.short}</span> : null}
      </header>
      <div className="ss-pbody">
        {latest ? (
          <>
            <div className="ss-seg ss-seg-lg" role="group" aria-label="Compare with">
              {(["stream", "grade"] as const).map((k) => (
                <button key={k} type="button" className={bm === k ? "is-on" : ""} aria-pressed={bm === k} onClick={() => setBm(k)}>
                  {k === "stream" ? "My stream" : "My grade"}
                </button>
              ))}
            </div>
            <div className="ss-cmp">
              {latest.exam.scores.map((s) => {
                const b = s[bm];
                const g = gap(s.score - b);
                return (
                  <div className="ss-cmp-row" key={s.subject}>
                    <span className="ss-cmp-subject">{s.subject}</span>
                    <div className="ss-cmp-bars" aria-hidden="true">
                      <div className="ss-bar">
                        <i style={{ width: `${s.score}%` }} />
                      </div>
                      <div className="ss-bar">
                        <i className="bm" style={{ width: `${b}%` }} />
                      </div>
                    </div>
                    <span className="ss-cmp-score">
                      {s.score}
                      <span className="ss-sr">
                        , {bmLabel.toLowerCase()} average {b}
                      </span>
                    </span>
                    <span className={`ss-result-change ${g.kind}`}>{g.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="ss-legend">
              <span>
                <i className="me" />
                You
              </span>
              <span>
                <i className="bm" />
                {bmLabel} average
              </span>
            </div>
          </>
        ) : (
          <p className="ss-empty">No exams recorded yet.</p>
        )}
      </div>
    </section>
  );
}

type HeatMode = "me" | "stream" | "grade";

const HEAT_MODES: { key: HeatMode; label: string }[] = [
  { key: "me", label: "My scores" },
  { key: "stream", label: "Stream average" },
  { key: "grade", label: "Grade average" },
];

const HEAT_LEGEND: [number, string][] = [
  [1, "Below 41"],
  [2, "41 to 57"],
  [3, "58 to 74"],
  [4, "75 to 89"],
  [5, "90 and above"],
];

function HeatmapCard({ progress }: { progress: Progress }) {
  const [mode, setMode] = useState<HeatMode>("me");
  const { stats, subjects } = progress;
  const key = mode === "me" ? "score" : mode;
  const modeLabel = HEAT_MODES.find((m) => m.key === mode)?.label ?? "";

  return (
    <section id="heatmap" className="ss-card ss-panel" aria-labelledby="heatmap-title">
      <header>
        <h3 id="heatmap-title">Subject heatmap</h3>
        <span className="ss-count">{stats.length} exams, oldest to newest</span>
      </header>
      <div className="ss-pbody">
        {stats.length ? (
          <>
            <div className="ss-seg ss-seg-lg" role="group" aria-label="Heatmap data">
              {HEAT_MODES.map((m) => (
                <button key={m.key} type="button" className={mode === m.key ? "is-on" : ""} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="ss-xscroll">
              <table className="ss-hmap">
                <caption className="ss-sr">{modeLabel} by subject and exam</caption>
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    {stats.map((s) => (
                      <th scope="col" key={s.exam.id}>
                        {s.exam.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject}>
                      <th scope="row">{subject}</th>
                      {stats.map((s) => {
                        const v = s.exam.scores.find((x) => x.subject === subject)?.[key];
                        return (
                          <td key={s.exam.id} className="ss-hm" data-l={v == null ? 0 : heatLevel(v)}>
                            {v ?? "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Average</th>
                    {stats.map((s) => (
                      <td key={s.exam.id} className="ss-hm ss-hm-mean">
                        {avg(s.exam.scores.map((x) => x[key])).toFixed(1)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="ss-hm-legend" aria-label="Colour key">
              {HEAT_LEGEND.map(([l, text]) => (
                <span key={l}>
                  <i className="ss-hm" data-l={l} />
                  {text}
                </span>
              ))}
            </div>
            <p className="ss-muted" style={{ margin: 0 }}>
              Darker cells mean higher scores. Every cell also shows its number.
            </p>
          </>
        ) : (
          <p className="ss-empty">No exams recorded yet.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Exam results in a grouped statement layout: one table, a header row, a
 * coloured band per exam (newest first), one row per subject, and a totals row.
 */
function ExamResultsCard({ progress }: { progress: Progress }) {
  const [term, setTerm] = useState("All");

  const rows = useMemo(
    () => progress.stats.map((s, i) => ({ ...s, prev: i > 0 ? progress.stats[i - 1] : null })).reverse(),
    [progress],
  );
  const terms = useMemo(() => Array.from(new Set(rows.map((r) => r.exam.term))), [rows]);
  const shown = rows.filter((r) => term === "All" || r.exam.term === term);

  return (
    <section id="exams" className="ss-card ss-panel" aria-labelledby="exams-title">
      <header>
        <h3 id="exams-title">Exam results</h3>
        <span className="ss-count">
          {shown.length} of {rows.length} exams, newest first
        </span>
      </header>
      <div className="ss-pbody">
        {rows.length ? (
          <>
            <div className="ss-toolbar" style={{ margin: 0 }}>
              <label className="ss-lab">
                Show
                <select className="ss-input ss-input-auto" value={term} onChange={(e) => setTerm(e.target.value)}>
                  <option value="All">All terms</option>
                  {terms.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ss-xscroll">
              <table className="ss-statement">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Subject</th>
                    <th scope="col" className="ss-c">
                      Score
                    </th>
                    <th scope="col" className="ss-c">
                      Band
                    </th>
                    <th scope="col" className="ss-c">
                      Stream average
                    </th>
                    <th scope="col" className="ss-c">
                      Grade average
                    </th>
                  </tr>
                </thead>
                {shown.map((r) => {
                  const scores = r.exam.scores;
                  const total = sum(scores.map((s) => s.score));
                  const ch = r.prev ? change(r.me - r.prev.me, " pts") : null;
                  return (
                    <tbody key={r.exam.id}>
                      <tr className="ss-st-band">
                        <th scope="colgroup" colSpan={6}>
                          <span className="ss-st-title">
                            {r.exam.name} · {fmtDate(r.exam.date)}
                          </span>
                          <span className="ss-st-meta">
                            Average {r.me.toFixed(1)}% ({bandFor(r.me)}) · {ordinal(r.exam.streamPosition)} of {r.exam.streamSize} in stream ·{" "}
                            {ordinal(r.exam.gradePosition)} of {r.exam.gradeSize} in grade
                            {ch && r.prev ? ` · ${ch.label} since ${r.prev.exam.short}` : ""}
                          </span>
                        </th>
                      </tr>
                      {scores.map((s) => (
                        <tr key={s.subject} className="ss-st-row">
                          <td>{s.code ?? s.subject.slice(0, 4).toUpperCase()}</td>
                          <td>{s.subject}</td>
                          <td className="ss-c">{s.score}</td>
                          <td className="ss-c">{bandFor(s.score)}</td>
                          <td className="ss-c">{s.stream}</td>
                          <td className="ss-c">{s.grade}</td>
                        </tr>
                      ))}
                      <tr className="ss-st-total">
                        <td colSpan={2} className="ss-st-label">
                          Total and average
                        </td>
                        <td className="ss-c">
                          {total} / {scores.length * 100}
                        </td>
                        <td className="ss-c">{bandFor(r.me)}</td>
                        <td className="ss-c">{r.stream.toFixed(1)}</td>
                        <td className="ss-c">{r.grade.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  );
                })}
              </table>
            </div>
          </>
        ) : (
          <p className="ss-empty">Your exam results will appear here once they are published.</p>
        )}
      </div>
    </section>
  );
}

function PlanCard({ tasks, onToggle }: { tasks: StudyTask[]; onToggle: (id: string) => void }) {
  const doneCount = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <section id="plan" className="ss-card ss-panel" aria-labelledby="plan-title">
      <header>
        <h3 id="plan-title">Your study plan this week</h3>
        <span className="ss-count">
          {doneCount} of {tasks.length} done
        </span>
      </header>
      <div className="ss-pbody">
        <div className="ss-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Study plan progress">
          <i className="gold" style={{ width: `${percent}%` }} />
        </div>
        <div className="ss-tasks">
          {tasks.map((t) => (
            <button key={t.id} type="button" className="ss-task" aria-pressed={t.done} onClick={() => onToggle(t.id)}>
              <span className="ss-task-box" aria-hidden="true">
                {t.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </span>
              <span className="ss-task-day">{t.day}</span>
              <span className="ss-task-text">{t.text}</span>
              <span className="ss-task-mins">{t.mins} min</span>
            </button>
          ))}
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          Tap a task to tick it off. The plan updates every week from your results and quizzes.
        </p>
      </div>
    </section>
  );
}

function TopicsCard({ topics, onNavigate }: { topics: Topic[]; onNavigate?: (key: string) => void }) {
  return (
    <section id="weak" className="ss-card ss-panel" aria-labelledby="topics-title">
      <header>
        <h3 id="topics-title">Topics to strengthen</h3>
      </header>
      <p className="ss-note">Based on your marks and tutor sessions. You choose what is shared with teachers and parents.</p>
      <div className="ss-topics" style={{ marginTop: 12 }}>
        {topics.map((t) => (
          <div className="ss-topic" key={`${t.subject}-${t.topic}`}>
            <div>
              <small>{t.subject}</small>
              <strong>{t.topic}</strong>
            </div>
            <button type="button" className="ss-btn ss-btn-sm" onClick={() => onNavigate?.(t.key)}>
              {t.action}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Learning materials                                                  */
/* ------------------------------------------------------------------ */

function MaterialsCard({
  materials,
  onDownload,
}: {
  materials: Material[];
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const [subject, setSubject] = useState("All");
  const [kind, setKind] = useState("All");
  const subjects = useMemo(() => Array.from(new Set(materials.map((m) => m.subject))), [materials]);
  const kinds = useMemo(() => Array.from(new Set(materials.map((m) => m.kind))), [materials]);
  const shown = materials.filter((m) => (subject === "All" || m.subject === subject) && (kind === "All" || m.kind === kind));

  return (
    <section id="materials" className="ss-card ss-panel" aria-labelledby="materials-title">
      <header>
        <h3 id="materials-title">Notes and past papers</h3>
        <span className="ss-count">
          {shown.length} of {materials.length} PDFs
        </span>
      </header>
      <div className="ss-pbody">
        <div className="ss-toolbar" style={{ margin: 0 }}>
          <label className="ss-lab">
            Subject
            <select className="ss-input ss-input-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="All">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="ss-lab">
            Type
            <select className="ss-input ss-input-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="All">All types</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        {shown.length ? (
          <div className="ss-scroll ss-scroll-sm">
            <ul className="ss-list ss-mat">
              {shown.map((m) => (
                <li key={m.id}>
                  <span className="ss-tag">{m.kind}</span>
                  <div>
                    <strong>{m.title}</strong>
                    <small>
                      {m.subject} · PDF · {m.sizeLabel} · {m.addedLabel}
                    </small>
                  </div>
                  <DownloadButton kind="material" id={m.id} label="Download" what={m.title} url={m.url} onDownload={onDownload} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ss-empty">No materials match these filters.</p>
        )}
      </div>
    </section>
  );
}

function ResultsDownloadsCard({
  progress,
  onDownload,
}: {
  progress: Progress;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const rows = useMemo(() => [...progress.stats].reverse(), [progress]);

  return (
    <section id="downloads" className="ss-card ss-panel" aria-labelledby="downloads-title">
      <header>
        <h3 id="downloads-title">Results downloads</h3>
        <span className="ss-count">{rows.length} report cards</span>
      </header>
      <div className="ss-pbody">
        {rows.length ? (
          <div className="ss-scroll ss-scroll-sm">
            <ul className="ss-list">
              {rows.map((r) => (
                <li key={r.exam.id}>
                  <div>
                    <strong>{r.exam.name}</strong>
                    <small>
                      {fmtDate(r.exam.date)} · Average {r.me.toFixed(1)}%
                    </small>
                  </div>
                  <DownloadButton kind="report-card" id={r.exam.id} label="Report card" what={r.exam.name} url={r.exam.reportUrl} onDownload={onDownload} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ss-empty">Report cards appear here once results are published.</p>
        )}
        <DownloadButton kind="report-card" id="all" label="Download all results (PDF)" small={false} onDownload={onDownload} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
/* ------------------------------------------------------------------ */

function StructurePanel({
  fees,
  onNavigate,
  onDownload,
}: {
  fees: LearnerDashboardData["fees"];
  onNavigate?: (key: string) => void;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const [i, setI] = useState(() => Math.max(0, fees.structure.findIndex((t) => t.term === fees.currentTerm)));
  const t = fees.structure[i];
  if (!t) return <p className="ss-empty">No fee structure has been published yet.</p>;
  const total = sum(t.lines.map((l) => l.amount));

  return (
    <>
      <div className="ss-seg ss-seg-lg" role="group" aria-label="Term">
        {fees.structure.map((s, idx) => (
          <button key={s.term} type="button" className={idx === i ? "is-on" : ""} aria-pressed={idx === i} onClick={() => setI(idx)}>
            {s.term}
          </button>
        ))}
      </div>
      <div className="ss-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="ss-num">Amount ({fees.currency})</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.name}>
                <td>{l.name}</td>
                <td className="ss-num">{fmt(l.amount)}</td>
              </tr>
            ))}
            <tr className="ss-total">
              <td>
                <strong>Total for {t.term}</strong>
              </td>
              <td className="ss-num">
                <strong>{fmt(total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ss-muted" style={{ margin: 0 }}>
        This is the same structure as on the Fees pages. Payment is due {t.dueLabel}.
      </p>
      <div className="ss-btn-row">
        <button type="button" className="ss-btn ss-btn-primary" onClick={() => onNavigate?.("fees-structure")}>
          Open full fee structure
        </button>
        <DownloadButton kind="fee-structure" id={t.term} label="Download PDF" what={`${t.term} fee structure`} small={false} onDownload={onDownload} />
      </div>
    </>
  );
}

function PaymentsPanel({ fees }: { fees: LearnerDashboardData["fees"] }) {
  const rows = useMemo(() => [...fees.payments].sort((a, b) => b.date.localeCompare(a.date)), [fees.payments]);
  if (!rows.length) return <p className="ss-empty">No payments have been recorded yet.</p>;

  return (
    <div className="ss-scroll">
      <table className="ss-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Method</th>
            <th>Term</th>
            <th className="ss-num">Amount ({fees.currency})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.date)}</td>
              <td>{p.reference}</td>
              <td>{p.method}</td>
              <td>{p.term}</td>
              <td className="ss-num">{fmt(p.amount)}</td>
            </tr>
          ))}
          <tr className="ss-total">
            <td colSpan={4}>
              <strong>Total paid</strong>
            </td>
            <td className="ss-num">
              <strong>{fmt(sum(rows.map((p) => p.amount)))}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BalancesPanel({
  currency,
  summary,
  onNavigate,
}: {
  currency: string;
  summary: FeeSummary;
  onNavigate?: (key: string) => void;
}) {
  return (
    <>
      <div className="ss-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              <th>Term</th>
              <th className="ss-num">Billed ({currency})</th>
              <th className="ss-num">Paid</th>
              <th className="ss-num">Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.term}>
                <td>{r.term}</td>
                <td className="ss-num">{fmt(r.billed)}</td>
                <td className="ss-num">{fmt(r.paid)}</td>
                <td className="ss-num">
                  <strong>{fmt(r.balance)}</strong>
                </td>
                <td>
                  {r.balance === 0 ? (
                    <span className="ss-tag ok">Cleared</span>
                  ) : r.overdue > 0 ? (
                    <span className="ss-tag warn">Overdue</span>
                  ) : (
                    <span className="ss-tag">Due {r.dueLabel}</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="ss-total">
              <td>
                <strong>All terms</strong>
              </td>
              <td className="ss-num">
                <strong>{fmt(summary.billed)}</strong>
              </td>
              <td className="ss-num">
                <strong>{fmt(summary.paid)}</strong>
              </td>
              <td className="ss-num">
                <strong>{fmt(summary.outstanding)}</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="ss-btn-row">
        <button type="button" className="ss-btn ss-btn-primary" onClick={() => onNavigate?.("fees-invoices")}>
          View invoices
        </button>
        <button type="button" className="ss-btn" onClick={() => onNavigate?.("fees-query")}>
          Raise a fee query
        </button>
      </div>
    </>
  );
}

function ReceiptsPanel({
  fees,
  onDownload,
}: {
  fees: LearnerDashboardData["fees"];
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const rows = useMemo(() => [...fees.payments].sort((a, b) => b.date.localeCompare(a.date)), [fees.payments]);
  if (!rows.length) return <p className="ss-empty">Receipts appear here after each payment.</p>;

  return (
    <div className="ss-scroll ss-scroll-sm">
      <ul className="ss-list">
        {rows.map((p) => (
          <li key={p.id}>
            <div>
              <strong>Receipt {p.receiptNo}</strong>
              <small>
                {fmtDate(p.date)} · {p.method} · {p.term}
              </small>
            </div>
            <b className="ss-rc-amt">
              {fees.currency} {fmt(p.amount)}
            </b>
            <DownloadButton kind="receipt" id={p.id} label="Download" what={`receipt ${p.receiptNo}`} url={p.receiptUrl} onDownload={onDownload} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisPanel({ fees, summary }: { fees: LearnerDashboardData["fees"]; summary: FeeSummary }) {
  const { payments, currency } = fees;
  if (!payments.length) return <p className="ss-empty">Fee analysis appears here after your first payment.</p>;

  const year = Math.max(...payments.map((p) => Number(p.date.slice(0, 4))));
  const months = Array.from({ length: 12 }, (_, m) => ({
    label: new Date(year, m, 1).toLocaleDateString("en-KE", { month: "short" }),
    total: sum(
      payments
        .filter((p) => Number(p.date.slice(0, 4)) === year && Number(p.date.slice(5, 7)) === m + 1)
        .map((p) => p.amount),
    ),
  }));
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  const methodTotals = new Map<string, number>();
  payments.forEach((p) => methodTotals.set(p.method, (methodTotals.get(p.method) ?? 0) + p.amount));
  const methods = Array.from(methodTotals.entries()).sort((a, b) => b[1] - a[1]);

  const total = sum(payments.map((p) => p.amount));
  const latest = [...payments].sort((a, b) => b.date.localeCompare(a.date))[0];
  const paidPercent = summary.billed > 0 ? Math.min(100, Math.round((summary.paid / summary.billed) * 100)) : 0;

  return (
    <>
      <div className="ss-trio">
        <div>
          <span>Payments made</span>
          <b>{payments.length}</b>
        </div>
        <div>
          <span>Average payment</span>
          <b>{fmt(Math.round(total / payments.length))}</b>
        </div>
        <div>
          <span>Largest payment</span>
          <b>{fmt(Math.max(...payments.map((p) => p.amount)))}</b>
        </div>
      </div>

      <div>
        <strong className="ss-h4">
          Payments by month, {year} ({currency})
        </strong>
        <div className="ss-cols" style={{ marginTop: 10 }}>
          {months.map((m) => (
            <div className="ss-col" key={m.label} role="img" aria-label={`${m.label}: ${fmt(m.total)} ${currency}`}>
              <div className="ss-col-bars">
                <i className="col" style={{ height: `${(m.total / maxMonth) * 100}%` }} title={`${m.label}: ${fmt(m.total)}`} />
              </div>
              <small>{m.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div>
        <strong className="ss-h4">Share of each term paid</strong>
        <div className="ss-rows">
          {summary.rows.map((r) => {
            const pct = r.billed > 0 ? Math.min(100, Math.round((r.paid / r.billed) * 100)) : 0;
            return (
              <div className="ss-rowbar" key={r.term}>
                <span>{r.term}</span>
                <div className="ss-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.term} paid`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <strong className="ss-h4">How you paid</strong>
        <div className="ss-rows">
          {methods.map(([method, amount]) => {
            const pct = Math.round((amount / total) * 100);
            return (
              <div className="ss-rowbar" key={method}>
                <span>{method}</span>
                <div className="ss-bar" aria-hidden="true">
                  <i className="bm" style={{ width: `${pct}%` }} />
                </div>
                <span>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="ss-muted" style={{ margin: 0 }}>
        You have paid {paidPercent}% of this year's fees. Your last payment was {currency} {fmt(latest.amount)} on {fmtDate(latest.date)}.
      </p>
    </>
  );
}

function FeesCard({
  fees,
  summary,
  tab,
  onTab,
  onNavigate,
  onDownload,
}: {
  fees: LearnerDashboardData["fees"];
  summary: FeeSummary;
  tab: FeesTab;
  onTab: (t: FeesTab) => void;
  onNavigate?: (key: string) => void;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const { currency } = fees;
  const percent = summary.billed > 0 ? Math.min(100, Math.round((summary.paid / summary.billed) * 100)) : 0;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = FEES_TABS.findIndex((t) => t.key === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % FEES_TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + FEES_TABS.length) % FEES_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = FEES_TABS.length - 1;
    else return;
    e.preventDefault();
    const key = FEES_TABS[next].key;
    onTab(key);
    document.getElementById(`fees-tab-${key}`)?.focus();
  };

  return (
    <section id="fees" className="ss-card ss-panel" aria-labelledby="fees-title">
      <header>
        <h3 id="fees-title">Fees</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("fees")}>
          Open the Fees pages
        </button>
      </header>
      <div className="ss-pbody">
        <div>
          <div className="ss-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Fees paid this year">
            <i style={{ width: `${percent}%` }} />
          </div>
          <p className="ss-muted" style={{ margin: "8px 0 0" }}>
            {percent}% of {currency} {fmt(summary.billed)} paid this year
          </p>
        </div>
        <div className="ss-trio">
          <div>
            <span>Billed</span>
            <b>{fmt(summary.billed)}</b>
          </div>
          <div>
            <span>Paid</span>
            <b>{fmt(summary.paid)}</b>
          </div>
          <div>
            <span>Outstanding</span>
            <b>{fmt(summary.outstanding)}</b>
          </div>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          Amounts in {currency}. {summary.overdue > 0 ? `${fmt(summary.overdue)} is overdue.` : "Nothing is overdue."}
        </p>

        <div className="ss-tabs" role="tablist" aria-label="Fees views" onKeyDown={onKey}>
          {FEES_TABS.map((t) => (
            <button
              key={t.key}
              id={`fees-tab-${t.key}`}
              type="button"
              role="tab"
              className="ss-tab"
              aria-selected={tab === t.key}
              aria-controls="fees-panel"
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => onTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="fees-panel" role="tabpanel" aria-labelledby={`fees-tab-${tab}`} className="ss-tabpanel">
          {tab === "structure" ? <StructurePanel fees={fees} onNavigate={onNavigate} onDownload={onDownload} /> : null}
          {tab === "payments" ? <PaymentsPanel fees={fees} /> : null}
          {tab === "balances" ? <BalancesPanel currency={currency} summary={summary} onNavigate={onNavigate} /> : null}
          {tab === "receipts" ? <ReceiptsPanel fees={fees} onDownload={onDownload} /> : null}
          {tab === "analysis" ? <AnalysisPanel fees={fees} summary={summary} /> : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

function ConsentTag({ ok }: { ok: boolean }) {
  return ok ? <span className="ss-tag ok">Guardian consent on record</span> : <span className="ss-tag warn">Consent needed</span>;
}

function ChatCard({
  ai,
  onAsk,
  onNavigate,
}: {
  ai: LearnerDashboardData["ai"];
  onAsk?: (q: string) => void;
  onNavigate?: (key: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const ok = ai.consentOnRecord;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    onAsk?.(q);
    setQuestion("");
  };

  return (
    <section id="ai-chat" className="ss-card ss-panel" aria-labelledby="chat-title">
      <header>
        <h3 id="chat-title">AI Chat</h3>
        <ConsentTag ok={ok} />
      </header>
      <div className="ss-pbody">
        <p className="ss-muted" style={{ margin: 0 }}>
          Ask a quick question about schoolwork, revision or exams. For a guided lesson, use the AI Tutor.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="ss-lab" htmlFor="chat-q">
            Your question
          </label>
          <div className="ss-inline">
            <input
              id="chat-q"
              className="ss-input"
              type="text"
              placeholder="Type your question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!ok}
            />
            <button type="submit" className="ss-btn ss-btn-primary" disabled={!ok}>
              Ask
            </button>
          </div>
        </form>
        <div className="ss-chips">
          {ai.chat.suggestions.map((s) => (
            <button key={s} type="button" className="ss-chip" disabled={!ok} onClick={() => setQuestion(s)}>
              {s}
            </button>
          ))}
        </div>
        {ai.chat.recent.length ? (
          <>
            <strong className="ss-h4">Recent chats</strong>
            <div className="ss-shortcuts">
              {ai.chat.recent.map((c) => (
                <button key={c.id} type="button" className="ss-shortcut" onClick={() => onNavigate?.(`chat-${c.id}`)}>
                  <span>{c.title}</span>
                  <small>{c.when}</small>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className="ss-btn-row">
          <button type="button" className="ss-btn" onClick={() => onNavigate?.("chat")}>
            Open full chat
          </button>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          AI-generated answers. Your chats stay private to you. Check with your teacher if something seems off.
        </p>
      </div>
    </section>
  );
}

const TUTOR_MODES: { key: TutorMode; label: string }[] = [
  { key: "teach", label: "Teach me step by step" },
  { key: "practice", label: "Practise with feedback" },
  { key: "revise", label: "Revise before an exam" },
];

function TutorCard({
  ai,
  subjects,
  onStart,
  onNavigate,
}: {
  ai: LearnerDashboardData["ai"];
  subjects: string[];
  onStart?: (r: TutorRequest) => void;
  onNavigate?: (key: string) => void;
}) {
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<TutorMode>("teach");
  const ok = ai.consentOnRecord;
  const { tutor } = ai;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    onStart?.({ subject, topic: t, mode });
    setTopic("");
  };

  return (
    <section id="ai-tutor" className="ss-card ss-panel" aria-labelledby="tutor-title">
      <header>
        <h3 id="tutor-title">AI Tutor</h3>
        <ConsentTag ok={ok} />
      </header>
      <div className="ss-pbody">
        <p className="ss-muted" style={{ margin: 0 }}>
          The Tutor teaches in short steps, checks that you understood, and adjusts to your answers.
        </p>
        <form onSubmit={submit} className="ss-tform">
          <label className="ss-lab" htmlFor="tutor-subject">
            Subject
            <select id="tutor-subject" className="ss-input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!ok}>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="ss-lab" htmlFor="tutor-mode">
            How should we work?
            <select id="tutor-mode" className="ss-input" value={mode} onChange={(e) => setMode(e.target.value as TutorMode)} disabled={!ok}>
              {TUTOR_MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ss-lab ss-span2" htmlFor="tutor-topic">
            Topic
            <input
              id="tutor-topic"
              className="ss-input"
              type="text"
              placeholder="For example: Electromagnetic induction"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!ok}
            />
          </label>
          <div className="ss-span2">
            <button type="submit" className="ss-btn ss-btn-primary" disabled={!ok}>
              <Icon name="tutor" size={16} />
              Start lesson
            </button>
          </div>
        </form>

        {tutor.path.length ? (
          <>
            <strong className="ss-h4">Your learning path</strong>
            <div className="ss-path">
              {tutor.path.map((p) => (
                <div className="ss-path-row" key={`${p.subject}-${p.topic}`}>
                  <div>
                    <strong>{p.topic}</strong>
                    <small>{p.subject}</small>
                  </div>
                  <div className="ss-bar" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.topic} progress`}>
                    <i style={{ width: `${p.percent}%` }} />
                  </div>
                  <span>{p.percent}%</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="ss-shortcuts">
          <button type="button" className="ss-shortcut" onClick={() => onNavigate?.("tutor-resume")}>
            <span>Continue: {tutor.resumeTopic}</span>
            <small>{tutor.resumeWhen}</small>
          </button>
          <button type="button" className="ss-shortcut" onClick={() => onNavigate?.("tutor-saved")}>
            <span>Saved explanations</span>
            <small>{tutor.savedCount} saved</small>
          </button>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          AI-generated lessons. Your sessions stay private to you. Check with your teacher if something seems off.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Career pathway recommender                                          */
/* ------------------------------------------------------------------ */

function CareerCard({
  career,
  progress,
  onNavigate,
}: {
  career: LearnerDashboardData["career"];
  progress: Progress;
  onNavigate?: (key: string) => void;
}) {
  const latest = progress.stats[progress.stats.length - 1];
  const strengths = latest ? [...latest.exam.scores].sort((a, b) => b.score - a.score).slice(0, 3) : [];
  const pathways = useMemo(() => [...career.pathways].sort((a, b) => b.match - a.match), [career.pathways]);

  return (
    <section id="career" className="ss-card ss-panel" aria-labelledby="career-title">
      <header>
        <h3 id="career-title">Career pathway recommender</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("career-recommender")}>
          Open the recommender
        </button>
      </header>
      <div className="ss-pbody">
        <div>
          <div className="ss-bar" role="progressbar" aria-valuenow={career.profilePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Interest profile progress">
            <i style={{ width: `${career.profilePercent}%` }} />
          </div>
          <p className="ss-muted" style={{ margin: "8px 0 0" }}>
            Interest and strengths profile: {career.profilePercent}% complete.
            {career.profilePercent < 100 ? " Finish it to sharpen these suggestions." : ""}
          </p>
        </div>

        {strengths.length ? (
          <div>
            <strong className="ss-h4">Your strongest subjects right now</strong>
            <div className="ss-chips" style={{ marginTop: 8 }}>
              {strengths.map((s) => (
                <span className="ss-tag" key={s.subject}>
                  {s.subject} {s.score}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <strong className="ss-h4">Suggested pathways</strong>
        {pathways.length ? (
          <div className="ss-careers">
            {pathways.map((c) => (
              <div className="ss-career" key={c.id}>
                <div className="ss-career-head">
                  <strong>{c.title}</strong>
                  <span className="ss-tag ok">{c.match}% match</span>
                </div>
                <div className="ss-bar" role="progressbar" aria-valuenow={c.match} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} match`}>
                  <i style={{ width: `${c.match}%` }} />
                </div>
                <p>{c.why}</p>
                {c.subjects.length ? <small>Builds on {c.subjects.join(", ")}</small> : null}
                <div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => onNavigate?.(`career-pathway-${c.id}`)}>
                    View pathway
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ss-empty">Complete your interest profile to get your first suggestions.</p>
        )}

        <div className="ss-btn-row">
          <button type="button" className="ss-btn ss-btn-primary" onClick={() => onNavigate?.("career-profile")}>
            {career.profilePercent < 100 ? "Continue profile" : "Review profile"}
          </button>
          <button type="button" className="ss-btn" onClick={() => onNavigate?.("career-pathways")}>
            Explore all pathways
          </button>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          These are ideas, not decisions. Suggestions come from your results and interests, and you can change or remove any of them.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

function AnnouncementsCard({ notices, onNavigate }: { notices: Notice[]; onNavigate?: (key: string) => void }) {
  return (
    <section id="announcements" className="ss-card ss-panel" aria-labelledby="notices-title">
      <header>
        <h3 id="notices-title">Announcements</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("announcements")}>
          See all
        </button>
      </header>
      <ul className="ss-list ss-news" style={{ marginTop: 4 }}>
        {notices.map((n) => (
          <li key={n.id} className={n.unread ? "is-unread" : "is-read"}>
            <span className={`ss-tag${n.tag === "Finance" ? " warn" : ""}`}>{n.tag}</span>
            <div>
              <strong>{n.title}</strong>
              <small>{n.meta}</small>
            </div>
            {n.unread ? <span className="ss-tag warn">New</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LearnerDashboard({
  data = SAMPLE_DATA,
  theme = "light",
  onNavigate,
  onTaskToggle,
  onAskChat,
  onStartTutor,
  onDownload,
}: LearnerDashboardProps) {
  const [tasks, setTasks] = useState<StudyTask[]>(data.tasks);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feesTab, setFeesTab] = useState<FeesTab>("balances");
  const [activeKey, setActiveKey] = useState("dashboard");

  const progress = useMemo(() => buildProgress(data.exams), [data.exams]);
  const summary = useMemo(() => buildFeeSummary(data.fees), [data.fees]);
  const latest = progress.stats[progress.stats.length - 1];

  const toggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const done = !target.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    onTaskToggle?.(id, done);
  };

  const tasksLeft = tasks.filter((t) => !t.done).length;

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  const select = (item: NavItem) => {
    setMenuOpen(false);
    setActiveKey(item.key);
    if (item.feesTab) setFeesTab(item.feesTab);
    if (item.section) goTo(item.section);
  };

  const tutorSubjects = progress.subjects.length ? progress.subjects : Array.from(new Set(data.materials.map((m) => m.subject)));

  return (
    <div id="top" className="ss-shell" data-theme={theme}>
      <Sidebar
        data={data}
        open={menuOpen}
        activeKey={activeKey}
        onClose={() => setMenuOpen(false)}
        onSelect={select}
        onNavigate={onNavigate}
      />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <PageHeader dateLabel={data.dateLabel} onOpenMenu={() => setMenuOpen(true)} />

        <main className="ss-content">
          <Hero data={data} latest={latest} outstanding={summary.outstanding} tasksLeft={tasksLeft} onGoto={goTo} />

          <SectionHead id="progress" title="Academic progress" note="How you are doing, and how that compares with your stream and your grade." />
          <KpiRow stats={progress.stats} attendance={data.attendance} />
          <div className="ss-two">
            <TrendCard stats={progress.stats} />
            <SubjectCompareCard stats={progress.stats} />
          </div>
          <HeatmapCard progress={progress} />
          <ExamResultsCard progress={progress} />
          <div className="ss-two">
            <PlanCard tasks={tasks} onToggle={toggleTask} />
            <TopicsCard topics={data.topics} onNavigate={onNavigate} />
          </div>

          <SectionHead title="Learning materials" note="Download notes, past papers and your report cards as PDFs." />
          <div className="ss-two">
            <MaterialsCard materials={data.materials} onDownload={onDownload} />
            <ResultsDownloadsCard progress={progress} onDownload={onDownload} />
          </div>

          <SectionHead title="Fees" note="Your fee structure, payments, balances, receipts and a summary of how you have paid." />
          <FeesCard fees={data.fees} summary={summary} tab={feesTab} onTab={setFeesTab} onNavigate={onNavigate} onDownload={onDownload} />

          <SectionHead title="AI learning support" note="Use Chat for quick questions and the Tutor for lessons." />
          <div className="ss-ai">
            <ChatCard ai={data.ai} onAsk={onAskChat} onNavigate={onNavigate} />
            <TutorCard ai={data.ai} subjects={tutorSubjects} onStart={onStartTutor} onNavigate={onNavigate} />
          </div>

          <SectionHead title="Career pathways" note="Ideas for what to study next, based on your results and interests." />
          <CareerCard career={data.career} progress={progress} onNavigate={onNavigate} />

          <AnnouncementsCard notices={data.notices} onNavigate={onNavigate} />
        </main>
      </div>
    </div>
  );
}