import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

/* Styles live in the shared portal stylesheet (section "Learner dashboard
   additions"). Import that stylesheet once at the app root. */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AttendanceCode = "P" | "L" | "A";

export interface AttendanceDay {
  day: string;
  code: AttendanceCode;
}

export interface ResultRow {
  subject: string;
  score: number;
  /** Change since the previous term, in points. */
  delta: number;
}

export interface Topic {
  subject: string;
  topic: string;
  action: string;
  key: string;
}

export interface StudyTask {
  id: string;
  day: string;
  text: string;
  mins: number;
  done: boolean;
}

export interface CareerOption {
  title: string;
  why: string;
}

export interface Notice {
  id: string;
  tag: "School" | "Class" | "Finance";
  title: string;
  meta: string;
  unread: boolean;
}

export interface LearnerDashboardData {
  learner: { firstName: string; fullName: string; classLabel: string };
  termLabel: string;
  dateLabel: string;
  attendance: { percent: number; present: number; total: number; absent: number; late: number; week: AttendanceDay[] };
  fees: { currency: string; total: number; paid: number; outstanding: number; overdue: number; dueLabel: string };
  tutor: { consentOnRecord: boolean; resumeTopic: string; resumeWhen: string; savedCount: number };
  results: { caption: string; rows: ResultRow[] };
  topics: Topic[];
  tasks: StudyTask[];
  career: { profilePercent: number; options: CareerOption[] };
  notices: Notice[];
  badges: { messages: number; announcements: number };
}

export interface LearnerDashboardProps {
  data?: LearnerDashboardData;
  theme?: "light" | "dark";
  /** Called for sidebar links and action buttons, with a key such as "results" or "fees-invoices". */
  onNavigate?: (key: string) => void;
  /** Called when a study task is ticked or unticked, so you can persist it. */
  onTaskToggle?: (id: string, done: boolean) => void;
  onAskTutor?: (question: string) => void;
}

/* ------------------------------------------------------------------ */
/* Sample data. Replace with API data.                                 */
/* ------------------------------------------------------------------ */

export const SAMPLE_DATA: LearnerDashboardData = {
  learner: { firstName: "Grace", fullName: "Grace Njeri", classLabel: "Grade 10 · East stream" },
  termLabel: "Term 3, 2026",
  dateLabel: "Saturday 14 November 2026",
  attendance: {
    percent: 94,
    present: 47,
    total: 50,
    absent: 2,
    late: 1,
    week: [
      { day: "Mon", code: "P" },
      { day: "Tue", code: "P" },
      { day: "Wed", code: "L" },
      { day: "Thu", code: "P" },
      { day: "Fri", code: "P" },
    ],
  },
  fees: { currency: "KES", total: 25000, paid: 12500, outstanding: 12500, overdue: 0, dueLabel: "28 November" },
  tutor: { consentOnRecord: true, resumeTopic: "Electromagnetic induction", resumeWhen: "Yesterday", savedCount: 7 },
  results: {
    caption: "End of Term 2 compared with Term 1",
    rows: [
      { subject: "Mathematics", score: 72, delta: 6 },
      { subject: "English", score: 68, delta: 2 },
      { subject: "Kiswahili", score: 75, delta: 0 },
      { subject: "Biology", score: 58, delta: -3 },
      { subject: "Chemistry", score: 64, delta: 4 },
      { subject: "Physics", score: 61, delta: -5 },
    ],
  },
  topics: [
    { subject: "Physics", topic: "Electromagnetic induction", action: "Try 3 practice questions", key: "quiz-physics" },
    { subject: "Biology", topic: "Monohybrid crosses", action: "Replay saved explanation", key: "tutor-saved" },
    { subject: "Chemistry", topic: "The mole concept", action: "Take a 5-question quiz", key: "quiz-chemistry" },
  ],
  tasks: [
    { id: "t1", day: "Mon", text: "Physics: induction worked examples", mins: 25, done: true },
    { id: "t2", day: "Tue", text: "Biology: genetics quiz", mins: 15, done: true },
    { id: "t3", day: "Wed", text: "Chemistry: mole concept flashcards", mins: 20, done: true },
    { id: "t4", day: "Thu", text: "Mathematics: past paper, section B", mins: 40, done: true },
    { id: "t5", day: "Fri", text: "English: summary writing practice", mins: 30, done: false },
    { id: "t6", day: "Sat", text: "Biology: review saved explanation", mins: 15, done: false },
  ],
  career: {
    profilePercent: 60,
    options: [
      { title: "Software engineering", why: "Fits your Mathematics results and your interest in solving problems step by step." },
      { title: "Civil engineering", why: "Builds on Mathematics and Physics, and your interest in designing things that last." },
      { title: "Biomedical science", why: "Matches your interest in how the body works. Biology topics are a good place to build up first." },
    ],
  },
  notices: [
    { id: "n1", tag: "School", title: "Term 3 examinations start on Monday 24 November", meta: "Head of Institution · 12 November", unread: true },
    { id: "n2", tag: "Class", title: "Physics practical on Wednesday: bring your lab coat", meta: "Class teacher, Grade 10 East · 13 November", unread: true },
    { id: "n3", tag: "Finance", title: "Term 3 fee balance is due on 28 November", meta: "Finance office · 10 November", unread: false },
  ],
  badges: { messages: 2, announcements: 2 },
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | "dashboard"
  | "profile"
  | "results"
  | "timetable"
  | "tutor"
  | "career"
  | "plan"
  | "fees"
  | "messages"
  | "announcements"
  | "privacy"
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
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  results: <path d="M5 20V11M12 20V4M19 20v-6" />,
  timetable: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  tutor: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />,
  career: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  plan: <path d="M9 6h11M9 12h11M9 18h11M4.5 6.5l1 1 2-2M4.5 12.5l1 1 2-2M4.5 18.5l1 1 2-2" />,
  fees: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
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
  privacy: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
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
  href: string;
  icon: IconName;
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function buildMenu(badges: LearnerDashboardData["badges"]): NavGroup[] {
  return [
    {
      group: "Overview",
      items: [
        { key: "dashboard", label: "Dashboard", href: "#top", icon: "dashboard" },
        { key: "profile", label: "My Profile", href: "#profile", icon: "profile" },
      ],
    },
    {
      group: "Academics",
      items: [
        { key: "results", label: "Academic Results", href: "#results", icon: "results" },
        { key: "timetable", label: "Timetable", href: "#timetable", icon: "timetable" },
      ],
    },
    {
      group: "AI",
      items: [
        { key: "tutor", label: "AI Tutor", href: "#tutor", icon: "tutor" },
        { key: "career", label: "Career Pathways", href: "#career", icon: "career" },
        { key: "plan", label: "Study Plan and Quizzes", href: "#plan", icon: "plan" },
      ],
    },
    {
      group: "Finance",
      items: [{ key: "fees", label: "My Fees / Payments", href: "#fees", icon: "fees" }],
    },
    {
      group: "Communication",
      items: [
        { key: "messages", label: "Messages", href: "#messages", icon: "messages", badge: badges.messages },
        { key: "announcements", label: "Announcements", href: "#announcements", icon: "announcements", badge: badges.announcements },
      ],
    },
    {
      group: "Account",
      items: [{ key: "privacy", label: "Settings and Privacy", href: "#privacy", icon: "privacy" }],
    },
  ];
}

interface SidebarProps {
  data: LearnerDashboardData;
  open: boolean;
  onClose: () => void;
  onNavigate?: (key: string) => void;
}

function Sidebar({ data, open, onClose, onNavigate }: SidebarProps) {
  const menu = useMemo(() => buildMenu(data.badges), [data.badges]);

  return (
    <aside id="learner-sidebar" className={`ss-sidebar${open ? " is-open" : ""}`}>
      <div className="ss-brand">
        <span className="ss-logo" aria-hidden="true">
          <strong>SP</strong>
        </span>
        <div className="ss-brand-text">
          <strong>Senior School</strong>
          <em>Learner</em>
          <small>PORTAL</small>
        </div>
        <button type="button" className="ss-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="ss-nav" aria-label="Learner navigation">
        {menu.map((group) => (
          <div className="ss-group" key={group.group}>
            <p className="ss-group-label">{group.group}</p>
            {group.items.map((item) => {
              const active = item.key === "dashboard";
              return (
                <a
                  key={item.key}
                  href={item.href}
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
                  {item.badge ? <em className="ss-badge" style={{ fontStyle: "normal" }}>{item.badge}</em> : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ss-side-foot">
        {data.learner.fullName} · {data.learner.classLabel}
      </div>
    </aside>
  );
}

function PageHeader({ dateLabel, onOpenMenu }: { dateLabel: string; onOpenMenu: () => void }) {
  return (
    <header className="ss-header">
      <button type="button" className="ss-h-icon ss-h-burger" aria-label="Open menu" aria-controls="learner-sidebar" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      <div className="ss-h-title">
        <h1>Dashboard</h1>
        <span>{dateLabel}</span>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => n.toLocaleString("en-KE");

function Hero({
  data,
  tasksLeft,
  onNavigate,
}: {
  data: LearnerDashboardData;
  tasksLeft: number;
  onNavigate?: (key: string) => void;
}) {
  const { fees, attendance } = data;
  return (
    <section className="ss-hero" aria-label="Welcome">
      <div className="ss-hero-text">
        <span className="ss-eyebrow">
          {data.learner.classLabel} · {data.termLabel}
        </span>
        <h2>Good morning, {data.learner.firstName}</h2>
        <p>
          You have <strong>{tasksLeft}</strong> study {tasksLeft === 1 ? "task" : "tasks"} left this week. Your AI Tutor is ready when you
          are.
        </p>
        <div className="ss-hero-btns">
          <button type="button" className="ss-btn ss-btn-gold" onClick={() => onNavigate?.("tutor")}>
            <Icon name="tutor" size={16} />
            Ask the AI Tutor
          </button>
          <button type="button" className="ss-btn ss-btn-ghost" onClick={() => onNavigate?.("results")}>
            View my results
          </button>
        </div>
      </div>
      <div className="ss-hero-stats">
        <div>
          <span>Attendance</span>
          <b>{attendance.percent}%</b>
        </div>
        <div>
          <span>Tasks left</span>
          <b>{tasksLeft}</b>
        </div>
        <div>
          <span>Balance</span>
          <b>{fmt(fees.outstanding)}</b>
        </div>
      </div>
    </section>
  );
}

const DOT_LABEL: Record<AttendanceCode, string> = { P: "present", L: "late", A: "absent" };

function AttendanceCard({ a }: { a: LearnerDashboardData["attendance"] }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = (a.percent / 100) * circumference;

  return (
    <section id="attendance" className="ss-card ss-panel" aria-labelledby="attendance-title">
      <header>
        <h3 id="attendance-title">Attendance</h3>
        <span className="ss-count">This term</span>
      </header>
      <div className="ss-pbody">
        <div className="ss-attend">
          <div className="ss-ring">
            <svg width="96" height="96" viewBox="0 0 104 104" aria-hidden="true">
              <circle className="ss-ring-track" cx="52" cy="52" r={radius} fill="none" strokeWidth="10" />
              <circle
                className="ss-ring-value"
                cx="52"
                cy="52"
                r={radius}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circumference}`}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <b>{a.percent}%</b>
          </div>
          <div className="ss-attend-text">
            <strong>
              {a.present} of {a.total} school days
            </strong>
            <small>
              {a.absent} absent · {a.late} late
            </small>
          </div>
        </div>
        <div>
          <p className="ss-muted" style={{ margin: "0 0 8px" }}>
            Last five school days
          </p>
          <div className="ss-week">
            {a.week.map((d) => (
              <div className="ss-week-day" key={d.day}>
                <span className={`ss-dot ${d.code}`} role="img" aria-label={`${d.day}: ${DOT_LABEL[d.code]}`}>
                  {d.code}
                </span>
                {d.day}
              </div>
            ))}
          </div>
          <p className="ss-muted" style={{ margin: "8px 0 0" }}>
            P present · L late · A absent
          </p>
        </div>
      </div>
    </section>
  );
}

function FeesCard({
  fees,
  termLabel,
  onNavigate,
}: {
  fees: LearnerDashboardData["fees"];
  termLabel: string;
  onNavigate?: (key: string) => void;
}) {
  const percent = fees.total > 0 ? Math.round((fees.paid / fees.total) * 100) : 0;

  return (
    <section id="fees" className="ss-card ss-panel" aria-labelledby="fees-title">
      <header>
        <h3 id="fees-title">Fees</h3>
        <span className="ss-count">{termLabel.split(",")[0]}</span>
      </header>
      <div className="ss-pbody">
        <div>
          <div className="ss-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Fees paid">
            <i style={{ width: `${percent}%` }} />
          </div>
          <p className="ss-muted" style={{ margin: "8px 0 0" }}>
            {percent}% of {fees.currency} {fmt(fees.total)} paid
          </p>
        </div>
        <div className="ss-trio">
          <div>
            <span>Paid</span>
            <b>{fmt(fees.paid)}</b>
          </div>
          <div>
            <span>Outstanding</span>
            <b>{fmt(fees.outstanding)}</b>
          </div>
          <div>
            <span>Overdue</span>
            <b>{fmt(fees.overdue)}</b>
          </div>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          Amounts in {fees.currency}. Next payment due {fees.dueLabel}.
        </p>
        <div className="ss-btn-row">
          <button type="button" className="ss-btn ss-btn-primary" onClick={() => onNavigate?.("fees-invoices")}>
            View invoices
          </button>
          <button type="button" className="ss-btn" onClick={() => onNavigate?.("fees-query")}>
            Raise a fee query
          </button>
        </div>
      </div>
    </section>
  );
}

function TutorCard({
  tutor,
  onAsk,
  onNavigate,
}: {
  tutor: LearnerDashboardData["tutor"];
  onAsk?: (q: string) => void;
  onNavigate?: (key: string) => void;
}) {
  const [question, setQuestion] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    onAsk?.(q);
    setQuestion("");
  };

  return (
    <section id="tutor" className="ss-card ss-panel" aria-labelledby="tutor-title">
      <header>
        <h3 id="tutor-title">AI Tutor</h3>
        {tutor.consentOnRecord ? <span className="ss-tag ok">Guardian consent on record</span> : <span className="ss-tag warn">Consent needed</span>}
      </header>
      <div className="ss-pbody">
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="ss-lab" htmlFor="tutor-q">
            What do you want to understand today?
          </label>
          <div className="ss-inline">
            <input
              id="tutor-q"
              className="ss-input"
              type="text"
              placeholder="Type a question or topic"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!tutor.consentOnRecord}
            />
            <button type="submit" className="ss-btn ss-btn-primary" disabled={!tutor.consentOnRecord}>
              Ask
            </button>
          </div>
        </form>
        <div className="ss-shortcuts">
          <button type="button" className="ss-shortcut" onClick={() => onNavigate?.("tutor-resume")}>
            <span>Continue: {tutor.resumeTopic}</span>
            <small>{tutor.resumeWhen}</small>
          </button>
          <button type="button" className="ss-shortcut" onClick={() => onNavigate?.("tutor-saved")}>
            <span>Saved explanations</span>
            <small>{tutor.savedCount} saved</small>
          </button>
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          AI-generated explanations. Your conversations stay private to you. Check with your teacher if something seems off.
        </p>
      </div>
    </section>
  );
}

function ResultsCard({ results, onNavigate }: { results: LearnerDashboardData["results"]; onNavigate?: (key: string) => void }) {
  return (
    <section id="results" className="ss-card ss-panel" aria-labelledby="results-title">
      <header>
        <h3 id="results-title">Recent results</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("results")}>
          All results and report cards
        </button>
      </header>
      <p className="ss-note">{results.caption}</p>
      <div className="ss-results" style={{ marginTop: 12 }}>
        {results.rows.map((r) => {
          const kind = r.delta > 0 ? "up" : r.delta < 0 ? "down" : "flat";
          const label = r.delta > 0 ? `Up ${r.delta}` : r.delta < 0 ? `Down ${Math.abs(r.delta)}` : "No change";
          return (
            <div className="ss-result" key={r.subject}>
              <span className="ss-result-subject">{r.subject}</span>
              <div className="ss-bar" aria-hidden="true">
                <i style={{ width: `${r.score}%` }} />
              </div>
              <span className="ss-result-score">{r.score}</span>
              <span className={`ss-result-change ${kind}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopicsCard({ topics, onNavigate }: { topics: Topic[]; onNavigate?: (key: string) => void }) {
  return (
    <section id="weak" className="ss-card ss-panel" aria-labelledby="topics-title">
      <header>
        <h3 id="topics-title">Topics to strengthen</h3>
      </header>
      <p className="ss-note">Based on your marks and tutor sessions. You choose what is shared with teachers and parents.</p>
      <div className="ss-topics" style={{ marginTop: 0 }}>
        {topics.map((t) => (
          <div className="ss-topic" key={`${t.subject}-${t.topic}`}>
            <div>
              <small>{t.subject}</small>
              <strong>{t.topic}</strong>
            </div>
            <button type="button" className="ss-btn ss-btn-sm" onClick={() => onNavigate?.(t.key)}>
              {t.action}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanCard({ tasks, onToggle }: { tasks: StudyTask[]; onToggle: (id: string) => void }) {
  const doneCount = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <section id="plan" className="ss-card ss-panel" aria-labelledby="plan-title">
      <header>
        <h3 id="plan-title">Your study plan this week</h3>
        <span className="ss-count">
          {doneCount} of {tasks.length} done
        </span>
      </header>
      <div className="ss-pbody">
        <div className="ss-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Study plan progress">
          <i className="gold" style={{ width: `${percent}%` }} />
        </div>
        <div className="ss-tasks">
          {tasks.map((t) => (
            <button key={t.id} type="button" className="ss-task" aria-pressed={t.done} onClick={() => onToggle(t.id)}>
              <span className="ss-task-box" aria-hidden="true">
                {t.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </span>
              <span className="ss-task-day">{t.day}</span>
              <span className="ss-task-text">{t.text}</span>
              <span className="ss-task-mins">{t.mins} min</span>
            </button>
          ))}
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          Tap a task to tick it off. The plan updates every week from your results and quizzes.
        </p>
      </div>
    </section>
  );
}

function CareerCard({ career, onNavigate }: { career: LearnerDashboardData["career"]; onNavigate?: (key: string) => void }) {
  return (
    <section id="career" className="ss-card ss-panel" aria-labelledby="career-title">
      <header>
        <h3 id="career-title">Career pathways</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("career")}>
          Continue profile
        </button>
      </header>
      <div className="ss-pbody">
        <div>
          <div className="ss-bar" role="progressbar" aria-valuenow={career.profilePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Interest profile progress">
            <i style={{ width: `${career.profilePercent}%` }} />
          </div>
          <p className="ss-muted" style={{ margin: "8px 0 0" }}>
            Interest and strengths profile: {career.profilePercent}% complete
          </p>
        </div>
        <strong style={{ fontSize: 13.5 }}>Your saved options</strong>
        <div className="ss-careers">
          {career.options.map((c) => (
            <div className="ss-career" key={c.title}>
              <div className="ss-career-head">
                <strong>{c.title}</strong>
                <span className="ss-tag">Suggestion</span>
              </div>
              <p>{c.why}</p>
            </div>
          ))}
        </div>
        <p className="ss-muted" style={{ margin: 0 }}>
          These are ideas, not decisions. You can change or remove any of them.
        </p>
      </div>
    </section>
  );
}

function AnnouncementsCard({ notices, onNavigate }: { notices: Notice[]; onNavigate?: (key: string) => void }) {
  return (
    <section id="announcements" className="ss-card ss-panel" aria-labelledby="notices-title">
      <header>
        <h3 id="notices-title">Announcements</h3>
        <button type="button" className="ss-link-btn" onClick={() => onNavigate?.("announcements")}>
          See all
        </button>
      </header>
      <ul className="ss-list ss-news" style={{ marginTop: 4 }}>
        {notices.map((n) => (
          <li key={n.id} className={n.unread ? "is-unread" : "is-read"}>
            <span className={`ss-tag${n.tag === "Finance" ? " warn" : ""}`}>{n.tag}</span>
            <div>
              <strong>{n.title}</strong>
              <small>{n.meta}</small>
            </div>
            {n.unread ? <span className="ss-tag warn">New</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LearnerDashboard({
  data = SAMPLE_DATA,
  theme = "light",
  onNavigate,
  onTaskToggle,
  onAskTutor,
}: LearnerDashboardProps) {
  const [tasks, setTasks] = useState<StudyTask[]>(data.tasks);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const done = !target.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    onTaskToggle?.(id, done);
  };

  const tasksLeft = tasks.filter((t) => !t.done).length;

  return (
    <div id="top" className="ss-shell" data-theme={theme}>
      <Sidebar data={data} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} />
      <div className={`ss-scrim${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="ss-main">
        <PageHeader dateLabel={data.dateLabel} onOpenMenu={() => setMenuOpen(true)} />

        <main className="ss-content">
          <Hero data={data} tasksLeft={tasksLeft} onNavigate={onNavigate} />

          <div className="ss-three">
            <AttendanceCard a={data.attendance} />
            <FeesCard fees={data.fees} termLabel={data.termLabel} onNavigate={onNavigate} />
            <TutorCard tutor={data.tutor} onAsk={onAskTutor} onNavigate={onNavigate} />
          </div>

          <div className="ss-two">
            <ResultsCard results={data.results} onNavigate={onNavigate} />
            <TopicsCard topics={data.topics} onNavigate={onNavigate} />
          </div>

          <div className="ss-two">
            <PlanCard tasks={tasks} onToggle={toggleTask} />
            <CareerCard career={data.career} onNavigate={onNavigate} />
          </div>

          <AnnouncementsCard notices={data.notices} onNavigate={onNavigate} />
        </main>
      </div>
    </div>
  );
}