import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AttendanceStatus = "P" | "A" | "L" | "E"; // present, absent, late, excused

export interface RegisterLearner {
  id: string;
  name: string;
  admNo: string;
  absencesThisTerm?: number;
}

export interface RecentRegister {
  date: string; // YYYY-MM-DD
  period: string;
  present: number; // present + late
  total: number;
}

export interface RegisterClass {
  id: string;
  name: string;
  subject: string;
  learners: RegisterLearner[];
  recent?: RecentRegister[];
}

export interface SaveRegisterRequest {
  classId: string;
  date: string;
  period: string;
  records: Record<string, { status: AttendanceStatus; note?: string }>;
}

export interface TeacherUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface AttendanceProps {
  data?: RegisterClass[];
  user?: TeacherUser;
  theme?: "light" | "dark";
  /** Called when the register is saved. Throw to show an error message. */
  onSave?: (request: SaveRegisterRequest) => void | Promise<void>;
  /** Optional. If omitted, react-router's navigate() is used. */
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
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
/* Sample data (replace with API results)                              */
/* ------------------------------------------------------------------ */

const SAMPLE: RegisterClass[] = [
  {
    id: "11A",
    name: "Grade 11A",
    subject: "Mathematics",
    learners: [
      { id: "s1", name: "Achieng Otieno", admNo: "1021" },
      { id: "s2", name: "Brian Kiptoo", admNo: "1022", absencesThisTerm: 4 },
      { id: "s3", name: "Cynthia Mwende", admNo: "1023" },
      { id: "s4", name: "Daniel Njoroge", admNo: "1024" },
      { id: "s5", name: "Esther Wambui", admNo: "1025", absencesThisTerm: 3 },
      { id: "s6", name: "Felix Mutua", admNo: "1026" },
    ],
    recent: [
      { date: "2026-11-18", period: "Lesson 1", present: 40, total: 42 },
      { date: "2026-11-17", period: "Lesson 1", present: 41, total: 42 },
      { date: "2026-11-16", period: "Lesson 2", present: 38, total: 42 },
    ],
  },
  {
    id: "11B",
    name: "Grade 11B",
    subject: "Mathematics",
    learners: [
      { id: "s7", name: "Grace Akinyi", admNo: "1051" },
      { id: "s8", name: "Hassan Ali", admNo: "1052" },
      { id: "s9", name: "Irene Chebet", admNo: "1053", absencesThisTerm: 5 },
      { id: "s10", name: "James Maina", admNo: "1054" },
    ],
    recent: [
      { date: "2026-11-18", period: "Lesson 5", present: 36, total: 40 },
      { date: "2026-11-17", period: "Lesson 5", present: 37, total: 40 },
    ],
  },
  {
    id: "12A",
    name: "Grade 12A",
    subject: "Physics",
    learners: [
      { id: "s11", name: "Kevin Omondi", admNo: "0981" },
      { id: "s12", name: "Lucy Nyambura", admNo: "0982" },
      { id: "s13", name: "Mark Kariuki", admNo: "0983" },
      { id: "s14", name: "Naomi Jepkoech", admNo: "0984" },
    ],
    recent: [{ date: "2026-11-18", period: "Lesson 3", present: 37, total: 38 }],
  },
];

const PERIODS = ["Morning register", "Lesson 1", "Lesson 2", "Lesson 3", "Lesson 4", "Lesson 5", "Lesson 6", "Lesson 7", "Lesson 8"];
const STATUSES: AttendanceStatus[] = ["P", "A", "L", "E"];
const STATUS_LABEL: Record<AttendanceStatus, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };
const NOTE_HINT: Record<AttendanceStatus, string> = {
  P: "",
  A: "Reason (optional)",
  L: "Minutes late (optional)",
  E: "Reason for excuse (optional)",
};

type Rec = { status: AttendanceStatus; note: string };
type Sheet = Record<string, Rec>;
type Filter = "all" | "unmarked" | AttendanceStatus;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

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
  | "check";

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
  check: <path d="M5 13l4 4L19 7" />,
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
  badge?: number;
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
          placeholder="Search learners in this register"
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
          <Icon name="check" size={16} />
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Attendance({ data = SAMPLE, user, theme = "light", onSave, onNavigate, onLogout }: AttendanceProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialClass = data.find((c) => c.id === params.get("class"))?.id ?? data[0]?.id ?? "";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [classId, setClassId] = useState(initialClass);
  const [date, setDate] = useState(todayISO());
  const [period, setPeriod] = useState(PERIODS[1]);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sheets, setSheets] = useState<Record<string, Sheet>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me: TeacherUser = user ?? { name: "Teacher", roleLabel: "Subject teacher" };
  const go = (route: string, key: string) => {
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  const cls = data.find((c) => c.id === classId) ?? null;
  const learners = cls?.learners ?? [];
  const key = `${classId}|${date}|${period}`;
  const sheet: Sheet = sheets[key] ?? {};
  const isSaved = Boolean(savedAt[key]);
  const today = todayISO();

  /* Counts */
  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { P: 0, A: 0, L: 0, E: 0 };
    learners.forEach((l) => {
      const r = sheet[l.id];
      if (r) c[r.status] += 1;
    });
    return c;
  }, [learners, sheet]);
  const marked = counts.P + counts.A + counts.L + counts.E;
  const unmarked = learners.length - marked;
  const complete = learners.length > 0 && unmarked === 0;
  const rate = pct(counts.P + counts.L, learners.length);

  /* Warn before leaving the page with an unsaved register */
  const hasUnsaved = Object.keys(sheets).some((k) => Object.keys(sheets[k]).length > 0 && !savedAt[k]);
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  /* Edits */
  const touch = () => {
    setError(null);
    setSavedAt((s) => {
      if (!s[key]) return s;
      const next = { ...s };
      delete next[key];
      return next;
    });
  };

  const setStatus = (id: string, status: AttendanceStatus) => {
    touch();
    setSheets((s) => ({
      ...s,
      [key]: { ...(s[key] ?? {}), [id]: { status, note: status === "P" ? "" : s[key]?.[id]?.note ?? "" } },
    }));
  };

  const setNote = (id: string, note: string) => {
    touch();
    setSheets((s) => {
      const cur = s[key]?.[id];
      if (!cur) return s;
      return { ...s, [key]: { ...s[key], [id]: { ...cur, note } } };
    });
  };

  const markRemainingPresent = () => {
    touch();
    setSheets((s) => {
      const cur = { ...(s[key] ?? {}) };
      learners.forEach((l) => {
        if (!cur[l.id]) cur[l.id] = { status: "P", note: "" };
      });
      return { ...s, [key]: cur };
    });
  };

  const resetSheet = () => {
    touch();
    setSheets((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
    setFilter("all");
  };

  const changeClass = (id: string) => {
    setClassId(id);
    setFilter("all");
    setError(null);
    setParams({ class: id }, { replace: true });
  };

  const save = async () => {
    if (!cls || !complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const records: SaveRegisterRequest["records"] = {};
      learners.forEach((l) => {
        const r = sheet[l.id];
        if (r) records[l.id] = { status: r.status, note: r.note.trim() || undefined };
      });
      await onSave?.({ classId: cls.id, date, period, records });
      setSavedAt((s) => ({ ...s, [key]: new Date().toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" }) }));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The register could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  /* Visible rows */
  const term = q.trim().toLowerCase();
  const rows = learners.filter((l) => {
    if (term && !l.name.toLowerCase().includes(term) && !l.admNo.includes(term)) return false;
    const r = sheet[l.id];
    if (filter === "all") return true;
    if (filter === "unmarked") return !r;
    return r?.status === filter;
  });

  const menu = useMemo(() => buildMenu(), []);
  const headerDate = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: learners.length },
    { key: "unmarked", label: "Unmarked", n: unmarked },
    { key: "P", label: "Present", n: counts.P },
    { key: "A", label: "Absent", n: counts.A },
    { key: "L", label: "Late", n: counts.L },
    { key: "E", label: "Excused", n: counts.E },
  ];

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} user={me} open={sidebarOpen} activeKey="attendance" onClose={() => setSidebarOpen(false)} onGo={go} />
      <div className={`ss-scrim${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <Header
          title="Attendance"
          dateLabel={headerDate}
          user={me}
          action={{ label: saving ? "Saving..." : isSaved ? "Saved" : "Save register", onClick: save, disabled: !complete || saving || isSaved }}
          onOpenMenu={() => setSidebarOpen(true)}
          onSearch={setQ}
          onGo={go}
          onLogout={onLogout}
        />

        <main className="ss-content" id="main">
          <div className="ss-sec-head">
            <h2>Mark register</h2>
            <p>Choose the class, date and lesson, mark every learner, then save.</p>
          </div>

          {/* Session picker */}
          <section className="ss-card rg-controls" aria-label="Register details">
            <label className="ss-lab">
              Class
              <select className="ss-input" value={classId} onChange={(e) => changeClass(e.target.value)}>
                {data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.subject}
                  </option>
                ))}
              </select>
            </label>
            <label className="ss-lab">
              Date
              <input
                className="ss-input"
                type="date"
                value={date}
                max={today}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setFilter("all");
                    setError(null);
                  }
                }}
              />
            </label>
            <label className="ss-lab">
              Lesson
              <select
                className="ss-input"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setFilter("all");
                  setError(null);
                }}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="rg-controls-info">
              <strong>{cls ? cls.name : "No class"}</strong>
              <small>
                {longDate(date)} · {period}
              </small>
            </div>
          </section>

          {!cls ? (
            <div className="ss-card rg-empty">
              <Icon name="attendance" size={28} />
              <h3>No classes assigned</h3>
              <p>When you are assigned classes, their registers appear here.</p>
              <button type="button" className="ss-btn" onClick={() => go(ROUTE.classes, "classes")}>
                Go to My classes
              </button>
            </div>
          ) : (
            <>
              {isSaved ? (
                <div className="rg-banner is-ok" role="status">
                  <span className="rg-banner-icon">
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <strong>Register saved at {savedAt[key]}</strong>
                    <small>
                      {counts.P} present · {counts.L} late · {counts.A} absent · {counts.E} excused · {rate}% attended. You can still edit and save again.
                    </small>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="rg-banner is-err" role="alert">
                  <div>
                    <strong>Not saved</strong>
                    <small>{error}</small>
                  </div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={save}>
                    Try again
                  </button>
                </div>
              ) : null}

              {/* Progress + filters */}
              <section className="ss-card rg-summary" aria-label="Register progress">
                <div className="rg-progress">
                  <div className="rg-progress-top">
                    <strong>
                      {marked} of {learners.length} marked
                    </strong>
                    <span className="ss-tag">{rate}% attended so far</span>
                  </div>
                  <div className="ss-bar" role="progressbar" aria-valuenow={marked} aria-valuemin={0} aria-valuemax={learners.length} aria-label="Learners marked">
                    <i style={{ width: `${pct(marked, learners.length)}%` }} />
                  </div>
                </div>
                <div className="rg-filters" role="group" aria-label="Filter learners">
                  {filters.map((f) => (
                    <button key={f.key} type="button" className={`rg-filter${filter === f.key ? " is-on" : ""}`} data-f={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                      {f.label}
                      <b>{f.n}</b>
                    </button>
                  ))}
                </div>
              </section>

              {/* Register */}
              <section className="ss-card ss-panel" aria-labelledby="rg-title">
                <header>
                  <h3 id="rg-title">
                    {cls.name} register · {shortDate(date)}
                  </h3>
                  <div className="rg-head-actions">
                    <button type="button" className="ss-btn ss-btn-sm" onClick={markRemainingPresent} disabled={unmarked === 0}>
                      Mark remaining present
                    </button>
                    <button type="button" className="ss-link-btn" onClick={resetSheet} disabled={marked === 0}>
                      Clear
                    </button>
                  </div>
                </header>

                {rows.length ? (
                  <ul className="rg-list">
                    {rows.map((l) => {
                      const r = sheet[l.id];
                      const idx = learners.findIndex((x) => x.id === l.id) + 1;
                      return (
                        <li key={l.id} className={`rg-row${r ? "" : " is-unmarked"}`}>
                          <span className="rg-no">{idx}</span>
                          <span className="rg-av" aria-hidden="true">
                            {initials(l.name)}
                          </span>
                          <div className="rg-who">
                            <strong>{l.name}</strong>
                            <small>
                              Adm. {l.admNo}
                              {l.absencesThisTerm && l.absencesThisTerm >= 3 ? <span className="rg-flag">{l.absencesThisTerm} absences this term</span> : null}
                            </small>
                          </div>
                          <div className="ss-seg rg-seg" role="group" aria-label={`Attendance for ${l.name}`}>
                            {STATUSES.map((s) => (
                              <button key={s} type="button" data-s={s} className={r?.status === s ? "is-on" : ""} aria-pressed={r?.status === s} title={STATUS_LABEL[s]} onClick={() => setStatus(l.id, s)}>
                                <span className="rg-l">{s}</span>
                                <span className="rg-full">{STATUS_LABEL[s]}</span>
                              </button>
                            ))}
                          </div>
                          {r && r.status !== "P" ? (
                            <input
                              className="ss-input rg-note"
                              type="text"
                              value={r.note}
                              maxLength={120}
                              placeholder={NOTE_HINT[r.status]}
                              aria-label={`Note for ${l.name}`}
                              onChange={(e) => setNote(l.id, e.target.value)}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="ss-empty rg-none">{learners.length === 0 ? "This class has no learners yet." : "No learners match this filter."}</p>
                )}
              </section>

              {/* Recent registers */}
              {cls.recent && cls.recent.length ? (
                <section className="ss-card ss-panel" aria-labelledby="rg-recent">
                  <header>
                    <h3 id="rg-recent">Recent registers · {cls.name}</h3>
                    <button type="button" className="ss-link-btn" onClick={() => go(`${ROUTE.progress}?class=${encodeURIComponent(cls.id)}`, "progress")}>
                      Attendance records
                    </button>
                  </header>
                  <ul className="ss-list">
                    {cls.recent.map((r) => {
                      const p = pct(r.present, r.total);
                      return (
                        <li key={`${r.date}-${r.period}`}>
                          <div>
                            <strong>{shortDate(r.date)}</strong>
                            <small>{r.period}</small>
                          </div>
                          <div className="rg-recent-bar">
                            <div className="ss-bar sm" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`Attendance ${p}%`}>
                              <i style={{ width: `${p}%` }} />
                            </div>
                          </div>
                          <span className={`ss-tag ${p >= 90 ? "ok" : "warn"}`}>
                            {r.present}/{r.total} · {p}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {/* Sticky save bar */}
              <div className="rg-savebar" role="region" aria-label="Save register">
                <span>
                  {complete ? (isSaved ? "Register saved." : "All learners marked. Ready to save.") : `${unmarked} ${unmarked === 1 ? "learner" : "learners"} still unmarked.`}
                </span>
                <div className="rg-savebar-btns">
                  <button type="button" className="ss-btn" onClick={() => go(ROUTE.classes, "classes")}>
                    Back to classes
                  </button>
                  <button type="button" className="ss-btn ss-btn-primary" onClick={save} disabled={!complete || saving || isSaved}>
                    {saving ? "Saving..." : isSaved ? "Saved" : "Save register"}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}