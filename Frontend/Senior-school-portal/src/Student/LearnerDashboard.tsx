import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/learnerApi";

/* Styles live in the shared portal stylesheet (section 6 "Learner dashboard
   additions" and section 13 "Learner portal pages"). Import that stylesheet
   once at the app root. */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SubjectScore {
  subject: string;
  code?: string;
  score: number;
  stream: number;
  grade: number;
}

export interface ExamRecord {
  id: string;
  name: string;
  short: string;
  term: string;
  /** Exam type for filtering, e.g. "Opener", "CAT", "Mid-term", "End of term". Worked out from the name when left out. */
  type?: string;
  date: string;
  scores: SubjectScore[];
  streamPosition: number;
  streamSize: number;
  gradePosition: number;
  gradeSize: number;
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
  url?: string;
}

export interface FeeLine {
  name: string;
  amount: number;
}

export interface FeeTerm {
  term: string;
  dueLabel: string;
  overdue: number;
  lines: FeeLine[];
}

export interface FeePayment {
  id: string;
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
  match: number;
  why: string;
  subjects: string[];
  /** Example careers shown in the pathway explorer. */
  examples?: string[];
}

export interface TimetableEntry {
  id: string;
  /** "Mon" to "Fri". */
  day: string;
  /** 24-hour time, e.g. "08:00". */
  start: string;
  end: string;
  subject: string;
  room?: string;
  teacher?: string;
  kind?: "lesson" | "break";
}

export interface LearnerProfile {
  admissionNo?: string;
  gender?: string;
  /** ISO date. */
  dob?: string;
  pathway?: string;
  guardian?: string;
  guardianPhone?: string;
  email?: string;
}

export type TutorMode = "teach" | "practice" | "revise";

export interface TutorRequest {
  subject: string;
  topic: string;
  mode: TutorMode;
}

export type PayMethod = "M-Pesa" | "Bank transfer" | "Card";

export interface PayFeesRequest {
  term: string;
  amount: number;
  method: PayMethod;
  /** Only for M-Pesa. */
  phone?: string;
}

export type DownloadKind = "material" | "report-card" | "receipt" | "fee-structure" | "fee-statement";

export interface LearnerDashboardData {
  learner: { firstName: string; fullName: string; classLabel: string; admissionNo?: string };
  profile?: LearnerProfile;
  termLabel: string;
  dateLabel: string;
  attendance: { percent: number; present: number; total: number };
  exams: ExamRecord[];
  materials: Material[];
  timetable: TimetableEntry[];
  fees: {
    currency: string;
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
}

/** Every page in the sidebar. Each one is a real route, see PAGE_PATHS. */
export type PageKey =
  | "home"
  | "profile"
  | "academic-transcript"
  | "academic-dashboard"
  | "fees-pay"
  | "fees-structure"
  | "fees-statement"
  | "timetable"
  | "career-recommender"
  | "career-explorer"
  | "materials"
  | "announcements"
  | "ai";

export interface LearnerDashboardProps {
  data?: LearnerDashboardData;
  theme?: "light" | "dark";
  /** Which page to show. Each route in App.tsx passes its own. */
  page?: PageKey;
  /** School crest shown in the sidebar instead of the "SP" mark. */
  logoSrc?: string;
  /**
   * Called for things that live outside the sidebar pages, such as "privacy",
   * "fees-query", a topic key, "chat-<id>", "tutor-resume" or "tutor-saved".
   * Moves between the sidebar pages are real route changes handled inside.
   */
  onNavigate?: (key: string) => void;
  onTaskToggle?: (id: string, done: boolean) => void;
  onAskChat?: (question: string) => void;
  onStartTutor?: (request: TutorRequest) => void;
  /** Called when the learner submits the Pay fees form. */
  onPayFees?: (request: PayFeesRequest) => void;
  /** Called when a notice is marked as read. */
  onNoticeRead?: (id: string) => void;
  onDownload?: (kind: DownloadKind, id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Sample data. Replace with API data.                                 */
/* ------------------------------------------------------------------ */

const SUBJECTS = ["Mathematics", "English", "Kiswahili", "Biology", "Chemistry", "Physics"];
const CODES = ["MATH", "ENG", "KISW", "BIO", "CHEM", "PHYS"];
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const LESSON_TIMES: [string, string][] = [
  ["08:00", "08:40"],
  ["08:40", "09:20"],
  ["09:20", "10:00"],
  ["10:30", "11:10"],
  ["11:10", "11:50"],
  ["11:50", "12:30"],
  ["14:00", "14:40"],
  ["14:40", "15:20"],
];
/* Index into TT_NAMES for each lesson of each day. */
const TT_PLAN = [
  [0, 1, 5, 3, 2, 4, 0, 6],
  [5, 0, 1, 4, 3, 2, 5, 6],
  [2, 4, 0, 1, 5, 3, 1, 6],
  [3, 5, 4, 0, 1, 2, 4, 0],
  [1, 2, 3, 5, 0, 4, 3, 6],
];
const TT_NAMES = [...SUBJECTS, "Games and clubs"];
const TT_TEACHERS = ["Mr. Kamau", "Ms. Wanjiru", "Mr. Mwangi", "Ms. Achieng", "Mr. Kiprop", "Ms. Njoki", "Games staff"];
const TT_ROOMS = ["Room 4", "Room 2", "Room 6", "Lab 1", "Lab 2", "Lab 3", "Field"];

const SAMPLE_TIMETABLE: TimetableEntry[] = DAYS.flatMap((day, d) => [
  ...TT_PLAN[d].map((s, i) => ({
    id: `${day}-${i}`,
    day,
    start: LESSON_TIMES[i][0],
    end: LESSON_TIMES[i][1],
    subject: TT_NAMES[s],
    room: TT_ROOMS[s],
    teacher: TT_TEACHERS[s],
    kind: "lesson" as const,
  })),
  { id: `${day}-tea`, day, start: "10:00", end: "10:30", subject: "Tea break", kind: "break" as const },
  { id: `${day}-lunch`, day, start: "12:30", end: "14:00", subject: "Lunch break", kind: "break" as const },
]);

export const SAMPLE_DATA: LearnerDashboardData = {
  learner: { firstName: "Grace", fullName: "Grace Njeri", classLabel: "Grade 10 · East stream" },
  profile: {
    admissionNo: "SS-2026-0187",
    gender: "Female",
    dob: "2010-05-14",
    pathway: "STEM",
    guardian: "Mrs. Wanjiru Njeri",
    guardianPhone: "0712 345 678",
    email: "grace.njeri@example.com",
  },
  termLabel: "Term 3, 2026",
  dateLabel: "Tuesday 17 November 2026",
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
  timetable: SAMPLE_TIMETABLE,
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
        examples: ["Software developer", "Data analyst", "Cybersecurity analyst"],
      },
      {
        id: "civil-engineering",
        title: "Civil engineering",
        match: 81,
        why: "Builds on Mathematics and Physics, and your interest in designing things that last.",
        subjects: ["Mathematics", "Physics"],
        examples: ["Structural engineer", "Quantity surveyor", "Urban planner"],
      },
      {
        id: "biomedical-science",
        title: "Biomedical science",
        match: 74,
        why: "Matches your interest in how the body works. Biology topics are a good place to build up first.",
        subjects: ["Biology", "Chemistry"],
        examples: ["Laboratory scientist", "Pharmacist", "Medical researcher"],
      },
      {
        id: "medicine-health",
        title: "Medicine and health",
        match: 69,
        why: "Your Biology and Chemistry marks are a base to build on. Chemistry is the subject to strengthen most.",
        subjects: ["Biology", "Chemistry"],
        examples: ["Doctor", "Nurse", "Public health officer"],
      },
      {
        id: "teaching",
        title: "Teaching and education",
        match: 66,
        why: "Fits your strong Kiswahili and English results and the way you explain ideas to others.",
        subjects: ["English", "Kiswahili"],
        examples: ["Secondary school teacher", "Curriculum developer", "Education officer"],
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
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => n.toLocaleString("en-KE");
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export function ordinal(n: number) {
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

export function change(d: number, unit = ""): { kind: Kind; label: string } {
  const r = Math.round(d * 10) / 10;
  if (r > 0) return { kind: "up", label: `Up ${r}${unit}` };
  if (r < 0) return { kind: "down", label: `Down ${Math.abs(r)}${unit}` };
  return { kind: "flat", label: "No change" };
}

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
export const bandFor = (n: number) => (BANDS.find((b) => n >= b.min) ?? BANDS[BANDS.length - 1]).label;
const heatLevel = (n: number) => (n >= 90 ? 5 : n >= 75 ? 4 : n >= 58 ? 3 : n >= 41 ? 2 : 1);

export interface ExamStat {
  exam: ExamRecord;
  me: number;
  stream: number;
  grade: number;
}

export interface Progress {
  stats: ExamStat[];
  subjects: string[];
}

export function buildProgress(exams: ExamRecord[]): Progress {
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
/* Pages and navigation                                                */
/* ------------------------------------------------------------------ */

/** The AI assistant's name, used in the sidebar and on its page. */
const AI_NAME = "Mwalimu AI";

type IconName =
  | "search"
  | "bolt"
  | "home"
  | "profile"
  | "exams"
  | "progress"
  | "payments"
  | "structure"
  | "balance"
  | "timetable"
  | "career"
  | "pathways"
  | "materials"
  | "announcements"
  | "sparkle"
  | "tutor"
  | "download"
  | "menu"
  | "close";

interface PageMeta {
  label: string;
  title: string;
  note: string;
  icon: IconName;
}

const PAGES: Record<PageKey, PageMeta> = {
  home: { label: "Dashboard", title: "Learner Dashboard", note: "", icon: "home" },
  profile: { label: "Profile", title: "My profile", note: "Your details as the school has them on record.", icon: "profile" },
  "academic-transcript": {
    label: "Academic transcript",
    title: "Academic transcript",
    note: "Every exam result in one statement, with report cards you can download.",
    icon: "exams",
  },
  "academic-dashboard": {
    label: "Academic dashboard",
    title: "Academic dashboard",
    note: "How you are doing, and how that compares with your stream and your grade.",
    icon: "progress",
  },
  "fees-pay": { label: "Pay fees", title: "Pay fees", note: "Pay a term's balance in a few steps.", icon: "payments" },
  "fees-structure": {
    label: "Fee structure",
    title: "Fee structure",
    note: "What each term costs, item by item, and when it is due.",
    icon: "structure",
  },
  "fees-statement": {
    label: "Fees statement and balances",
    title: "Fees statement and balances",
    note: "Your balances, payment statement, receipts and a summary of how you have paid.",
    icon: "balance",
  },
  timetable: { label: "Timetable", title: "Timetable", note: "Your weekly lessons, breaks and rooms.", icon: "timetable" },
  "career-recommender": {
    label: "Pathway recommender",
    title: "Pathway recommender",
    note: "Ideas for what to study next, based on your results and interests.",
    icon: "career",
  },
  "career-explorer": {
    label: "Pathways explorer",
    title: "Pathways explorer",
    note: "Browse every pathway and see the careers it can lead to.",
    icon: "pathways",
  },
  materials: {
    label: "Learning materials",
    title: "Learning materials",
    note: "Download notes, past papers, worksheets and revision packs as PDFs.",
    icon: "materials",
  },
  announcements: {
    label: "Announcements",
    title: "Announcements",
    note: "News from the school, your class teacher and the finance office.",
    icon: "announcements",
  },
  ai: {
    label: AI_NAME,
    title: AI_NAME,
    note: "Ask quick questions in Chat, or learn a topic step by step with the Tutor.",
    icon: "sparkle",
  },
};

/** Route of each page. These match the <Route path> values in App.tsx. */
export const PAGE_PATHS: Record<PageKey, string> = {
  home: "/Learner/Dashboard",
  profile: "/Learner/Profile",
  "academic-transcript": "/Academics/Results",
  "academic-dashboard": "/Academics/Dashboard",
  "fees-pay": "/Finance/PayFees",
  "fees-structure": "/Finance/Fee/Structure",
  "fees-statement": "/Finance/Fee/statement",
  timetable: "/Academic/Timetable",
  "career-recommender": "/CareerPathways",
  "career-explorer": "/Explore/Pathways",
  materials: "/Academic/LearningMaterials",
  announcements: "/Learner/Announcements",
  ai: "/AI/Chat",
};

const isPage = (k: string): k is PageKey => Object.prototype.hasOwnProperty.call(PAGES, k);

/** Sidebar order. A group without a label is a single link. */
const NAV: { label?: string; keys: PageKey[] }[] = [
  { label: "Overview", keys: ["home", "profile"] },
  { label: "Academic", keys: ["academic-transcript", "academic-dashboard"] },
  { label: "Finances", keys: ["fees-pay", "fees-structure", "fees-statement"] },
  { keys: ["timetable"] },
  { label: "Career pathway", keys: ["career-recommender", "career-explorer"] },
  { keys: ["materials"] },
  { keys: ["announcements"] },
  { keys: ["ai"] },
];

/** Keys that older cards use, mapped to the page that now holds that content. */
const ALIASES: Record<string, PageKey> = {
  fees: "fees-statement",
  "fees-invoices": "fees-statement",
  "career-pathways": "career-explorer",
  "career-profile": "career-recommender",
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICON_PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  exams: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </>
  ),
  progress: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  payments: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  structure: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h7" />
    </>
  ),
  balance: <path d="M12 4v16M6 20h12M5 8h14M5 8l-3 7a3 3 0 0 0 6 0zM19 8l-3 7a3 3 0 0 0 6 0z" />,
  timetable: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  career: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  pathways: <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 5-12 2-12 6" />,
  materials: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  announcements: (
    <>
      <path d="M4 10v4h3l8 4V6L7 10H4z" />
      <path d="M18.5 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  tutor: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />
    </>
  ),
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
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

function Sidebar({
  learner,
  open,
  page,
  badges,
  logoSrc,
  onClose,
}: {
  learner: LearnerDashboardData["learner"];
  open: boolean;
  page: PageKey;
  badges: Partial<Record<PageKey, number>>;
  logoSrc?: string;
  onClose: () => void;
}) {
  return (
    <aside id="learner-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className={`ss-logo${logoSrc ? " has-img" : ""}`} aria-hidden="true">
          {logoSrc ? <img src={logoSrc} alt="" /> : <strong>SP</strong>}
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
        {NAV.map((group, gi) => (
          <div className="ss-group" key={group.label ?? `g${gi}`}>
            {group.label ? <p className="ss-group-label">{group.label}</p> : null}
            {group.keys.map((key) => {
              const meta = PAGES[key];
              const active = key === page;
              const badge = badges[key];
              return (
                <Link
                  key={key}
                  to={PAGE_PATHS[key]}
                  className={`ss-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon name={meta.icon} />
                  <span>{meta.label}</span>
                  {key === "ai" ? <em className="ss-pill">AI</em> : null}
                  {badge ? (
                    <em className="ss-badge" style={{ fontStyle: "normal" }}>
                      <span className="ss-sr">{badge} unread</span>
                      <span aria-hidden="true">{badge}</span>
                    </em>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        className="ss-link"
        style={{ background: "none", border: 0, width: "100%", cursor: "pointer", textAlign: "left" }}
        onClick={logout}
      >
        <span>Logout</span>
      </button>

      <div className="ss-side-foot">
        {learner.fullName} · {learner.classLabel}
      </div>
    </aside>
  );
}

function PageHeader({ title, dateLabel, learner, onOpenMenu }: { title: string; dateLabel: string; learner: LearnerDashboardData["learner"]; onOpenMenu: () => void }) {
  return (
    <header className="ss-header">
      <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="learner-sidebar" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      <div className="ss-h-title">
        <h1>{title}</h1>
        <span>{dateLabel}</span>
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <strong style={{ display: "block" }}>{learner.fullName}</strong>
        {learner.admissionNo ? <small>Adm No: {learner.admissionNo}</small> : null}
      </div>
    </header>
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
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfilePage({ data, onNavigate }: { data: LearnerDashboardData; onNavigate: (key: string) => void }) {
  const p = data.profile ?? {};
  const initials = data.learner.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const personal: [string, string | undefined][] = [
    ["Full name", data.learner.fullName],
    ["Class", data.learner.classLabel],
    ["Admission number", p.admissionNo],
    ["Gender", p.gender],
    ["Date of birth", p.dob ? fmtDate(p.dob) : undefined],
    ["Senior school pathway", p.pathway],
  ];
  const contact: [string, string | undefined][] = [
    ["Parent or guardian", p.guardian],
    ["Guardian phone", p.guardianPhone],
    ["Learner email", p.email],
  ];

  return (
    <>
      <section className="ss-card ss-profile-head" aria-label="Learner summary">
        <span className="ss-avatar-lg" aria-hidden="true">
          {initials}
        </span>
        <div>
          <h2>{data.learner.fullName}</h2>
          <p className="ss-muted" style={{ margin: "2px 0 0" }}>
            {data.learner.classLabel} · {data.termLabel}
          </p>
        </div>
        <button type="button" className="ss-btn ss-profile-btn" onClick={() => onNavigate("privacy")}>
          Settings and privacy
        </button>
      </section>

      <div className="ss-two">
        <section className="ss-card ss-panel" aria-labelledby="personal-title">
          <header>
            <h3 id="personal-title">Personal details</h3>
          </header>
          <dl className="ss-dl">
            {personal.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v ?? "Not on record"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="ss-card ss-panel" aria-labelledby="contact-title">
          <header>
            <h3 id="contact-title">Guardian and contact</h3>
          </header>
          <dl className="ss-dl ss-dl-one">
            {contact.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v ?? "Not on record"}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="ss-card ss-panel" aria-labelledby="record-title">
        <header>
          <h3 id="record-title">This term at a glance</h3>
          <span className="ss-count">{data.termLabel}</span>
        </header>
        <div className="ss-pbody">
          <div>
            <div className="ss-bar" role="progressbar" aria-valuenow={data.attendance.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Attendance">
              <i style={{ width: `${data.attendance.percent}%` }} />
            </div>
            <p className="ss-muted" style={{ margin: "8px 0 0" }}>
              Attendance {data.attendance.percent}%: {data.attendance.present} of {data.attendance.total} school days.
            </p>
          </div>
          <p className="ss-muted" style={{ margin: 0 }}>
            If something here is wrong, please ask the school office to correct it. You cannot edit these details yourself.
          </p>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Academic dashboard                                                  */
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
  onGoto: (key: PageKey) => void;
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
          You have <strong>{tasksLeft}</strong> study {tasksLeft === 1 ? "task" : "tasks"} left this week. {AI_NAME} is ready when you are.
        </p>
        <div className="ss-hero-btns">
          <button type="button" className="ss-btn ss-btn-gold" onClick={() => onGoto("ai")}>
            <Icon name="tutor" size={16} />
            Start a tutor lesson
          </button>
          <button type="button" className="ss-btn ss-btn-ghost" onClick={() => onGoto("academic-transcript")}>
            See my transcript
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
    <section className="ss-card ss-panel" aria-labelledby="heatmap-title">
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

function PlanCard({ tasks, onToggle }: { tasks: StudyTask[]; onToggle: (id: string) => void }) {
  const doneCount = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <section className="ss-card ss-panel" aria-labelledby="plan-title">
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

function TopicsCard({ topics, onNavigate }: { topics: Topic[]; onNavigate: (key: string) => void }) {
  return (
    <section className="ss-card ss-panel" aria-labelledby="topics-title">
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
            <button type="button" className="ss-btn ss-btn-sm" onClick={() => onNavigate(t.key)}>
              {t.action}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Academic transcript                                                 */
/* ------------------------------------------------------------------ */

function ExamResultsCard({ progress }: { progress: Progress }) {
  const [term, setTerm] = useState("All");

  const rows = useMemo(
    () => progress.stats.map((s, i) => ({ ...s, prev: i > 0 ? progress.stats[i - 1] : null })).reverse(),
    [progress],
  );
  const terms = useMemo(() => Array.from(new Set(rows.map((r) => r.exam.term))), [rows]);
  const shown = rows.filter((r) => term === "All" || r.exam.term === term);

  return (
    <section className="ss-card ss-panel" aria-labelledby="exams-title">
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

function ResultsDownloadsCard({
  progress,
  onDownload,
}: {
  progress: Progress;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const rows = useMemo(() => [...progress.stats].reverse(), [progress]);

  return (
    <section className="ss-card ss-panel" aria-labelledby="downloads-title">
      <header>
        <h3 id="downloads-title">Report cards</h3>
        <span className="ss-count">{rows.length} available</span>
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
/* Finances: pay fees, fee structure, statement and balances           */
/* ------------------------------------------------------------------ */

const PAY_METHODS: PayMethod[] = ["M-Pesa", "Bank transfer", "Card"];
const KE_PHONE = /^(?:\+?254|0)[17]\d{8}$/;

function PayFeesPage({
  fees,
  summary,
  onPay,
  onGoto,
}: {
  fees: LearnerDashboardData["fees"];
  summary: FeeSummary;
  onPay?: (r: PayFeesRequest) => void;
  onGoto: (key: PageKey) => void;
}) {
  const owing = summary.rows.filter((r) => r.balance > 0);
  const balanceOf = (t: string) => summary.rows.find((r) => r.term === t)?.balance ?? 0;
  const firstTerm = owing.find((r) => r.term === fees.currentTerm)?.term ?? owing[0]?.term ?? "";

  const [term, setTerm] = useState(firstTerm);
  const [amount, setAmount] = useState(firstTerm ? String(balanceOf(firstTerm)) : "");
  const [method, setMethod] = useState<PayMethod>("M-Pesa");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; phone?: string }>({});
  const [sent, setSent] = useState("");

  const changeTerm = (t: string) => {
    setTerm(t);
    setAmount(String(balanceOf(t)));
    setErrors({});
    setSent("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: { amount?: string; phone?: string } = {};
    const amt = Number(amount.replace(/,/g, "").trim());
    const bal = balanceOf(term);
    if (!Number.isFinite(amt) || amt <= 0) next.amount = "Enter the amount you want to pay.";
    else if (amt > bal) next.amount = `This is more than the ${fees.currency} ${fmt(bal)} balance for ${term}.`;
    if (method === "M-Pesa" && !KE_PHONE.test(phone.replace(/\s+/g, ""))) {
      next.phone = "Enter a Safaricom number such as 0712 345 678.";
    }
    setErrors(next);
    if (next.amount || next.phone) {
      setSent("");
      return;
    }
    onPay?.({ term, amount: amt, method, phone: method === "M-Pesa" ? phone.replace(/\s+/g, "") : undefined });
    setSent(
      method === "M-Pesa"
        ? `Payment request of ${fees.currency} ${fmt(amt)} for ${term} sent. Approve it on your phone.`
        : `Payment of ${fees.currency} ${fmt(amt)} for ${term} submitted.`,
    );
  };

  return (
    <div className="ss-two">
      <section className="ss-card ss-panel" aria-labelledby="pay-title">
        <header>
          <h3 id="pay-title">Make a payment</h3>
        </header>
        {owing.length ? (
          <form className="ss-payform" onSubmit={submit} noValidate>
            <label className="ss-lab" htmlFor="pay-term">
              Term
              <select id="pay-term" className="ss-input" value={term} onChange={(e) => changeTerm(e.target.value)}>
                {owing.map((r) => (
                  <option key={r.term} value={r.term}>
                    {r.term}: balance {fees.currency} {fmt(r.balance)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ss-lab" htmlFor="pay-amount">
              Amount ({fees.currency})
              <input
                id="pay-amount"
                className="ss-input"
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={errors.amount ? true : undefined}
                aria-describedby={errors.amount ? "pay-amount-err" : undefined}
              />
              {errors.amount ? (
                <span id="pay-amount-err" className="ss-field-err">
                  {errors.amount}
                </span>
              ) : null}
            </label>
            <label className="ss-lab" htmlFor="pay-method">
              Payment method
              <select id="pay-method" className="ss-input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {method === "M-Pesa" ? (
              <label className="ss-lab" htmlFor="pay-phone">
                M-Pesa phone number
                <input
                  id="pay-phone"
                  className="ss-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? "pay-phone-err" : undefined}
                />
                {errors.phone ? (
                  <span id="pay-phone-err" className="ss-field-err">
                    {errors.phone}
                  </span>
                ) : null}
              </label>
            ) : null}
            <button type="submit" className="ss-btn ss-btn-primary">
              Pay {amount && Number(amount.replace(/,/g, "")) > 0 ? `${fees.currency} ${fmt(Number(amount.replace(/,/g, "")) || 0)}` : "now"}
            </button>
            <p role="status" className="ss-sent" style={{ margin: 0 }}>
              {sent}
            </p>
          </form>
        ) : (
          <div className="ss-pbody">
            <p className="ss-empty">You have no balance to pay. Every term is cleared.</p>
            <div className="ss-btn-row">
              <button type="button" className="ss-btn" onClick={() => onGoto("fees-statement")}>
                See your statement
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="ss-card ss-panel" aria-labelledby="owing-title">
        <header>
          <h3 id="owing-title">What you owe</h3>
          <span className="ss-count">
            {fees.currency} {fmt(summary.outstanding)} in total
          </span>
        </header>
        <div className="ss-pbody">
          <ul className="ss-list">
            {summary.rows.map((r) => (
              <li key={r.term}>
                <div>
                  <strong>{r.term}</strong>
                  <small>
                    Billed {fmt(r.billed)} · Paid {fmt(r.paid)}
                  </small>
                </div>
                {r.balance === 0 ? (
                  <span className="ss-tag ok">Cleared</span>
                ) : (
                  <span className={`ss-tag${r.overdue > 0 ? " warn" : ""}`}>
                    {fmt(r.balance)} {r.overdue > 0 ? "overdue" : `due ${r.dueLabel}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="ss-muted" style={{ margin: 0 }}>
            A receipt appears in your fees statement after the payment is recorded.
          </p>
          <div className="ss-btn-row">
            <button type="button" className="ss-btn" onClick={() => onGoto("fees-structure")}>
              See fee structure
            </button>
            <button type="button" className="ss-btn" onClick={() => onGoto("fees-statement")}>
              See statement
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeeStructurePage({
  fees,
  onGoto,
  onDownload,
}: {
  fees: LearnerDashboardData["fees"];
  onGoto: (key: PageKey) => void;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const [i, setI] = useState(() => Math.max(0, fees.structure.findIndex((t) => t.term === fees.currentTerm)));
  const t = fees.structure[i];

  return (
    <section className="ss-card ss-panel" aria-labelledby="structure-title">
      <header>
        <h3 id="structure-title">Fees by term</h3>
        {t ? <span className="ss-count">Due {t.dueLabel}</span> : null}
      </header>
      <div className="ss-pbody">
        {t ? (
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
                      <strong>{fmt(sum(t.lines.map((l) => l.amount)))}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="ss-btn-row">
              <button type="button" className="ss-btn ss-btn-primary" onClick={() => onGoto("fees-pay")}>
                Pay fees
              </button>
              <DownloadButton kind="fee-structure" id={t.term} label="Download PDF" what={`${t.term} fee structure`} small={false} onDownload={onDownload} />
            </div>
          </>
        ) : (
          <p className="ss-empty">No fee structure has been published yet.</p>
        )}
      </div>
    </section>
  );
}

type StatementTab = "balances" | "statement" | "receipts" | "analysis";

const STATEMENT_TABS: { key: StatementTab; label: string }[] = [
  { key: "balances", label: "Balances" },
  { key: "statement", label: "Payment statement" },
  { key: "receipts", label: "Receipts" },
  { key: "analysis", label: "Analysis" },
];

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
  onGoto,
  onNavigate,
}: {
  currency: string;
  summary: FeeSummary;
  onGoto: (key: PageKey) => void;
  onNavigate: (key: string) => void;
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
        {summary.outstanding > 0 ? (
          <button type="button" className="ss-btn ss-btn-primary" onClick={() => onGoto("fees-pay")}>
            Pay balance
          </button>
        ) : null}
        <button type="button" className="ss-btn" onClick={() => onNavigate("fees-query")}>
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

function StatementCard({
  fees,
  summary,
  onGoto,
  onNavigate,
  onDownload,
}: {
  fees: LearnerDashboardData["fees"];
  summary: FeeSummary;
  onGoto: (key: PageKey) => void;
  onNavigate: (key: string) => void;
  onDownload?: (kind: DownloadKind, id: string) => void;
}) {
  const [tab, setTab] = useState<StatementTab>("balances");
  const { currency } = fees;
  const percent = summary.billed > 0 ? Math.min(100, Math.round((summary.paid / summary.billed) * 100)) : 0;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = STATEMENT_TABS.findIndex((t) => t.key === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % STATEMENT_TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + STATEMENT_TABS.length) % STATEMENT_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STATEMENT_TABS.length - 1;
    else return;
    e.preventDefault();
    const key = STATEMENT_TABS[next].key;
    setTab(key);
    document.getElementById(`fees-tab-${key}`)?.focus();
  };

  return (
    <section className="ss-card ss-panel" aria-labelledby="fees-title">
      <header>
        <h3 id="fees-title">Fees this year</h3>
        <DownloadButton kind="fee-statement" id="all" label="Download statement" what="fees statement" onDownload={onDownload} />
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
          {STATEMENT_TABS.map((t) => (
            <button
              key={t.key}
              id={`fees-tab-${t.key}`}
              type="button"
              role="tab"
              className="ss-tab"
              aria-selected={tab === t.key}
              aria-controls="fees-panel"
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="fees-panel" role="tabpanel" aria-labelledby={`fees-tab-${tab}`} className="ss-tabpanel">
          {tab === "balances" ? <BalancesPanel currency={currency} summary={summary} onGoto={onGoto} onNavigate={onNavigate} /> : null}
          {tab === "statement" ? <PaymentsPanel fees={fees} /> : null}
          {tab === "receipts" ? <ReceiptsPanel fees={fees} onDownload={onDownload} /> : null}
          {tab === "analysis" ? <AnalysisPanel fees={fees} summary={summary} /> : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Timetable                                                           */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TimetablePage({ entries }: { entries: TimetableEntry[] }) {
  const today = WEEKDAYS[new Date().getDay()];
  const slots = useMemo(() => {
    const seen = new Map<string, { start: string; end: string }>();
    entries.forEach((e) => seen.set(`${e.start}-${e.end}`, { start: e.start, end: e.end }));
    return Array.from(seen.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [entries]);
  const find = (day: string, s: { start: string; end: string }) =>
    entries.find((e) => e.day === day && e.start === s.start && e.end === s.end);
  const todays = entries.filter((e) => e.day === today && e.kind !== "break").sort((a, b) => a.start.localeCompare(b.start));

  if (!entries.length) {
    return (
      <section className="ss-card ss-panel">
        <p className="ss-empty" style={{ marginTop: 16 }}>
          Your timetable has not been published yet.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="ss-card ss-panel" aria-labelledby="tt-title">
        <header>
          <h3 id="tt-title">Weekly timetable</h3>
          <span className="ss-count">{DAYS.includes(today) ? `Today is ${today}` : "Enjoy your weekend"}</span>
        </header>
        <div className="ss-pbody">
          <div className="ss-xscroll">
            <table className="ss-tt">
              <caption className="ss-sr">Lessons by day and time</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  {DAYS.map((d) => (
                    <th scope="col" key={d} className={d === today ? "is-today" : ""}>
                      {d}
                      {d === today ? <span className="ss-sr"> (today)</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => {
                  const cells = DAYS.map((d) => find(d, s));
                  const allBreak = cells.every((c) => c?.kind === "break");
                  return (
                    <tr key={`${s.start}-${s.end}`} className={allBreak ? "is-break" : ""}>
                      <th scope="row">
                        {s.start} to {s.end}
                      </th>
                      {allBreak ? (
                        <td colSpan={DAYS.length}>{cells[0]?.subject}</td>
                      ) : (
                        cells.map((c, i) => (
                          <td key={DAYS[i]} className={DAYS[i] === today ? "is-today" : ""}>
                            {c ? (
                              <>
                                <strong>{c.subject}</strong>
                                {c.room || c.teacher ? <small>{[c.room, c.teacher].filter(Boolean).join(" · ")}</small> : null}
                              </>
                            ) : (
                              <span className="ss-muted">–</span>
                            )}
                          </td>
                        ))
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {todays.length ? (
        <section className="ss-card ss-panel" aria-labelledby="today-title">
          <header>
            <h3 id="today-title">Today's lessons</h3>
            <span className="ss-count">{todays.length} lessons</span>
          </header>
          <ul className="ss-list" style={{ marginTop: 4 }}>
            {todays.map((e) => (
              <li key={e.id}>
                <span className="ss-tag">
                  {e.start} to {e.end}
                </span>
                <div>
                  <strong>{e.subject}</strong>
                  <small>{[e.room, e.teacher].filter(Boolean).join(" · ")}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Career pathways                                                     */
/* ------------------------------------------------------------------ */

function RecommenderPage({
  career,
  progress,
  onGoto,
  onNavigate,
}: {
  career: LearnerDashboardData["career"];
  progress: Progress;
  onGoto: (key: PageKey) => void;
  onNavigate: (key: string) => void;
}) {
  const latest = progress.stats[progress.stats.length - 1];
  const strengths = latest ? [...latest.exam.scores].sort((a, b) => b.score - a.score).slice(0, 3) : [];
  const pathways = useMemo(() => [...career.pathways].sort((a, b) => b.match - a.match).slice(0, 3), [career.pathways]);

  return (
    <section className="ss-card ss-panel" aria-labelledby="career-title">
      <header>
        <h3 id="career-title">Your top suggestions</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGoto("career-explorer")}>
          Explore all pathways
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
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => onNavigate(`career-pathway-${c.id}`)}>
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
          <button type="button" className="ss-btn ss-btn-primary" onClick={() => onNavigate("career-profile")}>
            {career.profilePercent < 100 ? "Continue profile" : "Review profile"}
          </button>
          <button type="button" className="ss-btn" onClick={() => onGoto("career-explorer")}>
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

function ExplorerPage({
  career,
  focusId,
  onGoto,
}: {
  career: LearnerDashboardData["career"];
  focusId: string | null;
  onGoto: (key: PageKey) => void;
}) {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("All");
  const subjects = useMemo(() => Array.from(new Set(career.pathways.flatMap((p) => p.subjects))).sort(), [career.pathways]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...career.pathways]
      .filter((p) => subject === "All" || p.subjects.includes(subject))
      .filter((p) => !needle || `${p.title} ${p.why} ${(p.examples ?? []).join(" ")}`.toLowerCase().includes(needle))
      .sort((a, b) => b.match - a.match);
  }, [career.pathways, q, subject]);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`pathway-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);

  return (
    <section className="ss-card ss-panel" aria-labelledby="explore-title">
      <header>
        <h3 id="explore-title">All pathways</h3>
        <span className="ss-count">
          {shown.length} of {career.pathways.length}
        </span>
      </header>
      <div className="ss-pbody">
        <div className="ss-toolbar" style={{ margin: 0 }}>
          <label className="ss-lab">
            Search
            <input className="ss-input ss-input-auto" type="search" placeholder="For example: engineer" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="ss-lab">
            Builds on
            <select className="ss-input ss-input-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="All">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {shown.length ? (
          <div className="ss-careers">
            {shown.map((c) => (
              <div id={`pathway-${c.id}`} className={`ss-career${c.id === focusId ? " is-focus" : ""}`} key={c.id}>
                <div className="ss-career-head">
                  <strong>{c.title}</strong>
                  <span className="ss-tag ok">{c.match}% match</span>
                </div>
                <div className="ss-bar" role="progressbar" aria-valuenow={c.match} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} match`}>
                  <i style={{ width: `${c.match}%` }} />
                </div>
                <p>{c.why}</p>
                <small>Builds on {c.subjects.join(", ")}</small>
                {c.examples?.length ? (
                  <div>
                    <small>Careers you could follow</small>
                    <div className="ss-chips" style={{ marginTop: 6 }}>
                      {c.examples.map((x) => (
                        <span className="ss-tag" key={x}>
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGoto("ai")}>
                    Ask {AI_NAME} about this
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ss-empty">No pathways match your search.</p>
        )}
        <p className="ss-muted" style={{ margin: 0 }}>
          Match scores are guides, not decisions. Talk to your teacher or career guide before you choose.
        </p>
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
    <section className="ss-card ss-panel" aria-labelledby="materials-title">
      <header>
        <h3 id="materials-title">Notes, past papers and revision packs</h3>
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
          <div className="ss-scroll">
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

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

type NoticeFilter = "All" | "Unread" | Notice["tag"];
const NOTICE_FILTERS: NoticeFilter[] = ["All", "Unread", "School", "Class", "Finance"];

function AnnouncementsPage({
  notices,
  onRead,
  onReadAll,
}: {
  notices: Notice[];
  onRead: (id: string) => void;
  onReadAll: () => void;
}) {
  const [filter, setFilter] = useState<NoticeFilter>("All");
  const unread = notices.filter((n) => n.unread).length;
  const shown = notices.filter((n) => (filter === "All" ? true : filter === "Unread" ? n.unread : n.tag === filter));

  return (
    <section className="ss-card ss-panel" aria-labelledby="notices-title">
      <header>
        <h3 id="notices-title">Announcements</h3>
        <span className="ss-count">{unread} unread</span>
      </header>
      <div className="ss-pbody">
        <div className="ss-toolbar" style={{ margin: 0, justifyContent: "space-between" }}>
          <div className="ss-seg ss-seg-lg" role="group" aria-label="Filter announcements">
            {NOTICE_FILTERS.map((f) => (
              <button key={f} type="button" className={filter === f ? "is-on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          {unread > 0 ? (
            <button type="button" className="ss-link-btn" onClick={onReadAll}>
              Mark all as read
            </button>
          ) : null}
        </div>
        {shown.length ? (
          <ul className="ss-list ss-news">
            {shown.map((n) => (
              <li key={n.id} className={n.unread ? "is-unread" : "is-read"}>
                <span className={`ss-tag${n.tag === "Finance" ? " warn" : ""}`}>{n.tag}</span>
                <div>
                  <strong>{n.title}</strong>
                  <small>{n.meta}</small>
                </div>
                {n.unread ? (
                  <>
                    <span className="ss-tag warn">New</span>
                    <button type="button" className="ss-btn ss-btn-sm" onClick={() => onRead(n.id)} aria-label={`Mark as read: ${n.title}`}>
                      Mark as read
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ss-empty">Nothing to show here.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AI: Mwalimu AI                                                      */
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
  onNavigate: (key: string) => void;
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
    <section className="ss-card ss-panel" aria-labelledby="chat-title">
      <header>
        <h3 id="chat-title">Chat</h3>
        <ConsentTag ok={ok} />
      </header>
      <div className="ss-pbody">
        <p className="ss-muted" style={{ margin: 0 }}>
          Ask a quick question about schoolwork, revision or exams. For a guided lesson, use the Tutor.
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
                <button key={c.id} type="button" className="ss-shortcut" onClick={() => onNavigate(`chat-${c.id}`)}>
                  <span>{c.title}</span>
                  <small>{c.when}</small>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className="ss-btn-row">
          <button type="button" className="ss-btn" onClick={() => onNavigate("chat")}>
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
  onNavigate: (key: string) => void;
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
    <section className="ss-card ss-panel" aria-labelledby="tutor-title">
      <header>
        <h3 id="tutor-title">Tutor</h3>
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
          <button type="button" className="ss-shortcut" onClick={() => onNavigate("tutor-resume")}>
            <span>Continue: {tutor.resumeTopic}</span>
            <small>{tutor.resumeWhen}</small>
          </button>
          <button type="button" className="ss-shortcut" onClick={() => onNavigate("tutor-saved")}>
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
/* Dashboard: header and navigation tiles only                         */
/* ------------------------------------------------------------------ */

/** One line under each tile title. */
const TILE_BLURBS: Record<PageKey, string> = {
  home: "",
  profile: "Your details on record",
  "academic-transcript": "Exam results and report cards",
  "academic-dashboard": "Progress, rank and study plan",
  "fees-pay": "Pay a term's balance",
  "fees-structure": "What each term costs",
  "fees-statement": "Balances, payments and receipts",
  timetable: "Weekly lessons, breaks and rooms",
  "career-recommender": "Suggestions from your results",
  "career-explorer": "Browse pathways and careers",
  materials: "Notes, past papers, revision packs",
  announcements: "School, class and finance notices",
  ai: "Chat and step-by-step tutor",
};

type Tone = "blue" | "green" | "amber" | "purple";

/** Groups shown on the dashboard. Every tile is a real route. */
const HUB: { label: string; tone: Tone; keys: PageKey[] }[] = [
  { label: "Overview", tone: "amber", keys: ["profile"] },
  { label: "Academics", tone: "blue", keys: ["academic-transcript", "academic-dashboard"] },
  { label: "Finances", tone: "green", keys: ["fees-pay", "fees-structure", "fees-statement"] },
  { label: "Schedule", tone: "blue", keys: ["timetable"] },
  { label: "Career pathway", tone: "purple", keys: ["career-recommender", "career-explorer"] },
  { label: "Learning", tone: "blue", keys: ["materials"] },
  { label: "Communication", tone: "amber", keys: ["announcements"] },
  { label: "AI", tone: "purple", keys: ["ai"] },
];

function HomeHero({ data, latest, outstanding }: { data: LearnerDashboardData; latest?: ExamStat; outstanding: number }) {
  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: "progress", label: "Average", value: latest ? `${Math.round(latest.me)}%` : "–" },
    { icon: "profile", label: "Stream rank", value: latest ? ordinal(latest.exam.streamPosition) : "–" },
    { icon: "payments", label: `Balance (${data.fees.currency})`, value: fmt(outstanding) },
  ];
  return (
    <section className="ss-hero ss-home-hero" aria-label="Welcome">
      <div className="ss-hero-text">
        <span className="ss-eyebrow">
          {data.learner.classLabel} · {data.termLabel}
        </span>
        <h2>
          {greeting()}, {data.learner.firstName}
        </h2>
        <p>Senior School Learner Portal. Jump straight to what you need below.</p>
        <div className="ss-hero-btns">
          <Link to={PAGE_PATHS["academic-transcript"]} className="ss-btn ss-btn-gold">
            <Icon name="exams" size={16} />
            Academic transcript
          </Link>
          <Link to={PAGE_PATHS["fees-pay"]} className="ss-btn ss-btn-ghost">
            <Icon name="payments" size={16} />
            Pay fees
          </Link>
        </div>
      </div>
      <div className="ss-home-chips">
        {stats.map((st) => (
          <div className="ss-home-chip" key={st.label}>
            <span>
              <Icon name={st.icon} size={13} />
              {st.label}
            </span>
            <b>{st.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function HomePage({
  data,
  latest,
  outstanding,
  unread,
}: {
  data: LearnerDashboardData;
  latest?: ExamStat;
  outstanding: number;
  unread: number;
}) {
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const needle = q.trim().toLowerCase();

  /* Press "/" anywhere on the page to jump to the search box. */
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Groups with the most tiles come first. */
  const groups = useMemo(
    () =>
      HUB.map((g) => ({
        ...g,
        keys: g.keys.filter((k) => !needle || `${PAGES[k].label} ${TILE_BLURBS[k]} ${g.label}`.toLowerCase().includes(needle)),
      }))
        .filter((g) => g.keys.length)
        .sort((a, b) => b.keys.length - a.keys.length),
    [needle],
  );

  return (
    <>
      <HomeHero data={data} latest={latest} outstanding={outstanding} />

      <div className="ss-quick-head">
        <h2>
          <span className="ss-bolt" aria-hidden="true">
            <Icon name="bolt" size={16} />
          </span>
          Quick Navigation
        </h2>
        <div className="ss-qsearch">
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search tools..."
            aria-label="Search pages"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section className="ss-quick-group" key={group.label} aria-label={group.label}>
            <p className="ss-quick-label">
              <span>{group.label}</span>
              <i />
              <b>{group.keys.length}</b>
            </p>
            <div className="ss-tiles">
              {group.keys.map((key) => {
                const meta = PAGES[key];
                const badge = key === "announcements" ? unread : 0;
                return (
                  <Link key={key} to={PAGE_PATHS[key]} className="ss-tile" data-tone={group.tone}>
                    <span className="ss-tile-icon" aria-hidden="true">
                      <Icon name={meta.icon} />
                    </span>
                    <span className="ss-tile-text">
                      <strong>{meta.label}</strong>
                      <small>{TILE_BLURBS[key]}</small>
                    </span>
                    {badge ? (
                      <em className="ss-tile-badge">
                        <span className="ss-sr">{badge} unread</span>
                        <span aria-hidden="true">{badge}</span>
                      </em>
                    ) : null}
                    <span className="ss-tile-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="ss-empty">No pages match your search.</p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page shell and route-aware page                                     */
/* ------------------------------------------------------------------ */

const todayLabel = () =>
  new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export interface LearnerShellProps {
  /** Which sidebar link is highlighted. */
  page: PageKey;
  learner?: LearnerDashboardData["learner"];
  dateLabel?: string;
  /** Unread announcements, shown as a badge on the Announcements link. */
  unread?: number;
  theme?: "light" | "dark";
  /** Replaces the page title in the header. */
  title?: string;
  /** Short line under the header. Pass null to hide it. */
  note?: string | null;
  /** School crest shown in the sidebar instead of the "SP" mark. */
  logoSrc?: string;
  children: ReactNode;
}

/**
 * The learner sidebar and header around any content. Use it to give your own
 * pages (Timetable, PayFees and so on) the same sidebar:
 *   <LearnerShell page="timetable"> ...your page... </LearnerShell>
 */
export function LearnerShell({
  page,
  learner = SAMPLE_DATA.learner,
  dateLabel = todayLabel(),
  unread = 0,
  theme = "light",
  title,
  note,
  logoSrc,
  children,
}: LearnerShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const meta = PAGES[page];
  const shownNote = note === undefined ? meta.note : note;

  /* Start each page at the top and move focus to it. */
  useEffect(() => {
    setMenuOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);

  return (
    <div id="top" className="ss-shell ss-learner" data-theme={theme}>
      <Sidebar learner={learner} open={menuOpen} page={page} badges={{ announcements: unread }} logoSrc={logoSrc} onClose={() => setMenuOpen(false)} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <PageHeader title={title ?? meta.title} dateLabel={dateLabel} learner={learner} onOpenMenu={() => setMenuOpen(true)} />
        <main className="ss-content" ref={mainRef} tabIndex={-1}>
          {shownNote ? <p className="ss-page-note">{shownNote}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function LearnerDashboard({
  data = SAMPLE_DATA,
  theme = "light",
  page = "home",
  logoSrc,
  onNavigate,
  onTaskToggle,
  onAskChat,
  onStartTutor,
  onPayFees,
  onNoticeRead,
  onDownload,
}: LearnerDashboardProps) {
  const routerNavigate = useNavigate();
  const [tasks, setTasks] = useState<StudyTask[]>(data.tasks);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [focusPathway, setFocusPathway] = useState<string | null>(null);

  const progress = useMemo(() => buildProgress(data.exams), [data.exams]);
  const summary = useMemo(() => buildFeeSummary(data.fees), [data.fees]);
  const latest = progress.stats[progress.stats.length - 1];
  const notices = useMemo(() => data.notices.map((n) => ({ ...n, unread: n.unread && !readIds.has(n.id) })), [data.notices, readIds]);
  const unreadCount = notices.filter((n) => n.unread).length;
  const tasksLeft = tasks.filter((t) => !t.done).length;
  const tutorSubjects = progress.subjects.length ? progress.subjects : Array.from(new Set(data.materials.map((m) => m.subject)));

  /** Opens a sidebar page as a real route. */
  const navigate = (key: PageKey) => routerNavigate(PAGE_PATHS[key]);

  /** Sends a key to a sidebar page when it belongs to one, otherwise to onNavigate. */
  const go = (key: string) => {
    if (isPage(key)) return navigate(key);
    const alias = ALIASES[key];
    if (alias) return navigate(alias);
    if (key.startsWith("career-pathway-")) {
      setFocusPathway(key.slice("career-pathway-".length));
      return navigate("career-explorer");
    }
    if (key === "chat" || key === "tutor-resume" || key === "tutor-saved" || key.startsWith("chat-")) {
      onNavigate?.(key);
      return navigate("ai");
    }
    onNavigate?.(key);
  };

  const toggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const done = !target.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    onTaskToggle?.(id, done);
  };

  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    onNoticeRead?.(id);
  };
  const markAllRead = () => notices.filter((n) => n.unread).forEach((n) => markRead(n.id));

  let body: ReactNode;
  switch (page) {
    case "home":
      body = <HomePage data={data} latest={latest} outstanding={summary.outstanding} unread={unreadCount} />;
      break;
    case "profile":
      body = <ProfilePage data={data} onNavigate={go} />;
      break;
    case "academic-transcript":
      body = (
        <>
          <ExamResultsCard progress={progress} />
          <ResultsDownloadsCard progress={progress} onDownload={onDownload} />
        </>
      );
      break;
    case "academic-dashboard":
      body = (
        <>
          <Hero data={data} latest={latest} outstanding={summary.outstanding} tasksLeft={tasksLeft} onGoto={navigate} />
          <KpiRow stats={progress.stats} attendance={data.attendance} />
          <div className="ss-two">
            <TrendCard stats={progress.stats} />
            <SubjectCompareCard stats={progress.stats} />
          </div>
          <HeatmapCard progress={progress} />
          <div className="ss-two">
            <PlanCard tasks={tasks} onToggle={toggleTask} />
            <TopicsCard topics={data.topics} onNavigate={go} />
          </div>
        </>
      );
      break;
    case "fees-pay":
      body = <PayFeesPage fees={data.fees} summary={summary} onPay={onPayFees} onGoto={navigate} />;
      break;
    case "fees-structure":
      body = <FeeStructurePage fees={data.fees} onGoto={navigate} onDownload={onDownload} />;
      break;
    case "fees-statement":
      body = <StatementCard fees={data.fees} summary={summary} onGoto={navigate} onNavigate={go} onDownload={onDownload} />;
      break;
    case "timetable":
      body = <TimetablePage entries={data.timetable} />;
      break;
    case "career-recommender":
      body = <RecommenderPage career={data.career} progress={progress} onGoto={navigate} onNavigate={go} />;
      break;
    case "career-explorer":
      body = <ExplorerPage career={data.career} focusId={focusPathway} onGoto={navigate} />;
      break;
    case "materials":
      body = <MaterialsCard materials={data.materials} onDownload={onDownload} />;
      break;
    case "announcements":
      body = <AnnouncementsPage notices={notices} onRead={markRead} onReadAll={markAllRead} />;
      break;
    case "ai":
      body = (
        <div className="ss-ai">
          <ChatCard ai={data.ai} onAsk={onAskChat} onNavigate={go} />
          <TutorCard ai={data.ai} subjects={tutorSubjects} onStart={onStartTutor} onNavigate={go} />
        </div>
      );
      break;
  }

  return (
    <LearnerShell page={page} learner={data.learner} dateLabel={data.dateLabel} unread={unreadCount} theme={theme} logoSrc={logoSrc} note={page === "home" ? null : undefined}>
      {body}
    </LearnerShell>
  );
}