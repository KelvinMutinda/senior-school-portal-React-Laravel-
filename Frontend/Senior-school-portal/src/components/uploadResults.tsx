import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from "react";


export type AssessmentStatus = "not_started" | "draft" | "submitted" | "returned" | "published";

export interface Learner {
  id: string;
  admNo: string;
  name: string;
}

/** One exam type (CAT 1, Mid-term, End of term...) for one subject. */
export interface ExamTypeOption {
  id: string;
  name: string;
  max: number;
  status: AssessmentStatus;
  reviewerComment?: string;
  marks?: Record<string, string>;
}

export interface SubjectOption {
  id: string;
  name: string;
  examTypes: ExamTypeOption[];
}

/** A class / grade within an academic year. */
export interface ClassOption {
  id: string;
  label: string;
  learners: Learner[];
  subjects: SubjectOption[];
}

export interface YearOption {
  id: string;
  label: string;
  classes: ClassOption[];
}

export interface SheetPayload {
  yearId: string;
  classId: string;
  subjectId: string;
  examTypeId: string;
  marks: Record<string, string>;
}

export interface UploadResultsProps {
  years?: YearOption[];
  reviewer?: "deputy" | "hoi";
  termLabel?: string;
  isClassTeacher?: boolean;
  unmarkedCount?: number;
  userName?: string;
  theme?: "light" | "dark";
  onSaveDraft?: (payload: SheetPayload) => Promise<void> | void;
  onSubmit?: (payload: SheetPayload) => Promise<void> | void;
  onRequestCorrection?: (payload: Omit<SheetPayload, "marks">) => void;
  onNavigate?: (key: string) => void;
}


const LEARNERS: Learner[] = [
  { id: "l1", admNo: "1001", name: "Grace Njeri" },
  { id: "l2", admNo: "1002", name: "Brian Otieno" },
  { id: "l3", admNo: "1003", name: "Faith Wanjiru" },
  { id: "l4", admNo: "1004", name: "Kevin Mutua" },
  { id: "l5", admNo: "1005", name: "Amina Hassan" },
  { id: "l6", admNo: "1006", name: "Joseph Kamau" },
  { id: "l7", admNo: "1007", name: "Mercy Achieng" },
  { id: "l8", admNo: "1008", name: "Daniel Kiprop" },
  { id: "l9", admNo: "1009", name: "Lucy Wambui" },
  { id: "l10", admNo: "1010", name: "Samuel Barasa" },
];

const SAMPLE_YEARS: YearOption[] = [
  {
    id: "y2026",
    label: "2026",
    classes: [
      {
        id: "c1",
        label: "Grade 10 East",
        learners: LEARNERS,
        subjects: [
          {
            id: "mat",
            name: "Mathematics",
            examTypes: [
              {
                id: "cat1",
                name: "CAT 1",
                max: 30,
                status: "published",
                marks: { l1: "26", l2: "21", l3: "28", l4: "17", l5: "24", l6: "19", l7: "22", l8: "ABS", l9: "25", l10: "20" },
              },
              {
                id: "mid",
                name: "Mid-term test",
                max: 50,
                status: "draft",
                marks: { l1: "41", l2: "35", l3: "44", l4: "28", l5: "39" },
              },
              { id: "exam", name: "End of term exam", max: 100, status: "not_started" },
            ],
          },
          {
            id: "phy",
            name: "Physics",
            examTypes: [
              {
                id: "cat1",
                name: "CAT 1",
                max: 30,
                status: "returned",
                reviewerComment: "Two marks are above 30 and look like typing slips (1004 and 1007). Please check them and resubmit.",
                marks: { l1: "22", l2: "18", l3: "25", l4: "33", l5: "20", l6: "16", l7: "37", l8: "21", l9: "24", l10: "19" },
              },
              { id: "exam", name: "End of term exam", max: 100, status: "not_started" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "y2025",
    label: "2025",
    classes: [
      {
        id: "c0",
        label: "Grade 9 East",
        learners: LEARNERS,
        subjects: [
          {
            id: "mat",
            name: "Mathematics",
            examTypes: [
              {
                id: "exam",
                name: "End of term exam",
                max: 100,
                status: "published",
                marks: { l1: "72", l2: "65", l3: "81", l4: "54", l5: "69", l6: "60", l7: "75", l8: "58", l9: "77", l10: "63" },
              },
            ],
          },
        ],
      },
    ],
  },
];

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
  const clean = text.replace(/^﻿/, "");
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
/* Icons and sidebar                                                   */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard"
  | "profile"
  | "classes"
  | "students"
  | "attendance"
  | "marks"
  | "comments"
  | "tools"
  | "insights"
  | "messages"
  | "announcements"
  | "upload"
  | "menu"
  | "close"
  | "warn";

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
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
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
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

/** Teacher menu from section 4.2. Report Comments is for class teachers only. */
function buildMenu(isClassTeacher: boolean, unmarked: number): NavGroup[] {
  const academics: NavItem[] = [
    { key: "classes", label: "My Classes", icon: "classes" },
    { key: "students", label: "Students", icon: "students" },
    { key: "attendance", label: "Attendance", icon: "attendance" },
    { key: "marks", label: "Marks Entry", icon: "marks", badge: unmarked },
  ];
  if (isClassTeacher) academics.push({ key: "report-comments", label: "Report Comments", icon: "comments" });

  return [
    {
      group: "Overview",
      items: [
        { key: "dashboard", label: "Dashboard", icon: "dashboard" },
        { key: "profile", label: "My Profile", icon: "profile" },
      ],
    },
    { group: "Academics", items: academics },
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
}

function Sidebar({
  isClassTeacher,
  unmarked,
  userName,
  open,
  onClose,
  onNavigate,
}: {
  isClassTeacher: boolean;
  unmarked: number;
  userName: string;
  open: boolean;
  onClose: () => void;
  onNavigate?: (key: string) => void;
}) {
  const menu = useMemo(() => buildMenu(isClassTeacher, unmarked), [isClassTeacher, unmarked]);

  return (
    <aside id="portal-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
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

      <nav className="ss-nav" aria-label="Main navigation">
        {menu.map((group) => (
          <div className="ss-group" key={group.group}>
            <p className="ss-group-label">{group.group}</p>
            {group.items.map((item) => {
              const active = item.key === "marks";
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

      <div className="ss-side-foot">{userName}</div>
    </aside>
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

export default function UploadResults({
  years = SAMPLE_YEARS,
  reviewer = "deputy",
  termLabel = "Term 3, 2026",
  isClassTeacher = true,
  unmarkedCount = 3,
  userName = "Mr. Otieno · Teacher",
  theme = "light",
  onSaveDraft,
  onSubmit,
  onRequestCorrection,
  onNavigate,
}: UploadResultsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  /* selection: Year > Class/Grade > Subject > Exam type */
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");

  const year = years.find((y) => y.id === yearId);
  const cls = year?.classes.find((c) => c.id === classId);
  const subject = cls?.subjects.find((s) => s.id === subjectId);
  const exam = subject?.examTypes.find((x) => x.id === examTypeId);
  const sheetKey = year && cls && subject && exam ? `${year.id}:${cls.id}:${subject.id}:${exam.id}` : "";

  /* marks sheet */
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AssessmentStatus>>({});
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

  const status: AssessmentStatus = exam ? statusOverrides[sheetKey] ?? exam.status : "not_started";
  const locked = status === "submitted" || status === "published";
  const max = exam?.max ?? 0;
  const learners = cls?.learners ?? [];

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
    if (!sheetKey || !exam) {
      setMarks({});
      return;
    }
    let local: { marks: Record<string, string>; savedAt: number } | null = null;
    try {
      const raw = window.localStorage.getItem(DRAFT_PREFIX + sheetKey);
      if (raw) local = JSON.parse(raw);
    } catch {
      local = null;
    }
    if (local && exam.status !== "published" && exam.status !== "submitted") {
      setMarks(local.marks);
      setLocalSavedAt(local.savedAt);
    } else {
      setMarks({ ...(exam.marks ?? {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKey]);

  /* Keep a local copy so a dropped connection never loses typed marks. */
  useEffect(() => {
    if (!sheetKey || !touched.current || locked) return;
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
  }, [marks, sheetKey, locked]);

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

  const reviewerLabel = reviewer === "deputy" ? "the Deputy" : "the Head of Institution";
  const payload = (): SheetPayload => ({ yearId, classId, subjectId, examTypeId, marks });

  /* ----- selection handlers (each level resets everything below it) ----- */

  const pickYear = (id: string) => {
    setYearId(id);
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
    if (!file || !exam) return;
    setUploadError(null);
    setReport(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("This file is larger than 5 MB. Check that it only contains the marks sheet.");
      return;
    }
    setReading(true);
    try {
      const table = await readTable(file);
      setReport(analyse(table, learners, exam.max, file.name));
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
    if (!year || !cls || !subject || !exam) return;
    const table: string[][] = [
      ["Admission No", "Learner name", `Marks (out of ${exam.max})`],
      ...cls.learners.map((l) => [l.admNo, l.name, marks[l.id] ?? ""]),
    ];
    const base = `marks-${slug(year.label)}-${slug(cls.label)}-${slug(subject.name)}-${slug(exam.name)}`;

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
    saveBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  };

  /* ----- save and submit ----- */

  const saveDraft = async () => {
    if (!exam) return;
    setBusy(true);
    setFormError(null);
    try {
      await onSaveDraft?.(payload());
      setServerSavedAt(Date.now());
      setNotice("Draft saved. You can come back and finish later.");
    } catch {
      setFormError("The draft could not be saved to the server. It is still kept on this device.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!exam) return;
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
      await onSubmit?.(payload());
      setStatusOverrides((s) => ({ ...s, [sheetKey]: "submitted" }));
      try {
        window.localStorage.removeItem(DRAFT_PREFIX + sheetKey);
      } catch {
        /* ignore */
      }
      setNotice(`Results submitted. ${reviewer === "deputy" ? "The Deputy" : "The Head of Institution"} has been notified and will approve or return them.`);
    } catch {
      setFormError("The results could not be submitted. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number | null) => (n === null ? "–" : (Math.round(n * 10) / 10).toString());
  const timeOf = (ts: number) => new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  const pct = learners.length ? Math.round((stats.entered / learners.length) * 100) : 0;

  /* ------------------------------------------------------------------ */

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar isClassTeacher={isClassTeacher} unmarked={unmarkedCount} userName={userName} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <header className="ss-header">
          <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="portal-sidebar" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="ss-h-title">
            <p className="ss-h-name">Marks Entry</p>
            <span>Academics</span>
          </div>
        </header>

        <main className="ss-content">
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Upload results</h2>
            <p className="ss-note" style={{ marginTop: 6, maxWidth: "68ch" }}>
              Choose the year, class, subject and exam type, then type the marks into the grid or upload an Excel (.xlsx, .xls) or CSV file for the
              whole class. Marks stay as a draft until you submit them. After you submit, {reviewerLabel} reviews them
              {reviewer === "deputy" ? " and the Head of Institution gives final approval" : ""}.
            </p>
          </div>

          {/* ---------- 1. Choose year, class, subject, exam type ---------- */}
          <section className="ss-card ss-panel" aria-labelledby="pick-title">
            <header>
              <h3 id="pick-title">Choose the exam</h3>
              {exam ? <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span> : <span className="ss-count">{termLabel}</span>}
            </header>
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
                Class / Grade
                <select className="ss-input" value={classId} onChange={(e) => pickClass(e.target.value)} disabled={!year}>
                  <option value="">{year ? "Select class" : "Choose a year first"}</option>
                  {year?.classes.map((c) => (
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
                  <option value="">{subject ? "Select exam type" : "Choose a subject first"}</option>
                  {subject?.examTypes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} (out of {x.max})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ss-note">Only your own classes and subjects are listed. Changing a choice above clears the choices below it.</p>
          </section>

          {/* ---------- Status messages ---------- */}
          {exam && status === "returned" && exam.reviewerComment ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-warn">
                <Icon name="warn" />
                <span>
                  <strong>Returned for correction.</strong> {exam.reviewerComment}
                </span>
              </li>
            </ul>
          ) : null}

          {exam && status === "submitted" ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-info">
                <Icon name="upload" />
                <span>These results are with {reviewerLabel} for review. You can read them but not change them unless they are returned to you.</span>
              </li>
            </ul>
          ) : null}

          {exam && status === "published" ? (
            <ul className="ss-alerts" style={{ margin: 0 }}>
              <li className="tone-info">
                <Icon name="upload" />
                <span>These results are published to learners and parents. A published mark can only change through a correction request with a reason.</span>
                <button
                  type="button"
                  className="ss-btn ss-btn-sm"
                  onClick={() => onRequestCorrection?.({ yearId, classId, subjectId, examTypeId })}
                >
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
              <h3 id="entry-title">{exam ? `${year?.label} · ${cls?.label} · ${subject?.name} · ${exam.name}` : "Marks"}</h3>
              {exam ? <span className="ss-count">Out of {exam.max}</span> : null}
            </header>

            {!exam ? (
              <p className="ss-empty" style={{ margin: "24px 0 8px", textAlign: "center" }}>
                Choose a year, class, subject and exam type to start entering marks.
              </p>
            ) : (
              <div className="ss-pbody">
                {!locked ? (
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
                {method === "upload" && !locked ? (
                  <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload">
                    <ol className="ss-steps">
                      <li>
                        <div>
                          <strong>Download the template</strong>
                          <p className="ss-muted" style={{ margin: "4px 0 10px" }}>
                            It lists every learner in {cls?.label} ({year?.label}) with their admission number, set up for {subject?.name} · {exam.name}. Any marks
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
                            Enter each mark out of {exam.max}. Write ABS for an absent learner. Leave a cell empty to skip that learner. Do not change the
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
                ) : (
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
                              Mark / {exam.max}
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
                                <td style={{ textAlign: "right" }}>{r.state === "ok" ? `${Math.round((Number(r.value.replace(",", ".")) / exam.max) * 100)}%` : "–"}</td>
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
                )}
              </div>
            )}
          </section>

          {/* ---------- Actions ---------- */}
          {exam && !locked ? (
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
                    {busy ? "Working…" : `Submit for ${reviewer === "deputy" ? "Deputy" : "HOI"} review`}
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