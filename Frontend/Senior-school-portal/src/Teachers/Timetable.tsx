import React, { useCallback, useEffect, useMemo, useState } from 'react'
// Adjust this path to wherever your shared TeacherSidebar.tsx lives
import TeacherSidebar from './TeacherSidebar'

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
// Set VITE_API_URL in .env (e.g. http://localhost:5000/api) or rely on the Vite proxy for "/api"
const API_BASE: string = (import.meta.env?.VITE_API_URL as string) || '/api'
const REFRESH_MS = 60_000
const EDITOR_ROLES = ['admin', 'dean']

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
type Day = (typeof DAYS)[number]

interface TimetableEntry {
  id: string
  day: Day
  startTime: string
  endTime: string
  subject: string
  className: string
  room?: string
  teacherId?: string
  teacherName?: string
}

interface Teacher {
  id: string
  name: string
}

interface StoredUser {
  name?: string
  role?: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const getUser = (): StoredUser => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const authHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
})

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

const todayName = (): string => new Date().toLocaleDateString('en-GB', { weekday: 'long' })

/**
 * Safe API call. If the server answers with HTML (Vite's index.html, an Express
 * "Cannot GET" page, a 404 page...) we show a clear message instead of the
 * confusing "Unexpected token '<'" JSON parse error.
 */
async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    })
  } catch {
    throw new Error('Cannot reach the server. Check that the backend is running.')
  }

  const type = res.headers.get('content-type') || ''
  const isJson = type.includes('application/json')

  if (!isJson) {
    if (res.ok && (res.status === 204 || res.headers.get('content-length') === '0')) {
      return undefined as T
    }
    if (type.includes('text/html')) {
      throw new Error(
        `The server returned a web page instead of data (${res.status}). ` +
          `Check that the backend is running, the "/api" proxy is set in vite.config.ts, ` +
          `and the route ${path} exists on the server.`,
      )
    }
    if (res.ok) return undefined as T
    throw new Error((await res.text()) || `Request failed (${res.status})`)
  }

  const data = await res.json()
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

/* ------------------------------------------------------------------ */
/* Add-lesson modal (admin / dean only)                                */
/* ------------------------------------------------------------------ */
interface FormState {
  day: Day
  startTime: string
  endTime: string
  subject: string
  className: string
  room: string
  teacherId: string
}

const emptyForm: FormState = {
  day: 'Monday',
  startTime: '08:00',
  endTime: '08:40',
  subject: '',
  className: '',
  room: '',
  teacherId: '',
}

const AddLessonModal: React.FC<{
  teachers: Teacher[]
  onClose: () => void
  onSaved: () => void
}> = ({ teachers, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/timetable', { method: 'POST', body: JSON.stringify(form) })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lesson')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tt-modal-backdrop" onClick={onClose}>
      <form className="tt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Add lesson to timetable</h3>

        <label>
          Teacher
          <select required value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
            <option value="">Select teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="tt-form-row">
          <label>
            Day
            <select value={form.day} onChange={(e) => set('day', e.target.value as Day)}>
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Start
            <input type="time" required value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </label>
          <label>
            End
            <input type="time" required value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </label>
        </div>

        <div className="tt-form-row">
          <label>
            Subject
            <input required placeholder="Mathematics" value={form.subject} onChange={(e) => set('subject', e.target.value)} />
          </label>
          <label>
            Class
            <input required placeholder="Grade 11A" value={form.className} onChange={(e) => set('className', e.target.value)} />
          </label>
          <label>
            Room
            <input placeholder="Room 4" value={form.room} onChange={(e) => set('room', e.target.value)} />
          </label>
        </div>

        {error && <div className="tt-form-error">{error}</div>}

        <div className="tt-modal-actions">
          <button type="button" className="tt-btn tt-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tt-btn tt-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save lesson'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function Timetables() {
  const user = useMemo(getUser, [])
  const canEdit = EDITOR_ROLES.includes((user.role || '').toLowerCase())

  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [view, setView] = useState<'week' | 'today'>('week')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [now, setNow] = useState(new Date())

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        // Editors see everyone's timetable; teachers only see their own
        const data = await api<TimetableEntry[] | { entries?: TimetableEntry[] }>(
          canEdit ? '/timetable' : '/timetable/me',
        )
        setEntries(Array.isArray(data) ? data : data?.entries ?? [])
        setLastUpdated(new Date())
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timetable')
      } finally {
        setLoading(false)
      }
    },
    [canEdit],
  )

  // initial load + polling + refetch when the tab regains focus
  useEffect(() => {
    load()
    const poll = setInterval(() => load(true), REFRESH_MS)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  // clock tick for "now" highlighting
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // teachers list for the admin form
  useEffect(() => {
    if (!canEdit) return
    api<Teacher[] | { teachers?: Teacher[] }>('/teachers')
      .then((d) => setTeachers(Array.isArray(d) ? d : d?.teachers ?? []))
      .catch(() => setTeachers([]))
  }, [canEdit])

  const removeEntry = async (id: string) => {
    if (!window.confirm('Remove this lesson from the timetable?')) return
    try {
      await api(`/timetable/${id}`, { method: 'DELETE' })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove lesson. Please try again.')
    }
  }

  const visible = useMemo(
    () => (canEdit && teacherFilter !== 'all' ? entries.filter((e) => e.teacherId === teacherFilter) : entries),
    [entries, canEdit, teacherFilter],
  )

  const slots = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>()
    visible.forEach((e) => map.set(`${e.startTime}-${e.endTime}`, { start: e.startTime, end: e.endTime }))
    return [...map.values()].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  }, [visible])

  const today = todayName()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isLive = (e: TimetableEntry) =>
    e.day === today && nowMin >= toMinutes(e.startTime) && nowMin < toMinutes(e.endTime)

  const todayEntries = visible
    .filter((e) => e.day === today)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

  const renderCard = (e: TimetableEntry) => (
    <div key={e.id} className={`tt-card${isLive(e) ? ' live' : ''}`}>
      <div className="tt-card-subject">{e.subject}</div>
      <div className="tt-card-meta">
        {e.className}
        {e.room ? ` · ${e.room}` : ''}
      </div>
      {canEdit && e.teacherName && <div className="tt-card-teacher">{e.teacherName}</div>}
      {isLive(e) && <span className="tt-live-badge">Now</span>}
      {canEdit && (
        <button className="tt-card-remove" title="Remove lesson" onClick={() => removeEntry(e.id)}>
          ×
        </button>
      )}
    </div>
  )

  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="tt-shell">
      <TeacherSidebar />

      <div className="tt-main">
        <header className="tt-topbar">
          <div className="tt-topbar-title">
            <strong>Timetable</strong>
            <span>{dateLabel}</span>
          </div>
          <div className="tt-user">
            <div className="tt-avatar">{(user.name || 'T').charAt(0).toUpperCase()}</div>
            <div>
              <div className="tt-user-name">{user.name || 'Teacher'}</div>
              <div className="tt-user-role">{user.role || 'Subject teacher'}</div>
            </div>
          </div>
        </header>

        <main className="tt-content">
          <div className="tt-heading">
            <h1>{canEdit ? 'School timetable' : 'My timetable'}</h1>
            <p>
              {canEdit
                ? 'Add or remove lessons. Teachers see changes automatically.'
                : 'Managed by the dean/admin. This page updates automatically when changes are made.'}
            </p>
          </div>

          <div className="tt-toolbar">
            <div className="tt-tabs">
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>
                Week
              </button>
              <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
                Today
              </button>
            </div>

            <div className="tt-toolbar-right">
              {canEdit && (
                <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                  <option value="all">All teachers</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {lastUpdated && (
                <span className="tt-updated">
                  Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button className="tt-btn tt-btn-ghost" onClick={() => load()}>
                Refresh
              </button>
              {canEdit && (
                <button className="tt-btn tt-btn-primary" onClick={() => setShowModal(true)}>
                  + Add lesson
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="tt-alert">
              <span>{error}</span>
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="tt-empty">Loading timetable…</div>
          ) : visible.length === 0 ? (
            // When the request failed, the red error above already explains why,
            // so don't also claim "no lessons yet".
            !error && (
              <div className="tt-empty">
                <strong>No lessons on the timetable yet.</strong>
                <span>
                  {canEdit
                    ? 'Use “Add lesson” to build the timetable.'
                    : 'Your timetable will appear here once the dean or admin publishes it.'}
                </span>
              </div>
            )
          ) : view === 'today' ? (
            <div className="tt-today">
              {todayEntries.length === 0 ? (
                <div className="tt-empty">No lessons scheduled for {today}.</div>
              ) : (
                todayEntries.map((e) => (
                  <div key={e.id} className={`tt-today-row${isLive(e) ? ' live' : ''}`}>
                    <div className="tt-today-time">
                      {e.startTime}
                      <small>{e.endTime}</small>
                    </div>
                    {renderCard(e)}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="tt-grid-wrap">
              <table className="tt-grid">
                <thead>
                  <tr>
                    <th className="tt-time-col">Time</th>
                    {DAYS.map((d) => (
                      <th key={d} className={d === today ? 'today' : ''}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={`${s.start}-${s.end}`}>
                      <td className="tt-time-col">
                        {s.start}
                        <small>{s.end}</small>
                      </td>
                      {DAYS.map((d) => (
                        <td key={d} className={d === today ? 'today' : ''}>
                          {visible
                            .filter((e) => e.day === d && e.startTime === s.start && e.endTime === s.end)
                            .map(renderCard)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {showModal && canEdit && (
        <AddLessonModal teachers={teachers} onClose={() => setShowModal(false)} onSaved={() => load(true)} />
      )}
    </div>
  )
}

export default Timetables