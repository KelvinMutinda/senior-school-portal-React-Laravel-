import { useMemo, useState } from "react";
import { DashboardLayout, type LayoutUser } from "../Hoi/HoiDashboard";

/* ==========================================================================
   TeacherDashboard
   Uses the shared DashboardLayout (permission-driven sidebar + HeaderSection)
   and the .ss-* styles in App.css. Teachers never see fee data here.
   Layout follows section 4.2 of the System Design document:
   classes overview, quick attendance, pending marks, class performance,
   AI weakness alerts, material and quiz generator, notices, quick actions.
   ========================================================================== */

/* ---------- Types ---------- */

type AttendanceStatus = "P" | "A" | "L" | "E"; // present, absent, late, excused

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  learners: number;
  mean: number;
  attendance: number;
  marksSubmitted: number;
}

interface Lesson {
  id: string;
  time: string;
  classId: string;
  subject: string;
  room: string;
  registerTaken: boolean;
}

interface PendingMarks {
  id: string;
  assessment: string;
  classId: string;
  status: "Not started" | "Draft" | "Returned";
  due: string;
  note?: string;
}

interface Learner {
  id: string;
  name: string;
  admNo: string;
}

interface WeaknessAlert {
  id: string;
  topic: string;
  classId: string;
  detail: string;
}

interface Notice {
  id: string;
  title: string;
  from: string;
  when: string;
}

export interface TeacherData {
  classes: ClassInfo[];
  lessons: Lesson[];
  pendingMarks: PendingMarks[];
  roster: Record<string, Learner[]>; // learners per class id
  alerts: WeaknessAlert[];
  notices: Notice[];
  aiUsage: { materialsThisTerm: number; quizAttempts: number; tutorSessions: number };
  commentsDone: number; // class teachers only
  commentsTotal: number;
}

export interface TeacherDashboardProps {
  data?: TeacherData;
  user?: LayoutUser;
  isClassTeacher?: boolean;
  classTeacherOf?: string; // e.g. "Grade 11A"
  onNavigate?: (route: string, key: string) => void;
  onLogout?: () => void;
  onSaveAttendance?: (classId: string, records: Record<string, AttendanceStatus>) => void | Promise<void>;
  onGenerate?: (request: { classId: string; topic: string; format: string }) => void | Promise<void>;
  onAlertAction?: (alertId: string, action: "accept" | "dismiss") => void | Promise<void>;
  onPostNotice?: (classId: string, message: string) => void | Promise<void>;
}

/* ---------- Sample data (replace with API results) ---------- */

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
  pendingMarks: [
    { id: "m1", assessment: "End of Term 3 exam", classId: "11B", status: "Draft", due: "Tue, 17 Nov" },
    { id: "m2", assessment: "Practical assessment 2", classId: "12A", status: "Not started", due: "Fri, 20 Nov" },
    { id: "m3", assessment: "CAT 3", classId: "11A", status: "Returned", due: "Mon, 16 Nov", note: "Deputy: check two marks above 100" },
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
  alerts: [
    { id: "w1", topic: "Quadratic equations", classId: "11A", detail: "Several learners lost marks on factorisation steps. A short practice set could help." },
    { id: "w2", topic: "Circular motion", classId: "12A", detail: "Tutor questions show repeated confusion about centripetal force." },
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

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/* ---------- Component ---------- */

function TeacherDashboard({
  data = SAMPLE,
  user,
  isClassTeacher = true,
  classTeacherOf = "Grade 11A",
  onNavigate,
  onLogout,
  onSaveAttendance,
  onGenerate,
  onAlertAction,
  onPostNotice,
}: TeacherDashboardProps) {
  const me: LayoutUser = user ?? {
    name: "Teacher",
    roleLabel: isClassTeacher ? `Class Teacher, ${classTeacherOf}` : "Subject Teacher",
  };

  const go = (route: string, key = "") => onNavigate?.(route, key);
  const className = (id: string) => data.classes.find((c) => c.id === id)?.name ?? id;

  /* quick attendance */
  const [attClass, setAttClass] = useState(data.classes[0]?.id ?? "");
  const [marks, setMarks] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [savedAtt, setSavedAtt] = useState<string | null>(null);
  const roster = data.roster[attClass] ?? [];
  const current = marks[attClass] ?? {};
  const markedCount = roster.filter((l) => current[l.id]).length;
  const counts = useMemo(
    () => STATUSES.map((s) => ({ s, n: roster.filter((l) => current[l.id] === s).length })),
    [roster, current],
  );

  const setStatus = (learnerId: string, status: AttendanceStatus) => {
    setSavedAtt(null);
    setMarks((m) => ({ ...m, [attClass]: { ...(m[attClass] ?? {}), [learnerId]: status } }));
  };
  const markAllPresent = () => {
    setSavedAtt(null);
    setMarks((m) => ({ ...m, [attClass]: Object.fromEntries(roster.map((l) => [l.id, "P" as AttendanceStatus])) }));
  };
  const saveAttendance = async () => {
    await onSaveAttendance?.(attClass, current);
    setSavedAtt(`Register saved for ${className(attClass)}.`);
  };

  /* AI alerts */
  const [alerts, setAlerts] = useState(data.alerts);
  const actOnAlert = async (id: string, action: "accept" | "dismiss") => {
    await onAlertAction?.(id, action);
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  /* generator */
  const [genClass, setGenClass] = useState(data.classes[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const generate = async () => {
    if (!topic.trim()) return;
    await onGenerate?.({ classId: genClass, topic: topic.trim(), format });
    setGenMsg(`${format} on "${topic.trim()}" requested. Review and edit it before publishing to ${className(genClass)}.`);
    setTopic("");
  };

  /* class notice */
  const [noticeClass, setNoticeClass] = useState(data.classes[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [noticeSent, setNoticeSent] = useState(false);
  const postNotice = async () => {
    if (!notice.trim()) return;
    await onPostNotice?.(noticeClass, notice.trim());
    setNotice("");
    setNoticeSent(true);
    setTimeout(() => setNoticeSent(false), 3000);
  };

  /* derived numbers */
  const totalLearners = data.classes.reduce((n, c) => n + c.learners, 0);
  const registersTaken = data.lessons.filter((l) => l.registerTaken).length;
  const meanAll = Math.round(data.classes.reduce((n, c) => n + c.mean, 0) / Math.max(1, data.classes.length));
  const openMarks = data.pendingMarks.length;

  return (
    <DashboardLayout
      role="TEACHER"
      user={me}
      title="Teacher Dashboard"
      activeKey="dashboard"
      isClassTeacher={isClassTeacher}
      notifications={alerts.length + openMarks}
      badges={{ marks: openMarks, messages: 2 }}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerAction={{ label: "Enter marks", icon: "pen", onClick: () => go("/academics/marks", "marks-entry") }}
    >
      {/* Hero */}
      <section className="ss-hero">
        <div className="ss-hero-text">
          <span className="ss-eyebrow">{isClassTeacher ? `Class teacher, ${classTeacherOf}` : "Subject teacher"}</span>
          <h2>{greeting()}, welcome back</h2>
          <p>
            You have <strong>{data.lessons.length} lessons</strong> today and{" "}
            <strong>{openMarks} marks tasks</strong> waiting
            {alerts.length > 0 && <>, plus <strong>{alerts.length} AI alerts</strong> to review</>}.
          </p>
          <div className="ss-hero-btns">
            <button type="button" className="ss-btn ss-btn-gold" onClick={() => go("/academics/attendance", "attendance")}>Open attendance</button>
            <button type="button" className="ss-btn ss-btn-ghost" onClick={() => go("/ai/tools", "ai-tools")}>AI tools</button>
          </div>
        </div>
        <div className="ss-hero-stats">
          <div><span>Classes</span><b>{data.classes.length}</b></div>
          <div><span>Learners</span><b>{totalLearners}</b></div>
          <div><span>Lessons today</span><b>{data.lessons.length}</b></div>
        </div>
      </section>

      {/* KPIs */}
      <section className="ss-kpis" aria-label="Key indicators">
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Registers taken today</span>
          <b>{registersTaken} of {data.lessons.length}</b>
          <div className="ss-bar"><i style={{ width: `${(registersTaken / Math.max(1, data.lessons.length)) * 100}%` }} /></div>
          <small>Lessons with attendance recorded</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Marks tasks open</span>
          <b>{openMarks}</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${Math.max(8, 100 - openMarks * 20)}%` }} /></div>
          <small>Drafts, returned and not started</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">Average class score</span>
          <b>{meanAll}%</b>
          <div className="ss-bar"><i style={{ width: `${meanAll}%` }} /></div>
          <small>Across your classes this term</small>
        </article>
        <article className="ss-card ss-kpi">
          <span className="ss-kpi-label">AI alerts to review</span>
          <b>{alerts.length}</b>
          <div className="ss-bar"><i className="gold" style={{ width: `${Math.min(100, alerts.length * 25)}%` }} /></div>
          <small>Topic-level suggestions for your classes</small>
        </article>
      </section>

      {/* Lessons + pending marks */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Today's lessons</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/academics/classes", "classes")}>My classes</button>
          </header>
          <ul className="ss-list">
            {data.lessons.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>{l.time} · {className(l.classId)}</strong>
                  <small>{l.subject} · {l.room}</small>
                </div>
                <span className={`ss-tag ${l.registerTaken ? "" : "warn"}`}>{l.registerTaken ? "Register taken" : "Register pending"}</span>
                {!l.registerTaken && (
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => setAttClass(l.classId)}>Take register</button>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="ss-card ss-panel">
          <header>
            <h3>Marks to complete</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/academics/marks", "marks-entry")}>Marks entry</button>
          </header>
          <ul className="ss-list">
            {data.pendingMarks.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.assessment}</strong>
                  <small>{className(m.classId)} · due {m.due}{m.note ? ` · ${m.note}` : ""}</small>
                </div>
                <span className={`ss-tag ${m.status === "Returned" ? "warn" : ""}`}>{m.status}</span>
                <button type="button" className="ss-btn ss-btn-sm" onClick={() => go("/academics/marks", "marks-entry")}>
                  {m.status === "Not started" ? "Start" : "Continue"}
                </button>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {/* Quick attendance */}
      <section className="ss-card ss-panel" aria-label="Quick attendance">
        <header>
          <h3>Quick attendance</h3>
          <button type="button" className="ss-link-btn" onClick={() => go("/academics/attendance", "attendance")}>Full register</button>
        </header>

        <div className="ss-toolbar">
          <select className="ss-input ss-input-auto" value={attClass} onChange={(e) => { setAttClass(e.target.value); setSavedAtt(null); }} aria-label="Class">
            {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
          </select>
          <button type="button" className="ss-btn ss-btn-sm" onClick={markAllPresent}>Mark all present</button>
          <span className="ss-toolbar-note">{markedCount} of {roster.length} marked</span>
        </div>

        <ul className="ss-roster">
          {roster.map((l) => (
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
          <span className="ss-toolbar-note">
            {counts.map((c) => `${STATUS_LABEL[c.s]} ${c.n}`).join(" · ")}
          </span>
          <button type="button" className="ss-btn ss-btn-primary" onClick={saveAttendance} disabled={roster.length === 0 || markedCount < roster.length}>
            Save register
          </button>
        </div>
        {savedAtt && <p className="ss-sent" role="status">{savedAtt}</p>}
      </section>

      {/* AI alerts + class performance */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>AI insights for your classes</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/ai/insights", "ai-insights")}>All insights</button>
          </header>
          {alerts.length === 0 ? (
            <p className="ss-empty">No new suggestions. Insights appear after marks are published.</p>
          ) : (
            <ul className="ss-list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.topic} · {className(a.classId)}</strong>
                    <small>{a.detail}</small>
                  </div>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => actOnAlert(a.id, "accept")}>Accept</button>
                  <button type="button" className="ss-btn ss-btn-sm" onClick={() => go("/ai/insights", "ai-insights")}>Edit</button>
                  <button type="button" className="ss-link-btn" onClick={() => actOnAlert(a.id, "dismiss")}>Dismiss</button>
                </li>
              ))}
            </ul>
          )}
          <p className="ss-note">Suggestions describe topics and next steps, never labels for individual learners. You can accept, edit or dismiss each one.</p>
        </article>

        <article className="ss-card ss-panel">
          <header><h3>Class performance</h3></header>
          <table className="ss-table">
            <thead>
              <tr><th>Class</th><th>Mean</th><th>Attendance</th><th>Marks in</th></tr>
            </thead>
            <tbody>
              {data.classes.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><br /><small>{c.subject}</small></td>
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
      </section>

      {/* Generator */}
      <section className="ss-card ss-panel" aria-label="Material and quiz generator">
        <header>
          <h3>Material and quiz generator</h3>
          <button type="button" className="ss-link-btn" onClick={() => go("/ai/tools", "ai-tools")}>Saved items</button>
        </header>
        <div className="ss-gen">
          <label className="ss-lab">Topic
            <input className="ss-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Factorising quadratic equations" />
          </label>
          <label className="ss-lab">Class
            <select className="ss-input" value={genClass} onChange={(e) => setGenClass(e.target.value)}>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="ss-lab">Format
            <select className="ss-input" value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <button type="button" className="ss-btn ss-btn-primary" onClick={generate} disabled={!topic.trim()}>Generate</button>
        </div>
        {genMsg && <p className="ss-sent" role="status">{genMsg}</p>}
        <p className="ss-note">
          Generated content is labelled AI-assisted and must be reviewed by you before it reaches learners.
          This term: {data.aiUsage.materialsThisTerm} items created, {data.aiUsage.quizAttempts} quiz attempts, {data.aiUsage.tutorSessions} tutor sessions in your classes.
        </p>
      </section>

      {/* Class teacher panel */}
      {isClassTeacher && (
        <section className="ss-card ss-panel" aria-label="Report comments">
          <header>
            <h3>Report comments, {classTeacherOf}</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/academics/comments", "comments")}>Open comments</button>
          </header>
          <div className="ss-progress">
            <div className="ss-bar"><i style={{ width: `${(data.commentsDone / Math.max(1, data.commentsTotal)) * 100}%` }} /></div>
            <small>{data.commentsDone} of {data.commentsTotal} learners have overall comments and conduct remarks. Report cards go to approval once these are complete.</small>
          </div>
        </section>
      )}

      {/* Notices */}
      <section className="ss-two">
        <article className="ss-card ss-panel">
          <header>
            <h3>Announcements</h3>
            <button type="button" className="ss-link-btn" onClick={() => go("/announcements", "announcements")}>View all</button>
          </header>
          <ul className="ss-activity">
            {data.notices.map((n) => (
              <li key={n.id}><span className="ss-pip" /><div><p>{n.title}</p><small>{n.from} · {n.when}</small></div></li>
            ))}
          </ul>
        </article>

        <article className="ss-card ss-panel">
          <header><h3>Post a class notice</h3></header>
          <div className="ss-notice">
            <select className="ss-input" value={noticeClass} onChange={(e) => setNoticeClass(e.target.value)} aria-label="Audience">
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea className="ss-input" rows={3} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Write a notice for this class..." />
            <button type="button" className="ss-btn ss-btn-primary" onClick={postNotice} disabled={!notice.trim()}>Post notice</button>
          </div>
          {noticeSent && <p className="ss-sent" role="status">Notice posted to {className(noticeClass)}.</p>}
        </article>
      </section>

      {/* Quick actions */}
      <section className="ss-card ss-panel" aria-label="Quick actions">
        <header><h3>Quick actions</h3></header>
        <div className="ss-actions-row">
          <button type="button" className="ss-btn" onClick={() => go("/academics/students", "students")}>My learners</button>
          <button type="button" className="ss-btn" onClick={() => go("/academics/marks", "marks-entry")}>Upload marks (CSV)</button>
          <button type="button" className="ss-btn" onClick={() => go("/academics/attendance", "attendance")}>Attendance history</button>
          <button type="button" className="ss-btn" onClick={() => go("/messages", "messages")}>Messages</button>
          {isClassTeacher && (
            <button type="button" className="ss-btn" onClick={() => go("/academics/comments", "comments")}>Report comments</button>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}

export default TeacherDashboard;