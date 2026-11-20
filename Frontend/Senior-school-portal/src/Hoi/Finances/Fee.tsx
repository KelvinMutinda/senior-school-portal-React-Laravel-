import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DashboardLayout } from "../HoiDashboard";

/* ---------- Types ---------- */

export type FeeCategory = "Tuition" | "Activities" | "Examinations" | "Meals" | "Levies" | "Other";
export type StructureStatus = "Draft" | "Pending approval" | "Approved";

export interface FeeItem {
  id: string;
  name: string;
  category: FeeCategory;
  amount: number;
  compulsory: boolean;
}

export interface Structure {
  grade: string; // "10" | "11" | "12"
  term: number; // 1 | 2 | 3
  status: StructureStatus;
  items: FeeItem[];
}

export interface Discount {
  id: string;
  name: string;
  rule: string;
  value: string;
  learners: number;
  active: boolean;
}

export interface FeeData {
  year: number;
  learners: Record<string, number>; // learners per grade
  structures: Structure[];
  discounts: Discount[];
}

interface Props {
  /** Replace the sample data with data from your API. */
  data?: FeeData;
  /** Called when the Head of Institution saves, submits or approves a structure. Save it to your API here. */
  onChange?: (structure: Structure, action: "save" | "submit" | "approve") => void | Promise<void>;
}

const GRADES = ["10", "11", "12"];
const TERMS = [1, 2, 3];
const CATEGORIES: FeeCategory[] = ["Tuition", "Activities", "Examinations", "Meals", "Levies", "Other"];

/* ---------- Sample data (replace with API results) ---------- */

function sampleItems(grade: string, term: number): FeeItem[] {
  const tuition = 9000 + (grade === "11" ? 500 : 0) + (grade === "12" ? 500 : 0);
  const exam = 2000 + (grade === "12" ? 1000 : 0);
  const items: FeeItem[] = [
    { id: "tuition", name: "Tuition", category: "Tuition", amount: tuition, compulsory: true },
    { id: "activity", name: "Activity fee", category: "Activities", amount: 3000, compulsory: true },
    { id: "exam", name: "Examinations", category: "Examinations", amount: exam, compulsory: true },
    { id: "ict", name: "Library and ICT", category: "Levies", amount: 2500, compulsory: true },
    { id: "medical", name: "Medical and insurance", category: "Levies", amount: 1500, compulsory: true },
    { id: "lunch", name: "Lunch programme", category: "Meals", amount: 6000, compulsory: false },
    { id: "transport", name: "School transport", category: "Other", amount: 5000, compulsory: false },
  ];
  if (term === 1) items.push({ id: "admission", name: "Admission and uniform levy", category: "Levies", amount: 2000, compulsory: true });
  return items;
}

function buildSample(): FeeData {
  const structures: Structure[] = [];
  GRADES.forEach((g) => TERMS.forEach((t) => {
    let status: StructureStatus = t <= 2 ? "Approved" : "Draft";
    if (g === "10" && t === 3) status = "Pending approval";
    structures.push({ grade: g, term: t, status, items: sampleItems(g, t) });
  }));
  return {
    year: 2026,
    learners: { "10": 150, "11": 140, "12": 122 },
    structures,
    discounts: [
      { id: "d1", name: "Sibling discount", rule: "Second and later child from the same family", value: "10% off tuition", learners: 24, active: true },
      { id: "d2", name: "Staff child", rule: "Children of teaching and support staff", value: "50% off tuition", learners: 6, active: true },
      { id: "d3", name: "Bursary", rule: "Awarded by the BOM bursary committee", value: "Set per learner", learners: 18, active: true },
      { id: "d4", name: "Early payment", rule: "Full term fees paid in the first 2 weeks", value: "KES 500 off", learners: 0, active: false },
    ],
  };
}

/* ---------- Helpers ---------- */

const full = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const compulsoryTotal = (items: FeeItem[]) => sum(items.filter((i) => i.compulsory).map((i) => i.amount));
const optionalTotal = (items: FeeItem[]) => sum(items.filter((i) => !i.compulsory).map((i) => i.amount));
const statusClass = (s: StructureStatus) => (s === "Approved" ? "ok" : s === "Pending approval" ? "warn" : "muted");

/* ---------- Icons ---------- */

const PATHS = {
  plus: "M12 5v14 M5 12h14",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  check: "M20 6L9 17l-5-5",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7l2-3h12 M16 14h2",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  calendar: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4",
  coins: "M12 8a6 3 0 1 0 0-.01 M6 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8 M6 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4",
  print: "M7 9V4h10v5 M7 17H5v-6h14v6h-2 M7 14h10v6H7z",
  alert: "M12 3l10 18H2z M12 10v5 M12 18h.01",
} as const;

function Ico({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="ss-card fm-panel">
      <header><h3>{title}</h3>{aside && <span className="fm-aside">{aside}</span>}</header>
      <div className="fm-body">{children}</div>
    </section>
  );
}

/* ---------- Page ---------- */

function Fee({ data, onChange }: Props) {
  const initial = useMemo(() => data ?? buildSample(), [data]);
  const [structs, setStructs] = useState<Structure[]>(initial.structures);
  const [discounts, setDiscounts] = useState<Discount[]>(initial.discounts);
  const [term, setTerm] = useState(2);
  const [grade, setGrade] = useState("10");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // add-item form
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FeeCategory>("Levies");
  const [amount, setAmount] = useState("");
  const [compulsory, setCompulsory] = useState(true);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const current = structs.find((s) => s.grade === grade && s.term === term)!;
  const learners = initial.learners[grade] ?? 0;
  const perTerm = compulsoryTotal(current.items);
  const optional = optionalTotal(current.items);
  const annual = sum(TERMS.map((t) => compulsoryTotal(structs.find((s) => s.grade === grade && s.term === t)!.items)));
  const expected = perTerm * learners;
  const pendingCount = structs.filter((s) => s.status === "Pending approval").length;

  const update = (fn: (items: FeeItem[]) => FeeItem[]) =>
    setStructs((prev) => prev.map((s) => (s.grade === grade && s.term === term
      ? { ...s, items: fn(s.items), status: "Draft" as StructureStatus }
      : s)));

  const setItemAmount = (id: string, value: string) => {
    const n = Math.max(0, Number(value.replace(/[^\d]/g, "")) || 0);
    update((items) => items.map((i) => (i.id === id ? { ...i, amount: n } : i)));
  };
  const toggleCompulsory = (id: string) => update((items) => items.map((i) => (i.id === id ? { ...i, compulsory: !i.compulsory } : i)));
  const removeItem = (id: string) => update((items) => items.filter((i) => i.id !== id));

  const addItem = () => {
    const n = Number(amount.replace(/[^\d]/g, ""));
    if (!name.trim()) { setFormError("Enter the name of the fee item."); return; }
    if (!n) { setFormError("Enter an amount greater than zero."); return; }
    if (current.items.some((i) => i.name.toLowerCase() === name.trim().toLowerCase())) {
      setFormError("This item is already in the structure."); return;
    }
    update((items) => [...items, { id: `i-${Date.now()}`, name: name.trim(), category, amount: n, compulsory }]);
    setName(""); setAmount(""); setCategory("Levies"); setCompulsory(true); setFormError("");
  };

  const act = async (action: "save" | "submit" | "approve") => {
    const next: StructureStatus = action === "submit" ? "Pending approval" : action === "approve" ? "Approved" : "Draft";
    const updated: Structure = { ...current, status: next };
    setSaving(true);
    try {
      await onChange?.(updated, action);
      setStructs((prev) => prev.map((s) => (s.grade === grade && s.term === term ? updated : s)));
      setToast(
        action === "save" ? `Saved Grade ${grade}, Term ${term} as a draft.`
          : action === "submit" ? `Grade ${grade}, Term ${term} sent for approval.`
          : `Grade ${grade}, Term ${term} approved.`,
      );
    } catch {
      setToast("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscount = (id: string) =>
    setDiscounts((prev) => prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d)));

  const compare = GRADES.map((g) => {
    const s = structs.find((x) => x.grade === g && x.term === term)!;
    const n = initial.learners[g] ?? 0;
    return { grade: g, status: s.status, perTerm: compulsoryTotal(s.items), optional: optionalTotal(s.items), learners: n, expected: compulsoryTotal(s.items) * n };
  });

  return (
    <DashboardLayout
      role="HOI"
      user={{ name: "Head of Institution", roleLabel: "HOI" }}
      title="Fee Management"
    >
      <style>{STYLES}</style>
      <div className="fm-page">
        {/* Heading */}
        <div className="fm-head">
          <div>
            <h2 className="fm-title">Fee management</h2>
            <p className="fm-sub">Set what each grade pays every term, manage discounts, and approve structures before invoices go out.</p>
          </div>
          <button type="button" className="ss-btn ss-btn-sm fm-noprint" onClick={() => window.print()}>
            <Ico name="print" size={15} /> Print structure
          </button>
        </div>

        {toast && <div className="fm-toast" role="status"><Ico name="check" size={16} /> {toast}</div>}

        {/* Term and grade selectors */}
        <section className="ss-card fm-bar fm-noprint" aria-label="Choose a structure">
          <div className="fm-group">
            <span className="fm-label">Term</span>
            <div className="fm-seg" role="group" aria-label="Term">
              {TERMS.map((t) => (
                <button key={t} type="button" aria-pressed={term === t} onClick={() => setTerm(t)}>Term {t}</button>
              ))}
            </div>
          </div>
          <div className="fm-group">
            <span className="fm-label">Grade</span>
            <div className="fm-seg" role="group" aria-label="Grade">
              {GRADES.map((g) => (
                <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)}>Grade {g}</button>
              ))}
            </div>
          </div>
          <span className="fm-year">{initial.year}</span>
        </section>

        {/* KPIs */}
        <div className="fm-kpis">
          <div className="ss-card fm-kpi">
            <span className="fm-kpi-label"><Ico name="wallet" size={15} /> Per learner, Term {term}</span>
            <b>{full(perTerm)}</b>
            <small>Compulsory items only</small>
          </div>
          <div className="ss-card fm-kpi">
            <span className="fm-kpi-label"><Ico name="calendar" size={15} /> Per learner, full year</span>
            <b>{full(annual)}</b>
            <small>All three terms, compulsory</small>
          </div>
          <div className="ss-card fm-kpi">
            <span className="fm-kpi-label"><Ico name="users" size={15} /> Expected, Grade {grade}</span>
            <b>{full(expected)}</b>
            <small>{learners} learners this term</small>
          </div>
          <div className="ss-card fm-kpi">
            <span className="fm-kpi-label"><Ico name="coins" size={15} /> Optional items</span>
            <b>{full(optional)}</b>
            <small>Charged only to learners who opt in</small>
          </div>
        </div>

        {/* Structure editor */}
        <Panel
          title={`Grade ${grade}, Term ${term} structure`}
          aside={<span className={`fm-pill ${statusClass(current.status)}`}>{current.status}</span>}
        >
          <div className="fm-scroll">
            <table className="fm-table">
              <thead>
                <tr>
                  <th scope="col">Fee item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">Amount (KES)</th>
                  <th scope="col"><span className="fm-sr">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.name}</strong></td>
                    <td><span className="fm-cat">{i.category}</span></td>
                    <td>
                      <button type="button" className={`fm-type ${i.compulsory ? "on" : ""}`} onClick={() => toggleCompulsory(i.id)}
                        aria-label={`${i.name} is ${i.compulsory ? "compulsory" : "optional"}. Change.`}>
                        {i.compulsory ? "Compulsory" : "Optional"}
                      </button>
                    </td>
                    <td className="num">
                      <input className="fm-amt" inputMode="numeric" value={i.amount.toLocaleString("en-KE")}
                        onChange={(e) => setItemAmount(i.id, e.target.value)} aria-label={`Amount for ${i.name}`} />
                    </td>
                    <td className="end">
                      <button type="button" className="fm-del" onClick={() => removeItem(i.id)} aria-label={`Remove ${i.name}`}>
                        <Ico name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {current.items.length === 0 && (
                  <tr><td colSpan={5} className="fm-empty">No fee items yet. Add the first one below.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total per learner (compulsory)</td>
                  <td className="num"><strong>{full(perTerm)}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add item */}
          <div className="fm-add fm-noprint">
            <label className="fm-field fm-grow">
              <span>New fee item</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setFormError(""); }} placeholder="e.g. Science practicals" />
            </label>
            <label className="fm-field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as FeeCategory)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="fm-field">
              <span>Amount (KES)</span>
              <input inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setFormError(""); }} placeholder="0" />
            </label>
            <label className="fm-check">
              <input type="checkbox" checked={compulsory} onChange={(e) => setCompulsory(e.target.checked)} /> Compulsory
            </label>
            <button type="button" className="ss-btn ss-btn-sm" onClick={addItem}><Ico name="plus" size={14} /> Add item</button>
          </div>
          {formError && <p className="fm-err" role="alert">{formError}</p>}

          {/* Actions */}
          <div className="fm-actions fm-noprint">
            <p className="fm-hint">
              {current.status === "Draft" && "Changes are saved as a draft until you submit or approve them."}
              {current.status === "Pending approval" && "This structure is waiting for approval. Invoices are not generated yet."}
              {current.status === "Approved" && "This structure is approved. Editing it moves it back to draft."}
            </p>
            <div>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => act("save")} disabled={saving || current.status !== "Draft"}>Save draft</button>
              <button type="button" className="ss-btn ss-btn-sm" onClick={() => act("submit")} disabled={saving || current.status !== "Draft" || current.items.length === 0}>
                <Ico name="send" size={14} /> Submit for approval
              </button>
              <button type="button" className="ss-btn ss-btn-sm ss-btn-primary" onClick={() => act("approve")} disabled={saving || current.status === "Approved" || current.items.length === 0}>
                <Ico name="check" size={14} /> Approve
              </button>
            </div>
          </div>
        </Panel>

        {/* Comparison + discounts */}
        <div className="fm-two">
          <Panel title={`All grades, Term ${term}`} aside={`${pendingCount} pending approval`}>
            <div className="fm-scroll">
              <table className="fm-table fm-compare">
                <thead>
                  <tr>
                    <th scope="col">Grade</th>
                    <th scope="col" className="num">Per learner</th>
                    <th scope="col" className="num">Learners</th>
                    <th scope="col" className="num">Expected</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((c) => (
                    <tr key={c.grade} className={c.grade === grade ? "is-sel" : ""}>
                      <td>
                        <button type="button" className="fm-linkish" onClick={() => setGrade(c.grade)}>Grade {c.grade}</button>
                      </td>
                      <td className="num">{full(c.perTerm)}</td>
                      <td className="num">{c.learners}</td>
                      <td className="num">{full(c.expected)}</td>
                      <td><span className={`fm-pill ${statusClass(c.status)}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>School</td>
                    <td />
                    <td className="num">{sum(compare.map((c) => c.learners))}</td>
                    <td className="num"><strong>{full(sum(compare.map((c) => c.expected)))}</strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="fm-note">Expected fees use compulsory items only and are before any discounts or bursaries.</p>
          </Panel>

          <Panel title="Discounts and bursaries" aside={`${discounts.filter((d) => d.active).length} active`}>
            <ul className="fm-disc">
              {discounts.map((d) => (
                <li key={d.id} className={d.active ? "" : "off"}>
                  <div>
                    <strong>{d.name}</strong>
                    <small>{d.rule}</small>
                    <small className="fm-val">{d.value}{d.learners > 0 ? ` · ${d.learners} learners` : ""}</small>
                  </div>
                  <button type="button" className={`fm-switch ${d.active ? "on" : ""}`} role="switch" aria-checked={d.active}
                    aria-label={`${d.name} is ${d.active ? "on" : "off"}`} onClick={() => toggleDiscount(d.id)}>
                    <i />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {pendingCount > 0 && (
          <div className="fm-callout fm-noprint" role="note">
            <Ico name="alert" size={16} />
            {pendingCount} fee {pendingCount === 1 ? "structure is" : "structures are"} waiting for approval. Invoices cannot be generated for a term until its structure is approved.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Fee;

/* ---------- Styles (uses the --ss-* theme variables, so light and dark both work) ---------- */

const STYLES = `
.fm-page { display: flex; flex-direction: column; gap: 16px; }
.fm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.fm-title { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.fm-sub { margin: 4px 0 0; color: var(--ss-muted); max-width: 64ch; }
.fm-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.fm-toast { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(30,122,79,.1); border: 1px solid rgba(30,122,79,.3); border-left: 4px solid var(--ss-ok); border-radius: 10px; color: var(--ss-ok); font-weight: 600; }

.fm-bar { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 20px; padding: 14px 16px; }
.fm-group { display: flex; flex-direction: column; gap: 6px; }
.fm-label { color: var(--ss-muted); font-size: 12px; font-weight: 600; }
.fm-year { margin-left: auto; padding: 3px 11px; background: var(--ss-tint); border: 1px solid var(--ss-line); border-radius: 999px; color: var(--ss-muted); font-size: 12px; font-weight: 600; }
.fm-seg { display: inline-flex; overflow: hidden; border: 1.5px solid var(--ss-line); border-radius: 9px; }
.fm-seg button { height: 34px; padding: 0 14px; background: var(--ss-surface); border: 0; border-left: 1px solid var(--ss-line); color: var(--ss-muted); font-size: 13px; font-weight: 600; cursor: pointer; }
.fm-seg button:first-child { border-left: 0; }
.fm-seg button:hover { background: var(--ss-tint); color: var(--ss-ink); }
.fm-seg button:focus-visible { outline: 2px solid var(--ss-accent); outline-offset: -2px; }
.fm-seg button[aria-pressed="true"] { background: var(--ss-accent); color: #fff; }

.fm-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.fm-kpi { padding: 16px 20px 18px; border-top: 3px solid var(--ss-accent); }
.fm-kpi-label { display: flex; align-items: center; gap: 7px; color: var(--ss-muted); font-size: 12.5px; font-weight: 600; }
.fm-kpi b { display: block; margin: 6px 0 4px; font-size: 24px; font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }
.fm-kpi small { color: var(--ss-muted); font-size: 12px; }

.fm-panel { padding: 0; overflow: hidden; }
.fm-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; background: var(--ss-tint); border-bottom: 1px solid var(--ss-line); }
.fm-panel h3 { margin: 0; font-size: 14.5px; font-weight: 700; }
.fm-aside { color: var(--ss-muted); font-size: 12.5px; font-weight: 600; }
.fm-body { padding: 16px 20px 18px; }

.fm-scroll { overflow-x: auto; border: 1px solid var(--ss-line); border-radius: 10px; }
.fm-table { width: 100%; min-width: 560px; border-collapse: collapse; }
.fm-table th { padding: 10px 14px; background: var(--ss-tint); color: var(--ss-muted); font-size: 11.5px; font-weight: 600; letter-spacing: .05em; text-align: left; text-transform: uppercase; border-bottom: 1px solid var(--ss-line); }
.fm-table td { padding: 10px 14px; border-bottom: 1px solid var(--ss-line); vertical-align: middle; }
.fm-table tbody tr:last-child td { border-bottom: 0; }
.fm-table th.num, .fm-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.fm-table td.end { width: 44px; text-align: right; }
.fm-table tfoot td { padding: 12px 14px; background: var(--ss-tint); border-top: 2px solid var(--ss-line); font-weight: 600; }
.fm-table strong { font-weight: 600; }
.fm-compare tr.is-sel td { background: color-mix(in srgb, var(--ss-accent) 7%, var(--ss-surface)); }
.fm-empty { padding: 24px 14px !important; color: var(--ss-muted); text-align: center; }

.fm-cat { display: inline-block; padding: 2px 9px; background: var(--ss-tint); border: 1px solid var(--ss-line); border-radius: 6px; font-size: 12px; font-weight: 600; }
.fm-type { padding: 2px 10px; background: transparent; border: 1px solid var(--ss-line); border-radius: 999px; color: var(--ss-muted); font-size: 11.5px; font-weight: 600; cursor: pointer; }
.fm-type.on { background: rgba(31,95,209,.1); border-color: rgba(31,95,209,.28); color: var(--ss-accent); }
.fm-type:hover { border-color: var(--ss-accent); }
.fm-type:focus-visible, .fm-del:focus-visible, .fm-linkish:focus-visible, .fm-switch:focus-visible { outline: 2px solid var(--ss-accent); outline-offset: 2px; }
.fm-amt { width: 120px; height: 34px; padding: 0 10px; background: var(--ss-surface); border: 1.5px solid var(--ss-line); border-radius: 8px; color: var(--ss-ink); font: inherit; text-align: right; font-variant-numeric: tabular-nums; }
.fm-amt:focus { outline: none; border-color: var(--ss-accent); box-shadow: 0 0 0 4px rgba(31,95,209,.16); }
.fm-del { display: inline-grid; place-items: center; width: 30px; height: 30px; padding: 0; background: transparent; border: 1.5px solid var(--ss-line); border-radius: 8px; color: var(--ss-muted); cursor: pointer; }
.fm-del:hover { border-color: var(--ss-danger); color: var(--ss-danger); }
.fm-linkish { padding: 0; background: none; border: 0; color: var(--ss-accent); font: inherit; font-weight: 600; cursor: pointer; }
.fm-linkish:hover { text-decoration: underline; }

.fm-add { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-top: 16px; padding: 14px 16px; background: var(--ss-tint); border: 1px dashed var(--ss-line); border-radius: 10px; }
.fm-field { display: flex; flex-direction: column; gap: 4px; color: var(--ss-muted); font-size: 12px; font-weight: 600; }
.fm-grow { flex: 1 1 200px; }
.fm-field input, .fm-field select { height: 36px; min-width: 120px; padding: 0 10px; background: var(--ss-surface); border: 1.5px solid var(--ss-line); border-radius: 9px; color: var(--ss-ink); font: inherit; font-size: 13.5px; }
.fm-field input:focus, .fm-field select:focus { outline: none; border-color: var(--ss-accent); box-shadow: 0 0 0 4px rgba(31,95,209,.16); }
.fm-check { display: inline-flex; align-items: center; gap: 8px; height: 36px; color: var(--ss-ink); font-size: 13.5px; cursor: pointer; }
.fm-check input { width: 16px; height: 16px; accent-color: var(--ss-accent); }
.fm-err { margin: 8px 0 0; color: var(--ss-danger); font-size: 12.5px; font-weight: 600; }

.fm-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--ss-line); }
.fm-actions > div { display: flex; flex-wrap: wrap; gap: 8px; }
.fm-hint { margin: 0; color: var(--ss-muted); font-size: 12.5px; max-width: 52ch; }

.fm-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid; font-size: 11.5px; font-weight: 600; }
.fm-pill.ok { background: rgba(30,122,79,.1); border-color: rgba(30,122,79,.3); color: var(--ss-ok); }
.fm-pill.warn { background: rgba(168,106,18,.12); border-color: rgba(168,106,18,.35); color: var(--ss-warn); }
.fm-pill.muted { background: var(--ss-tint); border-color: var(--ss-line); color: var(--ss-muted); }

.fm-two { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }
.fm-note { margin: 12px 0 0; color: var(--ss-muted); font-size: 12.5px; }

.fm-disc { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.fm-disc li { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--ss-line); }
.fm-disc li:first-child { padding-top: 0; }
.fm-disc li:last-child { padding-bottom: 0; border-bottom: 0; }
.fm-disc li.off { opacity: .6; }
.fm-disc strong { display: block; font-weight: 600; }
.fm-disc small { display: block; color: var(--ss-muted); font-size: 12px; }
.fm-disc .fm-val { color: var(--ss-ink); font-weight: 600; }
.fm-switch { position: relative; flex: none; width: 42px; height: 24px; padding: 0; background: var(--ss-line); border: 0; border-radius: 999px; cursor: pointer; transition: background .15s; }
.fm-switch i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .15s; }
.fm-switch.on { background: var(--ss-ok); }
.fm-switch.on i { transform: translateX(18px); }

.fm-callout { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(168,106,18,.1); border: 1px solid rgba(168,106,18,.3); border-left: 4px solid var(--ss-warn); border-radius: 10px; color: var(--ss-ink); font-size: 13.5px; }
.fm-callout svg { flex: none; color: var(--ss-warn); }

@media (max-width: 1180px) {
  .fm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fm-two { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .fm-kpis { grid-template-columns: 1fr; }
  .fm-body { padding: 14px 14px 16px; }
  .fm-year { margin-left: 0; }
  .fm-actions > div { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .fm-switch, .fm-switch i { transition: none; } }
@media print { .fm-noprint { display: none !important; } .fm-panel { break-inside: avoid; } }
`;