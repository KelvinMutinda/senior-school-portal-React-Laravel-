import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LearnerShell } from "../LearnerDashboard";
import type { LearnerDashboardData } from "../LearnerDashboard";
import { DEFAULT_PATHS, FeesTabs, LoadState, TERMS, buildLedger, fmtDay, fmtKES, sampleLoadAccount, useLoad } from "./fees-shared";
import type { EntryType, FeesAccount, FeesPaths } from "./fees-shared";

/* Styles come from App.css (fees.css block). */

export interface FeeStatementProps {
  loadAccount?: () => Promise<FeesAccount>;
  /** kind "statement" = whole statement (id "all"), "receipt" = one payment (id = entry id). */
  onDownload?: (kind: "statement" | "receipt", id: string) => void;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
  paths?: FeesPaths;
}

const ALL = "All";
const TYPE_LABEL: Record<EntryType, string> = { invoice: "Invoice", payment: "Payment", bursary: "Bursary", adjustment: "Adjustment" };

export default function FeeStatement({ loadAccount = sampleLoadAccount, onDownload, learner, unread, logoSrc, paths = DEFAULT_PATHS }: FeeStatementProps) {
  const { data: account, status, error, retry } = useLoad(loadAccount);
  const [params, setParams] = useSearchParams();

  /* Filters live in the URL (?year=2026&term=Term 3) so a refresh or shared link keeps them. */
  const year = params.get("year") ?? ALL;
  const term = params.get("term") ?? ALL;
  const setFilter = (key: "year" | "term", value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const filtered = year !== ALL || term !== ALL;

  /* Running balance is always worked out on the whole ledger, so filters never change it. */
  const ledger = useMemo(() => (account ? buildLedger(account) : []), [account]);
  const years = useMemo(() => Array.from(new Set(ledger.map((r) => r.date.slice(0, 4)))).sort().reverse(), [ledger]);
  const shown = ledger.filter((r) => (year === ALL || r.date.startsWith(year)) && (term === ALL || r.term === term));

  const totals = useMemo(() => {
    if (!account || !shown.length) return null;
    const first = ledger.indexOf(shown[0]);
    return {
      opening: first > 0 ? ledger[first - 1].balance : account.opening.amount,
      billed: shown.reduce((t, r) => t + r.debit, 0),
      paid: shown.reduce((t, r) => t + r.credit, 0),
      closing: shown[shown.length - 1].balance,
    };
  }, [account, ledger, shown]);

  const current = ledger.length ? ledger[ledger.length - 1].balance : (account?.opening.amount ?? 0);

  return (
    <LearnerShell page="fees-statement" learner={learner} unread={unread} logoSrc={logoSrc}>
      <FeesTabs paths={paths} />
      <LoadState status={status} error={error} onRetry={retry} />

      {status === "ready" && account ? (
        <section className="ss-card ss-panel ss-fee-statement" aria-labelledby="st-title">
          <header>
            <h3 id="st-title">Fee statement</h3>
            <span className="ss-count">
              {account.admissionNo} · {account.grade}
            </span>
          </header>

          <div className="ss-pbody">
            <div className="ss-toolbar ss-fee-filters" style={{ margin: 0 }} role="group" aria-label="Filter statement">
              <label className="ss-lab">
                Year
                <select className="ss-input ss-input-auto" value={year} onChange={(e) => setFilter("year", e.target.value)}>
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
                <select className="ss-input ss-input-auto" value={term} onChange={(e) => setFilter("term", e.target.value)}>
                  <option value={ALL}>All terms</option>
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {filtered ? (
                <button type="button" className="ss-link-btn ss-ar-reset" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </button>
              ) : null}
              <span className="ss-fee-spacer" />
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => onDownload?.("statement", "all")}>
                Download (PDF)
              </button>
            </div>

            <p role="status" className="ss-sr">{`${shown.length} entries shown`}</p>

            {totals ? (
              <div className="ss-fee-kpis">
                <div>
                  <span>Opening balance</span>
                  <b>{fmtKES(totals.opening)}</b>
                </div>
                <div>
                  <span>Billed</span>
                  <b>{fmtKES(totals.billed)}</b>
                </div>
                <div>
                  <span>Paid and credited</span>
                  <b className="is-clear">{fmtKES(totals.paid)}</b>
                </div>
                <div className="is-key">
                  <span>{filtered ? "Balance at end of period" : "Balance now"}</span>
                  <b className={totals.closing > 0 ? "is-owing" : "is-clear"}>{fmtKES(totals.closing)}</b>
                </div>
              </div>
            ) : null}

            {!ledger.length ? <p className="ss-empty">Your fee entries will appear here once the school posts them.</p> : null}
            {ledger.length > 0 && !shown.length ? (
              <div className="ss-empty">
                No entries match these filters.{" "}
                <button type="button" className="ss-link-btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </button>
              </div>
            ) : null}

            {shown.length ? (
              <div className="ss-xscroll">
                <table className="ss-fee-table ss-fee-ledger">
                  <caption className="ss-sr">Fee statement entries, oldest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Reference</th>
                      <th scope="col" className="ss-r">
                        Billed
                      </th>
                      <th scope="col" className="ss-r">
                        Paid
                      </th>
                      <th scope="col" className="ss-r">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {year === ALL && term === ALL ? (
                      <tr className="ss-fee-open">
                        <td colSpan={5}>{account.opening.label}</td>
                        <td className="ss-r">{fmtKES(account.opening.amount)}</td>
                      </tr>
                    ) : null}
                    {shown.map((r) => (
                      <tr key={r.id}>
                        <td className="ss-fee-nowrap">{fmtDay(r.date)}</td>
                        <td>
                          <strong>{r.description}</strong>
                          <small>
                            <em className="ss-fee-type" data-type={r.type}>
                              {TYPE_LABEL[r.type]}
                            </em>{" "}
                            {r.term}
                            {r.type === "payment" ? (
                              <>
                                {" · "}
                                <button type="button" className="ss-link-btn" onClick={() => onDownload?.("receipt", r.id)}>
                                  Receipt
                                </button>
                              </>
                            ) : null}
                          </small>
                        </td>
                        <td className="ss-fee-ref">{r.ref}</td>
                        <td className="ss-r">{r.debit ? r.debit.toLocaleString("en-KE") : <span className="ss-fee-dash">–</span>}</td>
                        <td className="ss-r is-clear">{r.credit ? r.credit.toLocaleString("en-KE") : <span className="ss-fee-dash">–</span>}</td>
                        <td className="ss-r">
                          <b>{r.balance.toLocaleString("en-KE")}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={3}>
                        Totals (KES)
                      </th>
                      <td className="ss-r">{totals?.billed.toLocaleString("en-KE")}</td>
                      <td className="ss-r">{totals?.paid.toLocaleString("en-KE")}</td>
                      <td className="ss-r">{totals?.closing.toLocaleString("en-KE")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}

            {current > 0 ? (
              <p className="ss-page-note ss-fee-foot">
                Your current balance is {fmtKES(current)}, due {fmtDay(account.dueDate)}. Use the Pay fees tab to settle it.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </LearnerShell>
  );
}