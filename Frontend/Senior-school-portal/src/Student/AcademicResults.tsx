import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LearnerShell,
  SAMPLE_DATA,
  avg,
  bandFor,
  buildProgress,
  change,
  fmtDate,
  ordinal,
  sum,
} from "./LearnerDashboard";
import type { DownloadKind, ExamRecord, LearnerDashboardData } from "./LearnerDashboard";

/* Styles come from App.css (sections 6 and 13, academic transcript block). */

const sampleLoad = () => new Promise<ExamRecord[]>((resolve) => setTimeout(() => resolve(SAMPLE_DATA.exams), 500));

export interface AcademicResultsProps {
  loadExams?: () => Promise<ExamRecord[]>;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
  /** Called for report card downloads that have no direct url. id is the exam id, or "all". */
  onDownload?: (kind: DownloadKind, id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const yearOf = (e: ExamRecord) => e.date.slice(0, 4);
const termOf = (e: ExamRecord) => e.term.match(/Term\s*\d/i)?.[0].replace(/\s+/, " ") ?? e.term;

function typeOf(e: ExamRecord): string {
  if (e.type) return e.type;
  const n = e.name.toLowerCase();
  if (n.includes("opener")) return "Opener";
  if (n.includes("cat")) return "CAT";
  if (n.includes("mid")) return "Mid-term";
  if (n.includes("end of term") || n.includes("end-term")) return "End of term";
  return "Other";
}

/** Colour tone for a score. Only affects colour, the label still comes from bandFor. */
const tone = (n: number) => (n >= 75 ? "a" : n >= 50 ? "b" : n >= 25 ? "c" : "d");
const clamp = (n: number) => Math.min(100, Math.max(0, n));

interface Filters {
  year: string;
  term: string;
  type: string;
}
const ALL = "All";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Delta({ value, unit = "" }: { value: number; unit?: string }) {
  const r = Math.round(value * 10) / 10;
  if (r === 0) return <span className="ss-ar-delta is-flat">0{unit}</span>;
  return (
    <span className={`ss-ar-delta ${r > 0 ? "is-up" : "is-down"}`}>
      <span aria-hidden="true">{r > 0 ? "▲" : "▼"}</span>
      <span className="ss-sr">{r > 0 ? "Up " : "Down "}</span>
      {Math.abs(r)}
      {unit}
    </span>
  );
}

function Meter({ score, stream }: { score: number; stream: number }) {
  return (
    <div className="ss-ar-score">
      <b>{score}</b>
      <span className="ss-ar-meter" aria-hidden="true">
        <i data-tone={tone(score)} style={{ width: `${clamp(score)}%` }} />
        <u title={`Stream average ${stream}`} style={{ left: `${clamp(stream)}%` }} />
      </span>
    </div>
  );
}

interface TrendPoint {
  label: string;
  me: number;
  stream: number;
}

function Trend({ points }: { points: TrendPoint[] }) {
  const W = 640;
  const H = 170;
  const L = 34;
  const R = 14;
  const T = 14;
  const B = 28;
  const all = points.flatMap((p) => [p.me, p.stream]);
  let lo = Math.max(0, Math.floor((Math.min(...all) - 8) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...all) + 8) / 10) * 10);
  if (hi - lo < 20) {
    lo = Math.max(0, hi - 20);
    hi = lo + 20;
  }
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (key: "me" | "stream") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const step = Math.ceil(points.length / 7);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <figure className="ss-ar-trend">
      <figcaption>
        <span>Average by exam, oldest to newest</span>
        <span className="ss-ar-legend">
          <i className="is-me" /> You <i className="is-stream" /> Stream average
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your average across ${points.length} exams, from ${points[0].me.toFixed(1)}% to ${points[points.length - 1].me.toFixed(1)}%`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ss-ar-grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <path d={line("stream")} className="ss-ar-line-stream" />
        <path d={line("me")} className="ss-ar-line-me" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.me)} r={4} className="ss-ar-dot">
              <title>{`${p.label}: ${p.me.toFixed(1)}% (stream ${p.stream.toFixed(1)}%)`}</title>
            </circle>
            {i % step === 0 || i === points.length - 1 ? (
              <text x={x(i)} y={H - 8} textAnchor="middle">
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AcademicResults({ loadExams = sampleLoad, learner, unread, logoSrc, onDownload }: AcademicResultsProps) {
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [params, setParams] = useSearchParams();
  /** null = default (newest shown exam open). Otherwise the exact set of open exam ids. */
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadExams()
      .then((rows) => {
        if (cancelled) return;
        setExams(rows);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : "Could not load your results.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // loadExams is read once per attempt on purpose, so an inline function does not refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const filters: Filters = {
    year: params.get("year") ?? ALL,
    term: params.get("term") ?? ALL,
    type: params.get("type") ?? ALL,
  };
  const setFilter = (key: keyof Filters, value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
    setOpenIds(null);
  };
  const resetFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
    setOpenIds(null);
  };

  /* Newest first. "Since previous exam" is always worked out on the full list, so filters do not change it. */
  const progress = useMemo(() => buildProgress(exams), [exams]);
  const rows = useMemo(
    () => progress.stats.map((s, i) => ({ ...s, prev: i > 0 ? progress.stats[i - 1] : null })).reverse(),
    [progress],
  );

  const years = useMemo(() => Array.from(new Set(exams.map(yearOf))).sort().reverse(), [exams]);
  const terms = useMemo(() => Array.from(new Set(exams.map(termOf))).sort(), [exams]);
  const types = useMemo(() => Array.from(new Set(exams.map(typeOf))).sort(), [exams]);

  const shown = rows.filter(
    (r) =>
      (filters.year === ALL || yearOf(r.exam) === filters.year) &&
      (filters.term === ALL || termOf(r.exam) === filters.term) &&
      (filters.type === ALL || typeOf(r.exam) === filters.type),
  );
  const filtered = filters.year !== ALL || filters.term !== ALL || filters.type !== ALL;

  const summary = useMemo(() => {
    if (!shown.length) return null;
    const bySubject = new Map<string, number[]>();
    shown.forEach((r) => r.exam.scores.forEach((s) => bySubject.set(s.subject, [...(bySubject.get(s.subject) ?? []), s.score])));
    const means = Array.from(bySubject.entries())
      .map(([subject, xs]) => ({ subject, mean: avg(xs) }))
      .sort((a, b) => b.mean - a.mean);
    const latest = shown[0];
    return {
      average: avg(shown.map((r) => r.me)),
      best: means[0],
      weakest: means.length > 1 ? means[means.length - 1] : null,
      latest,
      latestChange: latest.prev ? latest.me - latest.prev.me : null,
    };
  }, [shown]);

  const trend: TrendPoint[] = useMemo(
    () => [...shown].reverse().map((r) => ({ label: r.exam.short, me: r.me, stream: r.stream })),
    [shown],
  );

  const isOpen = (id: string, index: number) => (openIds ? openIds.has(id) : index === 0);
  const toggle = (id: string, index: number) => {
    const next = new Set(openIds ?? (shown[0] ? [shown[0].exam.id] : []));
    if (isOpen(id, index)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  const allOpen = shown.length > 0 && shown.every((r, i) => isOpen(r.exam.id, i));

  return (
    <LearnerShell page="academic-transcript" learner={learner} unread={unread} logoSrc={logoSrc}>
      <section className="ss-card ss-panel" aria-labelledby="ar-title">
        <header>
          <h3 id="ar-title">Exam results</h3>
          {status === "ready" ? (
            <span className="ss-count">
              {shown.length} of {rows.length} exams, newest first
            </span>
          ) : null}
        </header>

        <div className="ss-pbody">
          <div className="ss-toolbar ss-ar-filters" style={{ margin: 0 }} role="group" aria-label="Filter exams">
            <label className="ss-lab">
              Year
              <select className="ss-input ss-input-auto" value={filters.year} onChange={(e) => setFilter("year", e.target.value)} disabled={status !== "ready"}>
                <option value={ALL}>All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="ss-lab">
              Term
              <select className="ss-input ss-input-auto" value={filters.term} onChange={(e) => setFilter("term", e.target.value)} disabled={status !== "ready"}>
                <option value={ALL}>All terms</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="ss-lab">
              Exam type
              <select className="ss-input ss-input-auto" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} disabled={status !== "ready"}>
                <option value={ALL}>All exam types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {filtered ? (
              <button type="button" className="ss-link-btn ss-ar-reset" onClick={resetFilters}>
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              className="ss-btn ss-ar-download"
              disabled={status !== "ready" || !rows.length}
              onClick={() => onDownload?.("report-card", "all")}
            >
              Download transcript (PDF)
            </button>
          </div>

          <p role="status" className="ss-sr">
            {status === "loading" ? "Loading your results" : status === "ready" ? `${shown.length} exams shown` : ""}
          </p>

          {status === "loading" ? (
            <div className="ss-ar-skeleton" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          ) : null}

          {status === "error" ? (
            <div className="ss-ar-error" role="alert">
              <strong>{error}</strong>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : null}

          {status === "ready" && summary ? (
            <>
              <div className="ss-ar-kpis">
                <div>
                  <span>Latest exam</span>
                  <b>
                    {summary.latest.me.toFixed(1)}%
                    <em className="ss-ar-band" data-tone={tone(summary.latest.me)}>
                      {bandFor(summary.latest.me)}
                    </em>
                  </b>
                  <small>
                    {summary.latestChange !== null ? (
                      <>
                        <Delta value={summary.latestChange} unit=" pts" /> since {summary.latest.prev?.exam.short}
                      </>
                    ) : (
                      summary.latest.exam.short
                    )}
                  </small>
                </div>
                <div>
                  <span>Average of these exams</span>
                  <b>
                    {summary.average.toFixed(1)}%
                    <em className="ss-ar-band" data-tone={tone(summary.average)}>
                      {bandFor(summary.average)}
                    </em>
                  </b>
                  <small>{shown.length} exams shown</small>
                </div>
                <div>
                  <span>Strongest subject</span>
                  <b>{summary.best.subject}</b>
                  <small>{summary.best.mean.toFixed(1)}% average</small>
                </div>
                {summary.weakest ? (
                  <div>
                    <span>Needs most attention</span>
                    <b>{summary.weakest.subject}</b>
                    <small>{summary.weakest.mean.toFixed(1)}% average</small>
                  </div>
                ) : null}
              </div>

              {trend.length > 1 ? <Trend points={trend} /> : null}
            </>
          ) : null}

          {status === "ready" && !rows.length ? <p className="ss-empty">Your exam results will appear here once they are published.</p> : null}

          {status === "ready" && rows.length > 0 && !shown.length ? (
            <div className="ss-empty">
              No exams match these filters.{" "}
              <button type="button" className="ss-link-btn" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          ) : null}

          {status === "ready" && shown.length > 0 ? (
            <>
              <div className="ss-ar-listbar">
                <button type="button" className="ss-link-btn" onClick={() => setOpenIds(allOpen ? new Set() : new Set(shown.map((r) => r.exam.id)))}>
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              </div>

              <div className="ss-ar-list">
                {shown.map((r, index) => {
                  const scores = r.exam.scores;
                  const total = sum(scores.map((s) => s.score));
                  const ch = r.prev ? change(r.me - r.prev.me, " pts") : null;
                  const open = isOpen(r.exam.id, index);
                  const bodyId = `ar-body-${r.exam.id}`;
                  return (
                    <article key={r.exam.id} className={`ss-ar-exam${open ? " is-open" : ""}`}>
                      <button type="button" className="ss-ar-head" aria-expanded={open} aria-controls={bodyId} onClick={() => toggle(r.exam.id, index)}>
                        <span className="ss-ar-chev" aria-hidden="true">
                          ›
                        </span>
                        <span className="ss-ar-title">
                          <strong>{r.exam.name}</strong>
                          <small>
                            {fmtDate(r.exam.date)} · {termOf(r.exam)} · {typeOf(r.exam)}
                          </small>
                        </span>
                        <span className="ss-ar-chips">
                          <span className="ss-ar-chip is-strong" data-tone={tone(r.me)}>
                            {r.me.toFixed(1)}% · {bandFor(r.me)}
                          </span>
                          <span className="ss-ar-chip">
                            {ordinal(r.exam.streamPosition)}/{r.exam.streamSize} stream
                          </span>
                          <span className="ss-ar-chip">
                            {ordinal(r.exam.gradePosition)}/{r.exam.gradeSize} grade
                          </span>
                          {ch && r.prev ? (
                            <span className="ss-ar-chip" title={`Since ${r.prev.exam.short}`}>
                              <Delta value={r.me - r.prev.me} unit=" pts" />
                            </span>
                          ) : null}
                        </span>
                      </button>

                      {open ? (
                        <div id={bodyId} className="ss-ar-body">
                          <div className="ss-xscroll">
                            <table className="ss-statement ss-ar-table">
                              <thead>
                                <tr>
                                  <th scope="col">Subject</th>
                                  <th scope="col">Score</th>
                                  <th scope="col" className="ss-c">
                                    Band
                                  </th>
                                  <th scope="col" className="ss-c">
                                    vs stream
                                  </th>
                                  <th scope="col" className="ss-c">
                                    Stream avg
                                  </th>
                                  <th scope="col" className="ss-c">
                                    Grade avg
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {scores.map((s) => (
                                  <tr key={s.subject} className="ss-st-row">
                                    <td>
                                      <strong>{s.subject}</strong>
                                      <small className="ss-ar-code">{s.code ?? s.subject.slice(0, 4).toUpperCase()}</small>
                                    </td>
                                    <td className="ss-ar-scorecell">
                                      <Meter score={s.score} stream={s.stream} />
                                    </td>
                                    <td className="ss-c">
                                      <span className="ss-ar-band" data-tone={tone(s.score)}>
                                        {bandFor(s.score)}
                                      </span>
                                    </td>
                                    <td className="ss-c">
                                      <Delta value={s.score - s.stream} />
                                    </td>
                                    <td className="ss-c">{s.stream}</td>
                                    <td className="ss-c">{s.grade}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="ss-st-total">
                                  <td className="ss-st-label">Total and average</td>
                                  <td>
                                    {total} / {scores.length * 100}
                                  </td>
                                  <td className="ss-c">
                                    <span className="ss-ar-band" data-tone={tone(r.me)}>
                                      {bandFor(r.me)}
                                    </span>
                                  </td>
                                  <td className="ss-c">
                                    <Delta value={r.me - r.stream} />
                                  </td>
                                  <td className="ss-c">{r.stream.toFixed(1)}</td>
                                  <td className="ss-c">{r.grade.toFixed(1)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          <div className="ss-ar-foot">
                            <span className="ss-ar-key">
                              <u /> Tick on the bar marks the stream average
                            </span>
                            {r.exam.reportUrl ? (
                              <a className="ss-link-btn" href={r.exam.reportUrl} download>
                                Download report card
                              </a>
                            ) : (
                              <button type="button" className="ss-link-btn" onClick={() => onDownload?.("report-card", r.exam.id)}>
                                Download report card
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </LearnerShell>
  );
}