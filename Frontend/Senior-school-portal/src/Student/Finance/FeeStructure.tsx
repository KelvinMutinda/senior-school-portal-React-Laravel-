import { useMemo, useState } from "react";
import { LearnerShell } from "../LearnerDashboard";
import type { LearnerDashboardData } from "../LearnerDashboard";
import { DEFAULT_PATHS, FeesTabs, LoadState, TERMS, fmtDay, fmtKES, sampleLoadStructure, useLoad } from "./fees-shared";
import type { FeeStructureData, FeesPaths, Residency } from "./fees-shared";

/* Styles come from App.css (fees.css block). */

export interface FeeStructureProps {
  loadStructure?: () => Promise<FeeStructureData>;
  /** Which fees to show first. Pass the learner's own residency from your API. */
  defaultResidency?: Residency;
  onDownload?: () => void;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
  paths?: FeesPaths;
}

const sum3 = (a: number[][]) => [0, 1, 2].map((i) => a.reduce((t, r) => t + r[i], 0));

export default function FeeStructure({ loadStructure = sampleLoadStructure, defaultResidency = "boarding", onDownload, learner, unread, logoSrc, paths = DEFAULT_PATHS }: FeeStructureProps) {
  const { data, status, error, retry } = useLoad(loadStructure);
  const [residency, setResidency] = useState<Residency>(defaultResidency);
  const [optional, setOptional] = useState(false);

  const view = useMemo(() => {
    if (!data) return null;
    const items = data.items.filter((i) => (i.audience === "all" || i.audience === residency) && (optional || !i.optional));
    const cats = Array.from(new Set(items.map((i) => i.category)));
    const groups = cats.map((c) => {
      const rows = items.filter((i) => i.category === c);
      return { name: c, rows, totals: sum3(rows.map((r) => r.amounts)) };
    });
    const terms = sum3(items.map((i) => i.amounts));
    const year = terms.reduce((a, b) => a + b, 0);
    return { groups, terms, year };
  }, [data, residency, optional]);

  return (
    <LearnerShell page="fees-structure" learner={learner} unread={unread} logoSrc={logoSrc}>
      <FeesTabs paths={paths} />
      <LoadState status={status} error={error} onRetry={retry} />

      {status === "ready" && data && view ? (
        <section className="ss-card ss-panel" aria-labelledby="fs-title">
          <header>
            <h3 id="fs-title">
              Fee structure {data.year} · {data.grade}
            </h3>
            <button type="button" className="ss-btn ss-btn-sm" onClick={() => onDownload?.()}>
              Download (PDF)
            </button>
          </header>

          <div className="ss-pbody">
            <div className="ss-fee-controls">
              <div className="ss-seg ss-seg-lg" role="group" aria-label="Learner type">
                {(["boarding", "day"] as Residency[]).map((r) => (
                  <button key={r} type="button" className={residency === r ? "is-on" : ""} aria-pressed={residency === r} onClick={() => setResidency(r)}>
                    {r === "boarding" ? "Boarder" : "Day scholar"}
                  </button>
                ))}
              </div>
              <label className="ss-fee-check">
                <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
                Include optional items (bus, trip, sports kit)
              </label>
            </div>

            <div className="ss-fee-terms">
              {TERMS.map((t, i) => (
                <div key={t}>
                  <span>{t}</span>
                  <b>{fmtKES(view.terms[i])}</b>
                  <small>Due {fmtDay(data.dueDates[i])}</small>
                </div>
              ))}
              <div className="is-year">
                <span>Whole year</span>
                <b>{fmtKES(view.year)}</b>
                <small>{view.groups.reduce((n, g) => n + g.rows.length, 0)} fee items</small>
              </div>
            </div>

            <div className="ss-fee-split" role="img" aria-label={`Where the money goes: ${view.groups.map((g) => `${g.name} ${Math.round((g.totals.reduce((a, b) => a + b, 0) / view.year) * 100)}%`).join(", ")}`}>
              {view.groups.map((g, i) => (
                <i key={g.name} data-i={i % 5} style={{ width: `${(g.totals.reduce((a, b) => a + b, 0) / view.year) * 100}%` }} title={g.name} />
              ))}
            </div>
            <ul className="ss-fee-legend">
              {view.groups.map((g, i) => (
                <li key={g.name} data-i={i % 5}>
                  <i /> {g.name} <b>{Math.round((g.totals.reduce((a, b) => a + b, 0) / view.year) * 100)}%</b>
                </li>
              ))}
            </ul>

            <div className="ss-xscroll">
              <table className="ss-fee-table">
                <thead>
                  <tr>
                    <th scope="col">Fee item</th>
                    {TERMS.map((t) => (
                      <th key={t} scope="col" className="ss-r">
                        {t}
                      </th>
                    ))}
                    <th scope="col" className="ss-r">
                      Year
                    </th>
                  </tr>
                </thead>
                {view.groups.map((g) => (
                  <tbody key={g.name}>
                    <tr className="ss-fee-cat">
                      <th scope="colgroup" colSpan={5}>
                        {g.name}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row">
                          {r.name}
                          {r.optional ? <em className="ss-fee-tag">Optional</em> : null}
                          {r.note ? <small>{r.note}</small> : null}
                        </th>
                        {r.amounts.map((a, i) => (
                          <td key={i} className="ss-r">
                            {a ? a.toLocaleString("en-KE") : <span className="ss-fee-dash">–</span>}
                          </td>
                        ))}
                        <td className="ss-r">
                          <b>{r.amounts.reduce((x, y) => x + y, 0).toLocaleString("en-KE")}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
                <tfoot>
                  <tr>
                    <th scope="row">Total (KES)</th>
                    {view.terms.map((t, i) => (
                      <td key={i} className="ss-r">
                        {t.toLocaleString("en-KE")}
                      </td>
                    ))}
                    <td className="ss-r">{view.year.toLocaleString("en-KE")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <h4 className="ss-fee-h">Good to know</h4>
            <ul className="ss-fee-notes">
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </LearnerShell>
  );
}