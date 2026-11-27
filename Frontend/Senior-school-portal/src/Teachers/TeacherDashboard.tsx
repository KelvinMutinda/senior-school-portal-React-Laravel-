import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

export type AttendanceStatus = "P" | "A" | "L" | "E"; // present, absent, late, excused

export interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  learners: number | null;
  mean: number | null;
  attendance: number | null;
  marksSubmitted: number | null;
}

export interface Lesson {
  id: string;
  time: string;
  classId: string;
  subject: string;
  room: string;
  registerTaken: boolean;
}

export interface PendingMarks {
  id: string;
  assessment: string;
  classId: string;
  status: "Not started" | "Draft" | "Returned";
  due: string;
  note?: string;
}

export interface Learner {
  id: string;
  name: string;
  admNo: string;
}

export interface WeaknessAlert {
  id: string;
  topic: string;
  classId: string;
  detail: string;
}

export interface Notice {
  id: string;
  title: string;
  from: string;
  when: string;
}

/** Latest published result for a class. */
export interface ResultSummary {
  classId: string;
  assessment: string;
  date: string;
  mean: number;
  previousMean: number;
  highest: number;
  lowest: number;
}

/** Class mean over the last few assessments, oldest first, plus learner trend counts. */
export interface ProgressTrend {
  classId: string;
  points: number[];
  improving: number;
  steady: number;
  declining: number;
}

export type MaterialStatus = "Published" | "Draft" | "Awaiting review";

export interface MaterialItem {
  id: string;
  title: string;
  classId: string;
  kind: "Upload" | "AI-assisted";
  status: MaterialStatus;
  when: string;
}

export interface TutorTopic {
  topic: string;
  classId: string;
  sessions: number;
}

export interface TeacherUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface TeacherData {
  classes: ClassInfo[];
  lessons: Lesson[];
  periodsThisWeek: number | null;
  pendingMarks: PendingMarks[];
  results: ResultSummary[];
  progress: ProgressTrend[];
  roster: Record<string, Learner[]>; // learners per class id
  materials: MaterialItem[];
  alerts: WeaknessAlert[];
  tutorTopics: TutorTopic[];
  notices: Notice[];
  aiUsage: { materialsThisTerm: number; quizAttempts: number; tutorSessions: number } | null;
  commentsDone: number; // class teachers only
  commentsTotal: number;
}

export interface TeacherDashboardProps {
  data?: TeacherData;
  user?: TeacherUser;
  theme?: "light" | "dark";
  isClassTeacher?: boolean;
  classTeacherOf?: string; // e.g. "Grade 11A"
  /** Called for every page link, with the route and a key such as "marks-entry". */
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
  onSaveAttendance?: (classId: string, records: Record<string, AttendanceStatus>) => void | Promise<void>;
  onGenerate?: (request: { classId: string; topic: string; format: string }) => void | Promise<void>;
  onUploadMaterial?: (request: { classId: string; title: string; file: File }) => void | Promise<void>;
  onAssignTutor?: (request: { classId: string; topic: string }) => void | Promise<void>;
  onAlertAction?: (alertId: string, action: "accept" | "dismiss") => void | Promise<void>;
  onPostNotice?: (classId: string, message: string) => void | Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Routes: one place, used by the sidebar, the quick nav and the cards */
/* ------------------------------------------------------------------ */

const ROUTE = {
  dashboard: "/Teacher/Dashboard",
  profile: "/Teacher/Profile",
  classes: "/Academics/classes",
  students: "/Students",
  attendance: "/Academics/Attendance",
  marks: "/Results/Upload/Results",
  results: "/Results/View/Results",
  progress: "/Academics/Progress",
  timetable: "/Academics/Timetable",
  materials: "/Academic/LearningMaterials",
  upload: "/Upload/LearningMaterial",
  generate: "/AI/Chat",
  tutor: "/AI/Chat",
  announcements: "/Announcements",
  comments: "/Academics/Comments",
} as const;
const EMPTY: TeacherData = {
  classes: [], lessons: [], periodsThisWeek: null, pendingMarks: [], results: [], progress: [],
  roster: {}, materials: [], alerts: [], tutorTopics: [], notices: [], aiUsage: null,
  commentsDone: 0, commentsTotal: 0,
};

const STATUS_LABEL: Record<AttendanceStatus, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };
const STATUSES: AttendanceStatus[] = ["P", "A", "L", "E"];
const FORMATS = ["Notes", "Summary", "Revision guide", "Flashcards", "Quiz", "Past-paper style questions"];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

type Kind = "up" | "down" | "flat";

function change(d: number, unit = ""): { kind: Kind; label: string } {
  const r = Math.round(d * 10) / 10;
  if (r > 0) return { kind: "up", label: `Up ${r}${unit}` };
  if (r < 0) return { kind: "down", label: `Down ${Math.abs(r)}${unit}` };
  return { kind: "flat", label: "No change" };
}

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
  | "insights"
  | "comments"
  | "messages"
  | "announcements"
  | "settings"
  | "bell"
  | "search"
  | "logout"
  | "chevron"
  | "menu"
  | "close"
  | "bolt";

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
  insights: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  comments: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
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
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
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
/* Sidebar menu                                                        */
/* ------------------------------------------------------------------ */

interface NavItem {
  key: string;
  label: string;
  hint: string; // short description shown on the quick navigation tiles
  route: string;
  icon: IconName;
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function buildMenu(badges: { marks: number }): NavGroup[] {
  return [
    {
      group: "Overview",
      items: [
        { key: "dashboard", label: "Dashboard", hint: "Your day at a glance", route: ROUTE.dashboard, icon: "dashboard" },
        { key: "profile", label: "Profile", hint: "Your profile", route: ROUTE.profile, icon: "students" },
      ],
    },
    {
      group: "Class management",
      items: [
        { key: "classes", label: "My classes", hint: "Your classes and rosters", route: ROUTE.classes, icon: "classes" },
        { key: "students", label: "Learners", hint: "Learner directory and profiles", route: ROUTE.students, icon: "students" },
        { key: "attendance", label: "Attendance", hint: "Registers and attendance records", route: ROUTE.attendance, icon: "attendance" },
      ],
    },
    {
      group: "Assessment",
      items: [
        { key: "marks-entry", label: "Upload marks", hint: "Enter or upload assessment marks", route: ROUTE.marks, icon: "marks", badge: badges.marks },
        { key: "results", label: "View marks", hint: "Published results and analysis", route: ROUTE.results, icon: "results" },
        { key: "progress", label: "Progress records", hint: "Learner and class progress over time", route: ROUTE.progress, icon: "progress" },
      ],
    },
    {
      group: "Teaching",
      items: [
        { key: "timetable", label: "Timetable", hint: "Your weekly lessons", route: ROUTE.timetable, icon: "timetable" },
        { key: "materials", label: "Learning materials", hint: "Notes, revision packs, past papers", route: ROUTE.materials, icon: "materials" },
        { key: "materials-upload", label: "Upload learning materials", hint: "Share files with your classes", route: ROUTE.upload, icon: "upload" },
        { key: "ai-tools", label: "Generate learning material", hint: "Create notes, quizzes, flashcards", route: ROUTE.generate, icon: "generate" },
      ],
    },
    {
      group: "AI",
      items: [{ key: "ai-tutor", label: "AI Mwalimu", hint: "Learner questions and weak topics", route: ROUTE.tutor, icon: "tutor" }],
    },
    {
      group: "Communication",
      items: [{ key: "announcements", label: "Announcements", hint: "Notices and publishing", route: ROUTE.announcements, icon: "announcements" }],
    },
  ];
}

function Sidebar({
  menu,
  user,
  open,
  activeKey,
  onClose,
  onNavigate,
}: {
  menu: NavGroup[];
  user: TeacherUser;
  open: boolean;
  activeKey: string;
  onClose: () => void;
  onNavigate?: (route: string, key: string) => void;
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
                    onClose();
                    if (onNavigate) {
                      e.preventDefault();
                      onNavigate(item.route, item.key);
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
  notifications,
  action,
  onOpenMenu,
  onSearch,
  onNavigate,
  onLogout,
}: {
  title: string;
  dateLabel: string;
  user: TeacherUser;
  notifications: number;
  action: { label: string; onClick: () => void };
  onOpenMenu: () => void;
  onSearch?: (q: string) => void;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
}) {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (v) onSearch?.(v);
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
        <input type="search" placeholder="Search learners, classes, materials" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      <div className="ss-h-actions">
        <button
          type="button"
          className="ss-h-icon"
          aria-label={notifications > 0 ? `Notifications, ${notifications} new` : "Notifications"}
          onClick={() => onNavigate?.("/notifications", "notifications")}
        >
          <Icon name="bell" />
          {notifications > 0 ? <span className="ss-h-dot">{notifications}</span> : null}
        </button>
        <button type="button" className="ss-h-primary" onClick={action.onClick}>
          <Icon name="marks" size={16} />
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
                  onNavigate?.(ROUTE.profile, "profile");
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
                  onNavigate?.("/settings", "settings");
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

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="ss-sec-head">
      <h2>{title}</h2>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick navigation tiles (same items and routes as the sidebar)       */
/* ------------------------------------------------------------------ */

function QuickNav({
  menu,
  activeKey,
  onGo,
}: {
  menu: NavGroup[];
  activeKey: string;
  onGo: (route: string, key: string) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const groups = menu
    .filter((g) => g.group !== "Overview")
    .map((g) => ({
      ...g,
      items: term ? g.items.filter((i) => i.label.toLowerCase().includes(term) || i.hint.toLowerCase().includes(term)) : g.items,
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="ss-quick" aria-labelledby="quick-nav-title">
      <div className="ss-quick-head">
        <h2 id="quick-nav-title">
          <span className="ss-bolt" aria-hidden="true">
            <Icon name="bolt" size={16} />
          </span>
          Quick navigation
        </h2>
        <div className="ss-quick-search">
          <input type="search" placeholder="Search tools..." aria-label="Search tools" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <div className="ss-quick-group" key={group.group}>
            <p className="ss-quick-label">
              <span>{group.group}</span>
              <i />
              <b>{group.items.length}</b>
            </p>
            <div className="ss-tiles">
              {group.items.map((item) => (
                <a
                  key={item.key}
                  href={item.route}
                  className="ss-tile"
                  aria-current={item.key === activeKey ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onGo(item.route, item.key);
                  }}
                >
                  <span className="ss-tile-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span className="ss-tile-text">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                  {item.badge ? <em className="ss-tile-badge">{item.badge}</em> : null}
                </a>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="ss-empty" style={{ marginTop: 16 }}>
          No pages match “{q.trim()}”.
        </p>
      )}
    </section>
  );
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (!points.length) return null;
  const W = 120;
  const H = 36;
  const P = 4;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const x = (i: number) => (points.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (points.length - 1));
  const y = (v: number) => (hi === lo ? H / 2 : H - P - ((v - lo) / (hi - lo)) * (H - 2 * P));
  const last = points.length - 1;
  return (
    <svg className="ss-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <polyline points={points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
      <circle cx={x(last)} cy={y(points[last])} r="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Classes, timetable and attendance                                   */
/* ------------------------------------------------------------------ */

function ClassesCard({ classes, onGo }: { classes: ClassInfo[]; onGo: (route: string, key: string) => void }) {
  return (
    <section id="classes" className="ss-card ss-panel" aria-labelledby="classes-title">
      <header>
        <h3 id="classes-title">My classes</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.classes, "classes")}>
          Manage classes
        </button>
      </header>
      <div className="ss-pbody">
        <div className="ss-scroll">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Class</th>
                <th className="ss-num">Learners</th>
                <th className="ss-num">Mean</th>
                <th className="ss-num">Attendance</th>
                <th>Marks in</th>
                <th>
                  <span className="ss-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6}>No classes are assigned to you this year.</td>
                </tr>
              ) : null}
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <br />
                    <small>{c.subject}</small>
                  </td>
                  <td className="ss-num">{c.learners ?? "—"}</td>
                  <td className="ss-num">{c.mean === null ? "—" : `${c.mean}%`}</td>
                  <td className="ss-num">{c.attendance === null ? "—" : `${c.attendance}%`}</td>
                  <td>
                    {c.marksSubmitted === null ? (
                      "—"
                    ) : (
                      <>
                        <div className="ss-bar sm" role="progressbar" aria-valuenow={c.marksSubmitted} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} marks submitted`}>
                      <i style={{ width: `${c.marksSubmitted}%` }} />
                    </div>
                    <small>{c.marksSubmitted}%</small>
                      </>
                    )}
                  </td>
                  <td>
                    <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(ROUTE.classes, `class-${c.id}`)}>
                      Open
                      <span className="ss-sr"> {c.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LessonsCard({
  lessons,
  periodsThisWeek,
  nameOf,
  onTakeRegister,
  onGo,
}: {
  lessons: Lesson[];
  periodsThisWeek: number | null;
  nameOf: (id: string) => string;
  onTakeRegister: (classId: string) => void;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="timetable" className="ss-card ss-panel" aria-labelledby="lessons-title">
      <header>
        <h3 id="lessons-title">Today's lessons</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.timetable, "timetable")}>
          Full timetable
        </button>
      </header>
      {lessons.length ? (
        <ul className="ss-list">
          {lessons.map((l) => (
            <li key={l.id}>
              <div>
                <strong>
                  {l.time} · {nameOf(l.classId)}
                </strong>
                <small>
                  {l.subject} · {l.room}
                </small>
              </div>
              <span className={`ss-tag ${l.registerTaken ? "ok" : "warn"}`}>{l.registerTaken ? "Register taken" : "Register pending"}</span>
              {!l.registerTaken ? (
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => onTakeRegister(l.classId)}>
                  Take register
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">{periodsThisWeek === null ? "The timetable is not connected yet." : "No lessons today."}</p>
      )}
      {periodsThisWeek !== null ? <p className="ss-note">{periodsThisWeek} periods on your timetable this week.</p> : null}
    </section>
  );
}

function AttendanceCard({
  classes,
  roster,
  attClass,
  onClassChange,
  nameOf,
  onSave,
  onGo,
}: {
  classes: ClassInfo[];
  roster: Record<string, Learner[]>;
  attClass: string;
  onClassChange: (id: string) => void;
  nameOf: (id: string) => string;
  onSave?: (classId: string, records: Record<string, AttendanceStatus>) => void | Promise<void>;
  onGo: (route: string, key: string) => void;
}) {
  const [marks, setMarks] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const learners = roster[attClass] ?? [];
  const current = marks[attClass] ?? {};
  const markedCount = learners.filter((l) => current[l.id]).length;
  const counts = STATUSES.map((s) => ({ s, n: learners.filter((l) => current[l.id] === s).length }));

  const setStatus = (id: string, status: AttendanceStatus) => {
    setSaved(null);
    setMarks((m) => ({ ...m, [attClass]: { ...(m[attClass] ?? {}), [id]: status } }));
  };
  const markAllPresent = () => {
    setSaved(null);
    setMarks((m) => ({ ...m, [attClass]: Object.fromEntries(learners.map((l) => [l.id, "P" as AttendanceStatus])) }));
  };
  const save = async () => {
    await onSave?.(attClass, current);
    setSaved(`Register saved for ${nameOf(attClass)}.`);
  };

  return (
    <section id="attendance" className="ss-card ss-panel" aria-labelledby="att-title">
      <header>
        <h3 id="att-title">Quick attendance</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.attendance, "attendance")}>
          Full register
        </button>
      </header>

      <div className="ss-toolbar">
        <select
          className="ss-input ss-input-auto"
          value={attClass}
          onChange={(e) => {
            onClassChange(e.target.value);
            setSaved(null);
          }}
          aria-label="Class"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.subject}
            </option>
          ))}
        </select>
        <button type="button" className="ss-btn ss-btn-sm" onClick={markAllPresent}>
          Mark all present
        </button>
        <span className="ss-toolbar-note">
          {markedCount} of {learners.length} marked
        </span>
      </div>

      {learners.length === 0 ? <p className="ss-empty">No learner list is available for this class yet.</p> : null}

      <ul className="ss-roster">
        {learners.map((l) => (
          <li key={l.id}>
            <div>
              <strong>{l.name}</strong>
              <small>Adm. {l.admNo}</small>
            </div>
            <div className="ss-seg" role="group" aria-label={`Attendance for ${l.name}`}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-s={s}
                  className={current[l.id] === s ? "is-on" : ""}
                  aria-pressed={current[l.id] === s}
                  title={STATUS_LABEL[s]}
                  onClick={() => setStatus(l.id, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="ss-roster-foot">
        <span className="ss-toolbar-note">{counts.map((c) => `${STATUS_LABEL[c.s]} ${c.n}`).join(" · ")}</span>
        <button type="button" className="ss-btn ss-btn-primary" onClick={save} disabled={!onSave || learners.length === 0 || markedCount < learners.length}>
          Save register
        </button>
      </div>
      {saved ? (
        <p className="ss-sent" role="status">
          {saved}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Marks and results                                                   */
/* ------------------------------------------------------------------ */

function MarksCard({
  pending,
  nameOf,
  onGo,
}: {
  pending: PendingMarks[];
  nameOf: (id: string) => string;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="marks" className="ss-card ss-panel" aria-labelledby="marks-title">
      <header>
        <h3 id="marks-title">Marks to complete</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.marks, "marks-entry")}>
          Upload marks
        </button>
      </header>
      {pending.length ? (
        <ul className="ss-list">
          {pending.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.assessment}</strong>
                <small>
                  {nameOf(m.classId)} · due {m.due}
                  {m.note ? ` · ${m.note}` : ""}
                </small>
              </div>
              <span className={`ss-tag ${m.status === "Returned" ? "warn" : ""}`}>{m.status}</span>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(ROUTE.marks, "marks-entry")}>
                {m.status === "Not started" ? "Start" : "Continue"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">No pending marks to show.</p>
      )}
      <div className="ss-btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="ss-btn" onClick={() => onGo(ROUTE.marks, "marks-upload")}>
          Upload marks (CSV)
        </button>
      </div>
    </section>
  );
}

function ResultsCard({
  results,
  nameOf,
  onGo,
}: {
  results: ResultSummary[];
  nameOf: (id: string) => string;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="results" className="ss-card ss-panel" aria-labelledby="results-title">
      <header>
        <h3 id="results-title">Latest results</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.results, "results")}>
          View marks
        </button>
      </header>
      <div className="ss-pbody">
        {results.length ? (
          results.map((r) => {
            const ch = change(r.mean - r.previousMean, " pts");
            return (
              <div className="ss-trow" key={r.classId}>
                <div>
                  <strong>{nameOf(r.classId)}</strong>
                  <small>
                    {r.assessment} · {r.date}
                  </small>
                  <small>
                    Highest {r.highest} · Lowest {r.lowest}
                  </small>
                  <small className={`ss-result-change ${ch.kind}`}>{ch.label} on the previous assessment</small>
                </div>
                <div className="ss-bar" role="progressbar" aria-valuenow={r.mean} aria-valuemin={0} aria-valuemax={100} aria-label={`${nameOf(r.classId)} mean`}>
                  <i style={{ width: `${r.mean}%` }} />
                </div>
                <span>{r.mean}%</span>
              </div>
            );
          })
        ) : (
          <p className="ss-empty">Results appear here after marks are published.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Learners and progress                                               */
/* ------------------------------------------------------------------ */

function StudentFinderCard({
  roster,
  nameOf,
  onGo,
}: {
  roster: Record<string, Learner[]>;
  nameOf: (id: string) => string;
  onGo: (route: string, key: string) => void;
}) {
  const [q, setQ] = useState("");
  const all = useMemo(() => Object.entries(roster).flatMap(([classId, ls]) => ls.map((l) => ({ ...l, classId }))), [roster]);
  const term = q.trim().toLowerCase();
  const matches = term ? all.filter((l) => l.name.toLowerCase().includes(term) || l.admNo.includes(term)) : [];

  return (
    <section id="students" className="ss-card ss-panel" aria-labelledby="students-title">
      <header>
        <h3 id="students-title">Learner details</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.students, "students")}>
          All learners
        </button>
      </header>
      <div className="ss-pbody">
        <label className="ss-lab" htmlFor="finder-q">
          Find a learner
          <input id="finder-q" className="ss-input" type="search" placeholder="Name or admission number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {term ? (
          matches.length ? (
            <ul className="ss-list">
              {matches.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.name}</strong>
                    <small>
                      Adm. {l.admNo} · {nameOf(l.classId)}
                    </small>
                  </div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(ROUTE.students, `learner-${l.id}`)}>
                    Open
                    <span className="ss-sr"> {l.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ss-empty">No learner matches “{q.trim()}”.</p>
          )
        ) : (
          <p className="ss-muted">Type a name or admission number to find a learner.</p>
        )}
      </div>
    </section>
  );
}

function ProgressCard({
  progress,
  nameOf,
  onGo,
}: {
  progress: ProgressTrend[];
  nameOf: (id: string) => string;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="progress" className="ss-card ss-panel" aria-labelledby="progress-title">
      <header>
        <h3 id="progress-title">Progress records</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.progress, "progress")}>
          All records
        </button>
      </header>
      <div className="ss-pbody">
        {progress.length ? (
          progress.map((p) => {
            const first = p.points[0] ?? 0;
            const last = p.points[p.points.length - 1] ?? 0;
            const ch = change(last - first, " pts");
            return (
              <div className="ss-prog-row" key={p.classId}>
                <strong>{nameOf(p.classId)}</strong>
                <Sparkline points={p.points} label={`${nameOf(p.classId)} class mean over recent assessments`} />
                <small>
                  {p.improving} improving · {p.steady} steady · {p.declining} declining ·{" "}
                  <span className={`ss-result-change ${ch.kind}`}>{ch.label}</span>
                </small>
              </div>
            );
          })
        ) : (
          <p className="ss-empty">Progress records appear after two or more assessments.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Learning materials: list, upload and generate                       */
/* ------------------------------------------------------------------ */

function MaterialsCard({
  materials,
  classes,
  nameOf,
  onUpload,
  onGo,
}: {
  materials: MaterialItem[];
  classes: ClassInfo[];
  nameOf: (id: string) => string;
  onUpload?: (request: { classId: string; title: string; file: File }) => void | Promise<void>;
  onGo: (route: string, key: string) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || !classId) return;
    await onUpload?.({ classId, title: title.trim(), file });
    setSent(`“${title.trim()}” uploaded for ${nameOf(classId)}.`);
    setTitle("");
    setFile(null);
    setFileKey((k) => k + 1);
  };

  return (
    <section id="materials" className="ss-card ss-panel" aria-labelledby="mat-title">
      <header>
        <h3 id="mat-title">Learning materials</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.materials, "materials")}>
          All materials
        </button>
      </header>
      {materials.length ? (
        <ul className="ss-list ss-mat">
          {materials.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.title}</strong>
                <small>
                  {nameOf(m.classId)} · {m.kind} · {m.when}
                </small>
              </div>
              <span className={`ss-tag ${m.status === "Published" ? "ok" : m.status === "Awaiting review" ? "warn" : "muted"}`}>{m.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">No materials yet.</p>
      )}

      <form className="ss-form" onSubmit={submit}>
        <h4 className="ss-h4">Upload a material</h4>
        <div className="ss-tform">
          <label className="ss-lab">
            Title
            <input className="ss-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Term 3 revision pack" />
          </label>
          <label className="ss-lab">
            Class
            <select className="ss-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ss-lab ss-span2">
            File
            <input key={fileKey} className="ss-input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <button type="submit" className="ss-btn ss-btn-primary" disabled={!onUpload || !file || !title.trim()}>
          Upload material
        </button>
        {sent ? (
          <p className="ss-sent" role="status">
            {sent}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function GenerateCard({
  classes,
  onGenerate,
  onGo,
}: {
  classes: ClassInfo[];
  onGenerate?: (request: { classId: string; topic: string; format: string }) => void | Promise<void>;
  onGo: (route: string, key: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [format, setFormat] = useState(FORMATS[0]);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t || !classId) return;
    await onGenerate?.({ classId, topic: t, format });
    setSent(`${format} on “${t}” sent for generation. It will appear under Learning materials for review.`);
    setTopic("");
  };

  return (
    <section id="generate" className="ss-card ss-panel" aria-labelledby="gen-title">
      <header>
        <h3 id="gen-title">Generate learning material</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.generate, "ai-tools")}>
          Open generator
        </button>
      </header>
      <form className="ss-gen" onSubmit={submit}>
        <label className="ss-lab">
          Topic
          <input className="ss-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic equations" />
        </label>
        <label className="ss-lab">
          Class
          <select className="ss-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ss-lab">
          Format
          <select className="ss-input" value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="ss-btn ss-btn-primary" disabled={!onGenerate || !topic.trim()}>
          Generate
        </button>
      </form>
      {sent ? (
        <p className="ss-sent" role="status">
          {sent}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AI Mwalimu                                                          */
/* ------------------------------------------------------------------ */

function MwalimuCard({
  topics,
  alerts,
  usage,
  nameOf,
  onAssign,
  onAlertAction,
  onGo,
}: {
  topics: TutorTopic[];
  alerts: WeaknessAlert[];
  usage: TeacherData["aiUsage"];
  nameOf: (id: string) => string;
  onAssign?: (request: { classId: string; topic: string }) => void | Promise<void>;
  onAlertAction?: (alertId: string, action: "accept" | "dismiss") => void | Promise<void>;
  onGo: (route: string, key: string) => void;
}) {
  const [handled, setHandled] = useState<Record<string, "accept" | "dismiss">>({});
  const [assigned, setAssigned] = useState<string | null>(null);
  const open = alerts.filter((a) => !handled[a.id]);

  const act = async (id: string, action: "accept" | "dismiss") => {
    await onAlertAction?.(id, action);
    setHandled((h) => ({ ...h, [id]: action }));
  };

  const assign = async (t: TutorTopic) => {
    await onAssign?.({ classId: t.classId, topic: t.topic });
    setAssigned(`${t.topic} assigned to ${nameOf(t.classId)} on AI Mwalimu.`);
  };

  return (
    <section id="mwalimu" className="ss-card ss-panel" aria-labelledby="mwalimu-title">
      <header>
        <h3 id="mwalimu-title">AI Mwalimu</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.tutor, "ai-tutor")}>
          Open AI Mwalimu
        </button>
      </header>

      {open.length ? (
        <ul className="ss-alerts">
          {open.map((a) => (
            <li key={a.id} className="tone-warn">
              <Icon name="insights" />
              <span>
                <strong>{a.topic}</strong> · {nameOf(a.classId)}
                <br />
                <small>{a.detail}</small>
              </span>
              <button type="button" className="ss-btn ss-btn-sm ss-btn-primary" onClick={() => act(a.id, "accept")}>
                Assign practice
              </button>
              <button type="button" className="ss-link-btn" onClick={() => act(a.id, "dismiss")}>
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">No learning gaps to show.</p>
      )}

      <h4 className="ss-h4" style={{ marginTop: 16 }}>
        Most asked topics
      </h4>
      <ul className="ss-list">
        {topics.map((t) => (
          <li key={`${t.classId}-${t.topic}`}>
            <div>
              <strong>{t.topic}</strong>
              <small>{nameOf(t.classId)}</small>
            </div>
            <span className="ss-count">{t.sessions} sessions</span>
            <button type="button" className="ss-btn ss-btn-sm" onClick={() => assign(t)} disabled={!onAssign}>
              Assign
            </button>
          </li>
        ))}
      </ul>
      {assigned ? (
        <p className="ss-sent" role="status">
          {assigned}
        </p>
      ) : null}
      {usage ? (
        <p className="ss-note">
          This term: {usage.materialsThisTerm} materials generated · {usage.quizAttempts} quiz attempts · {usage.tutorSessions} tutor sessions.
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

function AnnouncementsCard({
  notices,
  classes,
  nameOf,
  onPost,
  onGo,
}: {
  notices: Notice[];
  classes: ClassInfo[];
  nameOf: (id: string) => string;
  onPost?: (classId: string, message: string) => void | Promise<void>;
  onGo: (route: string, key: string) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = message.trim();
    if (!m || !classId) return;
    await onPost?.(classId, m);
    setSent(`Notice posted to ${nameOf(classId)}.`);
    setMessage("");
  };

  return (
    <section id="announcements" className="ss-card ss-panel" aria-labelledby="ann-title">
      <header>
        <h3 id="ann-title">Announcements</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo(ROUTE.announcements, "announcements")}>
          All announcements
        </button>
      </header>
      {notices.length ? (
        <ul className="ss-list">
          {notices.map((n) => (
            <li key={n.id}>
              <div>
                <strong>{n.title}</strong>
                <small>{n.from}</small>
              </div>
              <span className="ss-age">{n.when}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">No announcements.</p>
      )}

      <form className="ss-notice" onSubmit={submit}>
        <h4 className="ss-h4">Post a notice to a class</h4>
        <select className="ss-input" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <textarea className="ss-input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your notice" aria-label="Notice" />
        <button type="submit" className="ss-btn ss-btn-primary" disabled={!onPost || !message.trim()}>
          Post notice
        </button>
        {sent ? (
          <p className="ss-sent" role="status">
            {sent}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TeacherDashboard({
  data = EMPTY,
  user,
  theme = "light",
  isClassTeacher = false,
  classTeacherOf,
  onNavigate,
  onLogout,
  onSearch,
  onSaveAttendance,
  onGenerate,
  onUploadMaterial,
  onAssignTutor,
  onAlertAction,
  onPostNotice,
}: TeacherDashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attClass, setAttClass] = useState(data.classes[0]?.id ?? "");

  const me: TeacherUser = user ?? {
    name: "Teacher",
    roleLabel: isClassTeacher && classTeacherOf ? `Class teacher · ${classTeacherOf}` : "Subject teacher",
  };

  const nameOf = (id: string) => data.classes.find((c) => c.id === id)?.name ?? id;
  const go = (route: string, key: string) => {
    if (onNavigate) onNavigate(route, key);
    else window.location.assign(route);
  };

  const pendingCount = data.pendingMarks.length;
  const menu = useMemo(() => buildMenu({ marks: pendingCount }), [pendingCount]);

  const totalLearners = data.classes.some((c) => c.learners === null) ? null : sum(data.classes.map((c) => c.learners ?? 0));
  const registersPending = data.lessons.filter((l) => !l.registerTaken).length;
  const notifications = data.notices.length + data.alerts.length;

  const dateLabel = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const takeRegister = (classId: string) => {
    setAttClass(classId);
    document.getElementById("attendance")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} user={me} open={sidebarOpen} activeKey="dashboard" onClose={() => setSidebarOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <Header
          title="Teacher dashboard"
          dateLabel={dateLabel}
          user={me}
          notifications={notifications}
          action={{ label: "Upload marks", onClick: () => go(ROUTE.marks, "marks-entry") }}
          onOpenMenu={() => setSidebarOpen(true)}
          onSearch={onSearch}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <main className="ss-content" id="main">
          <section className="ss-hero">
            <div className="ss-hero-text">
              <span className="ss-eyebrow">{greeting()}</span>
              <h2>{me.name}</h2>
              {data.periodsThisWeek === null ? (
                <p>
                  You teach <strong>{data.classes.length}</strong> {data.classes.length === 1 ? "class" : "classes"} this year.
                </p>
              ) : (
                <p>
                  You have <strong>{data.lessons.length} lessons</strong> today and <strong>{registersPending}</strong>{" "}
                  {registersPending === 1 ? "register" : "registers"} still to take. <strong>{data.pendingMarks.length}</strong> marks{" "}
                  {data.pendingMarks.length === 1 ? "entry is" : "entries are"} waiting.
                </p>
              )}
              <div className="ss-hero-btns">
                <button type="button" className="ss-btn ss-btn-gold" onClick={() => document.getElementById("attendance")?.scrollIntoView({ behavior: "smooth" })}>
                  Take register
                </button>
                <button type="button" className="ss-btn ss-btn-ghost" onClick={() => go(ROUTE.marks, "marks-entry")}>
                  Upload marks
                </button>
              </div>
            </div>
            <div className="ss-hero-stats">
              <div>
                <span>Classes</span>
                <b>{data.classes.length}</b>
              </div>
              <div>
                <span>Learners</span>
                <b>{totalLearners ?? "—"}</b>
              </div>
              <div>
                <span>Periods / week</span>
                <b>{data.periodsThisWeek ?? "—"}</b>
              </div>
            </div>
          </section>

          <QuickNav menu={menu} activeKey="dashboard" onGo={go} />

          <SectionHead title="Today" note="Lessons, registers and marks that need you." />
          <div className="ss-two">
            <LessonsCard lessons={data.lessons} periodsThisWeek={data.periodsThisWeek} nameOf={nameOf} onTakeRegister={takeRegister} onGo={go} />
            <MarksCard pending={data.pendingMarks} nameOf={nameOf} onGo={go} />
          </div>

          <AttendanceCard
            classes={data.classes}
            roster={data.roster}
            attClass={attClass}
            onClassChange={setAttClass}
            nameOf={nameOf}
            onSave={onSaveAttendance}
            onGo={go}
          />

          {isClassTeacher ? (
            <section className="ss-card ss-panel" aria-labelledby="comments-title">
              <header>
                <h3 id="comments-title">Report comments{classTeacherOf ? ` · ${classTeacherOf}` : ""}</h3>
                <button type="button" className="ss-link-btn" onClick={() => go(ROUTE.comments, "comments")}>
                  Write comments
                </button>
              </header>
              <div className="ss-progress">
                <div
                  className="ss-bar"
                  role="progressbar"
                  aria-valuenow={data.commentsDone}
                  aria-valuemin={0}
                  aria-valuemax={data.commentsTotal}
                  aria-label="Report comments written"
                >
                  <i style={{ width: `${data.commentsTotal ? (data.commentsDone / data.commentsTotal) * 100 : 0}%` }} />
                </div>
                <small>
                  {data.commentsDone} of {data.commentsTotal} comments written
                </small>
              </div>
            </section>
          ) : null}

          <SectionHead title="My classes and learners" />
          <ClassesCard classes={data.classes} onGo={go} />
          <div className="ss-two">
            <ResultsCard results={data.results} nameOf={nameOf} onGo={go} />
            <ProgressCard progress={data.progress} nameOf={nameOf} onGo={go} />
          </div>
          <StudentFinderCard roster={data.roster} nameOf={nameOf} onGo={go} />

          <SectionHead title="Teaching" note="Share, upload and generate learning materials." />
          <div className="ss-two">
            <MaterialsCard materials={data.materials} classes={data.classes} nameOf={nameOf} onUpload={onUploadMaterial} onGo={go} />
            <GenerateCard classes={data.classes} onGenerate={onGenerate} onGo={go} />
          </div>

          <SectionHead title="AI Mwalimu and announcements" />
          <div className="ss-two">
            <MwalimuCard
              topics={data.tutorTopics}
              alerts={data.alerts}
              usage={data.aiUsage}
              nameOf={nameOf}
              onAssign={onAssignTutor}
              onAlertAction={onAlertAction}
              onGo={go}
            />
            <AnnouncementsCard notices={data.notices} classes={data.classes} nameOf={nameOf} onPost={onPostNotice} onGo={go} />
          </div>
        </main>
      </div>
    </div>
  );
}