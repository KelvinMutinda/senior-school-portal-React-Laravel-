import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TeacherSidebar from "../Teachers/TeacherSidebar";
import { apiUrl, authHeaders } from "../api/authApi"; // adjust the path if needed


interface Learner {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  assessmentNo: string | null;
  upiNo: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  birthCertNo: string | null;
  grade: number | null;
  className: string | null;
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
    ["Assessment no", "UPI no", "Full name", "Class", "Date of birth", "Birth cert no"],
    ...rows.map((l) => [l.assessmentNo, l.upiNo, fullName(l), l.className, l.dateOfBirth, l.birthCertNo]),
  ].map((r) => r.map(esc).join(","));
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
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
  const [picked, setPicked] = useState<number | null>(null);
  const [editing, setEditing] = useState<Learner | null>(null);
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
  const grade = picked !== null && grades.includes(picked) ? picked : (grades[0] ?? null);
  const inGrade = learners.filter((l) => l.grade === grade);
  const needle = q.trim().toLowerCase();
  const shown = inGrade.filter((l) => `${fullName(l)} ${l.assessmentNo ?? ""} ${l.upiNo ?? ""}`.toLowerCase().includes(needle));
  const title = grade === null ? "Learners" : `Grade ${grade} Learners`;

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
          {grades.length > 1 && (
            <div className="lr-tabs" role="group" aria-label="Grade">
              {grades.map((g) => (
                <button key={g} type="button" className={`lr-btn${g === grade ? " is-on" : ""}`} aria-pressed={g === grade} onClick={() => setPicked(g)}>
                  Grade {g}
                </button>
              ))}
            </div>
          )}

          <div className="lr-head">
            <h2>{title}</h2>
            {!loading && <span className="lr-count">{inGrade.length} {inGrade.length === 1 ? "student" : "students"}</span>}
            <div className="lr-head-actions">
              <button type="button" className="lr-btn" onClick={() => navigate("/Register/Learner")}>Register learner</button>
              <button type="button" className="lr-btn lr-gold" disabled={!shown.length} onClick={() => downloadCsv(shown, `grade-${grade}-learners.csv`)}>
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
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, assessment no, or UPI…" aria-label="Search learners" />
            </div>
            <div className="lr-banner">{grade === null ? "Enrolled learners" : `Grade ${grade} — enrolled learners`}</div>

            <div className="lr-scroll">
              <table className="lr-table">
                <thead>
                  <tr>
                    <th>#</th>
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
                      <td colSpan={8} className="lr-center">
                        {loading ? "Loading learners…" : needle ? "No learner matches your search." : "No learners to show."}
                      </td>
                    </tr>
                  ) : (
                    shown.map((l, i) => (
                      <tr key={l.id}>
                        <td>{i + 1}</td>
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
          </section>
        </main>
      </div>

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