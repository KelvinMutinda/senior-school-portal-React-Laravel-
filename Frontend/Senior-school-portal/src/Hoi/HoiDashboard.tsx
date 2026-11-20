import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderSection, { type Theme, type HeaderAction } from "../components/HeaderSection";


export type Role = "HOI" | "DEPUTY" | "TEACHER" | "FINANCE";

export interface LayoutUser {
  name: string;
  roleLabel: string;
  avatarUrl?: string;
}

export interface MenuItem {
  key: string;
  label: string;
  desc: string;
  route: string;
  perm: string;
  icon: IconName;
  badge?: string; // key into the badges map
  soon?: boolean; // no page exists in App.tsx yet, so the item is shown but disabled
}

export interface MenuGroup {
  group: string;
  items: MenuItem[];
}

/* ---------- Icons ---------- */

const PATHS = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  check: "M20 6L9 17l-5-5",
  shieldCheck: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  chart: "M3 3v18h18 M7 15l4-4 3 3 5-6",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M21 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  calendar: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4",
  clipboard: "M9 4h6v3H9z M7 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2 M8 12h8 M8 16h5",
  pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 17h4",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z M4 19.5V21h16",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7l2-3h12 M16 14h2",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z M9 8h6 M9 12h6",
  alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
  scale: "M12 3v18 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7 M12 17h.01",
  sparkles: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  toggle: "M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7z M17 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z M15 9a4 4 0 0 1 0 6",
  userCog: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 11v4 M17 13h4",
  audit: "M9 3h6l1 2h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3z M9 13l2 2 4-4",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  cap: "M22 10L12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5",
  close: "M18 6L6 18 M6 6l12 12",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
} as const;

export type IconName = keyof typeof PATHS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- 1. Menu and permissions ----------
   Routes match App.tsx. Items marked `soon` have no page in App.tsx yet,
   so they are shown disabled. Remove `soon` and set the route once the page exists.
   Finance items point to the HOI pages in Hoi/Finances. */

export const MENU: MenuGroup[] = [
  { group: "Overview", items: [
    { key: "dashboard", label: "Dashboard", desc: "School overview", route: "/Hoi/Dashboard", perm: "dashboard.view", icon: "home" },
    { key: "approvals", label: "Approvals", desc: "Marks, reports, waivers, reversals", route: "/Hoi/Approvals", perm: "approvals.review", icon: "shieldCheck", badge: "approvals" },
  ] },
  { group: "Academics", items: [
    { key: "academic", label: "Academic Overview", desc: "Class and stream performance", route: "/Academic/Overview", perm: "academic.overview", icon: "chart" },
    { key: "classes", label: "My Classes", desc: "Class lists, subjects, timetable", route: "/Academics/classes", perm: "classes.view", icon: "users" },
    { key: "timetable", label: "Classes and Timetable", desc: "Lessons, rooms, teacher assignments", route: "/Academics/Timetable", perm: "timetable.manage", icon: "calendar" },
    { key: "students", label: "Students", desc: "Learner directory and profiles", route: "/Students", perm: "students.view", icon: "cap" },
    { key: "students-fee", label: "Students (fee view)", desc: "Name, class, guardian, balance", route: "", perm: "students.fee", icon: "cap", soon: true },
    { key: "subjects", label: "Subjects", desc: "Add and manage subjects", route: "/add/Subjects", perm: "subjects.manage", icon: "book" },
    { key: "attendance", label: "Attendance", desc: "Registers, analytics, exceptions", route: "/Academics/Attendance", perm: "attendance.view", icon: "clipboard" },
    { key: "marks-entry", label: "Marks Entry", desc: "Enter, upload and submit marks", route: "/Results/Upload/Results", perm: "marks.enter", icon: "pen", badge: "marks" },
    { key: "marks-review", label: "Marks and Report Cards", desc: "Review, approve and publish", route: "/Results/View/Results", perm: "marks.review", icon: "file" },
    { key: "comments", label: "Report Comments", desc: "Overall comments and conduct", route: "", perm: "report.comment", icon: "book", soon: true },
  ] },
  { group: "Finance", items: [
    { key: "fin-overview", label: "Finance Overview", desc: "School finances at a glance", route: "/Hoi/Finances", perm: "finance.overview", icon: "wallet" },
    { key: "fees", label: "Fee Management", desc: "Fee structures and items", route: "/Hoi/Finances/Fee", perm: "fees.view", icon: "file" },
    { key: "invoices", label: "Invoices", desc: "Generate, view, void", route: "", perm: "invoices.view", icon: "file", soon: true },
    { key: "payments", label: "Payments and Receipts", desc: "Transactions and receipts", route: "/Hoi/Finances/Payments", perm: "payments.view", icon: "receipt" },
    { key: "overdue", label: "Outstanding and Overdue", desc: "Balances by learner and age", route: "", perm: "outstanding.view", icon: "alert", badge: "overdue", soon: true },
    { key: "reconcile", label: "Reconciliation", desc: "Statement matching, period lock", route: "", perm: "reconcile.view", icon: "scale", soon: true },
    { key: "queries", label: "Fee Queries", desc: "Tickets from learners and parents", route: "", perm: "feequeries.view", icon: "help", badge: "queries", soon: true },
    { key: "fin-reports", label: "Financial Reports", desc: "Expected vs collected, exports", route: "/Finance/Reports", perm: "reports.finance", icon: "chart" },
  ] },
  { group: "AI", items: [
    { key: "ai-tools", label: "AI Tools", desc: "Material and quiz generators, Q and A", route: "/AI/Chat", perm: "ai.tools", icon: "sparkles" },
    { key: "ai-insights", label: "AI Insights", desc: "Weak topics, usage, engagement", route: "/Hoi/AI/Insights", perm: "ai.insights", icon: "bolt" },
    { key: "ai-controls", label: "AI Controls", desc: "Enable, restrict or disable features", route: "/Hoi/AI/Controls", perm: "ai.controls", icon: "toggle" },
  ] },
  { group: "Communication", items: [
    { key: "announcements", label: "Announcements", desc: "Notices and publishing", route: "/Announcements", perm: "announcements.view", icon: "megaphone" },
  ] },
  { group: "Administration", items: [
    { key: "register-teacher", label: "Register Teacher", desc: "Onboard a new teacher or staff member", route: "/Register/Teacher", perm: "users.manage", icon: "userCog" },
    { key: "register-learner", label: "Register Learner", desc: "Admit and register a new learner", route: "/Register/Learner", perm: "users.manage", icon: "user" },
    { key: "audit", label: "Audit Log and Settings", desc: "Read-only trail, terms, grading", route: "/Hoi/Audit", perm: "audit.view", icon: "audit" },
  ] },
  { group: "Account", items: [
    { key: "profile", label: "My Profile", desc: "Details and password", route: "", perm: "profile.view", icon: "user", soon: true },
  ] },
];

export const ROLE_PERMS: Record<Role, string[]> = {
  HOI: [
    "dashboard.view", "approvals.review", "academic.overview", "students.view", "subjects.manage", "attendance.view",
    "marks.review", "finance.overview", "fees.view", "payments.view", "reports.finance", "ai.insights", "ai.controls",
    "messages.use", "announcements.view", "users.manage", "audit.view", "profile.view",
  ],
  DEPUTY: [
    "dashboard.view", "approvals.review", "classes.view", "timetable.manage", "students.view",
    "attendance.view", "marks.review", "ai.insights", "messages.use", "announcements.view", "profile.view",
  ],
  TEACHER: [
    "dashboard.view", "classes.view", "students.view", "attendance.view", "marks.enter", "ai.tools",
    "ai.insights", "messages.use", "announcements.view", "profile.view",
  ],
  FINANCE: [
    "dashboard.view", "students.fee", "finance.overview", "fees.view", "invoices.view", "payments.view", "outstanding.view",
    "reconcile.view", "feequeries.view", "reports.finance", "messages.use", "announcements.view", "profile.view",
  ],
};

/** Filters MENU by the role's permissions and hides empty groups. */
export function buildMenu(role: Role, extraPerms: string[] = []): MenuGroup[] {
  const perms = new Set([...ROLE_PERMS[role], ...extraPerms]);
  return MENU
    .map((g) => ({ ...g, items: g.items.filter((i) => perms.has(i.perm)) }))
    .filter((g) => g.items.length > 0);
}

/* ---------- 2. Sidebar ---------- */

interface SidebarProps {
  menu: MenuGroup[];
  activeKey: string;
  badges: Record<string, number>;
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string, key: string) => void;
  schoolName: string;
  motto: string;
}

export function Sidebar({ menu, activeKey, badges, open, onClose, onNavigate, schoolName, motto }: SidebarProps) {
  const [first, ...rest] = schoolName.split(" ");
  return (
    <>
      <div className={`ss-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`ss-sidebar ${open ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="ss-brand">
          <span className="ss-logo"><Icon name="cap" size={22} /></span>
          <span className="ss-brand-text">
            <strong>{first}</strong>
            <em>{rest.join(" ")}</em>
            <small>{motto}</small>
          </span>
          <button type="button" className="ss-close" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
        </div>

        <nav className="ss-nav">
          {menu.map((g) => (
            <div className="ss-group" key={g.group}>
              <p className="ss-group-label">{g.group}</p>
              {g.items.map((item) => {
                if (item.soon) {
                  return (
                    <span key={item.key} className="ss-link is-soon" aria-disabled="true" title="Coming soon">
                      <Icon name={item.icon} size={17} />
                      <span>{item.label}</span>
                      <b className="ss-soon">Soon</b>
                    </span>
                  );
                }
                const count = item.badge ? badges[item.badge] ?? 0 : 0;
                const active = item.key === activeKey;
                return (
                  <a
                    key={item.key}
                    href={item.route}
                    className={`ss-link ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => { e.preventDefault(); onNavigate(item.route, item.key); onClose(); }}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                    {count > 0 && <b className="ss-badge">{count > 99 ? "99+" : count}</b>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="ss-side-foot">Senior School Portal · v1.0</div>
      </aside>
    </>
  );
}

/* ---------- 3. Layout shell ---------- */

interface LayoutProps {
  role: Role;
  user: LayoutUser;
  title: string;
  children: React.ReactNode;
  isClassTeacher?: boolean; // adds the Report Comments item for teachers
  activeKey?: string; // optional: when omitted it is detected from the current URL
  badges?: Record<string, number>;
  notifications?: number;
  schoolName?: string;
  motto?: string;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  headerAction?: HeaderAction;
}

export function DashboardLayout({
  role, user, title, children, isClassTeacher, activeKey, badges = {}, notifications = 0,
  schoolName = "Stephen Kanja Senior School", motto = "AIM HIGHER", onNavigate, onLogout, headerAction,
}: LayoutProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menu = useMemo(
    () => buildMenu(role, role === "TEACHER" && isClassTeacher ? ["report.comment"] : []),
    [role, isClassTeacher],
  );

  // Highlight the sidebar item that matches the current URL (case-insensitive)
  const currentKey = useMemo(() => {
    if (activeKey) return activeKey;
    const path = location.pathname.toLowerCase().replace(/\/+$/, "");
    const hit = menu
      .flatMap((g) => g.items)
      .find((i) => !i.soon && i.route && i.route.toLowerCase() === path);
    return hit?.key ?? "dashboard";
  }, [activeKey, location.pathname, menu]);

  const go = (route: string, key: string) => {
    if (!route) return;
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  const logout = () => {
    if (onLogout) onLogout();
    else navigate("/auth/Login");
  };

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} activeKey={currentKey} badges={badges} open={open} onClose={() => setOpen(false)}
        onNavigate={go} schoolName={schoolName} motto={motto} />
      <div className="ss-main">
        <HeaderSection
          title={title}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          onMenuClick={() => setOpen(true)}
          primaryAction={headerAction}
          notifications={notifications}
          onProfile={() => {}}
          onLogout={logout}
        />
        <main className="ss-content">{children}</main>
      </div>
    </div>
  );
}

/* ---------- 4. HOI dashboard page ---------- */

export interface Pathway {
  id: string;
  name: string;
  icon: IconName;
  summary: string;
  tracks: string[];
  learners?: number; // optional: learners enrolled in this pathway
}

export interface HoiData {
  learners: number;
  teachers: number; // teachers and support staff
  classes: number;
  pathways: Pathway[];
}

/* Sample data - replace with API results */
const SAMPLE: HoiData = {
  learners: 412,
  teachers: 26,
  classes: 9,
  pathways: [
    {
      id: "stem",
      name: "STEM",
      icon: "bolt",
      summary: "Science, technology, engineering and mathematics.",
      tracks: ["Pure Sciences", "Applied Sciences", "Technical Engineering", "Career and Technology Studies"],
      learners: 168,
    },
    {
      id: "social",
      name: "Social Sciences",
      icon: "book",
      summary: "Languages, humanities and business studies.",
      tracks: ["Languages and Literature", "Humanities and Business Studies", "Religious Studies"],
      learners: 142,
    },
    {
      id: "arts",
      name: "Arts and Sports Science",
      icon: "sparkles",
      summary: "Creative arts, performance and sports.",
      tracks: ["Music and Dance", "Theatre and Film", "Fine Art", "Sports Science"],
      learners: 102,
    },
  ],
};

interface HoiProps {
  data?: HoiData;
  user?: LayoutUser;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
}

function HoiDashboard({
  data = SAMPLE,
  user = { name: "Head of Institution", roleLabel: "HOI", avatarUrl: undefined },
  onNavigate, onLogout,
}: HoiProps) {
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const menu = useMemo(() => buildMenu("HOI"), []);

  const go = (route: string, key = "") => {
    if (!route) return;
    if (onNavigate) onNavigate(route, key);
    else navigate(route);
  };

  // Quick navigation: only working pages, skipping Overview and Account
  const quick = menu
    .filter((g) => g.group !== "Overview" && g.group !== "Account")
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.soon && `${i.label} ${i.desc}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const stats: { label: string; value: number; icon: IconName; route: string }[] = [
    { label: "Learners", value: data.learners, icon: "cap", route: "/Students" },
    { label: "Teachers / Staff", value: data.teachers, icon: "users", route: "/Register/Teacher" },
    { label: "Classes", value: data.classes, icon: "book", route: "/Academic/Overview" },
  ];

  return (
    <DashboardLayout
      role="HOI"
      user={user}
      title="Head of Institution Dashboard"
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerAction={{ label: "Announcements", icon: "megaphone", onClick: () => go("/Announcements", "announcements") }}
    >
      {/* School at a glance */}
      <section className="ss-glance" aria-label="School at a glance">
        <div className="ss-stats">
          {stats.map((s) => (
            <button key={s.label} type="button" className="ss-card ss-stat" onClick={() => go(s.route)}>
              <span className="ss-stat-icon"><Icon name={s.icon} size={22} /></span>
              <span className="ss-stat-body">
                <small>{s.label}</small>
                <b>{s.value.toLocaleString()}</b>
              </span>
            </button>
          ))}
        </div>

        <article className="ss-card ss-panel ss-pathways">
          <header>
            <h3>Pathways offered</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/Explore/Pathways")}>
              Explore pathways <Icon name="arrow" size={14} />
            </button>
          </header>
          <div className="ss-pathway-grid">
            {data.pathways.map((p) => (
              <div key={p.id} className="ss-pathway">
                <div className="ss-pathway-top">
                  <span className="ss-pathway-icon"><Icon name={p.icon} size={18} /></span>
                  <div>
                    <strong>{p.name}</strong>
                    {p.learners !== undefined && <small>{p.learners} learners</small>}
                  </div>
                </div>
                <p>{p.summary}</p>
                <ul className="ss-chips">
                  {p.tracks.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Quick navigation */}
      <section className="ss-quick">
        <div className="ss-quick-head">
          <h2><span className="ss-bolt"><Icon name="bolt" size={16} /></span> Quick navigation</h2>
          <div className="ss-quick-search">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search tools..." aria-label="Search tools" />
          </div>
        </div>
        {quick.length === 0 && <p className="ss-empty">No tools match your search.</p>}
        {quick.map((g) => (
          <div key={g.group} className="ss-quick-group">
            <p className="ss-quick-label"><span>{g.group}</span><i /><b>{g.items.length}</b></p>
            <div className="ss-tiles">
              {g.items.map((i) => (
                <button key={i.key} type="button" className="ss-tile" onClick={() => go(i.route, i.key)}>
                  <span className="ss-tile-icon"><Icon name={i.icon} size={18} /></span>
                  <span><strong>{i.label}</strong><small>{i.desc}</small></span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </DashboardLayout>
  );
}

export default HoiDashboard;