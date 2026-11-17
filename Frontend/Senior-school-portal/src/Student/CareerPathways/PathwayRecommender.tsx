import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LearnerShell, PAGE_PATHS } from "../LearnerDashboard";
import type { LearnerDashboardData } from "../LearnerDashboard";
import { CareerTabs, INTERESTS, LEVEL_LABELS, LoadState, MatchRing, MiniBar, TrackTag, fitFor, matchLabel, sampleLoadCareer, toneOf, useLoad } from "./career-shared";
import type { CareerData, Interests } from "./career-shared";

/* Styles come from App.css (career.css block). */

export interface PathwayRecommenderProps {
  loadData?: () => Promise<CareerData>;
  /** Called when the learner saves their interests. Replace with your API call. */
  onSaveInterests?: (interests: Interests) => Promise<void> | void;
  /** Called when a pathway is saved or removed from the shortlist. */
  onSavePathway?: (id: string, saved: boolean) => void;
  /** Called with a ready-made question just before the learner is sent to Mwalimu AI. */
  onAskAi?: (question: string) => void;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
}

const DEFAULTS: Interests = { problem: 3, helping: 3, creating: 3, leading: 3, hands: 3, research: 3, performing: 3 };

export default function PathwayRecommender({ loadData = sampleLoadCareer, onSaveInterests, onSavePathway, onAskAi, learner, unread, logoSrc }: PathwayRecommenderProps) {
  const { data, status, error, retry } = useLoad(loadData);
  const navigate = useNavigate();

  const [edited, setEdited] = useState<Interests | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  const interests = edited ?? data?.interests ?? DEFAULTS;
  const saved = savedIds ?? data?.savedIds ?? [];
  const dirty = !!edited && !!data && INTERESTS.some((i) => edited[i.key] !== data.interests[i.key]);

  const ranked = useMemo(
    () => (data ? data.pathways.map((p) => ({ p, fit: fitFor(p, data, interests) })).sort((a, b) => b.fit.total - a.fit.total) : []),
    [data, interests],
  );
  const top = ranked.slice(0, 3);
  const strengths = useMemo(() => (data ? [...data.subjects].sort((a, b) => b.score - a.score).slice(0, 5) : []), [data]);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSavedIds(next);
    onSavePathway?.(id, next.includes(id));
  };

  const saveInterests = async () => {
    if (!edited) return;
    setSaveState("saving");
    try {
      await onSaveInterests?.(edited);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const ask = (title: string) => {
    onAskAi?.(`Tell me more about a career in ${title}. What should I do in Grade 10 to prepare?`);
    navigate(PAGE_PATHS.ai);
  };

  return (
    <LearnerShell page="career-recommender" learner={learner} unread={unread} logoSrc={logoSrc}>
      <CareerTabs />
      <LoadState status={status} error={error} onRetry={retry} />

      {status === "ready" && data ? (
        <>
          <section className="ss-cp-intro" aria-label="About your suggestions">
            <div>
              <span className="ss-cp-eyebrow">Based on your marks and interests</span>
              <h2>Pathways that could suit you</h2>
              <p>These are ideas, not decisions. Change your answers on the right and the suggestions update straight away.</p>
            </div>
            <div className="ss-cp-profile">
              <span>Interest profile</span>
              <div className="ss-bar" role="progressbar" aria-valuenow={data.profilePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Interest profile complete">
                <i style={{ width: `${data.profilePercent}%` }} />
              </div>
              <small>{data.profilePercent}% complete. {data.profilePercent < 100 ? "Answer every interest to sharpen the results." : "Nice, your profile is complete."}</small>
            </div>
          </section>

          <div className="ss-cp-grid">
            {/* ------------- Top matches ------------- */}
            <div className="ss-cp-main">
              <h3 className="ss-cp-h">Your top {top.length} matches</h3>
              {top.map(({ p, fit }, i) => (
                <article key={p.id} className="ss-cp-rec" data-track={p.track}>
                  <span className="ss-cp-rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="ss-cp-rec-body">
                    <header>
                      <div>
                        <TrackTag track={p.track} />
                        <h4>{p.title}</h4>
                        <small className="ss-cp-matchlabel" data-tone={toneOf(fit.total)}>
                          {matchLabel(fit.total)}
                        </small>
                      </div>
                      <MatchRing value={fit.total} />
                    </header>
                    <p>{p.summary}</p>

                    <div className="ss-cp-fits">
                      <MiniBar label="Subjects fit" value={fit.subjects} />
                      <MiniBar label="Interests fit" value={fit.interests} />
                    </div>

                    {fit.reasons.length ? (
                      <ul className="ss-cp-why">
                        {fit.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                    {fit.gaps.length ? (
                      <div className="ss-cp-gap">
                        <strong>To work on</strong>
                        <ul>
                          {fit.gaps.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="ss-cp-actions">
                      <Link className="ss-btn ss-btn-sm" to={`${PAGE_PATHS["career-explorer"]}?pathway=${p.id}`}>
                        View pathway
                      </Link>
                      <button type="button" className="ss-btn ss-btn-sm" aria-pressed={saved.includes(p.id)} onClick={() => toggleSaved(p.id)}>
                        {saved.includes(p.id) ? "Saved ✓" : "Save for later"}
                      </button>
                      <button type="button" className="ss-link-btn" onClick={() => ask(p.title)}>
                        Ask Mwalimu AI
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <p className="ss-cp-more">
                {ranked.length - top.length} more pathways are ranked below these.{" "}
                <Link className="ss-link-btn" to={PAGE_PATHS["career-explorer"]}>
                  Explore all pathways
                </Link>
              </p>
              <p className="ss-muted">Matches combine your subject marks (60%) and your interests (40%). Talk to your teacher or career guide before you choose.</p>
            </div>

            {/* ------------- Sidebar: interests + strengths ------------- */}
            <aside className="ss-cp-side" aria-label="Your profile">
              <section className="ss-card ss-panel" aria-labelledby="cp-int">
                <header>
                  <h3 id="cp-int">What do you enjoy?</h3>
                </header>
                <div className="ss-pbody">
                  <p className="ss-muted" style={{ margin: 0 }}>
                    Slide each one from "Not me" to "Very me".
                  </p>
                  {INTERESTS.map((it) => (
                    <div className="ss-cp-slider" key={it.key}>
                      <label htmlFor={`int-${it.key}`}>
                        {it.label}
                        <b>{LEVEL_LABELS[interests[it.key] - 1]}</b>
                      </label>
                      <input
                        id={`int-${it.key}`}
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={interests[it.key]}
                        aria-valuetext={LEVEL_LABELS[interests[it.key] - 1]}
                        onChange={(e) => {
                          setEdited({ ...interests, [it.key]: Number(e.target.value) });
                          setSaveState("idle");
                        }}
                      />
                    </div>
                  ))}
                  <button type="button" className="ss-btn ss-btn-primary" disabled={!dirty || saveState === "saving"} onClick={saveInterests}>
                    {saveState === "saving" ? "Saving…" : "Save my answers"}
                  </button>
                  <p role="status" className="ss-cp-save">
                    {saveState === "saved" ? "Saved. Your teacher can see this if you chose to share it." : saveState === "error" ? "Could not save. Please try again." : dirty ? "You have unsaved changes." : ""}
                  </p>
                </div>
              </section>

              <section className="ss-card ss-panel" aria-labelledby="cp-str">
                <header>
                  <h3 id="cp-str">Your strongest subjects</h3>
                </header>
                <div className="ss-pbody">
                  {strengths.map((s) => (
                    <div className="ss-cp-subj" key={s.subject}>
                      <span>{s.subject}</span>
                      <div className="ss-bar" role="progressbar" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.subject} score`}>
                        <i style={{ width: `${s.score}%` }} />
                      </div>
                      <b>{s.score}</b>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </LearnerShell>
  );
}