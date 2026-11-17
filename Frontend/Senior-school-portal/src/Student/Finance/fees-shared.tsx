import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { PAGE_PATHS } from "../LearnerDashboard";

/* ==========================================================================
   Shared types, FAKE sample data, helpers and small components for the three
   fee pages (PayFees, FeeStructure, FeeStatement).
   Replace the sample* loaders with your API calls later: every page takes a
   loader prop, so nothing inside the pages has to change.
   ========================================================================== */

export type Residency = "boarding" | "day";
export type TermName = "Term 1" | "Term 2" | "Term 3";
export const TERMS: TermName[] = ["Term 1", "Term 2", "Term 3"];

export interface FeeItem {
  id: string;
  name: string;
  category: string;
  audience: "all" | Residency;
  optional?: boolean;
  note?: string;
  /** Amount for Term 1, Term 2, Term 3 (0 = not charged that term). */
  amounts: [number, number, number];
}

export interface FeeStructureData {
  year: number;
  grade: string;
  items: FeeItem[];
  dueDates: [string, string, string];
  notes: string[];
}

export type EntryType = "invoice" | "payment" | "bursary" | "adjustment";

export interface StatementEntry {
  id: string;
  date: string; // YYYY-MM-DD
  ref: string;
  description: string;
  term: TermName;
  type: EntryType;
  debit: number; // increases what is owed
  credit: number; // reduces what is owed
}

export interface FeesAccount {
  admissionNo: string;
  grade: string;
  residency: Residency;
  dueDate: string;
  dueLabel: string;
  paybill: { number: string; account: string };
  bank: { name: string; accountName: string; accountNo: string; branch: string };
  opening: { label: string; amount: number };
  entries: StatementEntry[];
}

export interface LedgerRow extends StatementEntry {
  balance: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const fmtKES = (n: number) =>
  `${n < 0 ? "-" : ""}KES ${Math.abs(n).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Entries oldest first, each with the running balance (positive = owing). */
export function buildLedger(account: FeesAccount): LedgerRow[] {
  let bal = account.opening.amount;
  return [...account.entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      bal += e.debit - e.credit;
      return { ...e, balance: bal };
    });
}

export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loader()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // loader is read once per attempt on purpose, so an inline function does not refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return { data, status, error, retry: () => setAttempt((n) => n + 1) };
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

export interface FeesPaths {
  pay: string;
  structure: string;
  statement: string;
}
export const DEFAULT_PATHS: FeesPaths = {
  pay: PAGE_PATHS["fees-pay"],
  structure: PAGE_PATHS["fees-structure"],
  statement: PAGE_PATHS["fees-statement"],
};

export function FeesTabs({ paths = DEFAULT_PATHS }: { paths?: FeesPaths }) {
  const tabs: [string, string][] = [
    [paths.pay, "Pay fees"],
    [paths.structure, "Fee structure"],
    [paths.statement, "Fee statement"],
  ];
  return (
    <nav className="ss-fee-tabs" aria-label="Fees sections">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "is-on" : "")}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function LoadState({ status, error, onRetry }: { status: "loading" | "error" | "ready"; error: string; onRetry: () => void }) {
  if (status === "loading")
    return (
      <div className="ss-fee-skel" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  if (status === "error")
    return (
      <div className="ss-fee-error" role="alert">
        <strong>{error}</strong>
        <button type="button" className="ss-btn ss-btn-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  return null;
}

export function CopyBtn({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ss-link-btn ss-fee-copy"
      aria-label={`Copy ${label}`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => undefined,
        );
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* FAKE sample data (to be replaced by your database later)            */
/* ------------------------------------------------------------------ */

const wait = <T,>(v: T, ms = 500) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const SAMPLE_ACCOUNT: FeesAccount = {
  admissionNo: "SS/2026/0142",
  grade: "Grade 10",
  residency: "boarding",
  dueDate: "2026-11-27",
  dueLabel: "Term 3 2026 balance",
  paybill: { number: "522533", account: "SS/2026/0142" },
  bank: { name: "Equity Bank", accountName: "Senior School Fees Account", accountNo: "0170 2938 4471 9", branch: "Chuka" },
  opening: { label: "Balance brought forward from Term 3 2025", amount: 3400 },
  entries: [
    { id: "e01", date: "2026-01-05", ref: "INV-26T1-0142", description: "Term 1 2026 fees invoice", term: "Term 1", type: "invoice", debit: 42200, credit: 0 },
    { id: "e02", date: "2026-01-10", ref: "SAB4K2L9QP", description: "M-Pesa payment", term: "Term 1", type: "payment", debit: 0, credit: 20000 },
    { id: "e03", date: "2026-02-12", ref: "EQB-558201", description: "Bank deposit, Equity Bank", term: "Term 1", type: "payment", debit: 0, credit: 15000 },
    { id: "e04", date: "2026-03-04", ref: "CDF-26-0388", description: "CDF bursary award", term: "Term 1", type: "bursary", debit: 0, credit: 5000 },
    { id: "e05", date: "2026-05-04", ref: "INV-26T2-0142", description: "Term 2 2026 fees invoice", term: "Term 2", type: "invoice", debit: 38000, credit: 0 },
    { id: "e06", date: "2026-05-14", ref: "SEE7M1R3TY", description: "M-Pesa payment", term: "Term 2", type: "payment", debit: 0, credit: 25000 },
    { id: "e07", date: "2026-07-02", ref: "KCB-904417", description: "Bank deposit, KCB", term: "Term 2", type: "payment", debit: 0, credit: 10000 },
    { id: "e08", date: "2026-08-24", ref: "INV-26T3-0142", description: "Term 3 2026 fees invoice", term: "Term 3", type: "invoice", debit: 38000, credit: 0 },
    { id: "e09", date: "2026-09-03", ref: "SIT2P8W5ZC", description: "M-Pesa payment", term: "Term 3", type: "payment", debit: 0, credit: 20000 },
  ],
};

export const SAMPLE_STRUCTURE: FeeStructureData = {
  year: 2026,
  grade: "Grade 10",
  dueDates: ["2026-01-23", "2026-05-22", "2026-09-18"],
  items: [
    { id: "f01", name: "Tuition", category: "Tuition", audience: "all", amounts: [14000, 14000, 14000] },
    { id: "f02", name: "Boarding and meals", category: "Boarding and meals", audience: "boarding", amounts: [16000, 16000, 16000] },
    { id: "f03", name: "Lunch programme", category: "Boarding and meals", audience: "day", amounts: [5500, 5500, 5500] },
    { id: "f04", name: "Activities and co-curricular", category: "Learning and activities", audience: "all", amounts: [2500, 2500, 2500] },
    { id: "f05", name: "Library and ICT", category: "Learning and activities", audience: "all", amounts: [1500, 1500, 1500] },
    { id: "f06", name: "Laboratory and practicals", category: "Learning and activities", audience: "all", amounts: [2000, 2000, 2000] },
    { id: "f07", name: "Exams and assessment", category: "Learning and activities", audience: "all", amounts: [2000, 2000, 2000] },
    { id: "f08", name: "Medical and insurance", category: "Levies", audience: "all", amounts: [1200, 0, 0], note: "Charged once a year" },
    { id: "f09", name: "Development fund", category: "Levies", audience: "all", amounts: [3000, 0, 0], note: "Charged once a year" },
    { id: "f10", name: "School bus", category: "Optional", audience: "day", optional: true, amounts: [6000, 6000, 6000], note: "Only if you use school transport" },
    { id: "f11", name: "Educational trip", category: "Optional", audience: "all", optional: true, amounts: [0, 4500, 0], note: "Term 2 only" },
    { id: "f12", name: "Sports kit", category: "Optional", audience: "all", optional: true, amounts: [3500, 0, 0] },
  ],
  notes: [
    "Fees are payable in full by the due date of each term. Balances carry forward and appear on the next invoice.",
    "Pay through the school Paybill using your admission number as the account number, or deposit at the school bank account and keep the slip.",
    "Boarders pay boarding and meals. Day scholars pay the lunch programme instead.",
    "Bursary and scholarship awards are credited to your statement once confirmed by the Finance office.",
    "Fees paid are not refundable, except where the Board approves a refund in writing.",
  ],
};

export const sampleLoadAccount = () => wait(SAMPLE_ACCOUNT);
export const sampleLoadStructure = () => wait(SAMPLE_STRUCTURE);