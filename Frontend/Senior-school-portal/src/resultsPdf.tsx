import type { jsPDF } from "jspdf";
import type { CellDef, RowInput, UserOptions } from "jspdf-autotable";
import type { Lvl } from "./ResultsCharts";

/* ------------------------------------------------------------------ */
/* Types shared with ViewResults.tsx (structurally compatible)         */
/* ------------------------------------------------------------------ */

export type Cell = string | number | null;
export interface PdfSection {
  key: string;
  title: string;
  note?: string;
  cols: { h: string; t: "text" | "int" | "pct" | "delta" }[];
  rows: Cell[][];
}
export interface PdfMeta {
  year: string;
  scope: string;
  exam: string;
  includesPending: boolean;
  generatedAt: string;
}
export interface CardData {
  schoolName: string;
  termLabel: string;
  yearLabel: string;
  classLabel: string;
  examLabel: string;
  learner: { name: string; admNo: string };
  rows: { subject: string; pct: number | null; code: string; level: string; points: number | null; classMean: number | null }[];
  mean: number | null;
  points: number;
  code: string;
  rank: number | null;
  outOf: number;
  comment: string;
}

type RGB = [number, number, number];
type AutoTable = typeof import("jspdf-autotable").default;

/* ------------------------------------------------------------------ */
/* Palette and small helpers                                           */
/* ------------------------------------------------------------------ */

const NAVY: RGB = [12, 31, 61];
const GOLD: RGB = [185, 142, 47];
const INK: RGB = [26, 36, 51];
const MUTED: RGB = [98, 112, 132];
const LINE: RGB = [226, 231, 239];
const SOFT: RGB = [244, 247, 251];
const WHITE: RGB = [255, 255, 255];
const UP: RGB = [21, 128, 61];
const DOWN: RGB = [185, 28, 28];
const LEVEL_RGB: Record<string, RGB> = {
  Exceeding: [31, 157, 107],
  Meeting: [47, 111, 223],
  Approaching: [224, 165, 38],
  Below: [217, 83, 79],
};
const LVLS: Lvl[] = ["Exceeding", "Meeting", "Approaching", "Below"];

const isNum = (n: unknown): n is number => typeof n === "number" && !Number.isNaN(n);
const f1 = (n: number | null | undefined) => (isNum(n) ? (Math.round(n * 10) / 10).toFixed(1) : "-");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

/** Standard PDF fonts cannot draw arrows or the en dash reliably, so swap them for plain text. */
const safe = (s: string) => s.replace(/→/g, ">").replace(/–/g, "-");

const fill = (d: jsPDF, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const ink = (d: jsPDF, c: RGB) => d.setTextColor(c[0], c[1], c[2]);
const stroke = (d: jsPDF, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);

function fit(d: jsPDF, text: string, maxW: number): string {
  if (d.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && d.getTextWidth(`${s}...`) > maxW) s = s.slice(0, -1);
  return `${s}...`;
}

async function loadPdf() {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  return { jsPDF, autoTable };
}

function finalY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function header(d: jsPDF, W: number, title: string, sub: string, h = 26) {
  fill(d, NAVY);
  d.rect(0, 0, W, h, "F");
  fill(d, GOLD);
  d.rect(0, h, W, 1.2, "F");
  ink(d, WHITE);
  d.setFont("helvetica", "bold");
  d.setFontSize(h > 26 ? 17 : 15);
  d.text(safe(title), 12, h / 2 - 0.5);
  d.setFont("helvetica", "normal");
  d.setFontSize(9.5);
  d.text(safe(sub), 12, h / 2 + 6.5);
}

function footers(d: jsPDF, W: number, H: number, left: string, runningTitle?: string) {
  const pages = d.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    d.setPage(i);
    d.setFont("helvetica", "normal");
    d.setFontSize(7.5);
    ink(d, MUTED);
    stroke(d, LINE);
    d.setLineWidth(0.2);
    d.line(12, H - 10, W - 12, H - 10);
    d.text(safe(left), 12, H - 5.5);
    d.text(`Page ${i} of ${pages}`, W - 12, H - 5.5, { align: "right" });
    if (runningTitle && i > 1) d.text(safe(runningTitle), W - 12, 8, { align: "right" });
  }
}

function sectionTitle(d: jsPDF, x: number, y: number, text: string) {
  fill(d, GOLD);
  d.rect(x, y - 3.6, 1.1, 4.6, "F");
  ink(d, NAVY);
  d.setFont("helvetica", "bold");
  d.setFontSize(10.5);
  d.text(safe(text), x + 3, y);
}

function tile(d: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, sub?: string, accent: RGB = GOLD) {
  fill(d, SOFT);
  d.roundedRect(x, y, w, h, 2, 2, "F");
  fill(d, accent);
  d.roundedRect(x, y + 3, 1.2, h - 6, 0.6, 0.6, "F");
  d.setFont("helvetica", "normal");
  d.setFontSize(7.5);
  ink(d, MUTED);
  d.text(safe(label), x + 5, y + 6);
  d.setFont("helvetica", "bold");
  d.setFontSize(15);
  ink(d, NAVY);
  d.text(safe(value), x + 5, y + 14);
  if (sub) {
    d.setFont("helvetica", "normal");
    d.setFontSize(7);
    ink(d, MUTED);
    d.text(fit(d, safe(sub), w - 8), x + 5, y + h - 2.5);
  }
}

/* ------------------------------------------------------------------ */
/* Analysis report (5-page class performance report)                   */
/*   1  Class performance summary                                      */
/*   2  Students' performance merit list (runs over as many pages)     */
/*   3  Subject grade distribution                                     */
/*   4  Comparison with the previous exam (when there is one)          */
/* One report is made for every grade in scope, in the same PDF.       */
/* ------------------------------------------------------------------ */

export interface ReportBand {
  min: number;
  code: string;
  level: Lvl;
  points: number;
}
export interface ReportClassRef {
  id: string;
  label: string;
  grade: number;
}
export interface ReportLearner {
  id: number;
  admNo: string;
  name: string;
  pcts: Record<string, number | null>;
}
export interface ReportClassData {
  subjects: { id: number; name: string }[];
  learners: ReportLearner[];
}
export interface ReportComparison {
  current: { id: number; name: string };
  previous: { id: number; name: string };
  paired: number;
  summary: { meanNow: number; meanPrev: number; change: number } | null;
  subjects: { name: string; now: number; prev: number; change: number; n: number }[];
}

type GradeFn = (pct: number) => { level: Lvl; points: number };

const LEVEL_CODE: Record<Lvl, string> = { Exceeding: "E.E", Meeting: "M.E", Approaching: "A.E", Below: "B.E" };
const LEVEL_NAME: Record<Lvl, string> = {
  Exceeding: "Exceeding Expectation",
  Meeting: "Meeting Expectation",
  Approaching: "Approaching Expectation",
  Below: "Below Expectation",
};

const ABBR: Record<string, string> = {
  mathematics: "MAT", english: "ENG", kiswahili: "KIS", "kiswahili / ksl": "KIS", "social studies": "SST", science: "SCI",
  agriculture: "AGRI", "computer science": "COMP", biology: "BIO", chemistry: "CHEM", physics: "PHY", "history & citizenship": "HIST",
  geography: "GEO", "business studies": "BST", "literature in english": "LIT", music: "MUS", "fine art": "ART", "theatre & film": "T&F",
  "sports science": "SPS", "physical education": "PE", "community service learning": "CSL",
};
function abbr(name: string): string {
  const hit = ABBR[name.trim().toLowerCase()];
  if (hit) return hit;
  const words = name.trim().split(/[\s/&]+/).filter(Boolean);
  if (words.length <= 1) return name.length <= 5 ? name.toUpperCase() : name.slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
}

/** "Grade 10 A" or "10A" gives "A". */
const streamOf = (label: string) => label.replace(/^(grade\s*)?\d+\s*[-·]?\s*/i, "").trim() || label;

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mk = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const dp = (n: number | null | undefined, d: number) => (isNum(n) ? n.toFixed(d) : "-");
const sdp = (n: number | null | undefined, d: number) => (isNum(n) ? `${n > 0 ? "+" : ""}${n.toFixed(d)}` : "-");
const pos = (n: number | null) => (n === null ? "-" : String(n));
const zero = (): Record<Lvl, number> => ({ Exceeding: 0, Meeting: 0, Approaching: 0, Below: 0 });

/** Competition ranking: equal values share a position and the next position is skipped (1, 2, 2, 4). */
function competition(values: (number | null)[]): (number | null)[] {
  const v = values.map((x) => (x === null ? null : Math.round(x * 1e6) / 1e6));
  return v.map((x) => {
    if (x === null) return null;
    const mine: number = x;
    return 1 + v.filter((y) => y !== null && y > mine).length;
  });
}

interface Score {
  entries: number;
  total: number;
  mean: number | null;
  points: number;
  avgPts: number | null;
}
function scoreOf(marks: (number | null)[], grade: GradeFn): Score {
  const got = marks.filter(isNum);
  const total = got.reduce((a, b) => a + b, 0);
  const points = got.reduce((a, p) => a + grade(p).points, 0);
  return { entries: got.length, total, mean: got.length ? total / got.length : null, points, avgPts: got.length ? points / got.length : null };
}

interface Row extends Score {
  id: number;
  classId: string;
  admNo: string;
  name: string;
  stream: string;
  marks: (number | null)[];
  level: Lvl;
  strPos: number | null;
  ovrPos: number | null;
  prvStr: number | null;
  prvOvr: number | null;
}
interface PrevRow {
  id: number;
  classId: string;
  pcts: Record<string, number | null>;
  score: Score;
  level: Lvl;
  strPos: number | null;
  ovrPos: number | null;
}
interface Group {
  title: string;
  single: boolean;
  subjects: { id: number; name: string }[];
  rows: Row[];
  prev: PrevRow[]; // empty when there are no results for the previous exam
}
interface SubStat {
  name: string;
  entry: number;
  mean: number | null;
  counts: Record<Lvl, number>;
  avgPts: number | null;
  level: Lvl | null;
  prevMean: number | null;
  prevPts: number | null;
}
interface Overall {
  n: number;
  meanTotal: number;
  meanEntries: number;
  meanOfMeans: number;
  levels: Record<Lvl, number>;
  avgPts: number;
  level: Lvl;
  prevN: number;
  prevMeanTotal: number | null;
  prevAvgPts: number | null;
  prevLevels: Record<Lvl, number>;
}

function buildGroup(
  title: string,
  single: boolean,
  loaded: { ref: ReportClassRef; cur: ReportClassData; prev: ReportClassData | null }[],
  grade: GradeFn,
): Group | null {
  const subjects: { id: number; name: string }[] = [];
  loaded.forEach(({ cur }) =>
    cur.subjects.forEach((s) => {
      if (!subjects.some((x) => x.id === s.id)) subjects.push(s);
    }),
  );

  const rows: Row[] = [];
  loaded.forEach(({ ref, cur }) => {
    cur.learners.forEach((l) => {
      const marks = subjects.map((s) => {
        const v = l.pcts[String(s.id)];
        return isNum(v) ? v : null;
      });
      const sc = scoreOf(marks, grade);
      if (sc.mean === null) return; // learners without any marks are not listed
      rows.push({
        ...sc, id: l.id, classId: ref.id, admNo: l.admNo, name: l.name, stream: streamOf(ref.label), marks,
        level: grade(sc.mean).level, strPos: null, ovrPos: null, prvStr: null, prvOvr: null,
      });
    });
  });
  if (!rows.length) return null;

  const ovr = competition(rows.map((r) => r.mean));
  rows.forEach((r, i) => (r.ovrPos = ovr[i]));
  [...new Set(rows.map((r) => r.classId))].forEach((cid) => {
    const idx = rows.map((r, i) => (r.classId === cid ? i : -1)).filter((i) => i >= 0);
    const p = competition(idx.map((i) => rows[i].mean));
    idx.forEach((i, k) => (rows[i].strPos = p[k]));
  });

  const prev: PrevRow[] = [];
  loaded.forEach(({ ref, prev: pd }) => {
    if (!pd) return;
    pd.learners.forEach((l) => {
      const sc = scoreOf(Object.values(l.pcts).map((v) => (isNum(v) ? v : null)), grade);
      if (sc.mean === null) return;
      prev.push({ id: l.id, classId: ref.id, pcts: l.pcts, score: sc, level: grade(sc.mean).level, strPos: null, ovrPos: null });
    });
  });
  if (prev.length) {
    const po = competition(prev.map((p) => p.score.mean));
    prev.forEach((p, i) => (p.ovrPos = po[i]));
    [...new Set(prev.map((p) => p.classId))].forEach((cid) => {
      const idx = prev.map((p, i) => (p.classId === cid ? i : -1)).filter((i) => i >= 0);
      const ps = competition(idx.map((i) => prev[i].score.mean));
      idx.forEach((i, k) => (prev[i].strPos = ps[k]));
    });
    const byId = new Map(prev.map((p) => [p.id, p]));
    rows.forEach((r) => {
      const p = byId.get(r.id);
      if (p) {
        r.prvStr = p.strPos;
        r.prvOvr = p.ovrPos;
      }
    });
  }

  rows.sort((a, b) => (a.ovrPos ?? 0) - (b.ovrPos ?? 0) || a.name.localeCompare(b.name));
  return { title, single, subjects, rows, prev };
}

function statsFor(g: Group, grade: GradeFn): { subs: SubStat[]; ov: Overall } {
  const subs: SubStat[] = g.subjects.map((s, j) => {
    const vals = g.rows.map((r) => r.marks[j]).filter(isNum);
    const mean = avg(vals);
    const counts = zero();
    vals.forEach((v) => (counts[grade(v).level] += 1));
    const pv = g.prev.map((p) => p.pcts[String(s.id)]).filter(isNum);
    return {
      name: s.name, entry: vals.length, mean, counts,
      avgPts: avg(vals.map((v) => grade(v).points)),
      level: mean === null ? null : grade(mean).level,
      prevMean: avg(pv),
      prevPts: avg(pv.map((v) => grade(v).points)),
    };
  });

  const levels = zero();
  g.rows.forEach((r) => (levels[r.level] += 1));
  const prevLevels = zero();
  g.prev.forEach((p) => (prevLevels[p.level] += 1));
  const meanOfMeans = avg(g.rows.map((r) => r.mean ?? 0)) ?? 0;

  const ov: Overall = {
    n: g.rows.length,
    meanTotal: avg(g.rows.map((r) => r.total)) ?? 0,
    meanEntries: avg(g.rows.map((r) => r.entries)) ?? 0,
    meanOfMeans,
    levels,
    avgPts: avg(g.rows.map((r) => r.avgPts ?? 0)) ?? 0,
    level: grade(meanOfMeans).level,
    prevN: g.prev.length,
    prevMeanTotal: avg(g.prev.map((p) => p.score.total)),
    prevAvgPts: avg(g.prev.map((p) => p.score.avgPts ?? 0)),
    prevLevels,
  };
  return { subs, ov };
}

/* ----- drawing ----- */

interface Ctx {
  doc: jsPDF;
  autoTable: AutoTable;
  W: number;
  H: number;
  school: string;
  term: string;
  termYear: string;
  meta: PdfMeta;
  grade: GradeFn;
  exceedMin: number;
  belowCut: number;
  cmp: ReportComparison | null;
  info: (title: string) => string;
  newPage: () => void;
}

function reportHeader(d: jsPDF, W: number, school: string, title: string, info: string) {
  fill(d, NAVY);
  d.rect(0, 0, W, 27, "F");
  fill(d, GOLD);
  d.rect(0, 27, W, 1.2, "F");
  ink(d, WHITE);
  d.setFont("helvetica", "bold");
  d.setFontSize(14);
  d.text(safe(school), 12, 10);
  d.setFontSize(10.5);
  d.text(safe(`REPORT: ${title}`), 12, 17);
  d.setFont("helvetica", "normal");
  d.setFontSize(8.5);
  d.text(safe(info), 12, 23.2);
}

function reportFooters(d: jsPDF, W: number, H: number) {
  const pages = d.getNumberOfPages();
  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()} at ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  for (let i = 1; i <= pages; i++) {
    d.setPage(i);
    d.setFont("helvetica", "normal");
    d.setFontSize(7.5);
    ink(d, MUTED);
    stroke(d, LINE);
    d.setLineWidth(0.2);
    d.line(12, H - 10, W - 12, H - 10);
    d.text(`Report generated on: ${stamp}`, 12, H - 5.5);
    d.text(`Page ${i}/${pages}`, W - 12, H - 5.5, { align: "right" });
  }
}

function base(fontSize: number): UserOptions {
  return {
    theme: "grid",
    margin: { left: 12, right: 12, top: 14, bottom: 16 },
    styles: { fontSize, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.12 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", lineColor: NAVY },
    alternateRowStyles: { fillColor: SOFT },
  };
}

function note(d: jsPDF, y: number, lines: string[]): number {
  d.setFont("helvetica", "normal");
  d.setFontSize(7.8);
  ink(d, MUTED);
  lines.forEach((t, i) => d.text(safe(t), 12, y + i * 4.2));
  return y + lines.length * 4.2;
}

/** Page 1 */
function pageSummary(c: Ctx, g: Group, o: Overall, subs: SubStat[]) {
  c.newPage();
  const { doc, W } = c;
  reportHeader(doc, W, c.school, "CLASS PERFORMANCE SUMMARY", c.info(g.title));

  const gap = 4;
  const tw = (W - 24 - gap * 3) / 4;
  const y = 36;
  const pct = (k: number) => Math.round((k / o.n) * 100);
  tile(doc, 12, y, tw, 22, "TOTAL STUDENTS", String(o.n), `in this ${g.single ? "class" : "grade"} & exam`, GOLD);
  tile(doc, 12 + (tw + gap), y, tw, 22, "EXCEEDING EXPECTATIONS", `${o.levels.Exceeding} (${pct(o.levels.Exceeding)}%)`, `Avg >= ${c.exceedMin} per subject`, LEVEL_RGB.Exceeding);
  tile(doc, 12 + (tw + gap) * 2, y, tw, 22, "CLASS MEAN SCORE", `${f1(o.meanTotal)} / ${Math.max(1, Math.round(o.meanEntries)) * 100}`, `${f1(o.meanOfMeans)} avg per subject`, NAVY);
  tile(doc, 12 + (tw + gap) * 3, y, tw, 22, "BELOW EXPECTATIONS", `${o.levels.Below} (${pct(o.levels.Below)}%)`, `Avg < ${c.belowCut} per subject`, LEVEL_RGB.Below);

  const ty = y + 22 + 12;
  const leftW = 118;
  sectionTitle(doc, 12, ty, "ACHIEVEMENT BANDS (OVERALL)");
  c.autoTable(doc, {
    ...base(8.4),
    startY: ty + 3,
    margin: { left: 12, right: 12, top: 14, bottom: 16 },
    tableWidth: leftW,
    head: [["Level", "Meaning", "Students", "%"]],
    body: LVLS.map((l) => [LEVEL_CODE[l], LEVEL_NAME[l], String(o.levels[l]), `${pct(o.levels[l])}%`]),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 16 }, 2: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.textColor = LEVEL_RGB[LVLS[d.row.index]];
    },
  });

  const rx = 12 + leftW + 12;
  sectionTitle(doc, rx, ty, "SUBJECT MEANS (OUT OF 100)");
  c.autoTable(doc, {
    ...base(8.2),
    startY: ty + 3,
    margin: { left: rx, right: 12, top: 14, bottom: 16 },
    tableWidth: W - 12 - rx,
    head: [["Subject", "Mean", "Level"]],
    body: subs.map((s) => [safe(s.name), dp(s.mean, 1), s.level ? LEVEL_CODE[s.level] : "-"]),
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right", cellWidth: 24 }, 2: { halign: "center", cellWidth: 22 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 2) {
        const lv = subs[d.row.index]?.level;
        if (lv) {
          d.cell.styles.textColor = LEVEL_RGB[lv];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
}

/** Page 2 (and as many more as the learners need) */
function pageMerit(c: Ctx, g: Group, o: Overall, subs: SubStat[]) {
  c.newPage();
  const { doc, W, H } = c;
  reportHeader(doc, W, c.school, "STUDENTS' PERFORMANCE MERIT LIST", c.info(g.title));

  const hasPrev = g.prev.length > 0;
  const n = g.subjects.length;
  const lead = [8, 15, 36, 11, 10, 10, ...(hasPrev ? [10, 10] : [])];
  const tail = [11, 12, 12, 11, 11, 11];
  const fixed = [...lead, ...tail].reduce((a, b) => a + b, 0);
  const per = Math.floor(((W - 24 - fixed) / Math.max(1, n)) * 10) / 10;
  const narrow = per < 10.5;
  const fs = per >= 13 ? 7.4 : per >= 10.5 ? 6.8 : 6;
  const leadN = lead.length;

  const head = [[
    "S.No", "ADM No.", "Student Name", "Stream", "Str Pos", "Ovr Pos", ...(hasPrev ? ["Prv Str", "Prv Ovr"] : []),
    ...g.subjects.map((s) => (narrow ? abbr(s.name).slice(0, 3) : abbr(s.name))),
    "Sub. Entry", "Total Marks", "Avg Marks", "Total Pts", "Avg Pts", "Level",
  ]];

  const body = g.rows.map((r, i) => [
    String(i + 1), r.admNo, safe(r.name), r.stream, pos(r.strPos), pos(r.ovrPos), ...(hasPrev ? [pos(r.prvStr), pos(r.prvOvr)] : []),
    ...r.marks.map((m) => (m === null ? "-" : `${mk(m)}${narrow ? "\n" : " "}${LEVEL_CODE[c.grade(m).level]}`)),
    String(r.entries), mk(r.total), f1(r.mean), String(r.points), dp(r.avgPts, 2), LEVEL_CODE[r.level],
  ]);

  const span = (text: string): CellDef => ({ content: text, colSpan: leadN, styles: { halign: "right" } });
  const blank: CellDef = { content: "", colSpan: tail.length };
  const foot: RowInput[] = [
    [span("AVERAGE MARKS"), ...subs.map((s) => (s.mean === null ? "-" : narrow ? dp(s.mean, 1) : `${dp(s.mean, 2)}%`)), blank],
    [span("AVERAGE POINTS"), ...subs.map((s) => dp(s.avgPts, narrow ? 2 : 4)), blank],
    [span("PERFORMANCE LEVEL"), ...subs.map((s) => (s.level ? LEVEL_CODE[s.level] : "-")), blank],
  ];

  const columnStyles: Record<number, { cellWidth: number; halign: "left" | "center" }> = {};
  [...lead, ...Array(n).fill(per), ...tail].forEach((w, i) => (columnStyles[i] = { cellWidth: w as number, halign: i === 2 ? "left" : "center" }));

  c.autoTable(doc, {
    ...base(fs),
    startY: 34,
    margin: { left: 12, right: 12, top: 14, bottom: 16 },
    tableWidth: "auto",
    head,
    body,
    foot,
    showFoot: "lastPage",
    styles: { fontSize: fs, cellPadding: { top: narrow ? 0.9 : 1.3, bottom: narrow ? 0.9 : 1.3, left: 0.8, right: 0.8 }, textColor: INK, lineColor: LINE, lineWidth: 0.12, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", lineColor: NAVY, halign: "center", valign: "middle", fontSize: per < 7 ? 5.2 : Math.min(fs, 6.6) },
    footStyles: { fillColor: SOFT, textColor: NAVY, fontStyle: "bold", lineColor: LINE },
    columnStyles,
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const r = g.rows[d.row.index];
      if (!r) return;
      const ci = d.column.index;
      if (ci === 2) d.cell.styles.fontStyle = "bold";
      if (ci >= leadN && ci < leadN + n) {
        const m = r.marks[ci - leadN];
        if (m !== null) d.cell.styles.textColor = LEVEL_RGB[c.grade(m).level];
      } else if (ci === leadN + n + 5) {
        d.cell.styles.textColor = LEVEL_RGB[r.level];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  let y = finalY(doc, 40) + 6;
  if (y > H - 34) {
    doc.addPage();
    y = 20;
  }
  note(doc, y, [
    `- CLASS AVERAGE MARKS: ${f1(o.meanTotal)}`,
    "- Student position assigned by using average marks (learners may take different numbers of subjects)",
    "- Student performance level calculated using student average marks",
    "- Ovr Pos is the position among all learners in this report. Str Pos is the position within the learner's own class.",
    ...(hasPrev && c.cmp ? [`- Prv Str and Prv Ovr are the positions in ${c.cmp.previous.name}. A dash means the learner had no marks in that exam.`] : []),
  ]);
}

/** Page 4 */
function pageDistribution(c: Ctx, g: Group, o: Overall, subs: SubStat[]) {
  c.newPage();
  const { doc, W } = c;
  reportHeader(doc, W, c.school, "SUBJECT GRADE DISTRIBUTION REPORT", c.info(g.title));

  const dev = o.prevAvgPts === null ? null : o.avgPts - o.prevAvgPts;
  const gap = 4;
  const tw = (W - 24 - gap * 3) / 4;
  tile(doc, 12, 36, tw, 22, "GRADED STUDENTS' COUNT", String(o.n), undefined, GOLD);
  tile(doc, 12 + (tw + gap), 36, tw, 22, "AVERAGE POINTS", dp(o.avgPts, 4), undefined, NAVY);
  tile(doc, 12 + (tw + gap) * 2, 36, tw, 22, "LEVEL", LEVEL_CODE[o.level], undefined, LEVEL_RGB[o.level]);
  tile(doc, 12 + (tw + gap) * 3, 36, tw, 22, "DEVIATION VS PREVIOUS", sdp(dev, 4), c.cmp ? `against ${c.cmp.previous.name}` : undefined, dev === null ? MUTED : dev >= 0 ? UP : DOWN);

  const devOf = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  const body: string[][] = [
    ["Mean Marks (Overall)", ...LVLS.map((l) => String(o.levels[l])), String(o.n), dp(o.meanOfMeans, 2), dp(o.avgPts, 4), LEVEL_CODE[o.level], dp(o.prevAvgPts, 4), sdp(dev, 4)],
    ...subs.map((s) => [
      safe(s.name), ...LVLS.map((l) => String(s.counts[l])), String(s.entry), dp(s.mean, 2), dp(s.avgPts, 4),
      s.level ? LEVEL_CODE[s.level] : "-", dp(s.prevPts, 4), sdp(devOf(s.avgPts, s.prevPts), 4),
    ]),
  ];
  const devs: (number | null)[] = [dev, ...subs.map((s) => devOf(s.avgPts, s.prevPts))];
  const lvls: (Lvl | null)[] = [o.level, ...subs.map((s) => s.level)];

  c.autoTable(doc, {
    ...base(8.2),
    startY: 66,
    head: [["Learning Area", "E.E", "M.E", "A.E", "B.E", "Entry", "Avg Marks", "Avg Points", "Level", "Prev Points", "DEV"]],
    body,
    columnStyles: Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [i, { halign: i === 0 ? "left" : "center", fontStyle: i === 0 ? "bold" : "normal" }]),
    ),
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const i = d.row.index;
      if (i === 0) {
        d.cell.styles.fillColor = [231, 237, 247];
        d.cell.styles.fontStyle = "bold";
      }
      if (d.column.index === 8) {
        const lv = lvls[i];
        if (lv) {
          d.cell.styles.textColor = LEVEL_RGB[lv];
          d.cell.styles.fontStyle = "bold";
        }
      }
      if (d.column.index === 10) {
        const v = devs[i];
        if (v !== null && v !== undefined) {
          d.cell.styles.textColor = v > 0 ? UP : v < 0 ? DOWN : MUTED;
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
}

/** Page 5 */
function pageComparison(c: Ctx, g: Group, o: Overall, subs: SubStat[]) {
  const cmp = c.cmp;
  if (!cmp) return;
  c.newPage();
  const { doc, W } = c;
  reportHeader(doc, W, c.school, "COMPARISON WITH PREVIOUS EXAM", c.info(g.title));

  const gap = 4;
  const tw = (W - 24 - gap * 3) / 4;
  const haveData = g.prev.length > 0 && o.prevMeanTotal !== null;
  if (haveData) {
    const change = o.meanTotal - (o.prevMeanTotal as number);
    tile(doc, 12, 36, tw, 22, "CURRENT CLASS MEAN", f1(o.meanTotal), `${cmp.current.name} ${c.termYear}`, NAVY);
    tile(doc, 12 + (tw + gap), 36, tw, 22, "PREVIOUS CLASS MEAN", f1(o.prevMeanTotal), cmp.previous.name, MUTED);
    tile(doc, 12 + (tw + gap) * 2, 36, tw, 22, "CHANGE IN CLASS MEAN", signed(change), undefined, change >= 0 ? UP : DOWN);
    tile(doc, 12 + (tw + gap) * 3, 36, tw, 22, "PREVIOUS STUDENT COUNT", String(o.prevN), `current: ${o.n}`, GOLD);
  } else if (cmp.summary) {
    tile(doc, 12, 36, tw, 22, "CURRENT MEAN %", f1(cmp.summary.meanNow), cmp.current.name, NAVY);
    tile(doc, 12 + (tw + gap), 36, tw, 22, "PREVIOUS MEAN %", f1(cmp.summary.meanPrev), cmp.previous.name, MUTED);
    tile(doc, 12 + (tw + gap) * 2, 36, tw, 22, "CHANGE IN MEAN", signed(cmp.summary.change), "percentage points", cmp.summary.change >= 0 ? UP : DOWN);
    tile(doc, 12 + (tw + gap) * 3, 36, tw, 22, "LEARNERS COMPARED", String(cmp.paired), "with results in both exams", GOLD);
  }

  /* subject by subject: from the full learner lists when we have them, otherwise from the paired figures */
  const lvlOf = (v: number | null): Lvl | null => (v === null ? null : c.grade(v).level);
  const lines = haveData
    ? subs.map((s) => ({ name: s.name, cur: s.mean, prev: s.prevMean }))
    : cmp.subjects.map((s) => ({ name: s.name, cur: s.now as number | null, prev: s.prev as number | null }));
  const change = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

  sectionTitle(doc, 12, 70, "SUBJECT-BY-SUBJECT COMPARISON");
  c.autoTable(doc, {
    ...base(8.2),
    startY: 73,
    head: [["Subject", "Current Mean", "Previous Mean", "Change", "Current Level", "Previous Level"]],
    body: lines.map((l) => {
      const cl = lvlOf(l.cur);
      const pl = lvlOf(l.prev);
      return [safe(l.name), dp(l.cur, 1), dp(l.prev, 1), sdp(change(l.cur, l.prev), 1), cl ? LEVEL_CODE[cl] : "-", pl ? LEVEL_CODE[pl] : "-"];
    }),
    columnStyles: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, { halign: i === 0 ? "left" : "center", fontStyle: i === 0 ? "bold" : "normal" }])),
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const l = lines[d.row.index];
      if (!l) return;
      if (d.column.index === 3) {
        const v = change(l.cur, l.prev);
        if (v !== null) {
          d.cell.styles.textColor = v >= 1 ? UP : v <= -1 ? DOWN : MUTED;
          d.cell.styles.fontStyle = "bold";
        }
      }
      if (d.column.index === 4 || d.column.index === 5) {
        const lv = lvlOf(d.column.index === 4 ? l.cur : l.prev);
        if (lv) d.cell.styles.textColor = LEVEL_RGB[lv];
      }
    },
  });

  if (!haveData) return;
  let y = finalY(doc, 100) + 12;
  if (y > c.H - 56) {
    doc.addPage();
    y = 22;
  }
  sectionTitle(doc, 12, y, "ACHIEVEMENT BAND SHIFT (CURRENT VS PREVIOUS)");
  c.autoTable(doc, {
    ...base(8.4),
    startY: y + 3,
    tableWidth: 170,
    head: [["Level", "Meaning", "Current Students", "Previous Students", "Change"]],
    body: LVLS.map((l) => [LEVEL_CODE[l], LEVEL_NAME[l], String(o.levels[l]), String(o.prevLevels[l]), sdp(o.levels[l] - o.prevLevels[l], 0).replace("+0", "0")]),
    columnStyles: { 0: { fontStyle: "bold" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.column.index === 0) d.cell.styles.textColor = LEVEL_RGB[LVLS[d.row.index]];
      if (d.column.index === 4) {
        const l = LVLS[d.row.index];
        const diff = o.levels[l] - o.prevLevels[l];
        // for Below expectation, fewer learners is the good direction
        const good = l === "Below" ? diff < 0 : diff > 0;
        const bad = l === "Below" ? diff > 0 : diff < 0;
        d.cell.styles.textColor = good ? UP : bad ? DOWN : MUTED;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
}

export async function saveAnalysisPdf(o: {
  schoolName: string;
  termLabel: string;
  meta: PdfMeta;
  bands: ReportBand[];
  classes: ReportClassRef[];
  /** Loads one class. With an exam id it loads that exam instead of the selected one. */
  loadClass: (streamId: string, examId?: string) => Promise<ReportClassData>;
  comparison: ReportComparison | null;
  filename: string;
}) {
  if (!o.bands.length) throw new Error("Could not load the grading bands. Refresh the page and try again.");
  if (!o.classes.length) throw new Error("Could not load any classes for this selection.");

  const grade: GradeFn = (pct) => o.bands.find((b) => pct >= b.min) ?? o.bands[o.bands.length - 1];
  const exceeding = o.bands.filter((b) => b.level === "Exceeding").map((b) => b.min);
  const aboveBelow = o.bands.filter((b) => b.level !== "Below").map((b) => b.min);

  /* Load every class (and the same class for the previous exam, when there is one) */
  const prevId = o.comparison ? String(o.comparison.previous.id) : null;
  const loaded = await Promise.all(
    o.classes.map(async (ref) => {
      let cur: ReportClassData;
      try {
        cur = await o.loadClass(ref.id);
      } catch (e) {
        throw new Error(`Could not load the results for ${ref.label}: ${e instanceof Error ? e.message : "please try again"}`);
      }
      let prev: ReportClassData | null = null;
      if (prevId) {
        try {
          prev = await o.loadClass(ref.id, prevId);
        } catch {
          prev = null; // the report still works; the previous-exam columns just stay empty
        }
      }
      return { ref, cur, prev };
    }),
  );

  const grades = [...new Set(o.classes.map((c) => c.grade))].sort((a, b) => a - b);
  const groups = grades
    .map((gr) => {
      const list = loaded.filter((x) => x.ref.grade === gr);
      const single = list.length === 1;
      const label = list[0]?.ref.label ?? "";
      const title = single ? (/grade/i.test(label) ? label : `Grade ${label}`).toUpperCase() : `GRADE ${gr}`;
      return buildGroup(title, single, list, grade);
    })
    .filter((g): g is Group => g !== null);
  if (!groups.length) throw new Error("Could not load any marks for this selection.");

  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let first = true;

  const term = o.termLabel.split(",")[0].trim();
  const ctx: Ctx = {
    doc, autoTable, W: 297, H: 210,
    school: o.schoolName, term, termYear: o.termLabel.replace(",", ""), meta: o.meta, grade,
    exceedMin: exceeding.length ? Math.min(...exceeding) : 75,
    belowCut: aboveBelow.length ? Math.min(...aboveBelow) : 0,
    cmp: o.comparison,
    info: (title) => `CLASS: ${title}    TERM: ${term}    YEAR: ${o.meta.year}    EXAM: ${o.meta.exam.toUpperCase()}`,
    newPage: () => {
      if (first) first = false;
      else doc.addPage();
    },
  };

  groups.forEach((g) => {
    const { subs, ov } = statsFor(g, grade);
    pageSummary(ctx, g, ov, subs);
    pageMerit(ctx, g, ov, subs);
    pageDistribution(ctx, g, ov, subs);
    pageComparison(ctx, g, ov, subs);
  });

  reportFooters(doc, 297, 210);
  doc.save(o.filename);
}

/* ------------------------------------------------------------------ */
/* Report cards                                                        */
/* ------------------------------------------------------------------ */

function drawCard(doc: jsPDF, autoTable: AutoTable, c: CardData) {
  header(doc, 210, c.schoolName, `Learner report card · ${c.termLabel}`, 28);

  fill(doc, SOFT);
  doc.roundedRect(14, 38, 182, 24, 2.5, 2.5, "F");
  const field = (label: string, value: string, x: number, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    ink(doc, MUTED);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    ink(doc, NAVY);
    doc.text(fit(doc, safe(value), 80), x, y + 5);
  };
  field("Learner", c.learner.name, 20, 44.5);
  field("Admission no.", c.learner.admNo, 20, 54);
  field("Class", c.classLabel, 112, 44.5);
  field("Year and exam", `${c.yearLabel} · ${c.examLabel}`, 112, 54);

  autoTable(doc, {
    startY: 68,
    margin: { left: 14, right: 14 },
    head: [["Subject", "Score %", "Grade", "Level", "Pts", "Class mean %", "Score against class mean"]],
    body: c.rows.map((r) => [safe(r.subject), f1(r.pct), r.code, r.level, r.points === null ? "-" : String(r.points), f1(r.classMean), ""]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE, lineWidth: 0.12 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", lineColor: NAVY },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { cellWidth: 44 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 2) {
        const lvl = c.rows[d.row.index]?.level;
        if (lvl && LEVEL_RGB[lvl]) {
          d.cell.styles.textColor = LEVEL_RGB[lvl];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawCell: (d) => {
      if (d.section !== "body" || d.column.index !== 6) return;
      const r = c.rows[d.row.index];
      if (!r) return;
      const x = d.cell.x + 2.5;
      const w = d.cell.width - 5;
      const my = d.cell.y + d.cell.height / 2;
      fill(doc, LINE);
      doc.roundedRect(x, my - 1.3, w, 2.6, 1.3, 1.3, "F");
      if (isNum(r.pct)) {
        fill(doc, LEVEL_RGB[r.level] ?? NAVY);
        doc.roundedRect(x, my - 1.3, Math.max(1.4, (Math.min(r.pct, 100) / 100) * w), 2.6, 1.3, 1.3, "F");
      }
      if (isNum(r.classMean)) {
        stroke(doc, NAVY);
        doc.setLineWidth(0.5);
        doc.line(x + (Math.min(r.classMean, 100) / 100) * w, my - 2.6, x + (Math.min(r.classMean, 100) / 100) * w, my + 2.6);
      }
    },
  });

  let y = finalY(doc, 140) + 8;
  const tw = (182 - 3 * 4) / 4;
  [
    ["Mean", `${f1(c.mean)}%`],
    ["Total points", String(c.points)],
    ["Overall grade", c.code],
    ["Position", `${c.rank ?? "-"} of ${c.outOf}`],
  ].forEach(([l, v], i) => tile(doc, 14 + i * (tw + 4), y, tw, 18, l, v, undefined, GOLD));

  y += 18 + 9;
  sectionTitle(doc, 14, y, "Class teacher's comment");
  stroke(doc, LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y + 3, 182, 26, 2, 2, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  ink(doc, INK);
  doc.text(doc.splitTextToSize(safe(c.comment), 172), 19, y + 10);

  stroke(doc, MUTED);
  doc.setLineWidth(0.25);
  doc.line(14, 264, 84, 264);
  doc.line(126, 264, 196, 264);
  doc.setFontSize(8.5);
  ink(doc, MUTED);
  doc.text("Class teacher", 14, 269);
  doc.text("Head of Institution", 126, 269);
  doc.setFontSize(7.5);
  doc.text("EE Exceeding   ME Meeting   AE Approaching   BE Below expectation   |   Tick mark on the bar = class mean", 14, 286);
}

export async function saveReportCards(cards: CardData[], filename: string) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  cards.forEach((c, i) => {
    if (i > 0) doc.addPage();
    drawCard(doc, autoTable, c);
  });
  doc.save(filename);
}

/* ------------------------------------------------------------------ */
/* Class results PDF                                                   */
/* ------------------------------------------------------------------ */

export async function saveClassPdf(o: { title: string; subtitle: string; head: string[]; body: string[][]; filename: string }) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  header(doc, 297, o.title, o.subtitle, 24);

  const gradeCol = o.head.indexOf("Grade");
  const meanCol = o.head.indexOf("Mean %");
  const levelOf = (code: string): string | null =>
    code.startsWith("EE") ? "Exceeding" : code.startsWith("ME") ? "Meeting" : code.startsWith("AE") ? "Approaching" : code.startsWith("BE") ? "Below" : null;

  autoTable(doc, {
    startY: 32,
    margin: { left: 12, right: 12, top: 14, bottom: 16 },
    head: [o.head.map(safe)],
    body: o.body.map((r) => r.map(safe)),
    theme: "grid",
    styles: { fontSize: 8.3, cellPadding: 1.9, textColor: INK, lineColor: LINE, lineWidth: 0.12 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", lineColor: NAVY },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: Object.fromEntries(o.head.map((h, i) => [i, { halign: i === 1 || i === 2 ? "left" : "right" }])),
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.column.index === 2) d.cell.styles.fontStyle = "bold";
      if (d.column.index === meanCol) d.cell.styles.fontStyle = "bold";
      if (d.column.index === gradeCol) {
        const lvl = levelOf(String(d.cell.raw));
        if (lvl) {
          d.cell.styles.textColor = LEVEL_RGB[lvl];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  footers(doc, 297, 210, `${o.title} · ${o.subtitle}`);
  doc.save(o.filename);
}