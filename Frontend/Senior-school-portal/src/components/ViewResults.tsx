import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
// Shared teacher sidebar
import TeacherSidebar from "../Teachers/TeacherSidebar";
import { apiUrl, authHeaders } from "../api/authApi";
import { ChartsDashboard } from "../ResultsCharts";
import { saveAnalysisPdf, saveClassPdf, saveReportCards } from "../resultsPdf";
import type { CardData } from "../resultsPdf";
import "../resultsCharts.css";

/* ------------------------------------------------------------------ */
/* Types (these mirror the JSON from ResultsController)                */
/* ------------------------------------------------------------------ */

export type Level = "Exceeding" | "Meeting" | "Approaching" | "Below";
export const LEVELS: Level[] = ["Exceeding", "Meeting", "Approaching", "Below"];

export interface Band {
  min: number;
  code: string;
  level: Level;
  points: number;
}

interface ExamOption {
  id: string;
  name: string;
  max: number;
}
interface YearOption {
  id: string;
  label: string;
  hasResults: boolean;
  hasPending: boolean;
  exams: ExamOption[];
}
interface ClassOption {
  id: string;
  label: string;
  grade: number;
}
interface Options {
  currentYearId: string | null;
  canIncludePending: boolean;
  meetingMark: number;
  bands: Band[];
  grades: { level: number; label: string }[];
  classes: ClassOption[];
  years: YearOption[];
}

type Levels = Record<Level, number>;
interface Top {
  name: string;
  className: string;
  mean: number;
}
interface Block {
  learners: number;
  withResults: number;
  mean: number | null;
  median: number | null;
  high: number | null;
  low: number | null;
  meetingRate: number | null;
  levels: Levels;
  top: Top | null;
}
interface GradeRow extends Block {
  grade: number;
  label: string;
  streams: number;
}
interface StreamRow extends Block {
  id: number;
  label: string;
  grade: number;
  rank: number | null;
  rankInGrade: number | null;
  best: string | null;
  weakest: string | null;
}
interface SubjectRow {
  id: number;
  name: string;
  count: number;
  mean: number | null;
  high: number | null;
  low: number | null;
  sd: number | null;
  meetingRate: number | null;
  byGrade: Record<string, number>;
  bestStream: string | null;
  weakestStream: string | null;
  levels: Levels;
}
interface BandRow {
  code: string;
  level: Level;
  min: number;
  count: number;
  pct: number;
}
interface LearnerLine {
  id: number;
  admNo: string;
  name: string;
  className: string;
  gender: string | null;
  mean: number | null;
  code: string | null;
  level: Level | null;
  rank: number | null;
  best: string | null;
  weakest: string | null;
  belowCount: number;
}
interface Mover {
  id: number;
  admNo: string;
  name: string;
  className: string;
  now: number;
  prev: number;
  change: number;
  nowCode: string;
  prevCode: string;
  rankNow: number | null;
  rankPrev: number | null;
}
interface Change {
  name: string;
  now: number;
  prev: number;
  change: number;
  n: number;
}
interface Comparison {
  current: { id: number; name: string };
  previous: { id: number; name: string };
  paired: number;
  summary: { meanNow: number; meanPrev: number; change: number; improved: number; declined: number; steady: number } | null;
  subjects: Change[];
  streams: (Change & { label: string; grade: number })[];
  grades: (Change & { label: string })[];
  improved: Mover[];
  declined: Mover[];
}
interface Meta {
  year: string;
  scope: string;
  exam: string;
  examsUsed: string[];
  includesPending: boolean;
  generatedAt: string;
}
export interface Analysis {
  meta: Meta;
  summary: {
    learners: number;
    withResults: number;
    mean: number | null;
    median: number | null;
    high: number | null;
    low: number | null;
    sd: number | null;
    meetingRate: number | null;
    belowMeeting: number;
    absentMarks: number;
    subjects: number;
    streams: number;
    meetingMark: number;
  };
  bands: BandRow[];
  grades: GradeRow[];
  streams: StreamRow[];
  subjects: SubjectRow[];
  subjectByStream: { streams: { id: number; label: string }[]; rows: { subject: string; means: (number | null)[] }[] };
  gender: { gender: string; learners: number; withResults: number; mean: number | null; meetingRate: number | null; levels: Levels }[];
  top: LearnerLine[];
  support: LearnerLine[];
  comparison: Comparison | null;
  exams: { id: number; name: string; max: number }[];
}

interface ClassLearner {
  id: number;
  admNo: string;
  name: string;
  gender: string | null;
  pcts: Record<string, number | null>;
  mean: number | null;
  points: number;
  code: string | null;
  level: Level | null;
  rank: number | null;
}
interface ClassData {
  meta: Meta;
  subjects: { id: number; name: string }[];
  learners: ClassLearner[];
  ranked: number;
  summary: { mean: number | null; high: number | null; low: number | null; meetingRate: number | null };
  subjectStats: { subjectId: number; mean: number | null; high: number | null; low: number | null; meetingRate: number | null; count: number }[];
}

export interface ViewResultsProps {
  schoolName?: string;
  termLabel?: string;
  userName?: string;
  theme?: "light" | "dark";
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: authHeaders(), signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const first = body?.errors ? (Object.values(body.errors as Record<string, string[]>)[0]?.[0] ?? null) : null;
    throw new Error(
      first ??
        body?.message ??
        (res.status === 401
          ? "Your session has ended. Please sign in again."
          : res.status === 403
            ? "You do not have permission to view results."
            : "Something went wrong. Please try again."),
    );
  }
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Formatting and grading (exported so they can be unit tested)        */
/* ------------------------------------------------------------------ */

export const isNum = (n: unknown): n is number => typeof n === "number" && !Number.isNaN(n);
export const fmt1 = (n: number | null | undefined) => (isNum(n) ? (Math.round(n * 10) / 10).toFixed(1) : "–");
export const signed = (n: number | null | undefined) => (isNum(n) ? `${n > 0 ? "+" : ""}${n.toFixed(1)}` : "–");
export const levelTag = (level: Level | null) => (level === "Below" ? "ss-tag warn" : level === "Approaching" ? "ss-tag" : "ss-tag ok");
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function gradeFor(pct: number, bands: Band[]): Band {
  return bands.find((b) => pct >= b.min) ?? bands[bands.length - 1];
}

export function autoRemark(level: Level | null): string {
  switch (level) {
    case "Exceeding":
      return "Excellent performance. Keep up the consistent effort and continue to challenge yourself.";
    case "Meeting":
      return "Good work. With a little more practice in the weaker subjects you can reach the next level.";
    case "Approaching":
      return "A fair performance. More revision and regular practice are needed, especially in the weaker subjects.";
    case "Below":
      return "Performance is below expectation. Please meet the class teacher so a support plan can be agreed.";
    default:
      return "No marks have been recorded for this learner yet.";
  }
}

/* ------------------------------------------------------------------ */
/* One list of sections drives the screen, the Excel file and the PDF  */
/* ------------------------------------------------------------------ */

export type ColType = "text" | "int" | "pct" | "delta";
export type Cell = string | number | null;

export interface Section {
  key: string;
  sheet: string; // Excel sheet name (sections with the same name share a sheet)
  tab: "overview" | "analysis";
  title: string;
  note?: string;
  cols: { h: string; t: ColType }[];
  rows: Cell[][];
  bar?: { col: number; max: number }; // screen only: a small bar under the number
  heat?: { from: number }; // screen only: shade the cells from this column on
}

export function buildSections(a: Analysis): Section[] {
  const out: Section[] = [];
  const s = a.summary;
  const cmp = a.comparison;
  const meeting = s.meetingMark;

  out.push({
    key: "summary",
    sheet: "Summary",
    tab: "overview",
    title: "Summary",
    cols: [
      { h: "Measure", t: "text" },
      { h: "Value", t: "text" },
    ],
    rows: [
      ["Scope", a.meta.scope],
      ["Year", a.meta.year],
      ["Exam", a.meta.exam + (a.meta.examsUsed.length > 1 ? ` (${a.meta.examsUsed.join(", ")})` : "")],
      ["Learners in scope", String(s.learners)],
      ["Learners with results", String(s.withResults)],
      ["Mean %", fmt1(s.mean)],
      ["Median %", fmt1(s.median)],
      ["Highest learner mean %", fmt1(s.high)],
      ["Lowest learner mean %", fmt1(s.low)],
      ["Spread (standard deviation)", fmt1(s.sd)],
      [`Meeting expectations or above (${meeting}% and over)`, `${fmt1(s.meetingRate)}%`],
      [`Learners below ${meeting}%`, String(s.belowMeeting)],
      ["Absent (ABS) marks left out", String(s.absentMarks)],
      ["Subjects", String(s.subjects)],
      ["Classes", String(s.streams)],
      ...(a.meta.includesPending ? [["Note", "Includes submitted results that are not yet approved."]] : []),
    ],
  });

  out.push({
    key: "grades",
    sheet: "Grades",
    tab: "overview",
    title: "General grade analysis",
    note: "Each grade, all classes together. Means are the average of learners' subject averages.",
    cols: [
      { h: "Grade", t: "text" },
      { h: "Classes", t: "int" },
      { h: "Learners", t: "int" },
      { h: "With results", t: "int" },
      { h: "Mean %", t: "pct" },
      { h: "Median %", t: "pct" },
      { h: "Highest %", t: "pct" },
      { h: "Lowest %", t: "pct" },
      { h: "Meeting or above %", t: "pct" },
      { h: "Top learner", t: "text" },
    ],
    rows: a.grades.map((g) => [
      g.label, g.streams, g.learners, g.withResults, g.mean, g.median, g.high, g.low, g.meetingRate,
      g.top ? `${g.top.name} (${g.top.className}, ${fmt1(g.top.mean)}%)` : null,
    ]),
    bar: { col: 4, max: 100 },
  });

  out.push({
    key: "levels",
    sheet: "Grades",
    tab: "overview",
    title: "Performance levels by grade",
    note: "Share of all subject results at each level. EE Exceeding, ME Meeting, AE Approaching, BE Below expectation.",
    cols: [{ h: "Grade", t: "text" }, ...LEVELS.map((l) => ({ h: `${l} %`, t: "pct" as ColType }))],
    rows: a.grades.map((g) => [g.label, ...LEVELS.map((l) => g.levels[l])]),
    heat: { from: 1 },
  });

  out.push({
    key: "bands",
    sheet: "Grades",
    tab: "analysis",
    title: "Grade distribution (EE1 to BE2)",
    note: "Every subject result of every learner in scope, placed in its grade band.",
    cols: [
      { h: "Grade", t: "text" },
      { h: "Level", t: "text" },
      { h: "From %", t: "int" },
      { h: "Results", t: "int" },
      { h: "Share %", t: "pct" },
    ],
    rows: a.bands.map((b) => [b.code, b.level, b.min, b.count, b.pct]),
    bar: { col: 4, max: Math.max(10, ...a.bands.map((b) => b.pct)) },
  });

  out.push({
    key: "streams",
    sheet: "Classes",
    tab: "overview",
    title: "Class (stream) performance",
    note: "Ranked by mean. 'Pos in grade' ranks a class against the other classes of its own grade.",
    cols: [
      { h: "Pos", t: "int" },
      { h: "Class", t: "text" },
      { h: "Learners", t: "int" },
      { h: "Mean %", t: "pct" },
      { h: "Median %", t: "pct" },
      { h: "Highest %", t: "pct" },
      { h: "Lowest %", t: "pct" },
      { h: "Meeting or above %", t: "pct" },
      { h: "Pos in grade", t: "int" },
      { h: "Strongest subject", t: "text" },
      { h: "Weakest subject", t: "text" },
      { h: "Top learner", t: "text" },
    ],
    rows: a.streams.map((r) => [
      r.rank, r.label, r.learners, r.mean, r.median, r.high, r.low, r.meetingRate, r.rankInGrade, r.best, r.weakest,
      r.top ? `${r.top.name} (${fmt1(r.top.mean)}%)` : null,
    ]),
    bar: { col: 3, max: 100 },
  });

  const gradeKeys = Array.from(new Set(a.subjects.flatMap((x) => Object.keys(x.byGrade)))).sort((x, y) => Number(x) - Number(y));
  out.push({
    key: "subjects",
    sheet: "Subjects",
    tab: "analysis",
    title: "Subject analysis",
    note: "Ranked by mean. Spread is the standard deviation: a high figure means results vary a lot between learners.",
    cols: [
      { h: "Pos", t: "int" },
      { h: "Subject", t: "text" },
      { h: "Results", t: "int" },
      { h: "Mean %", t: "pct" },
      { h: "Highest %", t: "pct" },
      { h: "Lowest %", t: "pct" },
      { h: "Spread", t: "pct" },
      { h: "Meeting or above %", t: "pct" },
      ...gradeKeys.map((g) => ({ h: `Grade ${g} mean %`, t: "pct" as ColType })),
      { h: "Strongest class", t: "text" },
      { h: "Weakest class", t: "text" },
    ],
    rows: a.subjects.map((x, i) => [
      i + 1, x.name, x.count, x.mean, x.high, x.low, x.sd, x.meetingRate, ...gradeKeys.map((g) => x.byGrade[g] ?? null), x.bestStream, x.weakestStream,
    ]),
    bar: { col: 3, max: 100 },
  });

  if (a.subjectByStream.streams.length > 1) {
    out.push({
      key: "matrix",
      sheet: "Classes",
      tab: "analysis",
      title: "Subject by class (mean %)",
      note: "Darker cells are higher means. Read across to compare classes, down to compare subjects.",
      cols: [{ h: "Subject", t: "text" }, ...a.subjectByStream.streams.map((c) => ({ h: c.label, t: "pct" as ColType }))],
      rows: a.subjectByStream.rows.map((r) => [r.subject, ...r.means]),
      heat: { from: 1 },
    });
  }

  if (cmp && cmp.summary) {
    const c = cmp.summary;
    const label = `${cmp.current.name} compared with ${cmp.previous.name}`;
    out.push({
      key: "cmp-summary",
      sheet: "Comparison",
      tab: "analysis",
      title: `Comparison with previous marks: ${label}`,
      note: `Only the ${cmp.paired} learners with results in both exams are compared. A change of less than 1 point counts as steady.`,
      cols: [
        { h: "Measure", t: "text" },
        { h: "Value", t: "text" },
      ],
      rows: [
        [`Mean in ${cmp.previous.name} %`, fmt1(c.meanPrev)],
        [`Mean in ${cmp.current.name} %`, fmt1(c.meanNow)],
        ["Change in points", signed(c.change)],
        ["Learners who improved", String(c.improved)],
        ["Learners who declined", String(c.declined)],
        ["Learners who stayed steady", String(c.steady)],
      ],
    });
    const changeCols = (first: string, n = true): Section["cols"] => [
      { h: first, t: "text" },
      { h: `${cmp.previous.name} %`, t: "pct" },
      { h: `${cmp.current.name} %`, t: "pct" },
      { h: "Change", t: "delta" },
      ...(n ? [{ h: "Learners", t: "int" as ColType }] : []),
    ];
    out.push({
      key: "cmp-grades", sheet: "Comparison", tab: "analysis", title: "Change by grade", cols: changeCols("Grade"),
      rows: cmp.grades.map((g) => [g.label, g.prev, g.now, g.change, g.n]),
    });
    out.push({
      key: "cmp-streams", sheet: "Comparison", tab: "analysis", title: "Change by class", cols: changeCols("Class"),
      rows: cmp.streams.map((g) => [g.label, g.prev, g.now, g.change, g.n]),
    });
    out.push({
      key: "cmp-subjects", sheet: "Comparison", tab: "analysis", title: "Change by subject", cols: changeCols("Subject"),
      rows: cmp.subjects.map((g) => [g.name, g.prev, g.now, g.change, g.n]),
    });

    const moverCols: Section["cols"] = [
      { h: "#", t: "int" },
      { h: "Adm. no", t: "text" },
      { h: "Learner", t: "text" },
      { h: "Class", t: "text" },
      { h: `${cmp.previous.name} %`, t: "pct" },
      { h: `${cmp.current.name} %`, t: "pct" },
      { h: "Change", t: "delta" },
      { h: "Grade", t: "text" },
      { h: "Position", t: "text" },
    ];
    const moverRow = (m: Mover, i: number): Cell[] => [
      i + 1, m.admNo, m.name, m.className, m.prev, m.now, m.change, `${m.prevCode} → ${m.nowCode}`, `${m.rankPrev ?? "–"} → ${m.rankNow ?? "–"}`,
    ];
    out.push({ key: "improved", sheet: "Most improved", tab: "analysis", title: "Most improved learners", cols: moverCols, rows: cmp.improved.map(moverRow) });
    out.push({ key: "declined", sheet: "Most improved", tab: "analysis", title: "Biggest declines", cols: moverCols, rows: cmp.declined.map(moverRow) });
  }

  if (a.gender.length > 1) {
    out.push({
      key: "gender",
      sheet: "Gender",
      tab: "analysis",
      title: "Performance by gender",
      cols: [
        { h: "Gender", t: "text" },
        { h: "Learners", t: "int" },
        { h: "With results", t: "int" },
        { h: "Mean %", t: "pct" },
        { h: "Meeting or above %", t: "pct" },
        ...LEVELS.map((l) => ({ h: `${l} %`, t: "pct" as ColType })),
      ],
      rows: a.gender.map((g) => [g.gender, g.learners, g.withResults, g.mean, g.meetingRate, ...LEVELS.map((l) => g.levels[l])]),
    });
  }

  const lineCols: Section["cols"] = [
    { h: "Pos", t: "int" },
    { h: "Adm. no", t: "text" },
    { h: "Learner", t: "text" },
    { h: "Class", t: "text" },
    { h: "Mean %", t: "pct" },
    { h: "Grade", t: "text" },
    { h: "Strongest subject", t: "text" },
    { h: "Weakest subject", t: "text" },
    { h: `Subjects under ${meeting}%`, t: "int" },
  ];
  const lineRow = (l: LearnerLine): Cell[] => [l.rank, l.admNo, l.name, l.className, l.mean, l.code, l.best, l.weakest, l.belowCount];
  out.push({ key: "top", sheet: "Learners", tab: "analysis", title: "Top 10 learners", cols: lineCols, rows: a.top.map(lineRow) });
  out.push({
    key: "support", sheet: "Learners", tab: "analysis", title: "Learners who need support",
    note: "The 10 lowest means. Check the subjects column to see where the help is needed most.",
    cols: lineCols, rows: a.support.map(lineRow),
  });

  return out;
}

export function formatCell(v: Cell, t: ColType): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string") return v;
  if (t === "int") return String(Math.round(v));
  if (t === "delta") return signed(v);
  if (t === "pct") return v.toFixed(1);
  return String(v);
}

/* ------------------------------------------------------------------ */
/* Excel (the PDF builders live in ./resultsPdf)                       */
/* ------------------------------------------------------------------ */

export async function saveAnalysisExcel(sections: Section[], filename: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const sheets = new Map<string, Section[]>();
  sections.forEach((s) => sheets.set(s.sheet, [...(sheets.get(s.sheet) ?? []), s]));

  const FORMAT: Record<ColType, string | undefined> = { text: undefined, int: "0", pct: "0.0", delta: "+0.0;-0.0;0.0" };

  sheets.forEach((list, name) => {
    const aoa: Cell[][] = [];
    const formats: { r: number; c: number; z: string }[] = [];
    list.forEach((sec) => {
      aoa.push([sec.title]);
      if (sec.note) aoa.push([sec.note]);
      aoa.push(sec.cols.map((c) => c.h));
      sec.rows.forEach((row) => {
        const r = aoa.length;
        aoa.push(row);
        row.forEach((v, c) => {
          const z = FORMAT[sec.cols[c]?.t ?? "text"];
          if (typeof v === "number" && z) formats.push({ r, c, z });
        });
      });
      aoa.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    formats.forEach(({ r, c, z }) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = z;
    });
    const width = Math.max(...aoa.map((r) => r.length), 1);
    ws["!cols"] = Array.from({ length: width }, (_, c) => ({
      wch: Math.min(34, Math.max(10, ...aoa.filter((r) => r.length > 1).map((r) => String(r[c] ?? "").length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  XLSX.writeFile(wb, filename);
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName = "download" | "warn";

const ICONS: Record<IconName, ReactNode> = {
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
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

/* ------------------------------------------------------------------ */
/* Screen pieces (defined outside the page so they never remount)      */
/* ------------------------------------------------------------------ */

function SectionTable({ sec }: { sec: Section }) {
  const nums = sec.heat ? sec.rows.flatMap((r) => r.slice(sec.heat!.from)).filter(isNum) : [];
  const lo = nums.length ? Math.min(...nums) : 0;
  const hi = nums.length ? Math.max(...nums) : 1;
  const lead = sec.cols[0]?.t === "text" ? 0 : 1; // the name column (after a "Pos" or "#" column)

  return (
    <section className="ss-an-sec" aria-labelledby={`sec-${sec.key}`}>
      <h4 id={`sec-${sec.key}`}>{sec.title}</h4>
      {sec.note ? <p className="ss-note ss-an-note">{sec.note}</p> : null}
      <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label={sec.title}>
        <table className="ss-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              {sec.cols.map((c, i) => (
                <th key={i} scope="col" className={c.t === "text" ? undefined : "ss-num"}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sec.rows.length === 0 ? (
              <tr>
                <td colSpan={sec.cols.length} className="ss-empty" style={{ textAlign: "center", padding: 18 }}>
                  Nothing to show yet.
                </td>
              </tr>
            ) : (
              sec.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((v, ci) => {
                    const t = sec.cols[ci]?.t ?? "text";
                    const text = formatCell(v, t);
                    const heat = sec.heat && ci >= sec.heat.from && isNum(v);
                    const style = heat ? { background: `color-mix(in srgb, var(--ss-primary) ${Math.round(8 + ((v - lo) / Math.max(1, hi - lo)) * 42)}%, transparent)` } : undefined;
                    const cls = [t === "text" ? "" : "ss-num", heat ? "ss-heat" : ""].filter(Boolean).join(" ") || undefined;
                    return (
                      <td key={ci} className={cls} style={style}>
                        {t === "delta" && isNum(v) ? <span className={`ss-delta ${v >= 1 ? "up" : v <= -1 ? "down" : "flat"}`}>{text}</span> : ci === lead && t === "text" ? <strong>{text}</strong> : text}
                        {sec.bar && sec.bar.col === ci && isNum(v) ? (
                          <span className="ss-cellbar" aria-hidden="true">
                            <i style={{ width: `${Math.max(0, Math.min(100, (v / sec.bar.max) * 100))}%` }} />
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Tab = "dashboard" | "overview" | "analysis" | "results" | "cards";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "overview", label: "Overview" },
  { key: "analysis", label: "Analysis" },
  { key: "results", label: "Class results" },
  { key: "cards", label: "Report cards" },
];

export default function ViewResults({ schoolName = "Senior School", termLabel = "Term 3, 2026", userName = "Teacher", theme = "light" }: ViewResultsProps) {
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [yearId, setYearId] = useState("");
  const [grade, setGrade] = useState("all");
  const [classId, setClassId] = useState("all");
  const [examId, setExamId] = useState("all");
  const [compare, setCompare] = useState("auto");
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [classBusy, setClassBusy] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ----- load the filter options ----- */

  useEffect(() => {
    const ctl = new AbortController();
    api<Options>("/results/options", ctl.signal)
      .then((o) => {
        setOptions(o);
        const current = o.years.find((y) => y.id === o.currentYearId) ?? o.years[0];
        if (current) setYearId(current.id);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setOptionsError(e.message);
      });
    return () => ctl.abort();
  }, []);

  const year = options?.years.find((y) => y.id === yearId);
  const exams = year?.exams ?? [];
  const classes = (options?.classes ?? []).filter((c) => grade === "all" || String(c.grade) === grade);
  const canPending = options?.canIncludePending ?? false;
  const usePending = canPending && pending;

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams({ year_id: yearId, exam: examId });
    if (usePending) p.set("include_pending", "1");
    return p;
  }, [yearId, examId, usePending]);

  /* ----- load the analysis whenever a filter changes ----- */

  useEffect(() => {
    if (!yearId) return;
    const ctl = new AbortController();
    const p = new URLSearchParams(baseQuery);
    if (grade !== "all") p.set("grade", grade);
    if (classId !== "all") p.set("stream_id", classId);
    p.set("compare", compare);

    setAnalysisBusy(true);
    setAnalysisError(null);
    api<Analysis>(`/results/analysis?${p.toString()}`, ctl.signal)
      .then(setAnalysis)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setAnalysisError(e.message);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setAnalysisBusy(false);
      });
    return () => ctl.abort();
  }, [yearId, grade, classId, compare, baseQuery]);

  /* ----- load one class when the class tabs need it ----- */

  useEffect(() => {
    if (!yearId || classId === "all" || (tab !== "results" && tab !== "cards")) return;
    const ctl = new AbortController();
    const p = new URLSearchParams(baseQuery);
    p.set("stream_id", classId);

    setClassBusy(true);
    setClassError(null);
    api<ClassData>(`/results/class?${p.toString()}`, ctl.signal)
      .then(setClassData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setClassError(e.message);
      })
      .finally(() => {
        if (!ctl.signal.aborted) setClassBusy(false);
      });
    return () => ctl.abort();
  }, [yearId, classId, tab, baseQuery]);

  /* ----- selection ----- */

  const reset = () => {
    setNotice(null);
    setError(null);
    setQuery("");
    setLearnerId("");
  };
  const pickYear = (id: string) => {
    setYearId(id);
    setExamId("all");
    setCompare("auto");
    reset();
  };
  const pickGrade = (g: string) => {
    setGrade(g);
    setClassId("all");
    reset();
  };
  const pickClass = (id: string) => {
    setClassId(id);
    reset();
  };

  /* ----- derived ----- */

  const sections = useMemo(() => (analysis ? buildSections(analysis) : []), [analysis]);
  const hasData = !!analysis && analysis.summary.withResults > 0;
  const needsClass = classId === "all";
  const cls = classData && !needsClass ? classData : null;

  const visibleLearners = useMemo(() => {
    if (!cls) return [];
    const q = query.trim().toLowerCase();
    return cls.learners.filter((l) => !q || l.name.toLowerCase().includes(q) || l.admNo.toLowerCase().includes(q));
  }, [cls, query]);

  const activeLearner = cls?.learners.find((l) => String(l.id) === learnerId) ?? cls?.learners[0];
  const bands = options?.bands ?? [];
  const classLabel = options?.classes.find((c) => c.id === classId)?.label ?? "";
  const examLabel = analysis?.meta.exam ?? "";
  const base = `${slug(year?.label ?? "year")}-${slug(analysis?.meta.scope ?? "school")}-${slug(examLabel)}`;

  /* ----- downloads ----- */

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(done);
    } catch (e) {
      // Messages that start with "Could not load" come from the report builder and say what is wrong
      setError(
        e instanceof Error && e.message.startsWith("Could not load")
          ? e.message
          : "The file could not be created. Check that jspdf, jspdf-autotable and xlsx are installed, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadAnalysisExcel = () => {
    if (!analysis) return;
    void run(() => saveAnalysisExcel(sections, `results-analysis-${base}.xlsx`), "Analysis Excel file downloaded.");
  };

  // The PDF is the class performance report: summary, merit list, subject grade distribution and
  // comparison with the previous exam. It loads every class in the chosen scope, so it can take a moment.
  const downloadAnalysisPdf = () => {
    if (!analysis) return;
    const inScope = (options?.classes ?? []).filter((c) => (classId !== "all" ? c.id === classId : grade === "all" || String(c.grade) === grade));
    const loadClass = (streamId: string, exam?: string) => {
      const p = new URLSearchParams(baseQuery);
      p.set("stream_id", streamId);
      if (exam) p.set("exam", exam);
      return api<ClassData>(`/results/class?${p.toString()}`);
    };
    void run(
      () =>
        saveAnalysisPdf({
          schoolName,
          termLabel,
          meta: analysis.meta,
          bands,
          classes: inScope,
          loadClass,
          comparison: analysis.comparison,
          filename: `results-analysis-${base}.pdf`,
        }),
      "Analysis PDF downloaded.",
    );
  };

  const cardFor = (l: ClassLearner): CardData | null => {
    if (!cls || !year) return null;
    return {
      schoolName,
      termLabel,
      yearLabel: year.label,
      classLabel,
      examLabel,
      learner: { name: l.name, admNo: l.admNo },
      rows: cls.subjects.map((s) => {
        const p = l.pcts[String(s.id)] ?? null;
        const g = p === null || !bands.length ? null : gradeFor(p, bands);
        return {
          subject: s.name,
          pct: p,
          code: g?.code ?? "–",
          level: g?.level ?? "–",
          points: g?.points ?? null,
          classMean: cls.subjectStats.find((x) => x.subjectId === s.id)?.mean ?? null,
        };
      }),
      mean: l.mean,
      points: l.points,
      code: l.code ?? "–",
      rank: l.rank,
      outOf: cls.ranked,
      comment: comments[String(l.id)] ?? autoRemark(l.level),
    };
  };

  const downloadOneCard = () => {
    const card = activeLearner ? cardFor(activeLearner) : null;
    if (!card) return;
    void run(() => saveReportCards([card], `report-card-${slug(card.learner.name)}-${base}.pdf`), `Report card for ${card.learner.name} downloaded.`);
  };

  const downloadAllCards = () => {
    if (!cls) return;
    const cards = cls.learners.map(cardFor).filter((c): c is CardData => c !== null);
    void run(() => saveReportCards(cards, `report-cards-${base}.pdf`), `${cards.length} report cards downloaded in one PDF.`);
  };

  const classTable = () => {
    if (!cls) return { head: [] as string[], body: [] as string[][] };
    return {
      head: ["Pos", "Adm. no", "Learner", ...cls.subjects.map((s) => `${s.name} %`), "Mean %", "Grade", "Points"],
      body: cls.learners.map((l) => [
        l.rank === null ? "–" : String(l.rank),
        l.admNo,
        l.name,
        ...cls.subjects.map((s) => fmt1(l.pcts[String(s.id)])),
        fmt1(l.mean),
        l.code ?? "–",
        String(l.points),
      ]),
    };
  };

  const downloadClassPdf = () => {
    if (!cls || !year) return;
    const { head, body } = classTable();
    void run(
      () => saveClassPdf({ title: `${schoolName} · Class results`, subtitle: `${year.label} · ${classLabel} · ${examLabel} · ${termLabel}`, head, body, filename: `results-${base}.pdf` }),
      "Class results PDF downloaded.",
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
    }, "Class results Excel file downloaded.");
  };

  /* ------------------------------------------------------------------ */

  const pickClassMessage = (
    <p className="ss-empty" style={{ margin: "24px 0 8px", textAlign: "center" }}>
      Choose a class above to see this view.
    </p>
  );

  const s = analysis?.summary;
  const cmp = analysis?.comparison ?? null;

  return (
    // tt-shell gives the shared TeacherSidebar its colours and the 260px + content layout.
    // ss-shell keeps the existing page styles (cards, tables, tabs) working.
    <div className="tt-shell ss-shell" data-theme={theme} style={{ display: "grid", background: "var(--ss-canvas)" }}>
      <TeacherSidebar />

      <div className="ss-main">
        <header className="ss-header">
          <div className="ss-h-title">
            <p className="ss-h-name">View Results</p>
            <span>Assessment</span>
          </div>
          <div className="ss-h-actions" style={{ marginLeft: "auto" }}>
            <span className="ss-muted">{userName}</span>
          </div>
        </header>

        <main className="ss-content">
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Results</h2>
            <p className="ss-note" style={{ marginTop: 6, maxWidth: "68ch" }}>
              See how the whole school, a grade or a class performed, compare with earlier exams, and download the analysis as Excel or PDF. Only approved (published) results are
              counted.
            </p>
          </div>

          {optionsError ? (
            <p className="ss-field-err" role="alert" style={{ margin: 0 }}>
              {optionsError}
            </p>
          ) : null}

          {/* ---------- Filters ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="vr-filter-title">
            <header>
              <h3 id="vr-filter-title">Choose the results</h3>
              <span className="ss-count">{termLabel}</span>
            </header>

            {!options && !optionsError ? (
              <p className="ss-muted" role="status" style={{ margin: "12px 0" }}>
                Loading…
              </p>
            ) : (
              <>
                <div className="ss-mk-pick">
                  <label className="ss-lab">
                    Year
                    <select className="ss-input" value={yearId} onChange={(e) => pickYear(e.target.value)}>
                      {options?.years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Grade
                    <select className="ss-input" value={grade} onChange={(e) => pickGrade(e.target.value)}>
                      <option value="all">All grades</option>
                      {options?.grades.map((g) => (
                        <option key={g.level} value={String(g.level)}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Class
                    <select className="ss-input" value={classId} onChange={(e) => pickClass(e.target.value)}>
                      <option value="all">All classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Exam type
                    <select className="ss-input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                      <option value="all">All exams combined</option>
                      {exams.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} (out of {x.max})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Compare with
                    <select className="ss-input" value={compare} onChange={(e) => setCompare(e.target.value)}>
                      <option value="auto">The exam before it</option>
                      <option value="none">No comparison</option>
                      {exams.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {canPending ? (
                  <label className="ss-check-row">
                    <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} /> Also include submitted results that are not approved yet (preview for HOI and Deputy)
                  </label>
                ) : null}

                <p className="ss-note">
                  Scores are percentages. "All exams combined" averages each learner's percentages across the exams. Absent (ABS) marks are left out, not counted as zero.
                </p>
              </>
            )}
          </section>

          {analysisError ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-warn" role="alert">
                <Icon name="warn" />
                <span>{analysisError}</span>
              </li>
            </ul>
          ) : null}
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
          <section className="ss-card ss-panel" aria-labelledby="vr-title" aria-busy={analysisBusy}>
            <header>
              <h3 id="vr-title">{analysis ? `${analysis.meta.year} · ${analysis.meta.scope} · ${analysis.meta.exam}` : "Results"}</h3>
              {analysisBusy ? <span className="ss-count">Updating…</span> : s ? <span className="ss-count">{s.withResults} of {s.learners} learners</span> : null}
            </header>

            <div className="ss-pbody">
              <div className="ss-seg ss-mk-tabs" role="tablist" aria-label="Results views">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "is-on" : ""} onClick={() => setTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {analysis?.meta.includesPending ? (
                <ul className="ss-alerts" style={{ margin: "0 0 14px" }}>
                  <li className="tone-info">
                    <Icon name="warn" />
                    <span>This preview includes submitted results that have not been approved yet. Numbers can change.</span>
                  </li>
                </ul>
              ) : null}

              {/* ===== Dashboard, Overview and Analysis ===== */}
              {tab === "dashboard" || tab === "overview" || tab === "analysis" ? (
                !analysis ? (
                  <p className="ss-muted" role="status">
                    {analysisBusy ? "Loading the results…" : "Choose a year to begin."}
                  </p>
                ) : !hasData ? (
                  <p className="ss-empty" style={{ margin: "24px 0 8px", textAlign: "center" }}>
                    {year && !year.hasResults
                      ? `No results have been approved for ${year.label} yet.${canPending ? " Tick the preview box above to see submitted results." : ""}`
                      : "No results match these choices."}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    <div className="ss-an-bar">
                      <p className="ss-muted" style={{ margin: 0 }}>
                        Excel has every table on this page. The PDF is the class performance report: summary, merit list, subject grade distribution and comparison with the
                        previous exam, one report for each grade in your selection.
                      </p>
                      <div className="ss-btn-row">
                        <button type="button" className="ss-btn" onClick={downloadAnalysisExcel} disabled={busy}>
                          <Icon name="download" size={16} /> Excel
                        </button>
                        <button type="button" className="ss-btn ss-btn-primary" onClick={downloadAnalysisPdf} disabled={busy}>
                          <Icon name="download" size={16} /> {busy ? "Working…" : "PDF"}
                        </button>
                      </div>
                    </div>

                    {tab === "dashboard" ? <ChartsDashboard a={analysis} /> : null}

                    {tab === "overview" && s ? (
                      <div className="ss-mk-stats">
                        <Stat label="Learners" value={`${s.withResults} of ${s.learners}`} />
                        <Stat label="Mean" value={`${fmt1(s.mean)}%`} />
                        <Stat label="Meeting or above" value={`${fmt1(s.meetingRate)}%`} />
                        <Stat label="Highest" value={`${fmt1(s.high)}%`} />
                        <Stat label="Lowest" value={`${fmt1(s.low)}%`} />
                        <Stat label={`Below ${s.meetingMark}%`} value={String(s.belowMeeting)} />
                      </div>
                    ) : null}

                    {tab === "analysis" && cmp && cmp.summary ? (
                      <div className="ss-mk-stats">
                        <Stat label={`${cmp.previous.name} mean`} value={`${fmt1(cmp.summary.meanPrev)}%`} />
                        <Stat label={`${cmp.current.name} mean`} value={`${fmt1(cmp.summary.meanNow)}%`} />
                        <Stat label="Change" value={`${signed(cmp.summary.change)} pts`} />
                        <Stat label="Improved" value={String(cmp.summary.improved)} />
                        <Stat label="Declined" value={String(cmp.summary.declined)} />
                        <Stat label="Steady" value={String(cmp.summary.steady)} />
                      </div>
                    ) : null}

                    {tab === "analysis" && !cmp && compare !== "none" ? (
                      <p className="ss-note" style={{ margin: 0 }}>
                        There is no earlier exam with results to compare with yet. Once a second exam is approved, the comparison and most improved learners appear here.
                      </p>
                    ) : null}
                    {tab === "analysis" && cmp && !cmp.summary ? (
                      <p className="ss-note" style={{ margin: 0 }}>
                        {cmp.current.name} and {cmp.previous.name} have no learners in common yet, so they cannot be compared.
                      </p>
                    ) : null}

                    {sections
                      .filter((sec) => sec.tab === tab && !(tab === "overview" && sec.key === "summary"))
                      .map((sec) => (
                        <SectionTable key={sec.key} sec={sec} />
                      ))}
                  </div>
                )
              ) : null}

              {/* ===== Class results ===== */}
              {tab === "results" ? (
                needsClass ? (
                  pickClassMessage
                ) : classError ? (
                  <p className="ss-field-err" role="alert">
                    {classError}
                  </p>
                ) : !cls ? (
                  <p className="ss-muted" role="status">
                    {classBusy ? "Loading the class…" : ""}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="ss-mk-stats">
                      <Stat label="Class mean" value={`${fmt1(cls.summary.mean)}%`} />
                      <Stat label="Highest" value={`${fmt1(cls.summary.high)}%`} />
                      <Stat label="Lowest" value={`${fmt1(cls.summary.low)}%`} />
                      <Stat label="Meeting or above" value={`${fmt1(cls.summary.meetingRate)}%`} />
                    </div>

                    <div className="ss-toolbar" style={{ margin: 0 }}>
                      <input className="ss-input ss-input-auto" type="search" placeholder="Search name or admission number" aria-label="Search learners" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                            {cls.subjects.map((x) => (
                              <th key={x.id} scope="col" className="ss-num">
                                {x.name}
                              </th>
                            ))}
                            <th scope="col" className="ss-num">Mean %</th>
                            <th scope="col">Grade</th>
                            <th scope="col" className="ss-num">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLearners.length === 0 ? (
                            <tr>
                              <td colSpan={cls.subjects.length + 6} className="ss-empty" style={{ textAlign: "center", padding: 24 }}>
                                {cls.learners.length === 0 ? "There are no learners in this class." : "No learners match your search."}
                              </td>
                            </tr>
                          ) : (
                            visibleLearners.map((l) => (
                              <tr key={l.id}>
                                <td>
                                  <span className={`ss-vr-pos${l.rank !== null && l.rank <= 3 ? " top" : ""}`}>{l.rank ?? "–"}</span>
                                </td>
                                <td>{l.admNo}</td>
                                <td>
                                  <strong>{l.name}</strong>
                                </td>
                                {cls.subjects.map((x) => (
                                  <td key={x.id} className="ss-num">
                                    {fmt1(l.pcts[String(x.id)])}
                                  </td>
                                ))}
                                <td className="ss-num">
                                  <strong>{fmt1(l.mean)}</strong>
                                </td>
                                <td>{l.code ? <span className={levelTag(l.level)}>{l.code}</span> : "–"}</td>
                                <td className="ss-num">{l.points}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : null}

              {/* ===== Report cards ===== */}
              {tab === "cards" ? (
                needsClass ? (
                  pickClassMessage
                ) : classError ? (
                  <p className="ss-field-err" role="alert">
                    {classError}
                  </p>
                ) : !cls || !activeLearner ? (
                  <p className="ss-muted" role="status">
                    {classBusy ? "Loading the class…" : "There are no learners in this class."}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="ss-toolbar" style={{ margin: 0 }}>
                      <select className="ss-input ss-input-auto" aria-label="Learner" value={String(activeLearner.id)} onChange={(e) => setLearnerId(e.target.value)}>
                        {cls.learners.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.admNo})
                          </option>
                        ))}
                      </select>
                      <div className="ss-btn-row">
                        <button type="button" className="ss-btn" onClick={downloadOneCard} disabled={busy}>
                          <Icon name="download" size={16} /> This report card (PDF)
                        </button>
                        <button type="button" className="ss-btn ss-btn-primary" onClick={downloadAllCards} disabled={busy}>
                          {busy ? "Working…" : `All ${cls.learners.length} report cards (PDF)`}
                        </button>
                      </div>
                    </div>

                    <article className="ss-vr-card" aria-label={`Report card for ${activeLearner.name}`}>
                      <div className="ss-vr-card-head">
                        <h4>{schoolName}</h4>
                        <p>Learner report card · {termLabel}</p>
                      </div>
                      <div className="ss-vr-meta">
                        <div>
                          <span>Learner</span>
                          <b>{activeLearner.name}</b>
                        </div>
                        <div>
                          <span>Adm. no</span>
                          <b>{activeLearner.admNo}</b>
                        </div>
                        <div>
                          <span>Class</span>
                          <b>{classLabel}</b>
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
                              {cls.subjects.map((x) => {
                                const p = activeLearner.pcts[String(x.id)] ?? null;
                                const g = p === null || !bands.length ? null : gradeFor(p, bands);
                                return (
                                  <tr key={x.id}>
                                    <td>
                                      <strong>{x.name}</strong>
                                    </td>
                                    <td className="ss-num">{fmt1(p)}</td>
                                    <td>{g ? <span className={levelTag(g.level)}>{g.code}</span> : "–"}</td>
                                    <td>{g?.level ?? "–"}</td>
                                    <td className="ss-num">{g?.points ?? "–"}</td>
                                    <td className="ss-num">{fmt1(cls.subjectStats.find((st) => st.subjectId === x.id)?.mean)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="ss-mk-stats" style={{ marginTop: 14 }}>
                          <Stat label="Mean" value={`${fmt1(activeLearner.mean)}%`} />
                          <Stat label="Total points" value={String(activeLearner.points)} />
                          <Stat label="Overall grade" value={activeLearner.code ?? "–"} />
                          <Stat label="Position" value={`${activeLearner.rank ?? "–"} of ${cls.ranked}`} />
                        </div>

                        <label className="ss-lab" style={{ marginTop: 14 }}>
                          Class teacher's comment (printed on the PDF)
                          <textarea
                            className="ss-input"
                            rows={3}
                            value={comments[String(activeLearner.id)] ?? autoRemark(activeLearner.level)}
                            onChange={(e) => setComments((c) => ({ ...c, [String(activeLearner.id)]: e.target.value }))}
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