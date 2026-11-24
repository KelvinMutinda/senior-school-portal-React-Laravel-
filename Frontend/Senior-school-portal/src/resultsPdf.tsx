import type { jsPDF } from "jspdf";
import type { ChartsInput, Lvl } from "./ResultsCharts";

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

function cellText(v: Cell, t: PdfSection["cols"][number]["t"]): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "string") return safe(v);
  if (t === "int") return String(Math.round(v));
  if (t === "delta") return signed(v);
  if (t === "pct") return v.toFixed(1);
  return String(v);
}

const fill = (d: jsPDF, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const ink = (d: jsPDF, c: RGB) => d.setTextColor(c[0], c[1], c[2]);
const stroke = (d: jsPDF, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);

function fit(d: jsPDF, text: string, maxW: number): string {
  if (d.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && d.getTextWidth(`${s}...`) > maxW) s = s.slice(0, -1);
  return `${s}...`;
}

function levelRgb(v: number, bands: ChartsInput["bands"]): RGB {
  const lvl = bands.find((b) => v >= b.min)?.level ?? "Below";
  return LEVEL_RGB[lvl];
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

/* ------------------------------------------------------------------ */
/* Chart primitives                                                    */
/* ------------------------------------------------------------------ */

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

/** Single stacked bar of the four performance levels, with a legend underneath. */
function levelBar(d: jsPDF, x: number, y: number, w: number, levels: Record<Lvl, number>) {
  let cx = x;
  LVLS.forEach((l) => {
    const sw = (levels[l] / 100) * w;
    if (sw <= 0) return;
    fill(d, LEVEL_RGB[l]);
    d.rect(cx, y, sw, 8, "F");
    if (sw > 11) {
      ink(d, WHITE);
      d.setFont("helvetica", "bold");
      d.setFontSize(7.5);
      d.text(`${Math.round(levels[l])}%`, cx + sw / 2, y + 5.3, { align: "center" });
    }
    cx += sw;
  });
  const colW = w / 4;
  LVLS.forEach((l, i) => {
    fill(d, LEVEL_RGB[l]);
    d.roundedRect(x + colW * i, y + 12, 2.6, 2.6, 0.6, 0.6, "F");
    d.setFont("helvetica", "normal");
    d.setFontSize(7.5);
    ink(d, INK);
    d.text(`${l} ${levels[l].toFixed(1)}%`, x + colW * i + 4, y + 14.3);
  });
}

function columns(
  d: jsPDF, x: number, y: number, w: number, h: number, title: string,
  rows: { label: string; value: number | null; color: RGB }[], max: number, mark?: number,
) {
  sectionTitle(d, x, y, title);
  if (!rows.length) return;
  const top = y + 8;
  const plotH = h - 8 - 9;
  const base = top + plotH;
  const left = x + 9;
  const pw = w - 9;

  d.setLineWidth(0.15);
  stroke(d, LINE);
  d.setFont("helvetica", "normal");
  d.setFontSize(6.5);
  ink(d, MUTED);
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const gy = base - plotH * t;
    d.line(left, gy, x + w, gy);
    d.text(String(Math.round(max * t * 10) / 10), left - 1.5, gy + 1, { align: "right" });
  });

  const slot = pw / rows.length;
  const bw = Math.min(14, slot * 0.62);
  rows.forEach((r, i) => {
    const cx = left + slot * i + slot / 2;
    const v = isNum(r.value) ? Math.min(r.value, max) : 0;
    const bh = (v / max) * plotH;
    fill(d, r.color);
    if (bh > 0) d.roundedRect(cx - bw / 2, base - bh, bw, bh, 0.8, 0.8, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(7);
    ink(d, INK);
    d.text(f1(r.value), cx, base - bh - 1.6, { align: "center" });
    d.setFont("helvetica", "normal");
    d.setFontSize(6.5);
    ink(d, MUTED);
    d.text(fit(d, safe(r.label), slot - 1), cx, base + 4.5, { align: "center" });
  });

  if (mark !== undefined) {
    const my = base - (mark / max) * plotH;
    stroke(d, MUTED);
    d.setLineDashPattern([1.2, 1.2], 0);
    d.line(left, my, x + w, my);
    d.setLineDashPattern([], 0);
  }
}

function hbars(
  d: jsPDF, x: number, y: number, w: number, title: string, rows: { label: string; value: number | null }[],
  bands: ChartsInput["bands"], mark: number, maxRows = 18, maxH = 150,
) {
  sectionTitle(d, x, y, title);
  const list = rows.slice(0, maxRows);
  if (!list.length) return;
  const rowH = Math.min(7, maxH / list.length);
  const labelW = Math.min(48, w * 0.36);
  const trackX = x + labelW;
  const trackW = w - labelW - 14;
  const top = y + 6;

  list.forEach((r, i) => {
    const ry = top + i * rowH;
    const mid = ry + rowH / 2;
    d.setFont("helvetica", "normal");
    d.setFontSize(7.5);
    ink(d, INK);
    d.text(fit(d, safe(r.label), labelW - 3), x, mid + 1);
    fill(d, LINE);
    d.roundedRect(trackX, mid - 1.4, trackW, 2.8, 1.4, 1.4, "F");
    if (isNum(r.value)) {
      fill(d, levelRgb(r.value, bands));
      d.roundedRect(trackX, mid - 1.4, Math.max(1.5, (Math.min(r.value, 100) / 100) * trackW), 2.8, 1.4, 1.4, "F");
    }
    d.setFont("helvetica", "bold");
    ink(d, INK);
    d.text(f1(r.value), x + w, mid + 1, { align: "right" });
  });

  const mx = trackX + (mark / 100) * trackW;
  stroke(d, MUTED);
  d.setLineWidth(0.2);
  d.setLineDashPattern([1, 1], 0);
  d.line(mx, top - 1, mx, top + list.length * rowH);
  d.setLineDashPattern([], 0);
}

function deltaBars(d: jsPDF, x: number, y: number, w: number, title: string, rows: { label: string; value: number }[], maxRows = 18, maxH = 150) {
  sectionTitle(d, x, y, title);
  const list = rows.slice(0, maxRows);
  if (!list.length) return;
  const rowH = Math.min(7, maxH / list.length);
  const labelW = Math.min(48, w * 0.36);
  const trackW = w - labelW - 16;
  const cx = x + labelW + trackW / 2;
  const m = Math.max(1, ...list.map((r) => Math.abs(r.value)));
  const top = y + 6;

  list.forEach((r, i) => {
    const mid = top + i * rowH + rowH / 2;
    d.setFont("helvetica", "normal");
    d.setFontSize(7.5);
    ink(d, INK);
    d.text(fit(d, safe(r.label), labelW - 3), x, mid + 1);
    const bw = (Math.abs(r.value) / m) * (trackW / 2);
    fill(d, r.value >= 0 ? UP : DOWN);
    d.roundedRect(r.value >= 0 ? cx : cx - bw, mid - 1.4, Math.max(0.6, bw), 2.8, 0.8, 0.8, "F");
    d.setFont("helvetica", "bold");
    ink(d, r.value >= 1 ? UP : r.value <= -1 ? DOWN : MUTED);
    d.text(signed(r.value), x + w, mid + 1, { align: "right" });
  });
  stroke(d, MUTED);
  d.setLineWidth(0.2);
  d.line(cx, top - 1, cx, top + list.length * rowH);
}

/* ------------------------------------------------------------------ */
/* Analysis PDF: dashboard pages, then the detail tables               */
/* ------------------------------------------------------------------ */

export async function saveAnalysisPdf(o: {
  sections: PdfSection[];
  charts: ChartsInput;
  schoolName: string;
  termLabel: string;
  meta: PdfMeta;
  filename: string;
}) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297;
  const H = 210;
  const a = o.charts;
  const s = a.summary;

  header(doc, W, `${o.schoolName} - Results analysis`, `${o.meta.scope} · ${o.meta.year} · ${o.meta.exam} · ${o.termLabel}`);

  let y = 36;
  if (o.meta.includesPending) {
    ink(doc, [150, 90, 10]);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text("Includes submitted results that have not been approved yet. Numbers can change.", 12, y + 2);
    y += 7;
  }

  /* KPI tiles */
  const gap = 4;
  const tw = (W - 24 - gap * 4) / 5;
  const tiles: [string, string, string?, RGB?][] = [
    ["Mean score", `${f1(s.mean)}%`, `${s.withResults} of ${s.learners} learners`, s.mean !== null ? levelRgb(s.mean, a.bands) : GOLD],
    ["Meeting or above", `${f1(s.meetingRate)}%`, `${s.meetingMark}% and over`, LEVEL_RGB.Meeting],
    ["Highest learner", `${f1(s.high)}%`, undefined, LEVEL_RGB.Exceeding],
    ["Lowest learner", `${f1(s.low)}%`, undefined, LEVEL_RGB.Below],
    [`Below ${s.meetingMark}%`, String(s.belowMeeting), "learners needing support", LEVEL_RGB.Approaching],
  ];
  tiles.forEach((t, i) => tile(doc, 12 + i * (tw + gap), y, tw, 22, t[0], t[1], t[2], t[3]));
  y += 22 + 9;

  /* Row of charts */
  const overall: Record<Lvl, number> = { Exceeding: 0, Meeting: 0, Approaching: 0, Below: 0 };
  a.bands.forEach((b) => (overall[b.level] += b.pct));
  const colW = (W - 24 - 14) / 2;

  sectionTitle(doc, 12, y, "Performance levels");
  levelBar(doc, 12, y + 5, colW, overall);
  const bandMax = Math.max(10, Math.ceil(Math.max(...a.bands.map((b) => b.pct)) / 5) * 5);
  columns(doc, 12, y + 28, colW, 66, "Grade bands (BE2 to EE1), % of results",
    [...a.bands].reverse().map((b) => ({ label: b.code, value: b.pct, color: LEVEL_RGB[b.level] })), bandMax);

  columns(doc, 12 + colW + 14, y, colW, 94, "Mean score by grade",
    a.grades.map((g) => ({ label: g.label, value: g.mean, color: g.mean !== null ? levelRgb(g.mean, a.bands) : LINE })), 100, s.meetingMark);

  /* Page 2: classes and subjects */
  doc.addPage();
  hbars(doc, 12, 20, colW, "Class ranking (mean %)", a.streams.map((x) => ({ label: x.label, value: x.mean })), a.bands, s.meetingMark);
  hbars(doc, 12 + colW + 14, 20, colW, "Subject ranking (mean %)", a.subjects.map((x) => ({ label: x.name, value: x.mean })), a.bands, s.meetingMark);
  ink(doc, MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Dashed line marks the ${s.meetingMark}% meeting line. Bar colour shows the performance level.`, 12, H - 15);

  /* Page 3: comparison, when there is one */
  const c = a.comparison;
  if (c?.summary) {
    doc.addPage();
    deltaBars(doc, 12, 20, colW, `Change by subject: ${c.previous.name} to ${c.current.name}`, c.subjects.map((x) => ({ label: x.name, value: x.change })));
    deltaBars(doc, 12 + colW + 14, 20, colW, "Change by class (points)", c.streams.map((x) => ({ label: x.label, value: x.change })));
    ink(doc, MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Overall ${signed(c.summary.change)} points. ${c.summary.improved} improved, ${c.summary.declined} declined, ${c.summary.steady} steady.`, 12, H - 15);
  }

  /* Detail tables */
  doc.addPage();
  let ty = 18;
  o.sections.forEach((sec) => {
    if (ty > 165) {
      doc.addPage();
      ty = 18;
    }
    sectionTitle(doc, 12, ty, sec.title);
    ty += 2;
    if (sec.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      ink(doc, MUTED);
      const lines = doc.splitTextToSize(safe(sec.note), W - 24);
      doc.text(lines, 12, ty + 4);
      ty += 3.6 * lines.length;
    }
    const deltaCols = sec.cols.map((c2, i) => (c2.t === "delta" ? i : -1)).filter((i) => i >= 0);
    autoTable(doc, {
      startY: ty + 3,
      margin: { left: 12, right: 12, top: 14, bottom: 16 },
      head: [sec.cols.map((c2) => safe(c2.h))],
      body: sec.rows.map((r) => r.map((v, i) => cellText(v, sec.cols[i]?.t ?? "text"))),
      theme: "grid",
      styles: { fontSize: 7.8, cellPadding: 1.7, textColor: INK, lineColor: LINE, lineWidth: 0.12, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", lineColor: NAVY },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: Object.fromEntries(sec.cols.map((c2, i) => [i, { halign: c2.t === "text" ? "left" : "right" }])),
      didParseCell: (data) => {
        if (data.section === "body" && deltaCols.includes(data.column.index)) {
          const t = String(data.cell.raw);
          if (t.startsWith("+")) data.cell.styles.textColor = UP;
          else if (t.startsWith("-") && t !== "-") data.cell.styles.textColor = DOWN;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    ty = finalY(doc, ty + 20) + 10;
  });

  footers(doc, W, H, `${o.schoolName} · Generated ${new Date(o.meta.generatedAt).toLocaleString("en-KE")} · EE Exceeding, ME Meeting, AE Approaching, BE Below expectation`, `${o.meta.scope} · ${o.meta.exam}`);
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