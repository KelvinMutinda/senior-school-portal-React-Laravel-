import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TeacherSidebar from "../Teachers/TeacherSidebar";
import { apiUrl, authHeaders } from "../api/authApi"; // adjust the path if needed


interface Learner {
  id: string;
  admissionNo: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  assessmentNo: string | null;
  upiNo: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  birthCertNo: string | null;
  grade: number | null;
  className: string | null;
  stream: string | null;
}

const FIELDS = [
  { key: "firstName", label: "First name", type: "text", required: true },
  { key: "middleName", label: "Middle name", type: "text", required: false },
  { key: "lastName", label: "Last name", type: "text", required: true },
  { key: "assessmentNo", label: "Assessment no", type: "text", required: false },
  { key: "upiNo", label: "UPI no", type: "text", required: false },
  { key: "dateOfBirth", label: "Date of birth", type: "date", required: false },
  { key: "birthCertNo", label: "Birth cert no", type: "text", required: false },
] as const;

type Form = Record<(typeof FIELDS)[number]["key"], string>;

const fullName = (l: Learner) => [l.firstName, l.middleName, l.lastName].filter(Boolean).join(" ");
const PAGE_SIZE = 50;
const initials = (l: Learner) => `${l.firstName?.[0] ?? ""}${l.lastName?.[0] ?? ""}`.toUpperCase();

/** Calls the API and turns failures into a readable message. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { ...authHeaders(), Accept: "application/json", "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Your session has ended. Please sign in again.");
    throw new Error(body?.message || `The server responded with ${res.status}.`);
  }
  return body as T;
}

function downloadCsv(rows: Learner[], name: string) {
  // A leading = + - @ would be run as a formula by Excel, so it is neutralised.
  const esc = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
  const lines = [
    ["Admission no", "Assessment no", "UPI no", "Full name", "Class", "Date of birth", "Birth cert no"],
    ...rows.map((l) => [l.admissionNo, l.assessmentNo, l.upiNo, fullName(l), l.className, l.dateOfBirth, l.birthCertNo]),
  ].map((r) => r.map(esc).join(","));
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface Detail {
  label: string;
  value: string | number | null;
}

interface LearnerRecord {
  details: Detail[];
  guardians: { relationship: string | null; isPrimary: boolean; details: Detail[] }[];
}

function DetailList({ items }: { items: Detail[] }) {
  return (
    <dl className="lr-details">
      {items.map((d) => {
        const text = d.value === null || d.value === "" ? "–" : String(d.value);
        const isPhone = /phone|mobile|contact|tel/i.test(d.label) && text !== "–";
        return (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{isPhone ? <a href={`tel:${text.replace(/\s+/g, "")}`}>{text}</a> : text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function ViewDialog({ learner, onClose, onEdit }: { learner: Learner; onClose: () => void; onEdit: () => void }) {
  const [record, setRecord] = useState<LearnerRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api<LearnerRecord>(`/learners/${learner.id}`)
      .then((r) => live && setRecord(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [learner.id]);

  return (
    <div className="lr-overlay" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="lr-dialog lr-wide" role="dialog" aria-modal="true" aria-label={`${fullName(learner)} details`}>
        <div className="lr-who">
          <span className="lr-avatar" aria-hidden="true">{initials(learner)}</span>
          <div>
            <h3>{fullName(learner)}</h3>
            <small>{learner.className ?? "No class"} · Admission no {learner.admissionNo ?? "–"}</small>
          </div>
        </div>

        {error && <p className="lr-error" role="alert">{error}</p>}
        {!record && !error && <p role="status">Loading details…</p>}
        {record && (
          <>
            <h4>Learner details</h4>
            <DetailList items={record.details} />
            <h4>Parents and guardians</h4>
            {record.guardians.length === 0 && <p>No parent or guardian is recorded.</p>}
            {record.guardians.map((g, i) => (
              <div className="lr-guardian" key={i}>
                <strong>{g.relationship || "Guardian"}{g.isPrimary ? " (primary)" : ""}</strong>
                <DetailList items={g.details} />
              </div>
            ))}
          </>
        )}

        <div className="lr-actions">
          <button type="button" className="lr-btn" onClick={onClose} autoFocus>Close</button>
          <button type="button" className="lr-btn lr-gold" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function EditDialog({ learner, onClose, onSaved }: { learner: Learner; onClose: () => void; onSaved: (l: Learner) => void }) {
  const [form, setForm] = useState<Form>(() => Object.fromEntries(FIELDS.map((f) => [f.key, learner[f.key] ?? ""])) as Form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      const res = await api<{ learner: Learner }>(`/learners/${learner.id}`, { method: "PUT", body: JSON.stringify(payload) });
      onSaved(res.learner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <div className="lr-overlay">
      <form className="lr-dialog" role="dialog" aria-modal="true" aria-label={`Edit ${fullName(learner)}`} onSubmit={submit}>
        <h3>Edit learner</h3>
        <div className="lr-fields">
          {FIELDS.map((f, i) => (
            <label key={f.key}>
              {f.label}
              <input
                type={f.type}
                required={f.required}
                autoFocus={i === 0}
                value={form[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {error && <p className="lr-error" role="alert">{error}</p>}
        <div className="lr-actions">
          <button type="button" className="lr-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="lr-btn lr-gold" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

function Students() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState<"all" | number>("all");
  const [stream, setStream] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [viewing, setViewing] = useState<Learner | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLearners((await api<{ learners: Learner[] }>("/learners")).learners);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load learners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grades = useMemo(
    () => [...new Set(learners.map((l) => l.grade).filter((g): g is number => g !== null))].sort((a, b) => a - b),
    [learners],
  );
  const streams = useMemo(
    () =>
      [...new Set(learners.filter((l) => grade === "all" || l.grade === grade).map((l) => l.stream).filter((v): v is string => !!v))].sort(),
    [learners, grade],
  );
  const inView = learners.filter((l) => (grade === "all" || l.grade === grade) && (stream === "all" || l.stream === stream));
  const needle = q.trim().toLowerCase();
  const shown = inView.filter((l) => `${fullName(l)} ${l.admissionNo ?? ""} ${l.assessmentNo ?? ""} ${l.upiNo ?? ""}`.toLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const label = [grade === "all" ? "All grades" : `Grade ${grade}`, stream === "all" ? "" : `Stream ${stream}`].filter(Boolean).join(" · ");

  const remove = async (l: Learner) => {
    if (!window.confirm(`Remove ${fullName(l)}? They will no longer appear in learner lists.`)) return;
    setRemoving(l.id);
    setError("");
    try {
      await api(`/learners/${l.id}`, { method: "DELETE" });
      setLearners((list) => list.filter((x) => x.id !== l.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the learner.");
    } finally {
      setRemoving(null);
    }
  };

  const chip = (v: string | null) => <span className="lr-chip">{v || "–"}</span>;

  return (
    <div className="tt-shell ss-shell" style={{ display: "grid", background: "var(--ss-canvas)" }}>
      <TeacherSidebar />

      <div className="ss-main">
        <header className="ss-header">
          <div className="ss-h-title">
            <p className="ss-h-name">Students</p>
            <span>Class management</span>
          </div>
        </header>

        <main className="ss-content lr-page">
          <div className="lr-head">
            <h2>{label} Learners</h2>
            {!loading && <span className="lr-count">{shown.length} {shown.length === 1 ? "student" : "students"}</span>}
            <div className="lr-head-actions">
              <button type="button" className="lr-btn" onClick={() => navigate("/Register/Learner")}>Register learner</button>
              <button type="button" className="lr-btn lr-gold" disabled={!shown.length} onClick={() => downloadCsv(shown, `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-learners.csv`)}>
                Download Learners List
              </button>
            </div>
          </div>

          {error && (
            <p className="lr-error" role="alert">
              {error} <button type="button" className="lr-btn" onClick={() => void load()}>Retry</button>
            </p>
          )}

          <section className="lr-card" aria-busy={loading}>
            <div className="lr-searchbar">
              <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name, admission no, assessment no, or UPI…" aria-label="Search learners" />
              <select
                value={grade}
                aria-label="Grade"
                onChange={(e) => {
                  setGrade(e.target.value === "all" ? "all" : Number(e.target.value));
                  setStream("all");
                  setPage(1);
                }}
              >
                <option value="all">All grades</option>
                {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <select value={stream} aria-label="Stream" onChange={(e) => { setStream(e.target.value); setPage(1); }}>
                <option value="all">All streams</option>
                {streams.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="lr-banner">{label} — enrolled learners</div>

            <div className="lr-scroll">
              <table className="lr-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Admission no</th>
                    <th>Assessment no</th>
                    <th>UPI no</th>
                    <th>Full name</th>
                    <th>Class</th>
                    <th>Date of birth</th>
                    <th>Birth cert no</th>
                    <th className="lr-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || !shown.length ? (
                    <tr>
                      <td colSpan={9} className="lr-center">
                        {loading ? "Loading learners…" : needle ? "No learner matches your search." : "No learners to show."}
                      </td>
                    </tr>
                  ) : (
                    shown.slice(start, start + PAGE_SIZE).map((l, i) => (
                      <tr key={l.id}>
                        <td>{start + i + 1}</td>
                        <td>{chip(l.admissionNo)}</td>
                        <td>{chip(l.assessmentNo)}</td>
                        <td>{chip(l.upiNo)}</td>
                        <td>
                          <div className="lr-who">
                            <span className="lr-avatar" aria-hidden="true">{initials(l)}</span>
                            <strong>{fullName(l)}</strong>
                          </div>
                        </td>
                        <td><span className="lr-pill">{l.className ?? "–"}</span></td>
                        <td>{l.dateOfBirth ?? "–"}</td>
                        <td>{chip(l.birthCertNo)}</td>
                        <td>
                          <div className="lr-row-actions">
                            <button type="button" className="lr-btn" onClick={() => setViewing(l)}>View</button>
                            <button type="button" className="lr-btn" onClick={() => setEditing(l)}>✎ Edit</button>
                            <button type="button" className="lr-btn lr-danger" disabled={removing === l.id} onClick={() => void remove(l)}>
                              {removing === l.id ? "Removing…" : "Remove"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="lr-pager">
                <button type="button" className="lr-btn" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
                <span>Page {current} of {pages}</span>
                <button type="button" className="lr-btn" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
              </div>
            )}
          </section>
        </main>
      </div>

      {viewing && (
        <ViewDialog
          key={viewing.id}
          learner={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <EditDialog
          key={editing.id}
          learner={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setLearners((list) => list.map((x) => (x.id === saved.id ? saved : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export default Students;