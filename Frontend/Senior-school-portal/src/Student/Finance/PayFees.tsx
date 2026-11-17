import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { LearnerShell } from "../LearnerDashboard";
import type { LearnerDashboardData } from "../LearnerDashboard";
import { CopyBtn, DEFAULT_PATHS, FeesTabs, LoadState, buildLedger, fmtDay, fmtKES, sampleLoadAccount, useLoad } from "./fees-shared";
import type { FeesAccount, FeesPaths } from "./fees-shared";

/* Styles come from App.css (fees.css block). */

export interface PaymentRequest {
  method: "mpesa" | "card";
  amount: number;
  /** 2547XXXXXXXX, only for M-Pesa. */
  phone?: string;
}
export interface PaymentResult {
  reference: string;
}

export interface PayFeesProps {
  loadAccount?: () => Promise<FeesAccount>;
  /**
   * Replace with your API call. For M-Pesa it should trigger an STK push and resolve once
   * the payment is confirmed (or reject with a readable Error). For card it should resolve
   * after the checkout completes, or you can redirect to your gateway inside it.
   */
  onPay?: (_req: PaymentRequest) => Promise<PaymentResult>;
  learner?: LearnerDashboardData["learner"];
  unread?: number;
  logoSrc?: string;
  paths?: FeesPaths;
}

const samplePay = (_req: PaymentRequest) =>
  new Promise<PaymentResult>((resolve) => setTimeout(() => resolve({ reference: `S${Math.random().toString(36).slice(2, 11).toUpperCase()}` }), 2200));

type MethodKey = "mpesa" | "paybill" | "bank" | "card";
const METHODS: { key: MethodKey; title: string; sub: string }[] = [
  { key: "mpesa", title: "M-Pesa prompt", sub: "We send a request to your phone" },
  { key: "paybill", title: "M-Pesa Paybill", sub: "Pay manually from the M-Pesa menu" },
  { key: "bank", title: "Bank deposit", sub: "Deposit and keep the slip" },
  { key: "card", title: "Card", sub: "Visa or Mastercard, secure checkout" },
];

/** Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, +2547XXXXXXXX and returns 2547XXXXXXXX. */
const normPhone = (s: string) => {
  const m = s.replace(/[\s-]/g, "").match(/^(?:\+?254|0)?([71]\d{8})$/);
  return m ? `254${m[1]}` : null;
};

export default function PayFees({ loadAccount = sampleLoadAccount, onPay = samplePay, learner, unread, logoSrc, paths = DEFAULT_PATHS }: PayFeesProps) {
  const { data: account, status, error, retry } = useLoad(loadAccount);
  const ledger = useMemo(() => (account ? buildLedger(account) : []), [account]);
  const balance = ledger.length ? ledger[ledger.length - 1].balance : (account?.opening.amount ?? 0);
  const recent = useMemo(() => ledger.filter((r) => r.type === "payment" || r.type === "bursary").slice(-3).reverse(), [ledger]);

  const [method, setMethod] = useState<MethodKey>("mpesa");
  const [mode, setMode] = useState<"full" | "custom">("full");
  const [custom, setCustom] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<{ s: "idle" | "pending" | "done" | "fail"; msg?: string; ref?: string; paid?: number }>({ s: "idle" });

  const amount = mode === "full" ? balance : Number(custom);
  const amountError =
    mode === "custom" && custom !== ""
      ? !Number.isFinite(amount) || amount < 10
        ? "Enter at least KES 10."
        : amount > balance
          ? `The amount cannot be more than your balance of ${fmtKES(balance)}.`
          : ""
      : "";
  const phoneNorm = normPhone(phone);
  const phoneError = method === "mpesa" && phone !== "" && !phoneNorm ? "Enter a valid Safaricom or Airtel number, e.g. 0712 345 678." : "";
  const canPay = balance > 0 && amount >= 10 && amount <= balance && (method === "card" || (method === "mpesa" && !!phoneNorm));
  const busy = state.s === "pending";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPay || busy || (method !== "mpesa" && method !== "card")) return;
    setState({ s: "pending" });
    try {
      const res = await onPay({ method, amount, phone: phoneNorm ?? undefined });
      setState({ s: "done", ref: res.reference, paid: amount });
    } catch (err) {
      setState({ s: "fail", msg: err instanceof Error && err.message ? err.message : "The payment did not go through. You have not been charged." });
    }
  };

  const reset = () => {
    setState({ s: "idle" });
    setCustom("");
    setMode("full");
  };

  return (
    <LearnerShell page="fees-pay" learner={learner} unread={unread} logoSrc={logoSrc}>
      <FeesTabs paths={paths} />
      <LoadState status={status} error={error} onRetry={retry} />

      {status === "ready" && account ? (
        <div className="ss-fee-grid">
          {/* ---------------- Left: payment form ---------------- */}
          <section className="ss-card ss-panel" aria-labelledby="pf-title">
            <header>
              <h3 id="pf-title">Make a payment</h3>
            </header>
            <div className="ss-pbody">
              {state.s === "done" ? (
                <div className="ss-fee-done" role="status">
                  <span className="ss-fee-tick" aria-hidden="true">
                    ✓
                  </span>
                  <h4>Payment received</h4>
                  <p>
                    {fmtKES(state.paid ?? 0)} has been paid. Your statement will show it as {state.ref}.
                  </p>
                  <div className="ss-fee-actions">
                    <NavLink className="ss-btn" to={paths.statement}>
                      View statement
                    </NavLink>
                    <button type="button" className="ss-link-btn" onClick={reset}>
                      Make another payment
                    </button>
                  </div>
                </div>
              ) : balance <= 0 ? (
                <p className="ss-empty">You have no outstanding balance. Thank you!</p>
              ) : (
                <form onSubmit={submit} noValidate>
                  <fieldset className="ss-fee-set" disabled={busy}>
                    <legend>1. Choose how to pay</legend>
                    <div className="ss-fee-methods" role="radiogroup" aria-label="Payment method">
                      {METHODS.map((m) => (
                        <label key={m.key} className={`ss-fee-method${method === m.key ? " is-on" : ""}`}>
                          <input type="radio" name="method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} />
                          <strong>{m.title}</strong>
                          <small>{m.sub}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {method === "mpesa" || method === "card" ? (
                    <>
                      <fieldset className="ss-fee-set" disabled={busy}>
                        <legend>2. Amount</legend>
                        <div className="ss-fee-amounts">
                          <label className={`ss-fee-opt${mode === "full" ? " is-on" : ""}`}>
                            <input type="radio" name="amt" checked={mode === "full"} onChange={() => setMode("full")} />
                            <span>
                              Full balance <b>{fmtKES(balance)}</b>
                            </span>
                          </label>
                          <label className={`ss-fee-opt${mode === "custom" ? " is-on" : ""}`}>
                            <input type="radio" name="amt" checked={mode === "custom"} onChange={() => setMode("custom")} />
                            <span>Another amount</span>
                          </label>
                        </div>
                        {mode === "custom" ? (
                          <label className="ss-lab">
                            Amount (KES)
                            <input
                              className="ss-input"
                              inputMode="numeric"
                              type="number"
                              min={10}
                              max={balance}
                              step="1"
                              value={custom}
                              onChange={(e) => setCustom(e.target.value)}
                              aria-invalid={!!amountError}
                              aria-describedby={amountError ? "pf-amt-err" : undefined}
                              placeholder="e.g. 5000"
                            />
                          </label>
                        ) : null}
                        {amountError ? (
                          <p id="pf-amt-err" className="ss-fee-err">
                            {amountError}
                          </p>
                        ) : null}
                      </fieldset>

                      {method === "mpesa" ? (
                        <fieldset className="ss-fee-set" disabled={busy}>
                          <legend>3. M-Pesa number</legend>
                          <label className="ss-lab">
                            Phone number
                            <input
                              className="ss-input"
                              type="tel"
                              autoComplete="tel"
                              inputMode="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              aria-invalid={!!phoneError}
                              aria-describedby={phoneError ? "pf-ph-err" : undefined}
                              placeholder="0712 345 678"
                            />
                          </label>
                          {phoneError ? (
                            <p id="pf-ph-err" className="ss-fee-err">
                              {phoneError}
                            </p>
                          ) : null}
                        </fieldset>
                      ) : (
                        <p className="ss-page-note">You will be taken to a secure card checkout to finish the payment.</p>
                      )}

                      {state.s === "fail" ? (
                        <div className="ss-fee-error" role="alert">
                          <strong>{state.msg}</strong>
                        </div>
                      ) : null}
                      {busy ? (
                        <p className="ss-fee-wait" role="status">
                          {method === "mpesa" ? `Check your phone and enter your M-Pesa PIN to pay ${fmtKES(amount)}.` : "Opening secure checkout…"}
                        </p>
                      ) : null}

                      <button type="submit" className="ss-btn ss-fee-pay" disabled={!canPay || busy}>
                        {busy ? "Waiting for confirmation…" : `Pay ${canPay ? fmtKES(amount) : ""}`.trim()}
                      </button>
                    </>
                  ) : null}

                  {method === "paybill" ? (
                    <ol className="ss-fee-steps">
                      <li>Open M-Pesa, then Lipa na M-Pesa, then Pay Bill.</li>
                      <li>
                        Business number: <b>{account.paybill.number}</b> <CopyBtn value={account.paybill.number} label="business number" />
                      </li>
                      <li>
                        Account number: <b>{account.paybill.account}</b> <CopyBtn value={account.paybill.account} label="account number" />
                      </li>
                      <li>Enter the amount and your PIN. You will get an M-Pesa confirmation message.</li>
                      <li>Your statement updates after the school confirms the payment, usually within a few minutes.</li>
                    </ol>
                  ) : null}

                  {method === "bank" ? (
                    <>
                      <dl className="ss-dl ss-dl-one ss-fee-bank">
                        <div>
                          <dt>Bank</dt>
                          <dd>
                            {account.bank.name}, {account.bank.branch} branch
                          </dd>
                        </div>
                        <div>
                          <dt>Account name</dt>
                          <dd>{account.bank.accountName}</dd>
                        </div>
                        <div>
                          <dt>Account number</dt>
                          <dd>
                            {account.bank.accountNo} <CopyBtn value={account.bank.accountNo.replace(/\s/g, "")} label="account number" />
                          </dd>
                        </div>
                        <div>
                          <dt>Reference to write on the slip</dt>
                          <dd>
                            {account.admissionNo} <CopyBtn value={account.admissionNo} label="reference" />
                          </dd>
                        </div>
                      </dl>
                      <p className="ss-page-note">Keep the bank slip. The Finance office will post your payment once it is confirmed.</p>
                    </>
                  ) : null}
                </form>
              )}
            </div>
          </section>

          {/* ---------------- Right: balance + recent ---------------- */}
          <aside className="ss-fee-side" aria-label="Account summary">
            <section className="ss-card ss-fee-balance">
              <span>Outstanding balance</span>
              <b className={balance > 0 ? "is-owing" : "is-clear"}>{fmtKES(balance)}</b>
              {balance > 0 ? (
                <small>
                  {account.dueLabel}, due {fmtDay(account.dueDate)}
                </small>
              ) : (
                <small>All paid up</small>
              )}
              <hr />
              <dl className="ss-fee-mini">
                <div>
                  <dt>Admission no.</dt>
                  <dd>{account.admissionNo}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>
                    {account.grade}, {account.residency === "boarding" ? "Boarder" : "Day scholar"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="ss-card ss-panel" aria-labelledby="pf-recent">
              <header>
                <h3 id="pf-recent">Recent payments</h3>
                <NavLink className="ss-link-btn" to={paths.statement}>
                  See all
                </NavLink>
              </header>
              <div className="ss-pbody">
                {recent.length ? (
                  <ul className="ss-fee-recent">
                    {recent.map((r) => (
                      <li key={r.id}>
                        <span>
                          <strong>{r.description}</strong>
                          <small>
                            {fmtDay(r.date)} · {r.ref}
                          </small>
                        </span>
                        <b>{fmtKES(r.credit)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ss-empty">No payments yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </LearnerShell>
  );
}