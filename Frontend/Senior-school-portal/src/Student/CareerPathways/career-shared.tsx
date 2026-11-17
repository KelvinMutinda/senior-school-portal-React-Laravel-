import { NavLink } from "react-router-dom";
import { PAGE_PATHS } from "../LearnerDashboard";

/* Reuse the loader hook and skeleton/error block from the fees pages.
   If you later move them to a shared folder, only this line changes. */
export { useLoad, LoadState } from "../Finance/fees-shared";

/* ==========================================================================
   Shared types, FAKE sample data, scoring and small components for the
   career pages (PathwayRecommender, Pathways).
   Replace sampleLoadCareer with your API call later. Every page takes a
   loadData prop, so nothing inside the pages has to change.
   ========================================================================== */

export type TrackKey = "stem" | "social" | "arts";
export const TRACKS: { key: TrackKey; label: string; blurb: string }[] = [
  { key: "stem", label: "STEM", blurb: "Science, technology, engineering and mathematics" },
  { key: "social", label: "Social Sciences", blurb: "Business, languages, humanities and society" },
  { key: "arts", label: "Arts and Sports Science", blurb: "Creative arts, media, sports and performance" },
];
export const trackLabel = (k: TrackKey) => TRACKS.find((t) => t.key === k)?.label ?? k;

export type InterestKey = "problem" | "helping" | "creating" | "leading" | "hands" | "research" | "performing";
export type Interests = Record<InterestKey, number>; // 1 (not me) to 5 (very me)

export const INTERESTS: { key: InterestKey; label: string }[] = [
  { key: "problem", label: "Solving problems" },
  { key: "helping", label: "Helping people" },
  { key: "creating", label: "Creating and designing things" },
  { key: "leading", label: "Leading and organising" },
  { key: "hands", label: "Working with my hands" },
  { key: "research", label: "Research and discovery" },
  { key: "performing", label: "Performing and communicating" },
];
export const LEVEL_LABELS = ["Not me", "A little", "Sometimes", "Often", "Very me"];

export type Demand = "High demand" | "Growing" | "Steady";

export interface Pathway {
  id: string;
  title: string;
  track: TrackKey;
  summary: string;
  subjects: { name: string; role: "core" | "helpful" }[];
  /** How much each interest matters for this pathway, 0 to 1. */
  interestWeights: Partial<Record<InterestKey, number>>;
  careers: { title: string; blurb: string; demand: Demand }[];
  courses: string[];
  skills: string[];
  nextSteps: string[];
}

export interface CareerData {
  profilePercent: number;
  subjects: { subject: string; score: number }[];
  interests: Interests;
  pathways: Pathway[];
  savedIds: string[];
}

/* ------------------------------------------------------------------ */
/* Scoring (runs in the browser on fake data, move to the server later) */
/* ------------------------------------------------------------------ */

export interface Fit {
  subjects: number | null;
  interests: number;
  total: number;
  reasons: string[];
  gaps: string[];
}

export function fitFor(p: Pathway, data: Pick<CareerData, "subjects">, interests: Interests): Fit {
  const marks = new Map(data.subjects.map((s) => [s.subject, s.score]));

  let wSum = 0;
  let sSum = 0;
  p.subjects.forEach((s) => {
    const m = marks.get(s.name);
    if (m == null) return;
    const w = s.role === "core" ? 1 : 0.5;
    wSum += w;
    sSum += w * m;
  });
  const subjects = wSum ? sSum / wSum : null;

  let iw = 0;
  let is = 0;
  (Object.entries(p.interestWeights) as [InterestKey, number][]).forEach(([k, w]) => {
    iw += w;
    is += w * ((interests[k] - 1) / 4);
  });
  const interestFit = iw ? (is / iw) * 100 : 50;
  const total = Math.round(subjects === null ? interestFit : 0.6 * subjects + 0.4 * interestFit);

  const reasons: string[] = [];
  const gaps: string[] = [];

  const core = p.subjects.filter((s) => s.role === "core");
  const best = core.map((s) => ({ ...s, mark: marks.get(s.name) })).filter((s) => s.mark != null && s.mark >= 65).sort((a, b) => (b.mark ?? 0) - (a.mark ?? 0))[0];
  if (best) reasons.push(`Your ${best.name} mark of ${best.mark} is a strong base for this pathway.`);

  const topInterest = (Object.entries(p.interestWeights) as [InterestKey, number][])
    .filter(([k]) => interests[k] >= 4)
    .sort((a, b) => b[1] * interests[b[0]] - a[1] * interests[a[0]])[0];
  if (topInterest) reasons.push(`You enjoy ${INTERESTS.find((i) => i.key === topInterest[0])?.label.toLowerCase()}, which this pathway rewards.`);

  core.forEach((s) => {
    const m = marks.get(s.name);
    if (m == null) gaps.push(`${s.name} is a core subject here and is not in your record yet.`);
    else if (m < 55) gaps.push(`Strengthen ${s.name}, currently ${m}.`);
  });

  return { subjects: subjects === null ? null : Math.round(subjects), interests: Math.round(interestFit), total, reasons, gaps };
}

export const toneOf = (n: number) => (n >= 75 ? "a" : n >= 60 ? "b" : n >= 45 ? "c" : "d");
export const matchLabel = (n: number) => (n >= 75 ? "Strong match" : n >= 60 ? "Good match" : n >= 45 ? "Possible match" : "Stretch");

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

export function CareerTabs() {
  const tabs: [string, string][] = [
    [PAGE_PATHS["career-recommender"], "Pathway recommender"],
    [PAGE_PATHS["career-explorer"], "Explore pathways"],
  ];
  return (
    <nav className="ss-cp-tabs" aria-label="Career sections">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "is-on" : "")}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function MatchRing({ value, size = 64 }: { value: number; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="ss-cp-ring" data-tone={toneOf(value)} style={{ width: size, height: size }} role="img" aria-label={`${value}% match, ${matchLabel(value)}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="ss-cp-ring-bg" />
        <circle cx="32" cy="32" r={r} className="ss-cp-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 32 32)" />
      </svg>
      <b aria-hidden="true">{value}%</b>
    </span>
  );
}

export function TrackTag({ track }: { track: TrackKey }) {
  return (
    <span className="ss-cp-track" data-track={track}>
      {trackLabel(track)}
    </span>
  );
}

export function MiniBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="ss-cp-mini">
      <span>{label}</span>
      {value === null ? (
        <em>Not enough subject marks yet</em>
      ) : (
        <>
          <div className="ss-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <i data-tone={toneOf(value)} style={{ width: `${value}%` }} />
          </div>
          <b>{value}%</b>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAKE sample data (to be replaced by your database later)            */
/* ------------------------------------------------------------------ */

const wait = <T,>(v: T, ms = 500) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const SAMPLE_CAREER: CareerData = {
  profilePercent: 70,
  savedIds: ["software"],
  subjects: [
    { subject: "Mathematics", score: 74 },
    { subject: "English", score: 71 },
    { subject: "Kiswahili", score: 76 },
    { subject: "Biology", score: 61 },
    { subject: "Chemistry", score: 67 },
    { subject: "Physics", score: 59 },
    { subject: "Computer Studies", score: 80 },
    { subject: "Business Studies", score: 66 },
  ],
  interests: { problem: 5, helping: 3, creating: 4, leading: 3, hands: 2, research: 4, performing: 2 },
  pathways: [
    {
      id: "software",
      title: "Software engineering and computing",
      track: "stem",
      summary: "Design, build and test the apps, websites and systems that run banks, schools, shops and mobile money.",
      subjects: [
        { name: "Mathematics", role: "core" },
        { name: "Computer Studies", role: "core" },
        { name: "Physics", role: "helpful" },
      ],
      interestWeights: { problem: 1, research: 0.6, creating: 0.7 },
      careers: [
        { title: "Software developer", blurb: "Builds web and mobile apps.", demand: "High demand" },
        { title: "Data analyst", blurb: "Turns data into decisions.", demand: "High demand" },
        { title: "Cybersecurity analyst", blurb: "Protects systems and people online.", demand: "Growing" },
        { title: "AI and machine learning engineer", blurb: "Builds systems that learn from data.", demand: "Growing" },
      ],
      courses: ["BSc Computer Science", "BSc Software Engineering", "BSc Data Science", "Diploma in ICT (TVET)"],
      skills: ["Logical thinking", "Programming", "Patience with detail", "Teamwork"],
      nextSteps: ["Practise coding on small projects", "Keep Mathematics above 70", "Join the school ICT or robotics club"],
    },
    {
      id: "engineering",
      title: "Civil, mechanical and electrical engineering",
      track: "stem",
      summary: "Plan and build roads, bridges, machines and power systems, using mathematics and physics to solve real problems.",
      subjects: [
        { name: "Mathematics", role: "core" },
        { name: "Physics", role: "core" },
        { name: "Chemistry", role: "helpful" },
      ],
      interestWeights: { problem: 1, hands: 0.8, creating: 0.7 },
      careers: [
        { title: "Structural engineer", blurb: "Designs safe buildings and bridges.", demand: "High demand" },
        { title: "Electrical engineer", blurb: "Works on power and electronics.", demand: "High demand" },
        { title: "Quantity surveyor", blurb: "Plans and costs construction projects.", demand: "Steady" },
      ],
      courses: ["BEng Civil Engineering", "BEng Mechanical Engineering", "BEng Electrical Engineering", "Diploma in Engineering (TVET)"],
      skills: ["Mathematics", "Technical drawing", "Problem solving", "Safety awareness"],
      nextSteps: ["Strengthen Physics, aim above 65", "Try practical projects or a school workshop", "Talk to an engineer about daily work"],
    },
    {
      id: "health",
      title: "Medicine and health sciences",
      track: "stem",
      summary: "Care for people and protect public health as a doctor, nurse, pharmacist or laboratory scientist.",
      subjects: [
        { name: "Biology", role: "core" },
        { name: "Chemistry", role: "core" },
        { name: "Mathematics", role: "helpful" },
      ],
      interestWeights: { helping: 1, research: 0.7, hands: 0.4 },
      careers: [
        { title: "Doctor", blurb: "Diagnoses and treats patients.", demand: "High demand" },
        { title: "Nurse", blurb: "Provides care in clinics and hospitals.", demand: "High demand" },
        { title: "Pharmacist", blurb: "Prepares and advises on medicines.", demand: "Steady" },
        { title: "Medical laboratory scientist", blurb: "Runs tests that guide treatment.", demand: "Growing" },
      ],
      courses: ["MBChB Medicine and Surgery", "BSc Nursing", "BPharm Pharmacy", "BSc Medical Laboratory Science"],
      skills: ["Empathy", "Attention to detail", "Calm under pressure", "Communication"],
      nextSteps: ["Raise Biology and Chemistry marks", "Volunteer at a clinic or health camp", "Ask your teacher about entry requirements"],
    },
    {
      id: "agri",
      title: "Agriculture and biotechnology",
      track: "stem",
      summary: "Improve food, farming and the environment using biology, chemistry and modern technology.",
      subjects: [
        { name: "Biology", role: "core" },
        { name: "Chemistry", role: "core" },
        { name: "Business Studies", role: "helpful" },
      ],
      interestWeights: { research: 0.9, hands: 0.8, problem: 0.5 },
      careers: [
        { title: "Agricultural officer", blurb: "Advises farmers on crops and livestock.", demand: "Steady" },
        { title: "Food scientist", blurb: "Develops safe, nutritious food.", demand: "Growing" },
        { title: "Biotechnologist", blurb: "Uses living systems to make useful products.", demand: "Growing" },
      ],
      courses: ["BSc Agriculture", "BSc Biotechnology", "BSc Food Science", "Diploma in Agriculture (TVET)"],
      skills: ["Observation", "Lab skills", "Planning", "Business sense"],
      nextSteps: ["Start a school or home garden project", "Visit an agricultural show or research station"],
    },
    {
      id: "business",
      title: "Business, finance and entrepreneurship",
      track: "social",
      summary: "Run, grow and fund businesses, from a start-up to a bank, using numbers and people skills.",
      subjects: [
        { name: "Business Studies", role: "core" },
        { name: "Mathematics", role: "core" },
        { name: "English", role: "helpful" },
      ],
      interestWeights: { leading: 1, problem: 0.6, performing: 0.4 },
      careers: [
        { title: "Accountant", blurb: "Keeps and checks financial records.", demand: "Steady" },
        { title: "Entrepreneur", blurb: "Starts and runs a business.", demand: "Growing" },
        { title: "Financial analyst", blurb: "Advises on investments and risk.", demand: "Steady" },
      ],
      courses: ["BCom Accounting", "BBA Business Administration", "BSc Economics and Finance", "CPA and ATD courses"],
      skills: ["Number sense", "Leadership", "Negotiation", "Planning"],
      nextSteps: ["Join or start a school enterprise club", "Practise budgeting for a small project"],
    },
    {
      id: "law",
      title: "Law, governance and public service",
      track: "social",
      summary: "Argue cases, shape policy and serve communities through the courts, government and civil society.",
      subjects: [
        { name: "English", role: "core" },
        { name: "History and Citizenship", role: "core" },
        { name: "Kiswahili", role: "helpful" },
      ],
      interestWeights: { leading: 0.8, performing: 0.8, helping: 0.6, research: 0.5 },
      careers: [
        { title: "Advocate", blurb: "Represents clients in court.", demand: "Steady" },
        { title: "Policy analyst", blurb: "Researches and advises on public policy.", demand: "Steady" },
        { title: "Diplomat", blurb: "Represents the country abroad.", demand: "Steady" },
      ],
      courses: ["LLB Bachelor of Laws", "BA Political Science", "BA International Relations"],
      skills: ["Public speaking", "Critical reading", "Persuasive writing", "Fairness"],
      nextSteps: ["Join debate or Model UN", "Add History and Citizenship to your subjects"],
    },
    {
      id: "education",
      title: "Teaching and education",
      track: "social",
      summary: "Help others learn as a teacher, lecturer or curriculum developer and shape the next generation.",
      subjects: [
        { name: "English", role: "core" },
        { name: "Kiswahili", role: "core" },
        { name: "Mathematics", role: "helpful" },
      ],
      interestWeights: { helping: 1, performing: 0.7, leading: 0.5 },
      careers: [
        { title: "Secondary school teacher", blurb: "Teaches one or two subjects.", demand: "Steady" },
        { title: "Curriculum developer", blurb: "Designs what learners study.", demand: "Steady" },
        { title: "Education officer", blurb: "Supports schools at county level.", demand: "Steady" },
      ],
      courses: ["BEd Arts or Science", "BA Education", "Diploma in Teacher Education"],
      skills: ["Explaining clearly", "Patience", "Planning lessons", "Listening"],
      nextSteps: ["Help classmates revise a topic", "Ask a teacher if you can assist with a lesson"],
    },
    {
      id: "media",
      title: "Creative arts, media and design",
      track: "arts",
      summary: "Tell stories and make things people enjoy through film, writing, music, graphic design and digital media.",
      subjects: [
        { name: "English", role: "core" },
        { name: "Visual Arts", role: "core" },
        { name: "Computer Studies", role: "helpful" },
      ],
      interestWeights: { creating: 1, performing: 0.8, research: 0.3 },
      careers: [
        { title: "Graphic designer", blurb: "Creates visuals for brands and media.", demand: "Growing" },
        { title: "Journalist", blurb: "Reports and writes news and features.", demand: "Steady" },
        { title: "Film and video producer", blurb: "Plans and makes video content.", demand: "Growing" },
      ],
      courses: ["BA Film and Media Studies", "BA Journalism", "BA Graphic Design", "Diploma in Multimedia (TVET)"],
      skills: ["Creativity", "Storytelling", "Digital tools", "Meeting deadlines"],
      nextSteps: ["Build a small portfolio of your work", "Join the drama, music or media club"],
    },
    {
      id: "sports",
      title: "Sports science and fitness",
      track: "arts",
      summary: "Support athletes and healthy living as a coach, physiotherapist, sports scientist or fitness trainer.",
      subjects: [
        { name: "Physical Education", role: "core" },
        { name: "Biology", role: "core" },
        { name: "Mathematics", role: "helpful" },
      ],
      interestWeights: { helping: 0.7, hands: 0.8, leading: 0.6, performing: 0.4 },
      careers: [
        { title: "Sports coach", blurb: "Trains teams and athletes.", demand: "Growing" },
        { title: "Physiotherapist", blurb: "Treats injuries and restores movement.", demand: "High demand" },
        { title: "Sports scientist", blurb: "Studies performance and training.", demand: "Growing" },
      ],
      courses: ["BSc Sports Science", "BSc Physiotherapy", "BEd Physical Education", "Diploma in Sports Management"],
      skills: ["Teamwork", "Discipline", "Anatomy basics", "Motivating others"],
      nextSteps: ["Take part in school sports and keep a training log", "Add Physical Education to your subjects"],
    },
  ],
};

export const sampleLoadCareer = () => wait(SAMPLE_CAREER);