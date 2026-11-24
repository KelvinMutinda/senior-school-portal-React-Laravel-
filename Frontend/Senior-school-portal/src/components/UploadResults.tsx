import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import TeacherSidebar from "../Teachers/TeacherSidebar";
import { apiUrl, authHeaders, getUser } from "../api/authApi";

export type AssessmentStatus = "not_started" | "draft" | "submitted" | "returned" | "published";

export interface Learner {
  id: string;
  admNo: string;
  name: string;
}

/** An exam type (CAT 1, Mid-term, End of term...) defined for an academic year. */
export interface ExamTypeOption {
  id: string;
  name: string;
  max: number;
  yearId: string;
}

export interface SubjectOption {
  id: string;
  name: string;
}

/** One class (grade + stream), e.g. "Grade 10 B". `grade` is the grade name, e.g. "Grade 10". */
export interface ClassOption {
  id: string;
  label: string;
  grade: string;
  subjects: SubjectOption[];
}

export interface YearOption {
  id: string;
  label: string;
  classes: ClassOption[];
}

interface OptionsResponse {
  currentYearId: string | null;
  canManageExamTypes: boolean;
  years: YearOption[];
  examTypes: ExamTypeOption[];
}

interface SheetResponse {
  learners: Learner[];
  marks: Record<string, string>;
  status: AssessmentStatus;
  reviewerComment?: string | null;
}

export interface SheetPayload {
  yearId: string;
  classId: string;
  subjectId: string;
  examTypeId: string;
  marks: Record<string, string>;
}

export interface UploadResultsProps {
  /** Who reviews submitted marks. Defaults to the Deputy (or the HOI when a Deputy is signed in). */
  reviewer?: "deputy" | "hoi";
  termLabel?: string;
  theme?: "light" | "dark";
  onRequestCorrection?: (payload: Omit<SheetPayload, "marks">) => void;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(apiUrl(path), {
    method: init.method ?? "GET",
    headers: { ...authHeaders(), ...(hasBody ? { "Content-Type": "application/json" } : {}) },
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const first = body?.errors ? (Object.values(body.errors as Record<string, string[]>)[0]?.[0] ?? null) : null;
    throw new Error(
      first ??
        body?.message ??
        (res.status === 401
          ? "Your session has ended. Please sign in again."
          : res.status === 403
            ? "You do not have permission to do that."
            : "Something went wrong. Please try again."),
    );
  }
  return body as T;
}

const gradeOrder = (g: string) => parseInt(g.replace(/\D/g, ""), 10) || 0;
const NO_LEARNERS: Learner[] = [];

/* ------------------------------------------------------------------ */
/* Marks checking                                                      */
/* ------------------------------------------------------------------ */

type CellState = "missing" | "absent" | "ok" | "error";

function checkMark(raw: string, max: number): { state: CellState; message?: string } {
  const v = raw.trim().toUpperCase().replace(",", ".");
  if (v === "") return { state: "missing" };
  if (v === "ABS" || v === "A" || v === "ABSENT") return { state: "absent" };
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return { state: "error", message: "Enter a number or ABS." };
  if (Number(v) > max) return { state: "error", message: `Above the maximum of ${max}.` };
  return { state: "ok" };
}

function normalise(raw: string): string {
  const v = raw.trim().toUpperCase().replace(",", ".");
  if (v === "A" || v === "ABSENT" || v === "ABS") return "ABS";
  return v;
}

/* ------------------------------------------------------------------ */
/* Excel and CSV reading                                               */
/* ------------------------------------------------------------------ */

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
    return rows.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some((c) => c !== ""));
  }
  throw new Error("This file type is not supported. Use .xlsx, .xls or .csv.");
}

interface UploadIssue {
  line: number;
  adm: string;
  message: string;
}

interface UploadReport {
  fileName: string;
  ready: { learnerId: string; value: string }[];
  issues: UploadIssue[];
  blank: number;
  notInFile: number;
}

function analyse(rows: string[][], learners: Learner[], max: number, fileName: string): UploadReport {
  if (rows.length === 0) throw new Error("The file is empty.");

  const header = rows[0].map((c) => c.toLowerCase());
  const hasHeader = header.some((c) => /adm|name|mark|score|result/.test(c));
  let admCol = hasHeader ? header.findIndex((c) => /adm|reg/.test(c)) : 0;
  let markCol = hasHeader ? header.findIndex((c) => /mark|score|result/.test(c)) : rows[0].length > 2 ? 2 : 1;
  if (admCol < 0) admCol = 0;
  if (markCol < 0) markCol = rows[0].length - 1;

  const body = hasHeader ? rows.slice(1) : rows;
  const offset = hasHeader ? 2 : 1;
  const byAdm = new Map(learners.map((l) => [l.admNo.trim().toUpperCase(), l]));
  const seen = new Set<string>();

  const ready: UploadReport["ready"] = [];
  const issues: UploadIssue[] = [];
  let blank = 0;

  body.forEach((row, i) => {
    const line = i + offset;
    const adm = (row[admCol] ?? "").trim();
    const raw = (row[markCol] ?? "").trim();
    if (!adm && !raw) return;

    if (!adm) {
      issues.push({ line, adm: "", message: "No admission number on this row." });
      return;
    }
    const learner = byAdm.get(adm.toUpperCase());
    if (!learner) {
      issues.push({ line, adm, message: "Admission number not found in this class." });
      return;
    }
    if (seen.has(learner.id)) {
      issues.push({ line, adm, message: "This learner appears more than once. The first row was used." });
      return;
    }
    seen.add(learner.id);

    if (raw === "") {
      blank++;
      return;
    }
    const result = checkMark(raw, max);
    if (result.state === "error") {
      issues.push({ line, adm, message: `${learner.name}: ${result.message}` });
      return;
    }
    ready.push({ learnerId: learner.id, value: normalise(raw) });
  });

  return { fileName, ready, issues, blank, notInFile: learners.length - seen.size };
}

/* ------------------------------------------------------------------ */
/* Template download                                                   */
/* ------------------------------------------------------------------ */

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName = "upload" | "warn";

const ICONS: Record<IconName, ReactNode> = {
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted for review",
  returned: "Returned for correction",
  published: "Published",
};

const STATUS_CLASS: Record<AssessmentStatus, string> = {
  not_started: "ss-tag muted",
  draft: "ss-tag",
  submitted: "ss-tag",
  returned: "ss-tag warn",
  published: "ss-tag ok",
};

const DRAFT_PREFIX = "portal.marks.";

type Method = "grid" | "upload";
type Filter = "all" | "missing" | "errors";
type TemplateKind = "xlsx" | "xls" | "csv";

export default function UploadResults({ reviewer, termLabel = "Term 3, 2026", theme = "light", onRequestCorrection }: UploadResultsProps) {
  const user = getUser();
  const userName = user?.name ?? "Teacher";
  const isAdmin = user?.role === "HOI" || user?.role === "DEPUTY";
  const reviewerKind: "deputy" | "hoi" = reviewer ?? (user?.role === "DEPUTY" ? "hoi" : "deputy");

  /* what this person may see: loaded from the server, which also enforces it */
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  /* selection: Year > Grade > Class > Subject > Exam type */
  const [yearId, setYearId] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");

  const years = options?.years ?? [];
  const year = years.find((y) => y.id === yearId);
  const grades = useMemo(
    () => Array.from(new Set((year?.classes ?? []).map((c) => c.grade))).sort((a, b) => gradeOrder(a) - gradeOrder(b) || a.localeCompare(b)),
    [year],
  );
  const classesInGrade = (year?.classes ?? []).filter((c) => c.grade === gradeName);
  const cls = classesInGrade.find((c) => c.id === classId);
  const subject = cls?.subjects.find((s) => s.id === subjectId);
  const examTypes = (options?.examTypes ?? []).filter((x) => x.yearId === yearId);
  const examType = examTypes.find((x) => x.id === examTypeId);
  const sheetKey = year && cls && subject && examType ? `${year.id}:${cls.id}:${subject.id}:${examType.id}` : "";
  const canManageExamTypes = options?.canManageExamTypes ?? false;

  /* the marks sheet for the chosen exam */
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [localSavedAt, setLocalSavedAt] = useState<number | null>(null);
  const [serverSavedAt, setServerSavedAt] = useState<number | null>(null);
  const touched = useRef(false);

  const [method, setMethod] = useState<Method>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  /* upload */
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState<"replace" | "fill">("replace");

  /* feedback */
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /* exam type management (HOI and Deputy) */
  const [showTypes, setShowTypes] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState("");
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeNotice, setTypeNotice] = useState<string | null>(null);

  const ready = Boolean(examType && sheet);
  const status: AssessmentStatus = sheet?.status ?? "not_started";
  const locked = status === "submitted" || status === "published";
  const max = examType?.max ?? 0;
  const learners = sheet?.learners ?? NO_LEARNERS;

  /* Load the classes, subjects and exam types this person may use. */
  useEffect(() => {
    let off = false;
    api<OptionsResponse>("/marks/options")
      .then((o) => {
        if (off) return;
        setOptions(o);
        if (o.currentYearId) setYearId(o.currentYearId);
      })
      .catch((err: Error) => {
        if (!off) setOptionsError(err.message);
      });
    return () => {
      off = true;
    };
  }, []);

  /* Load the sheet when the selection changes. A local draft wins over the server copy. */
  useEffect(() => {
    touched.current = false;
    setReport(null);
    setUploadError(null);
    setNotice(null);
    setFormError(null);
    setFilter("all");
    setQuery("");
    setMethod("grid");
    setLocalSavedAt(null);
    setServerSavedAt(null);
    setSheet(null);
    setSheetError(null);
    setMarks({});
    if (!sheetKey) return;

    let off = false;
    setSheetLoading(true);
    const qs = new URLSearchParams({ year_id: yearId, stream_id: classId, subject_id: subjectId, exam_type_id: examTypeId });
    api<SheetResponse>(`/marks/sheet?${qs.toString()}`)
      .then((data) => {
        if (off) return;
        let local: { marks: Record<string, string>; savedAt: number } | null = null;
        try {
          const raw = window.localStorage.getItem(DRAFT_PREFIX + sheetKey);
          if (raw) local = JSON.parse(raw);
        } catch {
          local = null;
        }
        if (local && data.status !== "published" && data.status !== "submitted") {
          setMarks(local.marks);
          setLocalSavedAt(local.savedAt);
        } else {
          setMarks({ ...data.marks });
        }
        setSheet(data);
      })
      .catch((err: Error) => {
        if (!off) setSheetError(err.message);
      })
      .finally(() => {
        if (!off) setSheetLoading(false);
      });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKey]);

  /* Keep a local copy so a dropped connection never loses typed marks. */
  useEffect(() => {
    if (!sheetKey || !sheet || !touched.current || locked) return;
    const t = window.setTimeout(() => {
      try {
        const savedAt = Date.now();
        window.localStorage.setItem(DRAFT_PREFIX + sheetKey, JSON.stringify({ marks, savedAt }));
        setLocalSavedAt(savedAt);
      } catch {
        /* storage may be unavailable; the server draft still works */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [marks, sheetKey, sheet, locked]);

  const updateMarks = (fn: (m: Record<string, string>) => Record<string, string>) => {
    touched.current = true;
    setNotice(null);
    setFormError(null);
    setMarks(fn);
  };

  /* ----- derived values ----- */

  const rows = useMemo(
    () =>
      learners.map((l) => {
        const value = marks[l.id] ?? "";
        const result = checkMark(value, max || Infinity);
        return { learner: l, value, ...result };
      }),
    [learners, marks, max],
  );

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.state === "ok").map((r) => Number(r.value.replace(",", ".")));
    const absent = rows.filter((r) => r.state === "absent").length;
    const missing = rows.filter((r) => r.state === "missing").length;
    const errors = rows.filter((r) => r.state === "error").length;
    return {
      entered: ok.length + absent,
      missing,
      errors,
      mean: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null,
      high: ok.length ? Math.max(...ok) : null,
      low: ok.length ? Math.min(...ok) : null,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "missing" && r.state !== "missing") return false;
      if (filter === "errors" && r.state !== "error") return false;
      if (!q) return true;
      return r.learner.name.toLowerCase().includes(q) || r.learner.admNo.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  const reviewerLabel = reviewerKind === "deputy" ? "the Deputy" : "the Head of Institution";
  const payload = (): SheetPayload => ({ yearId, classId, subjectId, examTypeId, marks });
  const requestBody = () => ({ year_id: yearId, stream_id: classId, subject_id: subjectId, exam_type_id: examTypeId, marks });

  /* ----- selection handlers (each level resets everything below it) ----- */

  const pickYear = (id: string) => {
    setYearId(id);
    setGradeName("");
    setClassId("");
    setSubjectId("");
    setExamTypeId("");
  };
  const pickGrade = (g: string) => {
    setGradeName(g);
    setClassId("");
    setSubjectId("");
    setExamTypeId("");
  };
  const pickClass = (id: string) => {
    setClassId(id);
    setSubjectId("");
    setExamTypeId("");
  };
  const pickSubject = (id: string) => {
    setSubjectId(id);
    setExamTypeId("");
  };

  /* ----- grid handlers ----- */

  const onMarkChange = (id: string, v: string) => updateMarks((m) => ({ ...m, [id]: v }));

  const onMarkBlur = (id: string, v: string) => {
    const n = normalise(v);
    if (n !== v) updateMarks((m) => ({ ...m, [id]: n }));
  };

  const onMarkKey = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const move = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    document.getElementById(`mk-row-${index + move}`)?.focus();
  };

  /* ----- upload handlers ----- */

  const handleFile = async (file: File | undefined | null) => {
    if (!file || !examType) return;
    setUploadError(null);
    setReport(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("This file is larger than 5 MB. Check that it only contains the marks sheet.");
      return;
    }
    setReading(true);
    try {
      const table = await readTable(file);
      setReport(analyse(table, learners, examType.max, file.name));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "The file could not be read.");
    } finally {
      setReading(false);
    }
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const applyReport = () => {
    if (!report) return;
    updateMarks((m) => {
      const next = { ...m };
      report.ready.forEach(({ learnerId, value }) => {
        if (applyMode === "replace" || (next[learnerId] ?? "").trim() === "") next[learnerId] = value;
      });
      return next;
    });
    setNotice(
      `Applied ${report.ready.length} ${report.ready.length === 1 ? "mark" : "marks"} from ${report.fileName}. Review them below before you submit.`,
    );
    setReport(null);
    setMethod("grid");
  };

  const downloadTemplate = async (kind: TemplateKind) => {
    if (!year || !cls || !subject || !examType) return;
    const table: string[][] = [
      ["Admission No", "Learner name", `Marks (out of ${examType.max})`],
      ...learners.map((l) => [l.admNo, l.name, marks[l.id] ?? ""]),
    ];
    const base = `marks-${slug(year.label)}-${slug(cls.label)}-${slug(subject.name)}-${slug(examType.name)}`;

    if (kind === "xlsx" || kind === "xls") {
      try {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet(table);
        ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks");
        XLSX.writeFile(wb, `${base}.${kind}`, { bookType: kind === "xls" ? "biff8" : "xlsx" });
        return;
      } catch {
        setUploadError("The Excel template could not be created, so a CSV template was downloaded instead.");
      }
    }
    const csv = table.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    saveBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  };

  /* ----- save and submit ----- */

  const saveDraft = async () => {
    if (!examType) return;
    setBusy(true);
    setFormError(null);
    try {
      await api("/marks/draft", { method: "POST", body: requestBody() });
      setServerSavedAt(Date.now());
      setNotice("Draft saved. You can come back and finish later.");
    } catch (err) {
      setFormError(`${err instanceof Error ? err.message : "The draft could not be saved."} It is still kept on this device.`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!examType) return;
    setNotice(null);
    if (stats.errors > 0 || stats.missing > 0) {
      setFormError(
        stats.errors > 0
          ? `Fix the ${stats.errors} ${stats.errors === 1 ? "mark" : "marks"} with errors before you submit.`
          : `${stats.missing} ${stats.missing === 1 ? "learner has" : "learners have"} no mark. Enter a mark, or ABS if the learner was absent.`,
      );
      setFilter(stats.errors > 0 ? "errors" : "missing");
      setMethod("grid");
      requestAnimationFrame(() => document.getElementById("mk-row-0")?.focus());
      return;
    }
    if (!window.confirm(`Submit ${learners.length} results for ${reviewerLabel} to review? You cannot edit them unless they are returned.`)) return;

    setBusy(true);
    setFormError(null);
    try {
      await api("/marks/submit", { method: "POST", body: requestBody() });
      setSheet((s) => (s ? { ...s, status: "submitted" } : s));
      try {
        window.localStorage.removeItem(DRAFT_PREFIX + sheetKey);
      } catch {
        /* ignore */
      }
      setNotice(`Results submitted. ${reviewerKind === "deputy" ? "The Deputy" : "The Head of Institution"} has been notified and will approve or return them.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The results could not be submitted. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ----- exam types (HOI and Deputy) ----- */

  const addExamType = async (e: FormEvent) => {
    e.preventDefault();
    setTypeError(null);
    setTypeNotice(null);
    const name = newName.trim();
    const maxMarks = Number(newMax);
    if (!yearId) return setTypeError("Choose a year first.");
    if (!name) return setTypeError("Enter a name, for example CAT 1.");
    if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000) return setTypeError("Enter the maximum mark as a whole number from 1 to 1000.");

    setTypeBusy(true);
    try {
      const created = await api<ExamTypeOption>("/exam-types", { method: "POST", body: { year_id: yearId, name, max_marks: maxMarks } });
      setOptions((o) => (o ? { ...o, examTypes: [...o.examTypes, created] } : o));
      setNewName("");
      setNewMax("");
      setTypeNotice(`${created.name} (out of ${created.max}) was added for ${year?.label}.`);
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : "The exam type could not be added.");
    } finally {
      setTypeBusy(false);
    }
  };

  const removeExamType = async (x: ExamTypeOption) => {
    if (!window.confirm(`Remove "${x.name}" from ${year?.label}? This only works if no marks have been entered for it.`)) return;
    setTypeError(null);
    setTypeNotice(null);
    try {
      await api(`/exam-types/${x.id}`, { method: "DELETE" });
      setOptions((o) => (o ? { ...o, examTypes: o.examTypes.filter((t) => t.id !== x.id) } : o));
      if (examTypeId === x.id) setExamTypeId("");
      setTypeNotice(`${x.name} was removed.`);
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : "The exam type could not be removed.");
    }
  };

  const fmt = (n: number | null) => (n === null ? "–" : (Math.round(n * 10) / 10).toString());
  const timeOf = (ts: number) => new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  const pct = learners.length ? Math.round((stats.entered / learners.length) * 100) : 0;

  /* ------------------------------------------------------------------ */

  return (
    // tt-shell gives the shared TeacherSidebar its colours and the 260px + content layout.
    // ss-shell keeps the existing page styles (cards, tables, tabs) working.
    <div className="tt-shell ss-shell" data-theme={theme} style={{ display: "grid", background: "var(--ss-canvas)" }}>
      <TeacherSidebar />

      <div className="ss-main">
        <header className="ss-header">
          <div className="ss-h-title">
            <p className="ss-h-name">Marks Entry</p>
            <span>Assessment</span>
          </div>
          <div className="ss-h-actions" style={{ marginLeft: "auto" }}>
            <span className="ss-muted">{userName}</span>
          </div>
        </header>

        <main className="ss-content">
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Upload results</h2>
            <p className="ss-note" style={{ marginTop: 6, maxWidth: "68ch" }}>
              Choose the year, grade, class, subject and exam type, then type the marks into the grid or upload an Excel (.xlsx, .xls) or CSV file for the
              whole class. Marks stay as a draft until you submit them. After you submit, {reviewerLabel} reviews them
              {reviewerKind === "deputy" ? " and the Head of Institution gives final approval" : ""}.
            </p>
          </div>

          {optionsError ? (
            <p className="ss-field-err" role="alert" style={{ margin: 0 }}>
              {optionsError}
            </p>
          ) : null}

          {/* ---------- 1. Choose year, grade, class, subject, exam type ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="pick-title">
            <header>
              <h3 id="pick-title">Choose the exam</h3>
              {ready ? <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span> : <span className="ss-count">{termLabel}</span>}
            </header>

            {!options && !optionsError ? (
              <p className="ss-muted" role="status" style={{ margin: "12px 0" }}>
                Loading your classes…
              </p>
            ) : (
              <>
                <div className="ss-mk-pick">
                  <label className="ss-lab">
                    Year
                    <select className="ss-input" value={yearId} onChange={(e) => pickYear(e.target.value)}>
                      <option value="">Select year</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Grade
                    <select className="ss-input" value={gradeName} onChange={(e) => pickGrade(e.target.value)} disabled={!year}>
                      <option value="">{year ? "Select grade" : "Choose a year first"}</option>
                      {grades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Class
                    <select className="ss-input" value={classId} onChange={(e) => pickClass(e.target.value)} disabled={!gradeName}>
                      <option value="">{gradeName ? "Select class" : "Choose a grade first"}</option>
                      {classesInGrade.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Subject
                    <select className="ss-input" value={subjectId} onChange={(e) => pickSubject(e.target.value)} disabled={!cls}>
                      <option value="">{cls ? "Select subject" : "Choose a class first"}</option>
                      {cls?.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ss-lab">
                    Exam type
                    <select className="ss-input" value={examTypeId} onChange={(e) => setExamTypeId(e.target.value)} disabled={!subject}>
                      <option value="">{subject ? (examTypes.length ? "Select exam type" : "No exam types yet") : "Choose a subject first"}</option>
                      {examTypes.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} (out of {x.max})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {year && years.length > 0 && year.classes.length === 0 ? (
                  <p className="ss-note">There are no classes for {year.label}.</p>
                ) : null}
                {options && years.length === 0 ? (
                  <p className="ss-note">
                    You have no classes or subjects assigned yet. Ask the Head of Institution to assign your teaching subjects, then reload this page.
                  </p>
                ) : (
                  <p className="ss-note">
                    {isAdmin
                      ? "You can enter marks for any grade, class and subject."
                      : "Only your own classes and subjects are listed."}{" "}
                    Changing a choice above clears the choices below it.
                    {subject && examTypes.length === 0
                      ? isAdmin
                        ? " Add an exam type below to continue."
                        : " Ask the Deputy or Head of Institution to add exam types for this year."
                      : ""}
                  </p>
                )}
              </>
            )}
          </section>

          {/* ---------- Exam types (HOI and Deputy only) ---------- */}
          {canManageExamTypes && options ? (
            <section className="ss-card ss-panel" aria-labelledby="types-title">
              <header>
                <h3 id="types-title">Exam types{year ? ` for ${year.label}` : ""}</h3>
                <button type="button" className="ss-btn ss-btn-sm" aria-expanded={showTypes} onClick={() => setShowTypes((s) => !s)}>
                  {showTypes ? "Hide" : "Manage exam types"}
                </button>
              </header>

              {showTypes ? (
                <div className="ss-pbody">
                  {!year ? (
                    <p className="ss-note">Choose a year above to see and add its exam types.</p>
                  ) : (
                    <>
                      {examTypes.length === 0 ? (
                        <p className="ss-muted" style={{ margin: "0 0 12px" }}>
                          No exam types for {year.label} yet.
                        </p>
                      ) : (
                        <table className="ss-table" style={{ marginTop: 0, marginBottom: 14 }}>
                          <thead>
                            <tr>
                              <th scope="col">Name</th>
                              <th scope="col" style={{ textAlign: "right" }}>
                                Out of
                              </th>
                              <th scope="col" style={{ textAlign: "right" }}>
                                <span className="ss-sr">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {examTypes.map((x) => (
                              <tr key={x.id}>
                                <td>
                                  <strong>{x.name}</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>{x.max}</td>
                                <td style={{ textAlign: "right" }}>
                                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => void removeExamType(x)}>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <form onSubmit={(e) => void addExamType(e)} noValidate style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <label className="ss-lab" style={{ flex: "1 1 220px" }}>
                          Name
                          <input className="ss-input" value={newName} placeholder="e.g. CAT 2" maxLength={60} onChange={(e) => setNewName(e.target.value)} disabled={typeBusy} />
                        </label>
                        <label className="ss-lab" style={{ flex: "0 1 140px" }}>
                          Out of
                          <input className="ss-input" inputMode="numeric" value={newMax} placeholder="e.g. 30" onChange={(e) => setNewMax(e.target.value)} disabled={typeBusy} />
                        </label>
                        <button type="submit" className="ss-btn ss-btn-primary" disabled={typeBusy}>
                          {typeBusy ? "Adding…" : `Add to ${year.label}`}
                        </button>
                      </form>
                    </>
                  )}
                  {typeError ? (
                    <p className="ss-field-err" role="alert" style={{ marginTop: 10 }}>
                      {typeError}
                    </p>
                  ) : null}
                  {typeNotice ? (
                    <p className="ss-sent" role="status" style={{ marginTop: 10 }}>
                      {typeNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ---------- Status messages ---------- */}
          {sheetLoading ? (
            <p className="ss-muted" role="status" style={{ margin: 0 }}>
              Loading the class list and marks…
            </p>
          ) : null}
          {sheetError ? (
            <p className="ss-field-err" role="alert" style={{ margin: 0 }}>
              {sheetError}
            </p>
          ) : null}

          {ready && status === "returned" && sheet?.reviewerComment ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-warn">
                <Icon name="warn" />
                <span>
                  <strong>Returned for correction.</strong> {sheet.reviewerComment}
                </span>
              </li>
            </ul>
          ) : null}

          {ready && status === "submitted" ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-info">
                <Icon name="upload" />
                <span>These results are with {reviewerLabel} for review. You can read them but not change them unless they are returned to you.</span>
              </li>
            </ul>
          ) : null}

          {ready && status === "published" ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-info">
                <Icon name="upload" />
                <span>These results are published to learners and parents. A published mark can only change through a correction request with a reason.</span>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => onRequestCorrection?.({ yearId, classId, subjectId, examTypeId })}>
                  Request correction
                </button>
              </li>
            </ul>
          ) : null}

          {notice ? (
            <p className="ss-sent" role="status" style={{ margin: 0 }}>
              {notice}
            </p>
          ) : null}

          {/* ---------- 2. Enter marks ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="entry-title">
            <header>
              <h3 id="entry-title">{ready ? `${year?.label} · ${cls?.label} · ${subject?.name} · ${examType?.name}` : "Marks"}</h3>
              {ready ? <span className="ss-count">Out of {max}</span> : null}
            </header>

            {!ready ? (
              <p className="ss-empty" style={{ margin: "24px 0 8px", textAlign: "center" }}>
                {sheetLoading ? "Loading…" : "Choose a year, grade, class, subject and exam type to start entering marks."}
              </p>
            ) : (
              <div className="ss-pbody">
                {learners.length === 0 ? (
                  <p className="ss-empty" style={{ margin: "16px 0", textAlign: "center" }}>
                    There are no learners registered in {cls?.label}.
                  </p>
                ) : null}

                {!locked && learners.length > 0 ? (
                  <div className="ss-seg ss-mk-tabs" role="tablist" aria-label="How to enter marks">
                    <button type="button" role="tab" id="tab-grid" aria-selected={method === "grid"} aria-controls="panel-grid" className={method === "grid" ? "is-on" : ""} onClick={() => setMethod("grid")}>
                      Type marks
                    </button>
                    <button type="button" role="tab" id="tab-upload" aria-selected={method === "upload"} aria-controls="panel-upload" className={method === "upload" ? "is-on" : ""} onClick={() => setMethod("upload")}>
                      Upload Excel (.xlsx, .xls) or CSV
                    </button>
                  </div>
                ) : null}

                {/* ----- Upload panel ----- */}
                {method === "upload" && !locked && learners.length > 0 ? (
                  <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload">
                    <ol className="ss-steps">
                      <li>
                        <div>
                          <strong>Download the template</strong>
                          <p className="ss-muted" style={{ margin: "4px 0 10px" }}>
                            It lists every learner in {cls?.label} ({year?.label}) with their admission number, set up for {subject?.name} · {examType?.name}. Any marks
                            already in the grid are included.
                          </p>
                          <div className="ss-btn-row">
                            <button type="button" className="ss-btn" onClick={() => void downloadTemplate("xlsx")}>
                              Excel template (.xlsx)
                            </button>
                            <button type="button" className="ss-btn" onClick={() => void downloadTemplate("xls")}>
                              Excel 97-2003 template (.xls)
                            </button>
                            <button type="button" className="ss-btn" onClick={() => void downloadTemplate("csv")}>
                              CSV template (.csv)
                            </button>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <strong>Fill in the marks</strong>
                          <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                            Enter each mark out of {max}. Write ABS for an absent learner. Leave a cell empty to skip that learner. Do not change the
                            admission numbers, because they are used to match each row.
                          </p>
                        </div>
                      </li>
                      <li>
                        <div style={{ minWidth: 0 }}>
                          <strong>Upload the file</strong>
                          <label
                            className={`ss-drop${dragOver ? " is-over" : ""}`}
                            htmlFor="mk-file"
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                          >
                            <Icon name="upload" size={26} />
                            <span>
                              <b>Choose a file</b> or drop it here
                            </span>
                            <small>.xlsx, .xls or .csv, up to 5 MB</small>
                            <input
                              id="mk-file"
                              className="ss-sr"
                              type="file"
                              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              onChange={onFileInput}
                            />
                          </label>
                          {reading ? (
                            <p className="ss-muted" role="status" style={{ marginTop: 10 }}>
                              Reading the file…
                            </p>
                          ) : null}
                          {uploadError ? (
                            <p className="ss-field-err" role="alert" style={{ marginTop: 10 }}>
                              {uploadError}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    </ol>

                    {report ? (
                      <div className="ss-mk-report" role="region" aria-label="File check">
                        <h4>
                          {report.fileName}: {report.ready.length} of {learners.length} marks are ready to apply
                        </h4>
                        <p className="ss-muted" style={{ margin: "4px 0 0" }}>
                          {report.issues.length > 0 ? `${report.issues.length} ${report.issues.length === 1 ? "row needs" : "rows need"} fixing and will be skipped. ` : "No problems found. "}
                          {report.blank > 0 ? `${report.blank} empty ${report.blank === 1 ? "cell was" : "cells were"} left unchanged. ` : ""}
                          {report.notInFile > 0 ? `${report.notInFile} ${report.notInFile === 1 ? "learner is" : "learners are"} not in the file.` : ""}
                        </p>

                        {report.issues.length > 0 ? (
                          <ul className="ss-mk-issues">
                            {report.issues.map((i, n) => (
                              <li key={`${i.line}-${n}`}>
                                <b>Row {i.line}</b>
                                {i.adm ? ` · ${i.adm}` : ""}: {i.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <fieldset className="ss-mk-mode">
                          <legend>When a learner already has a mark</legend>
                          <label>
                            <input type="radio" name="apply-mode" checked={applyMode === "replace"} onChange={() => setApplyMode("replace")} /> Replace it with the file's mark
                          </label>
                          <label>
                            <input type="radio" name="apply-mode" checked={applyMode === "fill"} onChange={() => setApplyMode("fill")} /> Keep it and only fill empty marks
                          </label>
                        </fieldset>

                        <div className="ss-btn-row" style={{ marginTop: 14 }}>
                          <button type="button" className="ss-btn ss-btn-primary" onClick={applyReport} disabled={report.ready.length === 0}>
                            Apply {report.ready.length} {report.ready.length === 1 ? "mark" : "marks"} to the grid
                          </button>
                          <button type="button" className="ss-btn" onClick={() => setReport(null)}>
                            Choose another file
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : learners.length > 0 ? (
                  /* ----- Grid panel ----- */
                  <div id="panel-grid" role="tabpanel" aria-labelledby={locked ? undefined : "tab-grid"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div className="ss-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Marks entered">
                        <i className={stats.errors === 0 && stats.missing === 0 ? "gold" : ""} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="ss-mk-stats">
                      <div>
                        <span>Entered</span>
                        <b>
                          {stats.entered} of {learners.length}
                        </b>
                      </div>
                      <div>
                        <span>Missing</span>
                        <b className={stats.missing ? "warn" : ""}>{stats.missing}</b>
                      </div>
                      <div>
                        <span>Errors</span>
                        <b className={stats.errors ? "bad" : ""}>{stats.errors}</b>
                      </div>
                      <div>
                        <span>Class mean</span>
                        <b>{fmt(stats.mean)}</b>
                      </div>
                      <div>
                        <span>Highest</span>
                        <b>{fmt(stats.high)}</b>
                      </div>
                      <div>
                        <span>Lowest</span>
                        <b>{fmt(stats.low)}</b>
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
                      <div className="ss-seg" role="group" aria-label="Filter learners">
                        {(["all", "missing", "errors"] as Filter[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            className={filter === f ? "is-on" : ""}
                            style={filter === f ? { background: "var(--ss-primary)" } : undefined}
                            onClick={() => setFilter(f)}
                          >
                            {f === "all" ? "All" : f === "missing" ? "Missing" : "Errors"}
                          </button>
                        ))}
                      </div>
                      {!locked ? <span className="ss-toolbar-note">Press Enter to move to the next learner. Write ABS for absent.</span> : null}
                    </div>

                    <div className="ss-mk-wrap" tabIndex={0} role="region" aria-label="Marks entry grid">
                      <table className="ss-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr>
                            <th scope="col">Adm. no</th>
                            <th scope="col">Learner</th>
                            <th scope="col" style={{ textAlign: "right" }}>
                              Mark / {max}
                            </th>
                            <th scope="col" style={{ textAlign: "right" }}>
                              %
                            </th>
                            <th scope="col">Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="ss-empty" style={{ textAlign: "center", padding: 24 }}>
                                {filter === "all" ? "No learners match your search." : "Nothing to show here. All good."}
                              </td>
                            </tr>
                          ) : (
                            visible.map((r, i) => (
                              <tr key={r.learner.id} className={r.state === "error" ? "is-error" : r.state === "missing" ? "is-missing" : ""}>
                                <td>{r.learner.admNo}</td>
                                <td>
                                  <strong>{r.learner.name}</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <input
                                    id={`mk-row-${i}`}
                                    className="ss-input ss-mk-input"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    aria-label={`Mark for ${r.learner.name}`}
                                    aria-invalid={r.state === "error" ? true : undefined}
                                    aria-describedby={r.state === "error" ? `mk-msg-${r.learner.id}` : undefined}
                                    value={r.value}
                                    readOnly={locked}
                                    onChange={(e) => onMarkChange(r.learner.id, e.target.value)}
                                    onBlur={(e) => onMarkBlur(r.learner.id, e.target.value)}
                                    onKeyDown={(e) => onMarkKey(e, i)}
                                  />
                                </td>
                                <td style={{ textAlign: "right" }}>{r.state === "ok" ? `${Math.round((Number(r.value.replace(",", ".")) / max) * 100)}%` : "–"}</td>
                                <td id={`mk-msg-${r.learner.id}`} className={`ss-mk-msg ${r.state}`}>
                                  {r.state === "error" ? r.message : r.state === "missing" ? "No mark yet" : r.state === "absent" ? "Absent" : "OK"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* ---------- Actions ---------- */}
          {ready && !locked && learners.length > 0 ? (
            <section className="ss-card" style={{ padding: "16px 22px" }}>
              <div className="ss-mk-actions">
                <div className="ss-mk-saved" role="status">
                  {serverSavedAt ? `Draft saved to the server at ${timeOf(serverSavedAt)}.` : localSavedAt ? `Kept on this device at ${timeOf(localSavedAt)}.` : "Not saved yet."}
                  {formError ? (
                    <span className="ss-field-err" role="alert" style={{ display: "block", marginTop: 4 }}>
                      {formError}
                    </span>
                  ) : null}
                </div>
                <div className="ss-btn-row">
                  <button type="button" className="ss-btn" onClick={() => void saveDraft()} disabled={busy}>
                    Save draft
                  </button>
                  <button type="button" className="ss-btn ss-btn-primary" onClick={() => void submit()} disabled={busy}>
                    {busy ? "Working…" : `Submit for ${reviewerKind === "deputy" ? "Deputy" : "HOI"} review`}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}