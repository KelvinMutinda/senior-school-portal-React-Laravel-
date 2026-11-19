import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RosterLearner {
  id: string;
  name: string;
  admNo: string;
}

export interface ClassRow {
  id: string;
  name: string;
  subject: string;
  learners: number;
  mean: number;
  previousMean: number;
  attendance: number;
  marksSubmitted: number; // percent of marks entered for the latest assessment
  trend: number[]; // class mean over recent assessments, oldest first
  nextLesson?: string; // e.g. "Today · 8:00 AM · Room 4"
  classTeacher?: boolean;
  roster: RosterLearner[];
}

export interface TeacherUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface ClassesProps {
  data?: ClassRow[];
  user?: TeacherUser;
  theme?: "light" | "dark";
  /** Optional. If omitted, react-router's navigate() is used. */
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
}

/* ------------------------------------------------------------------ */
/* Routes (same object as TeacherDashboard.tsx)                        */
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
  materials: "/Academic/LearningMaterials",
  upload: "/Upload/LearningMaterial",
  generate: "/AI/Chat",
  tutor: "/AI/Chat",
  announcements: "/Announcements",
} as const;

/* ------------------------------------------------------------------ */
/* Sample data (replace with API results)                              */
/* ------------------------------------------------------------------ */

const SAMPLE: ClassRow[] = [
  {
    id: "11A",
    name: "Grade 11A",
    subject: "Mathematics",
    learners: 42,
    mean: 61,
    previousMean: 60,
    attendance: 94,
    marksSubmitted: 100,
    trend: [54, 57, 58, 60, 61],
    nextLesson: "Today · 8:00 AM · Room 4",
    classTeacher: true,
    roster: [
      { id: "s1", name: "Achieng Otieno", admNo: "1021" },
      { id: "s2", name: "Brian Kiptoo", admNo: "1022" },
      { id: "s3", name: "Cynthia Mwende", admNo: "1023" },
      { id: "s4", name: "Daniel Njoroge", admNo: "1024" },
      { id: "s5", name: "Esther Wambui", admNo: "1025" },
      { id: "s6", name: "Felix Mutua", admNo: "1026" },
    ],
  },
  {
    id: "11B",
    name: "Grade 11B",
    subject: "Mathematics",
    learners: 40,
    mean: 57,
    previousMean: 57,
    attendance: 92,
    marksSubmitted: 60,
    trend: [58, 55, 56, 57, 57],
    nextLesson: "Today · 2:00 PM · Room 6",
    roster: [
      { id: "s7", name: "Grace Akinyi", admNo: "1051" },
      { id: "s8", name: "Hassan Ali", admNo: "1052" },
      { id: "s9", name: "Irene Chebet", admNo: "1053" },
      { id: "s10", name: "James Maina", admNo: "1054" },
    ],
  },
  {
    id: "12A",
    name: "Grade 12A",
    subject: "Physics",
    learners: 38,
    mean: 64,
    previousMean: 63,
    attendance: 95,
    marksSubmitted: 80,
    trend: [59, 60, 62, 63, 64],
    nextLesson: "Today · 10:20 AM · Lab 1",
    roster: [
      { id: "s11", name: "Kevin Omondi", admNo: "0981" },
      { id: "s12", name: "Lucy Nyambura", admNo: "0982" },
      { id: "s13", name: "Mark Kariuki", admNo: "0983" },
      { id: "s14", name: "Naomi Jepkoech", admNo: "0984" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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

type SortKey = "name" | "mean" | "attendance" | "marks";
const SORT_LABEL: Record<SortKey, string> = {
  name: "Class name",
  mean: "Highest mean",
  attendance: "Highest attendance",
  marks: "Marks still to enter",
};

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

function buildMenu(badges: { marks: number }): NavGroup[] {
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
        { key: "marks-entry", label: "Upload marks", route: ROUTE.marks, icon: "marks", badge: badges.marks },
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
  action: { label: string; onClick: () => void };
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
          placeholder="Search classes or subjects"
          aria-label="Search classes"
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
        <button type="button" className="ss-h-primary" onClick={action.onClick}>
          <Icon name="attendance" size={16} />
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
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

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

function ClassCard({
  c,
  onGo,
  onRoster,
}: {
  c: ClassRow;
  onGo: (route: string, key: string) => void;
  onRoster: (id: string) => void;
}) {
  const ch = change(c.mean - c.previousMean, " pts");
  const marksDone = c.marksSubmitted >= 100;
  const lowAtt = c.attendance < 90;
  const q = `?class=${encodeURIComponent(c.id)}`;

  return (
    <article className="ss-card cl-card">
      <div className="cl-head">
        <span className="cl-badge" aria-hidden="true">
          {c.id}
        </span>
        <div className="cl-title">
          <h3>{c.name}</h3>
          <small>{c.subject}</small>
        </div>
        {c.classTeacher ? <span className="ss-tag">Class teacher</span> : null}
      </div>

      <div className="cl-stats">
        <div>
          <span>Learners</span>
          <b>{c.learners}</b>
        </div>
        <div>
          <span>Mean</span>
          <b>{c.mean}%</b>
          <small className={`ss-result-change ${ch.kind}`}>{ch.label}</small>
        </div>
        <div className={lowAtt ? "is-low" : ""}>
          <span>Attendance</span>
          <b>{c.attendance}%</b>
          <small>{lowAtt ? "Below 90%" : "On track"}</small>
        </div>
      </div>

      <div className="cl-line">
        <div className="cl-line-top">
          <span>Marks entered</span>
          <span className={`ss-tag ${marksDone ? "ok" : "warn"}`}>{marksDone ? "Complete" : `${c.marksSubmitted}%`}</span>
        </div>
        <div className="ss-bar" role="progressbar" aria-valuenow={c.marksSubmitted} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} marks entered`}>
          <i style={{ width: `${c.marksSubmitted}%` }} />
        </div>
      </div>

      <div className="cl-trend">
        <div>
          <span className="cl-trend-label">Class mean trend</span>
          {c.nextLesson ? (
            <small className="cl-next">
              <Icon name="timetable" size={14} /> {c.nextLesson}
            </small>
          ) : null}
        </div>
        <Sparkline points={c.trend} label={`${c.name} class mean over recent assessments`} />
      </div>

      <div className="cl-actions">
        <button type="button" className="ss-btn ss-btn-primary ss-btn-sm" onClick={() => onGo(`${ROUTE.attendance}${q}`, "attendance")}>
          Take register
        </button>
        <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(`${ROUTE.marks}${q}`, "marks-entry")}>
          Upload marks
        </button>
        <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(`${ROUTE.results}${q}`, "results")}>
          Results
        </button>
        <button type="button" className="ss-link-btn" onClick={() => onRoster(c.id)}>
          View learners
        </button>
      </div>
    </article>
  );
}

function ClassTable({
  rows,
  onGo,
  onRoster,
}: {
  rows: ClassRow[];
  onGo: (route: string, key: string) => void;
  onRoster: (id: string) => void;
}) {
  return (
    <section className="ss-card ss-panel" aria-label="Classes table">
      <div className="ss-pbody">
        <div className="ss-scroll">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Class</th>
                <th className="ss-num">Learners</th>
                <th className="ss-num">Mean</th>
                <th className="ss-num">Attendance</th>
                <th>Marks entered</th>
                <th>Next lesson</th>
                <th>
                  <span className="ss-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const ch = change(c.mean - c.previousMean, " pts");
                const q = `?class=${encodeURIComponent(c.id)}`;
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <br />
                      <small>{c.subject}</small>
                    </td>
                    <td className="ss-num">{c.learners}</td>
                    <td className="ss-num">
                      {c.mean}%
                      <br />
                      <small className={`ss-result-change ${ch.kind}`}>{ch.label}</small>
                    </td>
                    <td className="ss-num">{c.attendance}%</td>
                    <td>
                      <div className="ss-bar sm" role="progressbar" aria-valuenow={c.marksSubmitted} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} marks entered`}>
                        <i style={{ width: `${c.marksSubmitted}%` }} />
                      </div>
                      <small>{c.marksSubmitted}%</small>
                    </td>
                    <td>
                      <small>{c.nextLesson ?? "None scheduled"}</small>
                    </td>
                    <td>
                      <div className="cl-row-actions">
                        <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(`${ROUTE.attendance}${q}`, "attendance")}>
                          Register
                        </button>
                        <button type="button" className="ss-btn ss-btn-sm" onClick={() => onRoster(c.id)}>
                          Learners
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RosterDrawer({
  cls,
  onClose,
  onGo,
}: {
  cls: ClassRow;
  onClose: () => void;
  onGo: (route: string, key: string) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = term ? cls.roster.filter((l) => l.name.toLowerCase().includes(term) || l.admNo.includes(term)) : cls.roster;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="cl-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="cl-drawer" role="dialog" aria-modal="true" aria-label={`${cls.name} learners`}>
        <header className="cl-drawer-head">
          <div>
            <h3>{cls.name}</h3>
            <small>
              {cls.subject} · {cls.learners} learners
            </small>
          </div>
          <button type="button" className="ss-h-icon" aria-label="Close learners list" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <label className="ss-lab" htmlFor="cl-roster-q">
          Find a learner
          <input id="cl-roster-q" className="ss-input" type="search" placeholder="Name or admission number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {list.length ? (
          <ul className="ss-list cl-roster">
            {list.map((l) => (
              <li key={l.id}>
                <span className="cl-av" aria-hidden="true">
                  {initials(l.name)}
                </span>
                <div>
                  <strong>{l.name}</strong>
                  <small>Adm. {l.admNo}</small>
                </div>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => onGo(`${ROUTE.students}?adm=${encodeURIComponent(l.admNo)}`, "students")}>
                  Profile
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ss-empty">No learner matches “{q.trim()}”.</p>
        )}

        <div className="cl-drawer-foot">
          <button type="button" className="ss-btn ss-btn-primary" onClick={() => onGo(`${ROUTE.students}?class=${encodeURIComponent(cls.id)}`, "students")}>
            Open full learner list
          </button>
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Classes({ data = SAMPLE, user, theme = "light", onNavigate, onLogout }: ClassesProps) {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [rosterOf, setRosterOf] = useState<string | null>(null);

  const me: TeacherUser = user ?? { name: "Teacher", roleLabel: "Subject teacher" };

  const go = (route: string, key: string) => {
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  const subjects = useMemo(() => Array.from(new Set(data.map((c) => c.subject))).sort(), [data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = data.filter(
      (c) =>
        (subject === "all" || c.subject === subject) &&
        (!term || c.name.toLowerCase().includes(term) || c.subject.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "mean") return b.mean - a.mean;
      if (sort === "attendance") return b.attendance - a.attendance;
      if (sort === "marks") return a.marksSubmitted - b.marksSubmitted;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [data, q, subject, sort]);

  const totalLearners = sum(data.map((c) => c.learners));
  const weighted = (pick: (c: ClassRow) => number) => (totalLearners ? Math.round(sum(data.map((c) => pick(c) * c.learners)) / totalLearners) : 0);
  const avgMean = weighted((c) => c.mean);
  const avgAttendance = weighted((c) => c.attendance);
  const marksPending = data.filter((c) => c.marksSubmitted < 100).length;

  const menu = useMemo(() => buildMenu({ marks: marksPending }), [marksPending]);
  const dateLabel = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const rosterClass = data.find((c) => c.id === rosterOf) ?? null;

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} user={me} open={sidebarOpen} activeKey="classes" onClose={() => setSidebarOpen(false)} onGo={go} />
      <div className={`ss-scrim${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <Header
          title="My classes"
          dateLabel={dateLabel}
          user={me}
          action={{ label: "Take register", onClick: () => go(ROUTE.attendance, "attendance") }}
          onOpenMenu={() => setSidebarOpen(true)}
          onSearch={setQ}
          onGo={go}
          onLogout={onLogout}
        />

        <main className="ss-content" id="main">
          <div className="ss-sec-head">
            <h2>My classes</h2>
            <p>Every class you teach, with its latest numbers and the shortcuts you use most.</p>
          </div>

          <section className="ss-kpis" aria-label="Summary">
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">
                <Icon name="classes" size={16} /> Classes
              </span>
              <b>{data.length}</b>
              <small>{subjects.length} {subjects.length === 1 ? "subject" : "subjects"}</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">
                <Icon name="students" size={16} /> Learners
              </span>
              <b>{totalLearners}</b>
              <small>Across all your classes</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">
                <Icon name="results" size={16} /> Average mean
              </span>
              <b>{avgMean}%</b>
              <small>Weighted by class size</small>
            </article>
            <article className="ss-card ss-kpi">
              <span className="ss-kpi-label">
                <Icon name="attendance" size={16} /> Average attendance
              </span>
              <b>{avgAttendance}%</b>
              <small>{marksPending ? `${marksPending} ${marksPending === 1 ? "class has" : "classes have"} marks still to enter` : "All marks entered"}</small>
            </article>
          </section>

          <section className="ss-card cl-toolbar" aria-label="Filter and sort classes">
            <label className="ss-lab cl-search">
              Search
              <input className="ss-input" type="search" placeholder="Class or subject" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <label className="ss-lab">
              Subject
              <select className="ss-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">All subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="ss-lab">
              Sort by
              <select className="ss-input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="ss-seg ss-seg-lg cl-view" role="group" aria-label="View">
              <button type="button" className={view === "cards" ? "is-on" : ""} aria-pressed={view === "cards"} onClick={() => setView("cards")}>
                Cards
              </button>
              <button type="button" className={view === "table" ? "is-on" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}>
                Table
              </button>
            </div>
          </section>

          <p className="ss-count" role="status">
            Showing {rows.length} of {data.length} {data.length === 1 ? "class" : "classes"}
          </p>

          {rows.length === 0 ? (
            <div className="ss-card cl-empty">
              <Icon name="classes" size={28} />
              <h3>No classes match</h3>
              <p>Try a different search or show all subjects.</p>
              <button
                type="button"
                className="ss-btn"
                onClick={() => {
                  setQ("");
                  setSubject("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : view === "cards" ? (
            <div className="cl-grid">
              {rows.map((c) => (
                <ClassCard key={c.id} c={c} onGo={go} onRoster={setRosterOf} />
              ))}
            </div>
          ) : (
            <ClassTable rows={rows} onGo={go} onRoster={setRosterOf} />
          )}
        </main>
      </div>

      {rosterClass ? <RosterDrawer cls={rosterClass} onClose={() => setRosterOf(null)} onGo={go} /> : null}
    </div>
  );
}