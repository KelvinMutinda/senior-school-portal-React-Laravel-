import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

/* Styles live in the shared portal stylesheet (the .rl-page form styles plus
   the section "Add subject page"). Import that stylesheet once at the app root.

   Who uses this page (from the design document, section 7):
   - Head of Institution (HOI): creates and activates subjects directly.
   - Deputy / Director of Studies: creates subjects, which the HOI approves.
   Teachers can read subjects but not add them. Subjects are archived, never
   deleted, so past marks and report cards stay intact. */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SubjectStatus = "active" | "pending" | "draft" | "archived";
export type SubjectKind = "core" | "elective";
export type SubmitMode = "draft" | "submit";

export interface SubjectRow {
  id: string;
  name: string;
  code: string;
  kind: SubjectKind;
  department: string;
  levels: string[];
  teachers: number;
  lessonsPerWeek: number;
  status: SubjectStatus;
}

export interface TeacherOption {
  id: string;
  name: string;
  department: string;
}

export interface GradeScaleOption {
  id: string;
  name: string;
}

export interface SubjectPayload {
  name: string;
  code: string;
  shortName: string;
  department: string;
  kind: SubjectKind;
  pathway: string;
  description: string;
  academicYear: string;
  terms: string[];
  levels: string[];
  /** Empty means every stream. */
  streams: string[];
  lessonsPerWeek: number;
  doubleLessons: boolean;
  teacherIds: string[];
  leadTeacherId: string;
  gradeScaleId: string;
  weights: { cat: number; project: number; exam: number };
  aiEnabled: boolean;
  aiPauseDuringExams: boolean;
  effectiveTerm: string;
  approverNote: string;
}

export interface AddSubjectProps {
  /** "hoi" activates the subject straight away. "deputy" sends it to the HOI for approval. */
  submitterRole?: "hoi" | "deputy";
  academicYear?: string;
  existing?: SubjectRow[];
  departments?: string[];
  pathways?: string[];
  teachers?: TeacherOption[];
  gradeScales?: GradeScaleOption[];
  levels?: string[];
  streams?: string[];
  terms?: string[];
  onSave?: (payload: SubjectPayload, mode: SubmitMode) => Promise<void> | void;
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
  /** Called for sidebar links with a key such as "dashboard" or "approvals". Without it the links are plain hash anchors. */
  onNavigate?: (key: string) => void;
  theme?: "light" | "dark";
  /** Name shown at the bottom of the sidebar. */
  userName?: string;
  /** Count shown on the Approvals badge. Defaults to the number of subjects pending approval. */
  pendingApprovals?: number;
}

/* ------------------------------------------------------------------ */
/* Sample data. Replace with API data.                                 */
/* ------------------------------------------------------------------ */

const SAMPLE_EXISTING: SubjectRow[] = [
  { id: "s1", name: "Mathematics", code: "MAT", kind: "core", department: "Mathematics", levels: ["Grade 10", "Grade 11", "Grade 12"], teachers: 4, lessonsPerWeek: 5, status: "active" },
  { id: "s2", name: "English", code: "ENG", kind: "core", department: "Languages", levels: ["Grade 10", "Grade 11", "Grade 12"], teachers: 3, lessonsPerWeek: 5, status: "active" },
  { id: "s3", name: "Kiswahili", code: "KIS", kind: "core", department: "Languages", levels: ["Grade 10", "Grade 11", "Grade 12"], teachers: 3, lessonsPerWeek: 4, status: "active" },
  { id: "s4", name: "Biology", code: "BIO", kind: "elective", department: "Sciences", levels: ["Grade 10", "Grade 11", "Grade 12"], teachers: 2, lessonsPerWeek: 4, status: "active" },
  { id: "s5", name: "Chemistry", code: "CHE", kind: "elective", department: "Sciences", levels: ["Grade 10", "Grade 11", "Grade 12"], teachers: 2, lessonsPerWeek: 4, status: "active" },
  { id: "s6", name: "Physics", code: "PHY", kind: "elective", department: "Sciences", levels: ["Grade 10", "Grade 11"], teachers: 2, lessonsPerWeek: 4, status: "active" },
  { id: "s7", name: "Computer Studies", code: "CMP", kind: "elective", department: "Business and Technical", levels: ["Grade 10"], teachers: 1, lessonsPerWeek: 3, status: "pending" },
  { id: "s8", name: "Agriculture", code: "AGR", kind: "elective", department: "Sciences", levels: ["Grade 10", "Grade 11"], teachers: 0, lessonsPerWeek: 3, status: "archived" },
];

const SAMPLE_DEPARTMENTS = ["Mathematics", "Sciences", "Languages", "Humanities", "Business and Technical", "Arts and Sports"];
const SAMPLE_PATHWAYS = ["Core (all pathways)", "STEM", "Social Sciences", "Arts and Sports Science"];
const SAMPLE_TEACHERS: TeacherOption[] = [
  { id: "t1", name: "Mr. Otieno", department: "Mathematics" },
  { id: "t2", name: "Mrs. Kamau", department: "Sciences" },
  { id: "t3", name: "Ms. Achieng", department: "Languages" },
  { id: "t4", name: "Mr. Mutua", department: "Business and Technical" },
  { id: "t5", name: "Mrs. Wambui", department: "Humanities" },
  { id: "t6", name: "Mr. Barasa", department: "Sciences" },
];
const SAMPLE_SCALES: GradeScaleOption[] = [
  { id: "g1", name: "School percentage bands" },
  { id: "g2", name: "Competency levels" },
];
const SAMPLE_LEVELS = ["Grade 10", "Grade 11", "Grade 12"];
const SAMPLE_STREAMS = ["East", "West", "North", "South"];
const SAMPLE_TERMS = ["Term 1", "Term 2", "Term 3"];

/* ------------------------------------------------------------------ */
/* Form state and validation                                           */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  code: string;
  shortName: string;
  department: string;
  kind: "" | SubjectKind;
  pathway: string;
  description: string;
  terms: string[];
  levels: string[];
  streams: string[];
  lessonsPerWeek: string;
  doubleLessons: boolean;
  teacherIds: string[];
  leadTeacherId: string;
  gradeScaleId: string;
  cat: string;
  project: string;
  exam: string;
  aiEnabled: boolean;
  aiPauseDuringExams: boolean;
  effectiveTerm: string;
  approverNote: string;
}

type Errors = Partial<Record<keyof FormState | "weights" | "form", string>>;

const emptyForm = (terms: string[]): FormState => ({
  name: "",
  code: "",
  shortName: "",
  department: "",
  kind: "",
  pathway: "",
  description: "",
  terms: [...terms],
  levels: [],
  streams: [],
  lessonsPerWeek: "4",
  doubleLessons: false,
  teacherIds: [],
  leadTeacherId: "",
  gradeScaleId: "",
  cat: "30",
  project: "0",
  exam: "70",
  aiEnabled: true,
  aiPauseDuringExams: true,
  effectiveTerm: "",
  approverNote: "",
});

/** Order in which errors are focused. */
const FOCUS_ORDER: (keyof Errors)[] = [
  "name",
  "code",
  "department",
  "kind",
  "levels",
  "terms",
  "lessonsPerWeek",
  "teacherIds",
  "leadTeacherId",
  "gradeScaleId",
  "weights",
  "effectiveTerm",
];

const FIELD_ID: Record<string, string> = {
  name: "sub-name",
  code: "sub-code",
  department: "sub-department",
  kind: "sub-kind",
  levels: "sub-levels",
  terms: "sub-terms",
  lessonsPerWeek: "sub-lessonsPerWeek",
  teacherIds: "sub-teacherIds",
  leadTeacherId: "sub-leadTeacherId",
  gradeScaleId: "sub-gradeScaleId",
  weights: "sub-cat",
  effectiveTerm: "sub-effectiveTerm",
};

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

function weightTotal(f: FormState) {
  return [f.cat, f.project, f.exam].reduce((sum, v) => sum + (Number.isFinite(num(v)) ? num(v) : 0), 0);
}

function validate(f: FormState, existing: SubjectRow[], mode: SubmitMode): Errors {
  const e: Errors = {};
  const name = f.name.trim();
  const code = f.code.trim().toUpperCase();

  if (!name) {
    e.name = "Enter the subject name.";
  } else {
    const dup = existing.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (dup) e.name = dup.status === "archived" ? "This subject exists but is archived. Restore it from the list instead." : "A subject with this name already exists.";
  }

  if (!code) {
    e.code = "Enter a subject code.";
  } else if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    e.code = "Use 2 to 8 letters or numbers, with no spaces.";
  } else if (existing.some((s) => s.code === code)) {
    e.code = "This code is already used by another subject.";
  }

  if (mode === "draft") return e;

  if (!f.department) e.department = "Choose the department that owns this subject.";
  if (!f.kind) e.kind = "Choose whether the subject is core or elective.";
  if (f.levels.length === 0) e.levels = "Choose at least one class level.";
  if (f.terms.length === 0) e.terms = "Choose at least one term.";

  const lessons = num(f.lessonsPerWeek);
  if (!Number.isInteger(lessons) || lessons < 1 || lessons > 12) e.lessonsPerWeek = "Enter a whole number from 1 to 12.";

  if (f.teacherIds.length === 0) e.teacherIds = "Choose at least one subject teacher.";
  if (!f.leadTeacherId) e.leadTeacherId = "Choose a lead teacher from the teachers selected above.";
  else if (!f.teacherIds.includes(f.leadTeacherId)) e.leadTeacherId = "The lead teacher must be one of the selected teachers.";

  if (!f.gradeScaleId) e.gradeScaleId = "Choose a grade scale.";

  const parts = [num(f.cat), num(f.project), num(f.exam)];
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 100)) e.weights = "Each weight must be a number from 0 to 100.";
  else if (weightTotal(f) !== 100) e.weights = "The weights must add up to 100%.";

  if (!f.effectiveTerm) e.effectiveTerm = "Choose the term this subject starts in.";

  return e;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Field({
  fid,
  label,
  optional,
  hint,
  error,
  span,
  children,
}: {
  fid: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`rl-field${span ? " rl-span-all" : ""}`}>
      <label htmlFor={fid}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? (
        <span id={`${fid}-err`} className="rl-err">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function CheckGroup({
  fid,
  legend,
  options,
  value,
  onToggle,
  error,
}: {
  fid: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  onToggle: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset id={fid} className="rl-subjects" tabIndex={-1} data-invalid={error ? "true" : undefined} aria-describedby={error ? `${fid}-err` : undefined}>
      <legend>{legend}</legend>
      <div className="rl-checks">
        {options.map((o) => (
          <label className="rl-check" key={o.value}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => onToggle(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <span id={`${fid}-err`} className="rl-err" style={{ marginTop: 10 }}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar (same shell as the other dashboards)                        */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard"
  | "approvals"
  | "overview"
  | "subjects"
  | "students"
  | "attendance"
  | "marks"
  | "fees"
  | "reports"
  | "insights"
  | "controls"
  | "messages"
  | "announcements"
  | "users"
  | "audit"
  | "profile"
  | "menu"
  | "close";

const ICONS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  approvals: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </>
  ),
  overview: <path d="M5 20V11M12 20V4M19 20v-6" />,
  subjects: (
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
  fees: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  reports: <path d="M4 19h16M7 16v-4M12 16V8M17 16v-7" />,
  insights: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
  controls: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
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
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  audit: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
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

/** Menus follow sections 4.3 and 4.4 of the design document. */
function buildMenu(role: "hoi" | "deputy", pending: number): NavGroup[] {
  const dashboard: NavItem = { key: "dashboard", label: "Dashboard", icon: "dashboard" };
  const approvals: NavItem = { key: "approvals", label: "Approvals", icon: "approvals", badge: pending };
  const subjects: NavItem = { key: "subjects", label: "Subjects", icon: "subjects" };
  const profile: NavItem = { key: "profile", label: "My Profile", icon: "profile" };

  if (role === "hoi") {
    return [
      { group: "Overview", items: [dashboard, approvals] },
      {
        group: "Academics",
        items: [
          { key: "academic-overview", label: "Academic Overview", icon: "overview" },
          subjects,
          { key: "students", label: "Students", icon: "students" },
          { key: "attendance", label: "Attendance", icon: "attendance" },
          { key: "marks", label: "Marks and Report Cards", icon: "marks" },
        ],
      },
      {
        group: "Finance",
        items: [
          { key: "fees", label: "Fee Management", icon: "fees" },
          { key: "reports", label: "Financial Reports", icon: "reports" },
        ],
      },
      {
        group: "AI",
        items: [
          { key: "ai-insights", label: "AI Insights", icon: "insights" },
          { key: "ai-controls", label: "AI Controls", icon: "controls" },
        ],
      },
      {
        group: "Communication",
        items: [
          { key: "messages", label: "Messages", icon: "messages" },
          { key: "announcements", label: "Announcements", icon: "announcements" },
        ],
      },
      {
        group: "Administration",
        items: [
          { key: "users", label: "User Management", icon: "users" },
          { key: "audit", label: "Audit Log and School Settings", icon: "audit" },
        ],
      },
      { group: "Account", items: [profile] },
    ];
  }

  return [
    { group: "Overview", items: [dashboard, approvals] },
    {
      group: "Academics",
      items: [
        { key: "classes", label: "Classes and Timetable", icon: "attendance" },
        subjects,
        { key: "students", label: "Students", icon: "students" },
        { key: "attendance", label: "Attendance", icon: "attendance" },
        { key: "marks", label: "Marks and Report Cards", icon: "marks" },
      ],
    },
    { group: "AI", items: [{ key: "ai-insights", label: "AI Insights", icon: "insights" }] },
    {
      group: "Communication",
      items: [
        { key: "messages", label: "Messages", icon: "messages" },
        { key: "announcements", label: "Announcements", icon: "announcements" },
      ],
    },
    { group: "Account", items: [profile] },
  ];
}

function Sidebar({
  role,
  pending,
  userName,
  open,
  onClose,
  onNavigate,
}: {
  role: "hoi" | "deputy";
  pending: number;
  userName: string;
  open: boolean;
  onClose: () => void;
  onNavigate?: (key: string) => void;
}) {
  const menu = useMemo(() => buildMenu(role, pending), [role, pending]);

  return (
    <aside id="portal-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className="ss-logo" aria-hidden="true">
          <strong>SP</strong>
        </span>
        <div className="ss-brand-text">
          <strong>Senior School</strong>
          <em>{role === "hoi" ? "Head of Institution" : "Deputy / DoS"}</em>
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
              const active = item.key === "subjects";
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

const STATUS_LABEL: Record<SubjectStatus, string> = {
  active: "Active",
  pending: "Pending approval",
  draft: "Draft",
  archived: "Archived",
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AddSubject({
  submitterRole = "hoi",
  academicYear = "2026",
  existing = SAMPLE_EXISTING,
  departments = SAMPLE_DEPARTMENTS,
  pathways = SAMPLE_PATHWAYS,
  teachers = SAMPLE_TEACHERS,
  gradeScales = SAMPLE_SCALES,
  levels = SAMPLE_LEVELS,
  streams = SAMPLE_STREAMS,
  terms = SAMPLE_TERMS,
  onSave,
  onEdit,
  onArchive,
  onNavigate,
  theme = "light",
  userName,
  pendingApprovals,
}: AddSubjectProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(terms));
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubjectStatus>("all");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  /* Props for an input so errors are announced and styled. */
  const a = (key: keyof FormState) => ({
    id: `sub-${key}`,
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key] ? `sub-${key}-err` : undefined,
  });

  /* ----- list of subjects already in the school ----- */

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return existing.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
    });
  }, [existing, query, statusFilter]);

  const counts = useMemo(() => {
    const live = existing.filter((s) => s.status !== "archived");
    return {
      total: live.length,
      core: live.filter((s) => s.kind === "core").length,
      elective: live.filter((s) => s.kind === "elective").length,
      pending: existing.filter((s) => s.status === "pending").length,
    };
  }, [existing]);

  /* ----- teacher helpers ----- */

  const selectedTeachers = teachers.filter((t) => form.teacherIds.includes(t.id));

  const toggleTeacher = (id: string) => {
    setForm((f) => {
      const teacherIds = toggle(f.teacherIds, id);
      return { ...f, teacherIds, leadTeacherId: teacherIds.includes(f.leadTeacherId) ? f.leadTeacherId : "" };
    });
  };

  /* ----- submit ----- */

  const total = weightTotal(form);

  const run = async (mode: SubmitMode) => {
    setBanner(null);
    const errs = validate(form, existing, mode);
    setErrors(errs);

    const first = FOCUS_ORDER.find((k) => errs[k]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(FIELD_ID[first as string])?.focus());
      return;
    }

    const payload: SubjectPayload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      shortName: form.shortName.trim(),
      department: form.department,
      kind: (form.kind || "core") as SubjectKind,
      pathway: form.pathway,
      description: form.description.trim(),
      academicYear,
      terms: form.terms,
      levels: form.levels,
      streams: form.streams,
      lessonsPerWeek: Number(form.lessonsPerWeek),
      doubleLessons: form.doubleLessons,
      teacherIds: form.teacherIds,
      leadTeacherId: form.leadTeacherId,
      gradeScaleId: form.gradeScaleId,
      weights: { cat: num(form.cat) || 0, project: num(form.project) || 0, exam: num(form.exam) || 0 },
      aiEnabled: form.aiEnabled,
      aiPauseDuringExams: form.aiPauseDuringExams,
      effectiveTerm: form.effectiveTerm,
      approverNote: form.approverNote.trim(),
    };

    setBusy(true);
    try {
      await onSave?.(payload, mode);
      const subject = `“${payload.name}”`;
      if (mode === "draft") {
        setBanner(`${subject} was saved as a draft. It is not visible to teachers or learners yet.`);
      } else if (submitterRole === "hoi") {
        setBanner(`${subject} was added and is active from ${payload.effectiveTerm}.`);
      } else {
        setBanner(`${subject} was sent to the Head of Institution for approval. You will be notified of the decision.`);
      }
      setForm(emptyForm(terms));
      setErrors({});
    } catch {
      setErrors({ form: "The subject could not be saved. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run("submit");
  };

  const submitLabel = submitterRole === "hoi" ? "Add subject" : "Submit for approval";

  const content = (
    <div className="rl-page">
      <header className="rl-head">
        <h1>Add a subject</h1>
        <p>
          Add a subject to the school, choose where it is taught and who teaches it, and set how it is assessed. Subjects are archived, never
          deleted, so past marks and report cards stay intact.
        </p>
      </header>

      {banner ? (
        <div className="rl-ok" role="status">
          {banner}
        </div>
      ) : null}

      {/* ---------- Subjects already in the school ---------- */}
      <section className="rl-card rl-card--plain" aria-labelledby="subjects-title">
        <h2 id="subjects-title">
          Subjects in the school
          <span className="rl-opt">Academic year {academicYear}</span>
        </h2>

        <ul className="rl-stats" aria-label="Subject totals">
          <li>
            <b>{counts.total}</b>Offered
          </li>
          <li>
            <b>{counts.core}</b>Core
          </li>
          <li>
            <b>{counts.elective}</b>Elective
          </li>
          <li>
            <b>{counts.pending}</b>Awaiting approval
          </li>
        </ul>

        <div className="rl-toolbar">
          <div className="rl-field">
            <label htmlFor="subject-search">Search subjects</label>
            <input id="subject-search" type="search" placeholder="Name, code or department" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="rl-field">
            <label htmlFor="subject-status">Status</label>
            <select id="subject-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | SubjectStatus)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending approval</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="rl-table-wrap" tabIndex={0} role="region" aria-label="Subjects in the school">
          <table className="rl-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Type</th>
                <th scope="col">Grades</th>
                <th scope="col" className="rl-num">
                  Teachers
                </th>
                <th scope="col" className="rl-num">
                  Lessons per week
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span style={{ position: "absolute", left: -9999 }}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="rl-empty">
                    No subjects match your search.
                  </td>
                </tr>
              ) : (
                visible.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>
                        {s.code} · {s.department}
                      </small>
                    </td>
                    <td>{s.kind === "core" ? "Core" : "Elective"}</td>
                    <td>{s.levels.map((l) => l.replace(/^Grade /, "")).join(", ")}</td>
                    <td className="rl-num">{s.teachers}</td>
                    <td className="rl-num">{s.lessonsPerWeek}</td>
                    <td>
                      <span className={`rl-status ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                    </td>
                    <td>
                      <div className="rl-row-actions">
                        <button type="button" className="rl-btn rl-btn-sm" onClick={() => onEdit?.(s.id)} disabled={s.status === "archived"}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rl-btn rl-btn-sm"
                          disabled={s.status === "archived"}
                          onClick={() => {
                            if (window.confirm(`Archive ${s.name}? It will stop appearing in new timetables. Past marks stay on record.`)) onArchive?.(s.id);
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Add form ---------- */}
      <form onSubmit={onSubmit} noValidate aria-label="Add a subject">
        <section className="rl-card">
          <h2>Subject details</h2>
          <div className="rl-grid">
            <Field fid="sub-name" label="Subject name" error={errors.name}>
              <input {...a("name")} type="text" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
            </Field>
            <Field fid="sub-code" label="Subject code" hint="For example MAT or CMP. Used on marks sheets and reports." error={errors.code}>
              <input
                {...a("code")}
                type="text"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
              />
            </Field>
            <Field fid="sub-shortName" label="Short name" optional hint="Shown on small screens and the timetable.">
              <input {...a("shortName")} type="text" value={form.shortName} onChange={(e) => set("shortName", e.target.value)} maxLength={12} />
            </Field>

            <Field fid="sub-department" label="Department" error={errors.department}>
              <select {...a("department")} value={form.department} onChange={(e) => set("department", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field fid="sub-kind" label="Subject type" error={errors.kind}>
              <select {...a("kind")} value={form.kind} onChange={(e) => set("kind", e.target.value as FormState["kind"])}>
                <option value="">Select type</option>
                <option value="core">Core (every learner takes it)</option>
                <option value="elective">Elective (learners choose it)</option>
              </select>
            </Field>
            <Field fid="sub-pathway" label="Curriculum pathway" optional hint="Used by Career Pathways to suggest subject combinations.">
              <select {...a("pathway")} value={form.pathway} onChange={(e) => set("pathway", e.target.value)}>
                <option value="">Not specified</option>
                {pathways.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field fid="sub-description" label="Description" optional span>
              <textarea {...a("description")} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="rl-card">
          <h2>Where it is offered</h2>
          <div className="rl-grid">
            <Field fid="sub-academicYear" label="Academic year">
              <input id="sub-academicYear" type="text" value={academicYear} readOnly />
            </Field>
            <Field fid="sub-lessonsPerWeek" label="Lessons per week" hint="Used when the timetable is built." error={errors.lessonsPerWeek}>
              <input
                {...a("lessonsPerWeek")}
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={form.lessonsPerWeek}
                onChange={(e) => set("lessonsPerWeek", e.target.value)}
              />
            </Field>
          </div>

          <CheckGroup
            fid="sub-levels"
            legend="Class levels"
            options={levels.map((l) => ({ value: l, label: l }))}
            value={form.levels}
            onToggle={(v) => set("levels", toggle(form.levels, v))}
            error={errors.levels}
          />
          <CheckGroup
            fid="sub-terms"
            legend="Terms taught"
            options={terms.map((t) => ({ value: t, label: t }))}
            value={form.terms}
            onToggle={(v) => set("terms", toggle(form.terms, v))}
            error={errors.terms}
          />
          <CheckGroup
            fid="sub-streams"
            legend="Restrict to streams (leave all unticked to offer it in every stream)"
            options={streams.map((s) => ({ value: s, label: s }))}
            value={form.streams}
            onToggle={(v) => set("streams", toggle(form.streams, v))}
          />

          <label className="rl-check" style={{ marginTop: 20 }}>
            <input type="checkbox" checked={form.doubleLessons} onChange={(e) => set("doubleLessons", e.target.checked)} />
            <span>Allow double lessons (for practicals or long exercises)</span>
          </label>
        </section>

        <section className="rl-card">
          <h2>Teachers</h2>
          <p className="rl-note">
            Choose who can teach and mark this subject. You will assign each teacher to specific classes from Classes and Timetable once the
            subject is active.
          </p>
          <CheckGroup
            fid="sub-teacherIds"
            legend="Subject teachers"
            options={teachers.map((t) => ({ value: t.id, label: `${t.name} · ${t.department}` }))}
            value={form.teacherIds}
            onToggle={toggleTeacher}
            error={errors.teacherIds}
          />
          <div className="rl-grid" style={{ marginTop: 20 }}>
            <Field fid="sub-leadTeacherId" label="Lead teacher" hint="Reviews marks entry for this subject." error={errors.leadTeacherId}>
              <select
                {...a("leadTeacherId")}
                value={form.leadTeacherId}
                onChange={(e) => set("leadTeacherId", e.target.value)}
                disabled={selectedTeachers.length === 0}
              >
                <option value="">{selectedTeachers.length === 0 ? "Select teachers first" : "Select lead teacher"}</option>
                {selectedTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rl-card">
          <h2>Assessment and grading</h2>
          <p className="rl-note">Weights decide how each learner's term mark for this subject is calculated.</p>
          <div className="rl-grid">
            <Field fid="sub-gradeScaleId" label="Grade scale" error={errors.gradeScaleId}>
              <select {...a("gradeScaleId")} value={form.gradeScaleId} onChange={(e) => set("gradeScaleId", e.target.value)}>
                <option value="">Select grade scale</option>
                {gradeScales.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="rl-grid" style={{ marginTop: 20 }}>
            <Field fid="sub-cat" label="Continuous assessment (%)">
              <input
                {...a("cat")}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={form.cat}
                onChange={(e) => set("cat", e.target.value)}
                aria-invalid={errors.weights ? true : undefined}
                aria-describedby={errors.weights ? "sub-weights-err" : undefined}
              />
            </Field>
            <Field fid="sub-project" label="Project or practical (%)">
              <input {...a("project")} type="number" inputMode="numeric" min={0} max={100} value={form.project} onChange={(e) => set("project", e.target.value)} />
            </Field>
            <Field fid="sub-exam" label="End of term exam (%)">
              <input {...a("exam")} type="number" inputMode="numeric" min={0} max={100} value={form.exam} onChange={(e) => set("exam", e.target.value)} />
            </Field>
            <div className="rl-span-all">
              <p className={`rl-total${errors.weights || total !== 100 ? " is-bad" : ""}`} role="status">
                Total: {total}%{total === 100 ? "" : " (must be 100%)"}
              </p>
              {errors.weights ? (
                <span id="sub-weights-err" className="rl-err" style={{ marginTop: 6 }}>
                  {errors.weights}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rl-card">
          <h2>
            AI support
            <span className="rl-opt">Optional</span>
          </h2>
          <p className="rl-note">The Head of Institution can still switch any AI feature off for a class or the whole school from AI Controls.</p>
          <label className="rl-check">
            <input type="checkbox" checked={form.aiEnabled} onChange={(e) => set("aiEnabled", e.target.checked)} />
            <span>Allow the AI Tutor and material generation for this subject</span>
          </label>
          <label className="rl-check">
            <input type="checkbox" checked={form.aiPauseDuringExams} onChange={(e) => set("aiPauseDuringExams", e.target.checked)} disabled={!form.aiEnabled} />
            <span>Pause the AI Tutor for this subject during examinations</span>
          </label>
        </section>

        <section className="rl-card">
          <h2>Start and approval</h2>
          <p className="rl-note">
            {submitterRole === "hoi"
              ? "As Head of Institution, the subject becomes active from the term you choose. The change is recorded in the audit log."
              : "The Head of Institution approves new subjects. Until then the subject stays pending and is not visible to teachers or learners."}
          </p>
          <div className="rl-grid">
            <Field fid="sub-effectiveTerm" label="Starts in" error={errors.effectiveTerm}>
              <select {...a("effectiveTerm")} value={form.effectiveTerm} onChange={(e) => set("effectiveTerm", e.target.value)}>
                <option value="">Select term</option>
                {terms.map((t) => (
                  <option key={t} value={`${t}, ${academicYear}`}>
                    {t}, {academicYear}
                  </option>
                ))}
              </select>
            </Field>
            {submitterRole === "deputy" ? (
              <Field fid="sub-approverNote" label="Note for the approver" optional span>
                <textarea {...a("approverNote")} value={form.approverNote} onChange={(e) => set("approverNote", e.target.value)} />
              </Field>
            ) : null}
          </div>
        </section>

        <div className="rl-actions">
          {errors.form ? (
            <span className="rl-err" style={{ marginRight: "auto" }} role="alert">
              {errors.form}
            </span>
          ) : null}
          <button
            type="button"
            className="rl-btn"
            disabled={busy}
            onClick={() => {
              setForm(emptyForm(terms));
              setErrors({});
              setBanner(null);
            }}
          >
            Clear form
          </button>
          <button type="button" className="rl-btn" disabled={busy} onClick={() => void run("draft")}>
            Save as draft
          </button>
          <button type="submit" className="rl-btn rl-primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );

  const pending = pendingApprovals ?? counts.pending;
  const who = userName ?? (submitterRole === "hoi" ? "Head of Institution" : "Deputy / Director of Studies");

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar role={submitterRole} pending={pending} userName={who} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <header className="ss-header">
          <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="portal-sidebar" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="ss-h-title">
            <p className="ss-h-name">Subjects</p>
            <span>Academics</span>
          </div>
        </header>

        <main className="ss-content">{content}</main>
      </div>
    </div>
  );
}