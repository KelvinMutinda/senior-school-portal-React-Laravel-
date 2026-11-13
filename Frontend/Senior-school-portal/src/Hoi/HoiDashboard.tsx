import React, { useMemo, useState } from "react";
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

/* ---------- 1. Menu and permissions ---------- */

export const MENU: MenuGroup[] = [
  { group: "Overview", items: [
    { key: "dashboard", label: "Dashboard", desc: "School overview and alerts", route: "/dashboard", perm: "dashboard.view", icon: "home" },
    { key: "approvals", label: "Approvals", desc: "Marks, reports, waivers, reversals", route: "/approvals", perm: "approvals.review", icon: "shieldCheck", badge: "approvals" },
  ] },
  { group: "Academics", items: [
    { key: "academic", label: "Academic Overview", desc: "Class and stream performance", route: "/academics/overview", perm: "academic.overview", icon: "chart" },
    { key: "classes", label: "My Classes", desc: "Class lists, subjects, timetable", route: "/academics/classes", perm: "classes.view", icon: "users" },
    { key: "timetable", label: "Classes and Timetable", desc: "Lessons, rooms, teacher assignments", route: "/academics/timetable", perm: "timetable.manage", icon: "calendar" },
    { key: "students", label: "Students", desc: "Learner directory and profiles", route: "/academics/students", perm: "students.view", icon: "cap" },
    { key: "students-fee", label: "Students (fee view)", desc: "Name, class, guardian, balance", route: "/finance/students", perm: "students.fee", icon: "cap" },
    { key: "attendance", label: "Attendance", desc: "Registers, analytics, exceptions", route: "/academics/attendance", perm: "attendance.view", icon: "clipboard" },
    { key: "marks-entry", label: "Marks Entry", desc: "Enter, upload and submit marks", route: "/academics/marks", perm: "marks.enter", icon: "pen", badge: "marks" },
    { key: "marks-review", label: "Marks and Report Cards", desc: "Review, approve and publish", route: "/academics/review", perm: "marks.review", icon: "file" },
    { key: "comments", label: "Report Comments", desc: "Overall comments and conduct", route: "/academics/comments", perm: "report.comment", icon: "book" },
  ] },
  { group: "Finance", items: [
    { key: "fees", label: "Fee Management", desc: "Structures, items, discounts, approval", route: "/finance/fees", perm: "fees.view", icon: "wallet" },
    { key: "invoices", label: "Invoices", desc: "Generate, view, void", route: "/finance/invoices", perm: "invoices.view", icon: "file" },
    { key: "payments", label: "Payments and Receipts", desc: "Transactions and receipts", route: "/finance/payments", perm: "payments.view", icon: "receipt" },
    { key: "overdue", label: "Outstanding and Overdue", desc: "Balances by learner and age", route: "/finance/overdue", perm: "outstanding.view", icon: "alert", badge: "overdue" },
    { key: "reconcile", label: "Reconciliation", desc: "Statement matching, period lock", route: "/finance/reconciliation", perm: "reconcile.view", icon: "scale" },
    { key: "queries", label: "Fee Queries", desc: "Tickets from learners and parents", route: "/finance/queries", perm: "feequeries.view", icon: "help", badge: "queries" },
    { key: "fin-reports", label: "Financial Reports", desc: "Expected vs collected, exports", route: "/finance/reports", perm: "reports.finance", icon: "chart" },
  ] },
  { group: "AI", items: [
    { key: "ai-tools", label: "AI Tools", desc: "Material and quiz generators, Q and A", route: "/ai/tools", perm: "ai.tools", icon: "sparkles" },
    { key: "ai-insights", label: "AI Insights", desc: "Weak topics, usage, engagement", route: "/ai/insights", perm: "ai.insights", icon: "bolt" },
    { key: "ai-controls", label: "AI Controls", desc: "Enable, restrict or disable features", route: "/ai/controls", perm: "ai.controls", icon: "toggle" },
  ] },
  { group: "Communication", items: [
    { key: "messages", label: "Messages", desc: "Direct messages", route: "/messages", perm: "messages.use", icon: "message", badge: "messages" },
    { key: "announcements", label: "Announcements", desc: "Notices and publishing", route: "/announcements", perm: "announcements.view", icon: "megaphone" },
  ] },
  { group: "Administration", items: [
    { key: "users", label: "User Management", desc: "Onboarding, suspension, role requests", route: "/admin/users", perm: "users.manage", icon: "userCog" },
    { key: "audit", label: "Audit Log and Settings", desc: "Read-only trail, terms, grading", route: "/admin/audit", perm: "audit.view", icon: "audit" },
  ] },
  { group: "Account", items: [
    { key: "profile", label: "My Profile", desc: "Details and password", route: "/profile", perm: "profile.view", icon: "user" },
  ] },
];

export const ROLE_PERMS: Record<Role, string[]> = {
  HOI: [
    "dashboard.view", "approvals.review", "academic.overview", "students.view", "attendance.view",
    "marks.review", "fees.view", "payments.view", "reports.finance", "ai.insights", "ai.controls",
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
    "dashboard.view", "students.fee", "fees.view", "invoices.view", "payments.view", "outstanding.view",
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
  activeKey?: string;
  badges?: Record<string, number>;
  notifications?: number;
  schoolName?: string;
  motto?: string;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  headerAction?: HeaderAction;
}

export function DashboardLayout({
  role, user, title, children, isClassTeacher, activeKey = "dashboard", badges = {}, notifications = 0,
  schoolName = "Stephen Kanja Senior School", motto = "AIM HIGHER", onNavigate, onLogout, headerAction,
}: LayoutProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [open, setOpen] = useState(false);
  const menu = useMemo(
    () => buildMenu(role, role === "TEACHER" && isClassTeacher ? ["report.comment"] : []),
    [role, isClassTeacher],
  );
  const go = (route: string, key: string) => onNavigate?.(route, key);

  return (
    <div className="ss-shell" data-theme={theme}>
      <Sidebar menu={menu} activeKey={activeKey} badges={badges} open={open} onClose={() => setOpen(false)}
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
          onProfile={() => go("/profile", "profile")}
          onLogout={onLogout}
        />
        <main className="ss-content">{children}</main>
      </div>
    </div>
  );
}

/* ---------- 4. HOI dashboard page ---------- */

interface Approval { id: string; title: string; type: string; from: string; age: string; level: "Final" | "Escalated"; }
interface AlertItem { id: string; text: string; tone: "danger" | "warn" | "info"; route: string; }
interface ClassStat { name: string; mean: number; attendance: number; marksSubmitted: number; }
interface Activity { id: string; text: string; when: string; }

export interface HoiData {
  learners: number;
  teachers: number;
  classes: number;
  attendanceToday: number;
  collectionRate: number;
  collected: string;
  expected: string;
  marksSubmittedPct: number;
  aiAdoptionPct: number;
  approvals: Approval[];
  alerts: AlertItem[];
  classStats: ClassStat[];
  activity: Activity[];
}

/* Sample data - replace with API results */
const SAMPLE: HoiData = {
  learners: 412, teachers: 26, classes: 9,
  attendanceToday: 94, collectionRate: 78, collected: "KES 6.1M", expected: "KES 7.8M",
  marksSubmittedPct: 84, aiAdoptionPct: 61,
  approvals: [
    { id: "a1", title: "Grade 11 Mathematics, End of Term 3", type: "Marks release", from: "Deputy: J. Mwangi", age: "1 day", level: "Final" },
    { id: "a2", title: "Term 4 fee structure, Grade 10", type: "Fee structure", from: "Finance Officer", age: "2 days", level: "Final" },
    { id: "a3", title: "Hardship waiver, Adm. 1042", type: "Waiver", from: "Finance Officer", age: "3 days", level: "Escalated" },
    { id: "a4", title: "Reverse receipt RC-20931", type: "Payment reversal", from: "Finance Officer", age: "5 hours", level: "Final" },
  ],
  alerts: [
    { id: "x1", text: "Grade 12B attendance dropped below 85% this week", tone: "danger", route: "/academics/attendance" },
    { id: "x2", text: "23 learners have invoices overdue by more than 30 days", tone: "warn", route: "/finance/overdue" },
    { id: "x3", text: "2 AI outputs were flagged by teachers for review", tone: "info", route: "/ai/controls" },
  ],
  classStats: [
    { name: "Grade 10", mean: 58, attendance: 95, marksSubmitted: 91 },
    { name: "Grade 11", mean: 61, attendance: 93, marksSubmitted: 82 },
    { name: "Grade 12", mean: 64, attendance: 92, marksSubmitted: 79 },
  ],
  activity: [
    { id: "r1", text: "Marks for Grade 10 Biology submitted by Ms. Wanjiru", when: "12 min ago" },
    { id: "r2", text: "Payment of KES 18,500 recorded, receipt RC-20944", when: "40 min ago" },
    { id: "r3", text: "New teacher account created: Mr. Kiprono", when: "2 hours ago" },
    { id: "r4", text: "Grade 11 timetable updated by the Deputy", when: "Yesterday" },
  ],
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

interface HoiProps {
  data?: HoiData;
  user?: LayoutUser;
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  onPublishAnnouncement?: (audience: string, message: string) => void | Promise<void>;
}

function HoiDashboard({
  data = SAMPLE,
  user = { name: "Head of Institution", roleLabel: "HOI", avatarUrl: undefined },
  onNavigate, onLogout, onPublishAnnouncement,
}: HoiProps) {
  const [filter, setFilter] = useState("");
  const [audience, setAudience] = useState("School-wide");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const menu = useMemo(() => buildMenu("HOI"), []);
  const go = (route: string, key = "") => onNavigate?.(route, key);

  const quick = menu
    .filter((g) => g.group !== "Overview" && g.group !== "Account")
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => `${i.label} ${i.desc}`.toLowerCase().includes(filter.toLowerCase())),
    }))
    .filter((g) => g.items.length > 0);

  const publish = async () => {
    if (!message.trim()) return;
    await onPublishAnnouncement?.(audience, message.trim());
    setMessage("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <DashboardLayout
      role="HOI"
      user={user}
      title="Head of Institution Dashboard"
      activeKey="dashboard"
      notifications={data.approvals.length + data.alerts.length}
      badges={{ approvals: data.approvals.length, overdue: 23, queries: 5, messages: 3 }}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerAction={{ label: "Approvals", icon: "check", onClick: () => go("/approvals", "approvals") }}
    >
      {/* Hero */}
      <section className="ss-hero">
        <div className="ss-hero-text">
          <span className="ss-eyebrow">Head of Institution</span>
          <h2>{greeting()}, welcome back</h2>
          <p>
            Senior School overview for Grades 10 to 12. You have{" "}
            <strong>{data.approvals.length} approvals</strong> waiting and{" "}
            <strong>{data.alerts.length} alerts</strong> that need attention.
          </p>
          <div className="ss-hero-btns">
            <button type="button" className="ss-btn ss-btn-gold" onClick={() => go("/approvals", "approvals")}>Open approvals</button>
            <button type="button" className="ss-btn ss-btn-ghost" onClick={() => go("/academics/overview", "academic")}>Academic overview</button>
          </div>
        </div>
        <div className="ss-hero-stats">
          <div><span>Learners</span><b>{data.learners}</b></div>
          <div><span>Teachers</span><b>{data.teachers}</b></div>
          <div><span>Classes</span><b>{data.classes}</b></div>
        </div>
      </section>

      {/* KPI row */}
      <section className="ss-kpis" aria-label="Key indicators">
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label"><Icon name="clipboard" size={15} /> Attendance today</span>
          <b>{data.attendanceToday}%</b>
          <div className="ss-bar"><i style={{ width: `${data.attendanceToday}%` }} /></div>
          <small>School-wide, all streams</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label"><Icon name="wallet" size={15} /> Fee collection</span>
          <b>{data.collectionRate}%</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${data.collectionRate}%` }} /></div>
          <small>{data.collected} of {data.expected} expected</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label"><Icon name="pen" size={15} /> Marks submitted</span>
          <b>{data.marksSubmittedPct}%</b>
          <div className="ss-bar"><i style={{ width: `${data.marksSubmittedPct}%` }} /></div>
          <small>Current assessment cycle</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label"><Icon name="sparkles" size={15} /> AI adoption</span>
          <b>{data.aiAdoptionPct}%</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${data.aiAdoptionPct}%` }} /></div>
          <small>Learners and teachers using AI tools</small>
        </article>
      </section>

      {/* Approvals + alerts */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Pending approvals</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/approvals", "approvals")}>View all <Icon name="arrow" size={14} /></button>
          </header>
          <ul className="ss-list">
            {data.approvals.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.type} · {a.from}</small>
                </div>
                <span className="ss-age"><Icon name="clock" size={13} /> {a.age}</span>
                <span className={`ss-tag ${a.level === "Escalated" ? "warn" : ""}`}>{a.level}</span>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => go("/approvals", "approvals")}>Review</button>
              </li>
            ))}
          </ul>
        </article>

        <article className="ss-card ss-panel">
          <header><h3>Critical alerts</h3></header>
          <ul className="ss-alerts">
            {data.alerts.map((a) => (
              <li key={a.id} className={`tone-${a.tone}`}>
                <Icon name="alert" size={18} />
                <span>{a.text}</span>
                <button type="button" className="ss-link-btn" onClick={() => go(a.route)}>Open</button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* Performance + activity */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header><h3>Performance by grade</h3></header>
          <table className="ss-table">
            <thead>
              <tr><th>Grade</th><th>Mean score</th><th>Attendance</th><th>Marks submitted</th></tr>
            </thead>
            <tbody>
              {data.classStats.map((c) => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.mean}%</td>
                  <td>{c.attendance}%</td>
                  <td>
                    <div className="ss-bar sm"><i style={{ width: `${c.marksSubmitted}%` }} /></div>
                    <small>{c.marksSubmitted}%</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="ss-card ss-panel">
          <header><h3>Recent activity</h3></header>
          <ul className="ss-activity">
            {data.activity.map((a) => (
              <li key={a.id}><span className="ss-pip" /><div><p>{a.text}</p><small>{a.when}</small></div></li>
            ))}
          </ul>
        </article>
      </section>

      {/* Announcement publisher */}
      <section className="ss-card ss-panel">
        <header><h3>Publish an announcement</h3></header>
        <div className="ss-publish">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
            {["School-wide", "Grade 10", "Grade 11", "Grade 12", "Staff only", "Parents only"].map((o) => <option key={o}>{o}</option>)}
          </select>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write the notice..." />
          <button type="button" className="ss-btn ss-btn-primary" onClick={publish} disabled={!message.trim()}>
            <Icon name="send" size={15} /> Publish
          </button>
        </div>
        {sent && <p className="ss-sent" role="status">Announcement published to {audience.toLowerCase()}.</p>}
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