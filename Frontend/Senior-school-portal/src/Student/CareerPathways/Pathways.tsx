import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LearnerShell, PAGE_PATHS } from "../LearnerDashboard";
import type { LearnerDashboardData } from "../LearnerDashboard";
import { CareerTabs, LoadState, MatchRing, MiniBar, TRACKS, TrackTag, fitFor, matchLabel, sampleLoadCareer, toneOf, useLoad } from "./career-shared";
import type { CareerData } from "./career-shared";

/* Styles come from App.css (career.css block). */

export interface PathwaysProps {
  loadData?: () => Promise<CareerData>;
  onSavePathway?: (id: string, saved: boolean) => void;
  onAskAi?: (question: string) => void;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
}

const ALL = "All";

export default function Pathways({ loadData = sampleLoadCareer, onSavePathway, onAskAi, learner, unread, logoSrc }: PathwaysProps) {
  const { data, status, error, retry } = useLoad(loadData);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [savedIds, setSavedIds] = useState<string[] | null>(null);
  const [sort, setSort] = useState<"match" | "name">("match");
  const detailRef = useRef<HTMLElement>(null);

  /* Filters and the open pathway live in the URL so a refresh or shared link keeps them. */
  const q = params.get("q") ?? "";
  const track = params.get("track") ?? ALL;
  const savedOnly = params.get("saved") === "1";
  const wanted = params.get("pathway");
  const setParam = (key: string, value: string | null, replace = true) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace });
  };

  const saved = savedIds ?? data?.savedIds ?? [];
  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSavedIds(next);
    onSavePathway?.(id, next.includes(id));
  };

  const ranked = useMemo(() => (data ? data.pathways.map((p) => ({ p, fit: fitFor(p, data, data.interests) })) : []), [data]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ranked
      .filter(({ p }) => track === ALL || p.track === track)
      .filter(({ p }) => !savedOnly || saved.includes(p.id))
      .filter(({ p }) => !needle || `${p.title} ${p.summary} ${p.careers.map((c) => c.title).join(" ")} ${p.courses.join(" ")}`.toLowerCase().includes(needle))
      .sort((a, b) => (sort === "match" ? b.fit.total - a.fit.total : a.p.title.localeCompare(b.p.title)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, q, track, savedOnly, sort, savedIds]);

  const active = shown.find(({ p }) => p.id === wanted) ?? shown[0] ?? null;
  const filtered = q !== "" || track !== ALL || savedOnly;
  const clear = () => setParams(new URLSearchParams(), { replace: true });

  /* On a phone the detail sits under the list, so bring it into view after a pick. */
  useEffect(() => {
    if (wanted && window.innerWidth < 900) detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [wanted]);

  const marks = new Map((data?.subjects ?? []).map((s) => [s.subject, s.score]));
  const ask = (title: string) => {
    onAskAi?.(`Tell me more about a career in ${title}. What should I do in Grade 10 to prepare?`);
    navigate(PAGE_PATHS.ai);
  };

  return (
    <LearnerShell page="career-explorer" learner={learner} unread={unread} logoSrc={logoSrc}>
      <CareerTabs />
      <LoadState status={status} error={error} onRetry={retry} />

      {status === "ready" && data ? (
        <>
          <div className="ss-cp-tracks" role="group" aria-label="Filter by track">
            <button type="button" className={track === ALL ? "is-on" : ""} aria-pressed={track === ALL} onClick={() => setParam("track", null)}>
              <strong>All pathways</strong>
              <small>{data.pathways.length} to explore</small>
            </button>
            {TRACKS.map((t) => (
              <button key={t.key} type="button" data-track={t.key} className={track === t.key ? "is-on" : ""} aria-pressed={track === t.key} onClick={() => setParam("track", t.key)}>
                <strong>{t.label}</strong>
                <small>{t.blurb}</small>
              </button>
            ))}
          </div>

          <div className="ss-toolbar ss-cp-filters" style={{ margin: "0 0 16px" }} role="group" aria-label="Search and sort">
            <label className="ss-lab">
              Search
              <input className="ss-input ss-input-auto" type="search" placeholder="For example: doctor, design, law" value={q} onChange={(e) => setParam("q", e.target.value || null)} />
            </label>
            <label className="ss-lab">
              Sort by
              <select className="ss-input ss-input-auto" value={sort} onChange={(e) => setSort(e.target.value as "match" | "name")}>
                <option value="match">Best match first</option>
                <option value="name">Name A to Z</option>
              </select>
            </label>
            <label className="ss-cp-check">
              <input type="checkbox" checked={savedOnly} onChange={(e) => setParam("saved", e.target.checked ? "1" : null)} />
              Saved only ({saved.length})
            </label>
            {filtered ? (
              <button type="button" className="ss-link-btn" onClick={clear}>
                Clear filters
              </button>
            ) : null}
          </div>
          <p role="status" className="ss-sr">{`${shown.length} pathways shown`}</p>

          {!shown.length ? (
            <p className="ss-empty">
              No pathways match these filters.{" "}
              <button type="button" className="ss-link-btn" onClick={clear}>
                Clear filters
              </button>
            </p>
          ) : (
            <div className="ss-cp-explore">
              {/* ------------- List ------------- */}
              <ul className="ss-cp-list" aria-label="Pathways">
                {shown.map(({ p, fit }) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`ss-cp-item${active?.p.id === p.id ? " is-on" : ""}`}
                      data-track={p.track}
                      aria-current={active?.p.id === p.id ? "true" : undefined}
                      onClick={() => setParam("pathway", p.id)}
                    >
                      <span className="ss-cp-item-top">
                        <TrackTag track={p.track} />
                        {saved.includes(p.id) ? <span className="ss-cp-star" title="Saved">★<span className="ss-sr"> Saved</span></span> : null}
                      </span>
                      <strong>{p.title}</strong>
                      <span className="ss-cp-item-bar">
                        <span className="ss-bar" aria-hidden="true">
                          <i data-tone={toneOf(fit.total)} style={{ width: `${fit.total}%` }} />
                        </span>
                        <b>{fit.total}%</b>
                      </span>
                      <small>{p.careers.slice(0, 3).map((c) => c.title).join(" · ")}</small>
                    </button>
                  </li>
                ))}
              </ul>

              {/* ------------- Detail ------------- */}
              {active ? (
                <section ref={detailRef} className="ss-card ss-cp-detail" data-track={active.p.track} aria-labelledby="cp-detail-title" tabIndex={-1}>
                  <header className="ss-cp-detail-head">
                    <div>
                      <TrackTag track={active.p.track} />
                      <h3 id="cp-detail-title">{active.p.title}</h3>
                      <small className="ss-cp-matchlabel" data-tone={toneOf(active.fit.total)}>
                        {matchLabel(active.fit.total)} for you
                      </small>
                    </div>
                    <MatchRing value={active.fit.total} size={72} />
                  </header>
                  <p className="ss-cp-lead">{active.p.summary}</p>

                  <div className="ss-cp-actions">
                    <button type="button" className="ss-btn ss-btn-sm" aria-pressed={saved.includes(active.p.id)} onClick={() => toggleSaved(active.p.id)}>
                      {saved.includes(active.p.id) ? "Saved ✓" : "Save for later"}
                    </button>
                    <button type="button" className="ss-btn ss-btn-sm ss-btn-primary" onClick={() => ask(active.p.title)}>
                      Ask Mwalimu AI about this
                    </button>
                  </div>

                  <h4 className="ss-cp-sub">How you match</h4>
                  <div className="ss-cp-fits">
                    <MiniBar label="Subjects fit" value={active.fit.subjects} />
                    <MiniBar label="Interests fit" value={active.fit.interests} />
                  </div>
                  {active.fit.reasons.length ? (
                    <ul className="ss-cp-why">
                      {active.fit.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {active.fit.gaps.length ? (
                    <div className="ss-cp-gap">
                      <strong>To work on</strong>
                      <ul>
                        {active.fit.gaps.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <h4 className="ss-cp-sub">Subjects that matter</h4>
                  <div className="ss-xscroll">
                    <table className="ss-cp-table">
                      <thead>
                        <tr>
                          <th scope="col">Subject</th>
                          <th scope="col">Importance</th>
                          <th scope="col">Your mark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.p.subjects.map((s) => {
                          const m = marks.get(s.name);
                          return (
                            <tr key={s.name}>
                              <th scope="row">{s.name}</th>
                              <td>{s.role === "core" ? "Core" : "Helpful"}</td>
                              <td>
                                {m == null ? (
                                  <span className="ss-muted">Not in your record</span>
                                ) : (
                                  <span className="ss-cp-subj ss-cp-subj-inline">
                                    <span className="ss-bar" aria-hidden="true">
                                      <i style={{ width: `${m}%` }} />
                                    </span>
                                    <b>{m}</b>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="ss-cp-sub">Careers you could follow</h4>
                  <ul className="ss-cp-careers">
                    {active.p.careers.map((c) => (
                      <li key={c.title}>
                        <div>
                          <strong>{c.title}</strong>
                          <small>{c.blurb}</small>
                        </div>
                        <span className="ss-cp-demand" data-demand={c.demand.toLowerCase().replace(" ", "-")}>
                          {c.demand}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <h4 className="ss-cp-sub">University and college courses</h4>
                  <div className="ss-cp-chips">
                    {active.p.courses.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>

                  <h4 className="ss-cp-sub">Skills to build</h4>
                  <div className="ss-cp-chips is-soft">
                    {active.p.skills.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>

                  <h4 className="ss-cp-sub">Good next steps</h4>
                  <ol className="ss-cp-steps">
                    {active.p.nextSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="ss-muted" style={{ margin: "16px 0 0" }}>
                    Match scores are guides, not decisions. Talk to your teacher or career guide before you choose.
                  </p>
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </LearnerShell>
  );
}