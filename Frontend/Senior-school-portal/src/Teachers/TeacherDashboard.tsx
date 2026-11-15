import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

/* ==========================================================================
   TeacherDashboard
   Self-contained: it renders its own sidebar and header, so it no longer needs
   DashboardLayout. Styles live in App.css (sections "Dashboard shell",
   "Header section", "Teacher dashboard additions", "Learner dashboard
   additions" and "Teacher dashboard redesign"). Teachers never see fee data.
   ========================================================================== */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AttendanceStatus = "P" | "A" | "L" | "E"; // present, absent, late, excused

export interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  learners: number;
  mean: number;
  attendance: number;
  marksSubmitted: number;
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
  periodsThisWeek: number;
  pendingMarks: PendingMarks[];
  results: ResultSummary[];
  progress: ProgressTrend[];
  roster: Record<string, Learner[]>; // learners per class id
  materials: MaterialItem[];
  alerts: WeaknessAlert[];
  tutorTopics: TutorTopic[];
  notices: Notice[];
  aiUsage: { materialsThisTerm: number; quizAttempts: number; tutorSessions: number };
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
/* Sample data (replace with API results)                              */
/* ------------------------------------------------------------------ */

const SAMPLE: TeacherData = {
  classes: [
    { id: "11A", name: "Grade 11A", subject: "Mathematics", learners: 42, mean: 61, attendance: 94, marksSubmitted: 100 },
    { id: "11B", name: "Grade 11B", subject: "Mathematics", learners: 40, mean: 57, attendance: 92, marksSubmitted: 60 },
    { id: "12A", name: "Grade 12A", subject: "Physics", learners: 38, mean: 64, attendance: 95, marksSubmitted: 80 },
  ],
  lessons: [
    { id: "l1", time: "8:00 AM", classId: "11A", subject: "Mathematics", room: "Room 4", registerTaken: true },
    { id: "l2", time: "10:20 AM", classId: "12A", subject: "Physics", room: "Lab 1", registerTaken: false },
    { id: "l3", time: "2:00 PM", classId: "11B", subject: "Mathematics", room: "Room 6", registerTaken: false },
  ],
  periodsThisWeek: 14,
  pendingMarks: [
    { id: "m1", assessment: "End of Term 3 exam", classId: "11B", status: "Draft", due: "Tue, 17 Nov" },
    { id: "m2", assessment: "Practical assessment 2", classId: "12A", status: "Not started", due: "Fri, 20 Nov" },
    { id: "m3", assessment: "CAT 3", classId: "11A", status: "Returned", due: "Mon, 16 Nov", note: "Deputy: check two marks above 100" },
  ],
  results: [
    { classId: "11A", assessment: "CAT 2", date: "28 Oct", mean: 61, previousMean: 60, highest: 88, lowest: 29 },
    { classId: "11B", assessment: "CAT 2", date: "28 Oct", mean: 57, previousMean: 57, highest: 84, lowest: 24 },
    { classId: "12A", assessment: "Practical assessment 1", date: "30 Oct", mean: 64, previousMean: 63, highest: 91, lowest: 35 },
  ],
  progress: [
    { classId: "11A", points: [54, 57, 58, 60, 61], improving: 19, steady: 17, declining: 6 },
    { classId: "11B", points: [58, 55, 56, 57, 57], improving: 11, steady: 20, declining: 9 },
    { classId: "12A", points: [59, 60, 62, 63, 64], improving: 17, steady: 15, declining: 6 },
  ],
  roster: {
    "11A": [
      { id: "s1", name: "Achieng Otieno", admNo: "1021" },
      { id: "s2", name: "Brian Kiptoo", admNo: "1022" },
      { id: "s3", name: "Cynthia Mwende", admNo: "1023" },
      { id: "s4", name: "Daniel Njoroge", admNo: "1024" },
      { id: "s5", name: "Esther Wambui", admNo: "1025" },
      { id: "s6", name: "Felix Mutua", admNo: "1026" },
    ],
    "11B": [
      { id: "s7", name: "Grace Akinyi", admNo: "1051" },
      { id: "s8", name: "Hassan Ali", admNo: "1052" },
      { id: "s9", name: "Irene Chebet", admNo: "1053" },
      { id: "s10", name: "James Maina", admNo: "1054" },
    ],
    "12A": [
      { id: "s11", name: "Kevin Omondi", admNo: "0981" },
      { id: "s12", name: "Lucy Nyambura", admNo: "0982" },
      { id: "s13", name: "Mark Kariuki", admNo: "0983" },
      { id: "s14", name: "Naomi Jepkoech", admNo: "0984" },
    ],
  },
  materials: [
    { id: "mt1", title: "Quadratic equations: worked examples", classId: "11A", kind: "AI-assisted", status: "Awaiting review", when: "Today" },
    { id: "mt2", title: "Term 3 revision pack: algebra", classId: "11B", kind: "Upload", status: "Published", when: "Yesterday" },
    { id: "mt3", title: "Circular motion flashcards", classId: "12A", kind: "AI-assisted", status: "Draft", when: "12 Nov" },
    { id: "mt4", title: "Past paper: Mathematics Paper 2", classId: "11A", kind: "Upload", status: "Published", when: "10 Nov" },
  ],
  alerts: [
    { id: "w1", topic: "Quadratic equations", classId: "11A", detail: "Several learners lost marks on factorisation steps. A short practice set could help." },
    { id: "w2", topic: "Circular motion", classId: "12A", detail: "Tutor questions show repeated confusion about centripetal force." },
  ],
  tutorTopics: [
    { topic: "Quadratic equations", classId: "11A", sessions: 23 },
    { topic: "Circular motion", classId: "12A", sessions: 17 },
    { topic: "Simultaneous equations", classId: "11B", sessions: 12 },
  ],
  notices: [
    { id: "n1", title: "End of term exam timetable released", from: "Head of Institution", when: "Today" },
    { id: "n2", title: "Staff meeting moved to Friday 3:30 PM", from: "Deputy", when: "Yesterday" },
  ],
  aiUsage: { materialsThisTerm: 9, quizAttempts: 214, tutorSessions: 87 },
  commentsDone: 28,
  commentsTotal: 42,
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

interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: IconName;
  badge?: number;
  classTeacherOnly?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function buildMenu(badges: { marks: number; messages: number }, isClassTeacher: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      group: "Overview",
      items: [{ key: "dashboard", label: "Dashboard", route: "/dashboard", icon: "dashboard" }],
    },
    {
      group: "Class management",
      items: [
        { key: "classes", label: "My classes", route: "/academics/classes", icon: "classes" },
        { key: "students", label: "Learners", route: "/academics/students", icon: "students" },
        { key: "attendance", label: "Attendance", route: "/academics/attendance", icon: "attendance" },
        { key: "comments", label: "Report comments", route: "/academics/comments", icon: "comments", classTeacherOnly: true },
      ],
    },
    {
      group: "Assessment",
      items: [
        { key: "marks-entry", label: "Upload marks", route: "/academics/marks", icon: "marks", badge: badges.marks },
        { key: "results", label: "View results", route: "/academics/results", icon: "results" },
        { key: "progress", label: "Progress records", route: "/academics/progress", icon: "progress" },
      ],
    },
    {
      group: "Teaching",
      items: [
        { key: "timetable", label: "Timetable", route: "/academics/timetable", icon: "timetable" },
        { key: "materials", label: "Learning materials", route: "/materials", icon: "materials" },
        { key: "materials-upload", label: "Upload material", route: "/materials/upload", icon: "upload" },
        { key: "ai-tools", label: "Generate material", route: "/ai/tools", icon: "generate" },
      ],
    },
    {
      group: "AI",
      items: [
        { key: "ai-tutor", label: "AI Tutor", route: "/ai/tutor", icon: "tutor" },
        { key: "ai-insights", label: "AI insights", route: "/ai/insights", icon: "insights" },
      ],
    },
    {
      group: "Communication",
      items: [
        { key: "messages", label: "Messages", route: "/messages", icon: "messages", badge: badges.messages },
        { key: "announcements", label: "Announcements", route: "/announcements", icon: "announcements" },
      ],
    },
    {
      group: "Account",
      items: [{ key: "settings", label: "Settings", route: "/settings", icon: "settings" }],
    },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => isClassTeacher || !i.classTeacherOnly) }));
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
                  onNavigate?.("/profile", "profile");
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
/* Module cards                                                        */
/* ------------------------------------------------------------------ */

interface CardAction {
  label: string;
  onClick: () => void;
}

function ModuleCard({
  icon,
  title,
  hint,
  stat,
  statLabel,
  primary,
  secondary,
  children,
}: {
  icon: IconName;
  title: string;
  hint: string;
  stat: string | number;
  statLabel: string;
  primary: CardAction;
  secondary?: CardAction;
  children?: ReactNode;
}) {
  return (
    <article className="ss-card ss-mod">
      <div className="ss-mod-head">
        <span className="ss-mod-icon">
          <Icon name={icon} />
        </span>
        <div>
          <h3>{title}</h3>
          <small>{hint}</small>
        </div>
      </div>
      <div className="ss-mod-stat">
        <b>{stat}</b>
        <span>{statLabel}</span>
      </div>
      <div className="ss-mod-body">{children}</div>
      <div className="ss-mod-foot">
        <button type="button" className="ss-btn ss-btn-primary ss-btn-sm" onClick={primary.onClick}>
          {primary.label}
        </button>
        {secondary ? (
          <button type="button" className="ss-link-btn" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        ) : null}
      </div>
    </article>
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/classes", "classes")}>
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
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <br />
                    <small>{c.subject}</small>
                  </td>
                  <td className="ss-num">{c.learners}</td>
                  <td className="ss-num">{c.mean}%</td>
                  <td className="ss-num">{c.attendance}%</td>
                  <td>
                    <div className="ss-bar sm" role="progressbar" aria-valuenow={c.marksSubmitted} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} marks submitted`}>
                      <i style={{ width: `${c.marksSubmitted}%` }} />
                    </div>
                    <small>{c.marksSubmitted}%</small>
                  </td>
                  <td>
                    <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo("/academics/classes", `class-${c.id}`)}>
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
  periodsThisWeek: number;
  nameOf: (id: string) => string;
  onTakeRegister: (classId: string) => void;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="timetable" className="ss-card ss-panel" aria-labelledby="lessons-title">
      <header>
        <h3 id="lessons-title">Today's lessons</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/timetable", "timetable")}>
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
        <p className="ss-empty">No lessons today.</p>
      )}
      <p className="ss-note">{periodsThisWeek} periods on your timetable this week.</p>
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/attendance", "attendance")}>
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
        <button type="button" className="ss-btn ss-btn-primary" onClick={save} disabled={learners.length === 0 || markedCount < learners.length}>
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/marks", "marks-entry")}>
          Marks entry
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
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo("/academics/marks", "marks-entry")}>
                {m.status === "Not started" ? "Start" : "Continue"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">All marks are in. Nothing is waiting.</p>
      )}
      <div className="ss-btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="ss-btn" onClick={() => onGo("/academics/marks", "marks-upload")}>
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/results", "results")}>
          View results
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/students", "students")}>
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
            <ul className="ss-list" aria-live="polite">
              {matches.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.name}</strong>
                    <small>
                      Adm. {l.admNo} · {nameOf(l.classId)}
                    </small>
                  </div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo("/academics/students", `student-${l.id}`)}>
                    View details
                    <span className="ss-sr"> for {l.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ss-empty" aria-live="polite">
              No learner matches "{q.trim()}".
            </p>
          )
        ) : (
          <p className="ss-muted" style={{ margin: 0 }}>
            Type a name or admission number to open a learner's details.
          </p>
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
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/progress", "progress")}>
          Open records
        </button>
      </header>
      <div className="ss-pbody">
        {progress.map((p) => (
          <div className="ss-prog-row" key={p.classId}>
            <strong>{nameOf(p.classId)}</strong>
            <Sparkline points={p.points} label={`${nameOf(p.classId)} class mean over the last ${p.points.length} assessments, from ${p.points[0]} to ${p.points[p.points.length - 1]}`} />
            <small>
              {p.improving} improving · {p.steady} steady · {p.declining} falling
            </small>
          </div>
        ))}
        <p className="ss-muted" style={{ margin: 0 }}>
          Lines show the class mean over the last few assessments. Open the records for each learner's history.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Learning materials                                                  */
/* ------------------------------------------------------------------ */

function GenerateCard({
  classes,
  usage,
  nameOf,
  onGenerate,
  onGo,
}: {
  classes: ClassInfo[];
  usage: TeacherData["aiUsage"];
  nameOf: (id: string) => string;
  onGenerate?: TeacherDashboardProps["onGenerate"];
  onGo: (route: string, key: string) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = async () => {
    const t = topic.trim();
    if (!t) return;
    await onGenerate?.({ classId, topic: t, format });
    setMsg(`${format} on "${t}" requested. Review and edit it before publishing to ${nameOf(classId)}.`);
    setTopic("");
  };

  return (
    <section id="generate" className="ss-card ss-panel" aria-labelledby="gen-title">
      <header>
        <h3 id="gen-title">Generate material or a quiz</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/ai/tools", "ai-tools")}>
          Saved items
        </button>
      </header>
      <div className="ss-gen">
        <label className="ss-lab">
          Topic
          <input className="ss-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Factorising quadratic equations" />
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
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <button type="button" className="ss-btn ss-btn-primary" onClick={generate} disabled={!topic.trim()}>
          Generate
        </button>
      </div>
      {msg ? (
        <p className="ss-sent" role="status">
          {msg}
        </p>
      ) : null}
      <p className="ss-note">
        Generated content is labelled AI-assisted and must be reviewed by you before it reaches learners. This term: {usage.materialsThisTerm} items created.
      </p>
    </section>
  );
}

function UploadCard({
  classes,
  nameOf,
  onUpload,
  onGo,
}: {
  classes: ClassInfo[];
  nameOf: (id: string) => string;
  onUpload?: TeacherDashboardProps["onUploadMaterial"];
  onGo: (route: string, key: string) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = async () => {
    const t = title.trim();
    if (!t || !file) return;
    await onUpload?.({ classId, title: t, file });
    setMsg(`"${t}" uploaded for ${nameOf(classId)}.`);
    setTitle("");
    setFile(null);
    setFileKey((k) => k + 1);
  };

  return (
    <section id="upload" className="ss-card ss-panel" aria-labelledby="upload-title">
      <header>
        <h3 id="upload-title">Upload a material</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/materials/upload", "materials-upload")}>
          Full upload page
        </button>
      </header>
      <div className="ss-form">
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
        <label className="ss-lab">
          File (PDF, Word or PowerPoint)
          <input
            key={fileKey}
            className="ss-input"
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="button" className="ss-btn ss-btn-primary" onClick={upload} disabled={!title.trim() || !file}>
          <Icon name="upload" size={16} />
          Upload
        </button>
      </div>
      {msg ? (
        <p className="ss-sent" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}

function MaterialsListCard({
  materials,
  nameOf,
  onGo,
}: {
  materials: MaterialItem[];
  nameOf: (id: string) => string;
  onGo: (route: string, key: string) => void;
}) {
  const tone = (s: MaterialStatus) => (s === "Published" ? "ok" : s === "Awaiting review" ? "warn" : "muted");
  return (
    <section id="materials" className="ss-card ss-panel" aria-labelledby="materials-title">
      <header>
        <h3 id="materials-title">Recent materials</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/materials", "materials")}>
          Material library
        </button>
      </header>
      {materials.length ? (
        <ul className="ss-list ss-mat">
          {materials.map((m) => (
            <li key={m.id}>
              <span className="ss-tag">{m.kind}</span>
              <div>
                <strong>{m.title}</strong>
                <small>
                  {nameOf(m.classId)} · {m.when}
                </small>
              </div>
              <span className={`ss-tag ${tone(m.status)}`}>{m.status}</span>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo("/materials", `material-${m.id}`)}>
                {m.status === "Awaiting review" ? "Review" : "Open"}
                <span className="ss-sr"> {m.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ss-empty">Upload or generate your first material to see it here.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* AI Tutor                                                            */
/* ------------------------------------------------------------------ */

function InsightsCard({
  alerts,
  nameOf,
  onAct,
  onGo,
}: {
  alerts: WeaknessAlert[];
  nameOf: (id: string) => string;
  onAct: (id: string, action: "accept" | "dismiss") => void;
  onGo: (route: string, key: string) => void;
}) {
  return (
    <section id="insights" className="ss-card ss-panel" aria-labelledby="insights-title">
      <header>
        <h3 id="insights-title">AI insights for your classes</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/ai/insights", "ai-insights")}>
          All insights
        </button>
      </header>
      {alerts.length === 0 ? (
        <p className="ss-empty">No new suggestions. Insights appear after marks are published.</p>
      ) : (
        <ul className="ss-list">
          {alerts.map((a) => (
            <li key={a.id}>
              <div>
                <strong>
                  {a.topic} · {nameOf(a.classId)}
                </strong>
                <small>{a.detail}</small>
              </div>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onAct(a.id, "accept")}>
                Accept
              </button>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo("/ai/insights", "ai-insights")}>
                Edit
              </button>
              <button type="button" className="ss-link-btn" onClick={() => onAct(a.id, "dismiss")}>
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="ss-note">Suggestions describe topics and next steps, never labels for individual learners. You can accept, edit or dismiss each one.</p>
    </section>
  );
}

function TutorCard({
  classes,
  topics,
  usage,
  nameOf,
  onAssign,
  onGo,
}: {
  classes: ClassInfo[];
  topics: TutorTopic[];
  usage: TeacherData["aiUsage"];
  nameOf: (id: string) => string;
  onAssign?: TeacherDashboardProps["onAssignTutor"];
  onGo: (route: string, key: string) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const max = Math.max(1, ...topics.map((t) => t.sessions));

  const assign = async () => {
    const t = topic.trim();
    if (!t) return;
    await onAssign?.({ classId, topic: t });
    setMsg(`Tutor lesson on "${t}" assigned to ${nameOf(classId)}.`);
    setTopic("");
  };

  return (
    <section id="tutor" className="ss-card ss-panel" aria-labelledby="tutor-title">
      <header>
        <h3 id="tutor-title">AI Tutor in your classes</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/ai/tutor", "ai-tutor")}>
          Open AI Tutor
        </button>
      </header>
      <div className="ss-pbody">
        <div className="ss-trio">
          <div>
            <span>Tutor sessions</span>
            <b>{usage.tutorSessions}</b>
          </div>
          <div>
            <span>Quiz attempts</span>
            <b>{usage.quizAttempts}</b>
          </div>
          <div>
            <span>Items created</span>
            <b>{usage.materialsThisTerm}</b>
          </div>
        </div>

        <strong className="ss-h4">Topics learners are working on</strong>
        {topics.length ? (
          <div className="ss-rows" style={{ marginTop: 0 }}>
            {topics.map((t) => (
              <div className="ss-trow" key={`${t.classId}-${t.topic}`}>
                <div>
                  <strong>{t.topic}</strong>
                  <small>{nameOf(t.classId)}</small>
                </div>
                <div className="ss-bar" aria-hidden="true">
                  <i style={{ width: `${(t.sessions / max) * 100}%` }} />
                </div>
                <span>{t.sessions}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ss-empty">Tutor activity appears here once learners start sessions.</p>
        )}

        <strong className="ss-h4">Assign a tutor lesson</strong>
        <div className="ss-tform">
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
            Topic
            <input className="ss-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Circular motion" />
          </label>
          <div className="ss-span2">
            <button type="button" className="ss-btn ss-btn-primary" onClick={assign} disabled={!topic.trim()}>
              <Icon name="tutor" size={16} />
              Assign lesson
            </button>
          </div>
        </div>
        {msg ? (
          <p className="ss-sent" role="status" style={{ margin: 0 }}>
            {msg}
          </p>
        ) : null}
        <p className="ss-muted" style={{ margin: 0 }}>
          Topics are shown for the whole class, not for individual learners.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Communication                                                       */
/* ------------------------------------------------------------------ */

function CommentsCard({
  done,
  total,
  classTeacherOf,
  onGo,
}: {
  done: number;
  total: number;
  classTeacherOf: string;
  onGo: (route: string, key: string) => void;
}) {
  const pct = Math.round((done / Math.max(1, total)) * 100);
  return (
    <section id="comments" className="ss-card ss-panel" aria-labelledby="comments-title">
      <header>
        <h3 id="comments-title">Report comments, {classTeacherOf}</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/academics/comments", "comments")}>
          Open comments
        </button>
      </header>
      <div className="ss-progress">
        <div className="ss-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Comments completed">
          <i style={{ width: `${pct}%` }} />
        </div>
        <small>
          {done} of {total} learners have overall comments and conduct remarks. Report cards go to approval once these are complete.
        </small>
      </div>
    </section>
  );
}

function NoticesCard({ notices, onGo }: { notices: Notice[]; onGo: (route: string, key: string) => void }) {
  return (
    <section id="notices" className="ss-card ss-panel" aria-labelledby="notices-title">
      <header>
        <h3 id="notices-title">Announcements</h3>
        <button type="button" className="ss-link-btn" onClick={() => onGo("/announcements", "announcements")}>
          View all
        </button>
      </header>
      <ul className="ss-activity">
        {notices.map((n) => (
          <li key={n.id}>
            <span className="ss-pip" />
            <div>
              <p>{n.title}</p>
              <small>
                {n.from} · {n.when}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostNoticeCard({
  classes,
  nameOf,
  onPost,
}: {
  classes: ClassInfo[];
  nameOf: (id: string) => string;
  onPost?: (classId: string, message: string) => void | Promise<void>;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const post = async () => {
    const m = text.trim();
    if (!m) return;
    await onPost?.(classId, m);
    setText("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section className="ss-card ss-panel" aria-labelledby="post-title">
      <header>
        <h3 id="post-title">Post a class notice</h3>
      </header>
      <div className="ss-notice">
        <select className="ss-input" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Audience">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <textarea className="ss-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a notice for this class..." />
        <button type="button" className="ss-btn ss-btn-primary" onClick={post} disabled={!text.trim()}>
          Post notice
        </button>
      </div>
      {sent ? (
        <p className="ss-sent" role="status">
          Notice posted to {nameOf(classId)}.
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function TeacherDashboard({
  data = SAMPLE,
  user,
  theme = "light",
  isClassTeacher = true,
  classTeacherOf = "Grade 11A",
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
  const me: TeacherUser = user ?? {
    name: "Teacher",
    roleLabel: isClassTeacher ? `Class Teacher, ${classTeacherOf}` : "Subject Teacher",
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [attClass, setAttClass] = useState(data.classes[0]?.id ?? "");
  const [alerts, setAlerts] = useState(data.alerts);

  const go = (route: string, key = "") => onNavigate?.(route, key);
  const nameOf = (id: string) => data.classes.find((c) => c.id === id)?.name ?? id;

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  const actOnAlert = async (id: string, action: "accept" | "dismiss") => {
    await onAlertAction?.(id, action);
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  const takeRegister = (classId: string) => {
    setAttClass(classId);
    goTo("attendance");
  };

  /* derived numbers */
  const totalLearners = sum(data.classes.map((c) => c.learners));
  const registersTaken = data.lessons.filter((l) => l.registerTaken).length;
  const meanAll = Math.round(sum(data.classes.map((c) => c.mean)) / Math.max(1, data.classes.length));
  const openMarks = data.pendingMarks.length;
  const improving = sum(data.progress.map((p) => p.improving));
  const declining = sum(data.progress.map((p) => p.declining));
  const nextLesson = data.lessons.find((l) => !l.registerTaken) ?? data.lessons[0];
  const countStatus = (s: MaterialStatus) => data.materials.filter((m) => m.status === s).length;
  const topTopic = data.tutorTopics[0];

  const messages = 2;
  const menu = useMemo(() => buildMenu({ marks: openMarks, messages }, isClassTeacher), [openMarks, isClassTeacher]);

  const dateLabel = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div id="top" className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} user={me} open={menuOpen} activeKey="dashboard" onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <Header
          title="Teacher Dashboard"
          dateLabel={dateLabel}
          user={me}
          notifications={alerts.length + openMarks}
          action={{ label: "Enter marks", onClick: () => go("/academics/marks", "marks-entry") }}
          onOpenMenu={() => setMenuOpen(true)}
          onSearch={onSearch}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <main className="ss-content">
          {/* Hero */}
          <section className="ss-hero" aria-label="Welcome">
            <div className="ss-hero-text">
              <span className="ss-eyebrow">{isClassTeacher ? `Class teacher, ${classTeacherOf}` : "Subject teacher"}</span>
              <h2>{greeting()}, welcome back</h2>
              <p>
                You have <strong>{data.lessons.length} lessons</strong> today and <strong>{openMarks} marks tasks</strong> waiting
                {alerts.length > 0 && (
                  <>
                    , plus <strong>{alerts.length} AI alerts</strong> to review
                  </>
                )}
                .
              </p>
              <div className="ss-hero-btns">
                <button type="button" className="ss-btn ss-btn-gold" onClick={() => goTo("attendance")}>
                  Take attendance
                </button>
                <button type="button" className="ss-btn ss-btn-ghost" onClick={() => goTo("generate")}>
                  Generate material
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
                <b>{totalLearners}</b>
              </div>
              <div>
                <span>Lessons today</span>
                <b>{data.lessons.length}</b>
              </div>
            </div>
          </section>

          {/* KPIs */}
          <section className="ss-kpis" aria-label="Key indicators">
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">Registers taken today</span>
              <b>
                {registersTaken} of {data.lessons.length}
              </b>
              <div className="ss-bar">
                <i style={{ width: `${(registersTaken / Math.max(1, data.lessons.length)) * 100}%` }} />
              </div>
              <small>Lessons with attendance recorded</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">Marks tasks open</span>
              <b>{openMarks}</b>
              <div className="ss-bar">
                <i className="gold" style={{ width: `${Math.max(8, 100 - openMarks * 20)}%` }} />
              </div>
              <small>Drafts, returned and not started</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">Average class score</span>
              <b>{meanAll}%</b>
              <div className="ss-bar">
                <i style={{ width: `${meanAll}%` }} />
              </div>
              <small>Across your classes this term</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">AI alerts to review</span>
              <b>{alerts.length}</b>
              <div className="ss-bar">
                <i className="gold" style={{ width: `${Math.min(100, alerts.length * 25)}%` }} />
              </div>
              <small>Topic-level suggestions for your classes</small>
            </article>
          </section>

          {/* Workspace cards */}
          <SectionHead title="Your workspace" note="Open a page from a card, or use the sections below to work from this dashboard." />
          <div className="ss-mods">
            <ModuleCard
              icon="marks"
              title="Upload marks"
              hint="Marks entry and CSV upload"
              stat={openMarks}
              statLabel="tasks open"
              primary={{ label: "Upload marks (CSV)", onClick: () => go("/academics/marks", "marks-entry") }}
              secondary={{ label: "See tasks", onClick: () => goTo("marks") }}
            >
              {data.pendingMarks.slice(0, 2).map((m) => (
                <div className="ss-mini-line" key={m.id}>
                  <span>
                    {m.assessment} · {nameOf(m.classId)}
                  </span>
                  <span className={`ss-tag ${m.status === "Returned" ? "warn" : ""}`}>{m.status}</span>
                </div>
              ))}
              {openMarks === 0 ? <p className="ss-mod-sub">All marks are in.</p> : null}
            </ModuleCard>

            <ModuleCard
              icon="results"
              title="View results"
              hint="Published results by class"
              stat={`${meanAll}%`}
              statLabel="average across your classes"
              primary={{ label: "View results", onClick: () => go("/academics/results", "results") }}
              secondary={{ label: "See summary", onClick: () => goTo("results") }}
            >
              {data.results.map((r) => (
                <div className="ss-mini" key={r.classId}>
                  <span>{nameOf(r.classId)}</span>
                  <div className="ss-bar" aria-hidden="true">
                    <i style={{ width: `${r.mean}%` }} />
                  </div>
                  <span>{r.mean}%</span>
                </div>
              ))}
            </ModuleCard>

            <ModuleCard
              icon="students"
              title="Learner details"
              hint="Profiles, contacts and history"
              stat={totalLearners}
              statLabel={`learners in ${data.classes.length} classes`}
              primary={{ label: "My learners", onClick: () => go("/academics/students", "students") }}
              secondary={{ label: "Find a learner", onClick: () => goTo("students") }}
            >
              <div className="ss-chips">
                {data.classes.map((c) => (
                  <span className="ss-tag" key={c.id}>
                    {c.name}: {c.learners}
                  </span>
                ))}
              </div>
            </ModuleCard>

            <ModuleCard
              icon="progress"
              title="Progress records"
              hint="Trends over time"
              stat={improving}
              statLabel="learners improving"
              primary={{ label: "Progress records", onClick: () => go("/academics/progress", "progress") }}
              secondary={{ label: "See trends", onClick: () => goTo("progress") }}
            >
              {data.progress.map((p) => (
                <div className="ss-mini-line" key={p.classId}>
                  <span>{nameOf(p.classId)}</span>
                  <Sparkline points={p.points} label={`${nameOf(p.classId)} class mean trend`} />
                </div>
              ))}
              <p className="ss-mod-sub">{declining} learners show a falling trend.</p>
            </ModuleCard>

            <ModuleCard
              icon="timetable"
              title="Timetable"
              hint="Lessons and rooms"
              stat={data.lessons.length}
              statLabel={`lessons today · ${data.periodsThisWeek} this week`}
              primary={{ label: "Open timetable", onClick: () => go("/academics/timetable", "timetable") }}
              secondary={{ label: "Today's lessons", onClick: () => goTo("timetable") }}
            >
              {nextLesson ? (
                <p className="ss-mod-sub">
                  <strong>{nextLesson.registerTaken ? "Latest" : "Next"}:</strong> {nextLesson.time} · {nameOf(nextLesson.classId)}, {nextLesson.subject}, {nextLesson.room}
                </p>
              ) : (
                <p className="ss-mod-sub">No lessons today.</p>
              )}
            </ModuleCard>

            <ModuleCard
              icon="materials"
              title="Learning materials"
              hint="Upload and generate"
              stat={data.materials.length}
              statLabel="items in your library"
              primary={{ label: "Upload material", onClick: () => goTo("upload") }}
              secondary={{ label: "Generate", onClick: () => goTo("generate") }}
            >
              <div className="ss-chips">
                <span className="ss-tag ok">{countStatus("Published")} published</span>
                <span className="ss-tag muted">{countStatus("Draft")} draft</span>
                <span className="ss-tag warn">{countStatus("Awaiting review")} to review</span>
              </div>
            </ModuleCard>

            <ModuleCard
              icon="tutor"
              title="AI Tutor"
              hint="What learners are working on"
              stat={data.aiUsage.tutorSessions}
              statLabel="tutor sessions in your classes"
              primary={{ label: "Open AI Tutor", onClick: () => go("/ai/tutor", "ai-tutor") }}
              secondary={{ label: "Assign a lesson", onClick: () => goTo("tutor") }}
            >
              {topTopic ? (
                <p className="ss-mod-sub">
                  <strong>Top topic:</strong> {topTopic.topic} in {nameOf(topTopic.classId)} ({topTopic.sessions} sessions)
                </p>
              ) : (
                <p className="ss-mod-sub">No tutor sessions yet.</p>
              )}
            </ModuleCard>
          </div>

          {/* Classes and timetable */}
          <SectionHead title="Classes and timetable" note="Manage your classes, see today's lessons and take the register." />
          <ClassesCard classes={data.classes} onGo={go} />
          <div className="ss-two">
            <AttendanceCard
              classes={data.classes}
              roster={data.roster}
              attClass={attClass}
              onClassChange={setAttClass}
              nameOf={nameOf}
              onSave={onSaveAttendance}
              onGo={go}
            />
            <LessonsCard lessons={data.lessons} periodsThisWeek={data.periodsThisWeek} nameOf={nameOf} onTakeRegister={takeRegister} onGo={go} />
          </div>

          {/* Marks and results */}
          <SectionHead title="Marks and results" note="Finish pending marks and check how each class did." />
          <div className="ss-two">
            <MarksCard pending={data.pendingMarks} nameOf={nameOf} onGo={go} />
            <ResultsCard results={data.results} nameOf={nameOf} onGo={go} />
          </div>

          {/* Learners and progress */}
          <SectionHead title="Learners and progress" note="Look up a learner and follow each class over time." />
          <div className="ss-two">
            <ProgressCard progress={data.progress} nameOf={nameOf} onGo={go} />
            <StudentFinderCard roster={data.roster} nameOf={nameOf} onGo={go} />
          </div>

          {/* Learning materials */}
          <SectionHead title="Learning materials" note="Upload your own files or generate new ones, then review before learners see them." />
          <div className="ss-two">
            <GenerateCard classes={data.classes} usage={data.aiUsage} nameOf={nameOf} onGenerate={onGenerate} onGo={go} />
            <UploadCard classes={data.classes} nameOf={nameOf} onUpload={onUploadMaterial} onGo={go} />
          </div>
          <MaterialsListCard materials={data.materials} nameOf={nameOf} onGo={go} />

          {/* AI Tutor */}
          <SectionHead title="AI Tutor" note="See where learners need help and assign a guided lesson." />
          <div className="ss-two">
            <InsightsCard alerts={alerts} nameOf={nameOf} onAct={actOnAlert} onGo={go} />
            <TutorCard classes={data.classes} topics={data.tutorTopics} usage={data.aiUsage} nameOf={nameOf} onAssign={onAssignTutor} onGo={go} />
          </div>

          {/* Communication */}
          <SectionHead title="Communication" />
          {isClassTeacher && <CommentsCard done={data.commentsDone} total={data.commentsTotal} classTeacherOf={classTeacherOf} onGo={go} />}
          <div className="ss-two">
            <NoticesCard notices={data.notices} onGo={go} />
            <PostNoticeCard classes={data.classes} nameOf={nameOf} onPost={onPostNotice} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeacherDashboard;