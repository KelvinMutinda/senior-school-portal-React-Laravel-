import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'

/* ------------------------------------------------------------------ */
/* Config – adjust these to match your backend                         */
/* ------------------------------------------------------------------ */
const API_BASE = '/api'
const REFRESH_MS = 60_000 // re-fetch every minute so teachers see admin changes
const EDITOR_ROLES = ['admin', 'dean'] // only these roles can add/delete

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
type Day = (typeof DAYS)[number]

interface TimetableEntry {
  id: string
  day: Day
  startTime: string // "08:00"
  endTime: string // "08:40"
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

const todayName = (): string =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long' })

const NAV = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', to: '/teacher/dashboard', icon: 'grid' }],
  },
  {
    heading: 'Class management',
    items: [
      { label: 'My classes', to: '/teacher/classes', icon: 'users' },
      { label: 'Learners', to: '/teacher/learners', icon: 'user' },
      { label: 'Attendance', to: '/teacher/attendance', icon: 'check' },
    ],
  },
  {
    heading: 'Assessment',
    items: [
      { label: 'Upload marks', to: '/teacher/upload-marks', icon: 'pen' },
      { label: 'View marks', to: '/teacher/view-marks', icon: 'bars' },
      { label: 'Progress records', to: '/teacher/progress', icon: 'trend' },
    ],
  },
  {
    heading: 'Teaching',
    items: [
      { label: 'Timetable', to: '/Academics/Timetable', icon: 'calendar' },
      { label: 'Learning materials', to: '/Teacher/materials', icon: 'book' },
      { label: 'Upload learning materials', to: '/Upload/LearningMaterial', icon: 'upload' },
      { label: 'Generate learning material', to: '/AI/Chat', icon: 'spark' },
    ],
  },
  {
    heading: 'AI',
    items: [{ label: 'AI Mwalimu', to: '/teacher/ai-mwalimu', icon: 'cap' }],
  },
  {
    heading: 'Communication',
    items: [{ label: 'Announcements', to: '/teacher/announcements', icon: 'megaphone' }],
  },
]

const ICONS: Record<string, string> = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M21 19c0-2-1.5-3.5-4-4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-4 3-6 7-6s7 2 7 6',
  check: 'M4 6h16v14H4zM8 3v4M16 3v4M9 14l2 2 4-4',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  calendar: 'M4 6h16v14H4zM8 3v4M16 3v4M4 10h16',
  book: 'M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2zM5 18a2 2 0 012-2h12',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  megaphone: 'M4 10v4h3l7 4V6L7 10zM18 9a4 4 0 010 6',
}

const Icon = ({ name }: { name: string }) => (
  <svg
    className="tt-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={ICONS[name]} />
  </svg>
)

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */
const TeacherSidebar: React.FC = () => (
  <aside className="tt-sidebar">
    <div className="tt-brand">
      <div className="tt-brand-logo">SP</div>
      <div>
        <div className="tt-brand-name">Senior School</div>
        <div className="tt-brand-role">Teacher</div>
        <div className="tt-brand-portal">PORTAL</div>
      </div>
    </div>

    <nav className="tt-nav">
      {NAV.map((group) => (
        <div key={group.heading} className="tt-nav-group">
          <div className="tt-nav-heading">{group.heading}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `tt-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  </aside>
)

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
      const res = await fetch(`${API_BASE}/timetable`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.text()) || 'Could not save lesson')
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      // Editors see everyone's timetable; teachers only see their own
      const url = canEdit ? `${API_BASE}/timetable` : `${API_BASE}/timetable/me`
      const res = await fetch(url, { headers: authHeaders() })
      if (!res.ok) throw new Error(`Failed to load timetable (${res.status})`)
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : data.entries ?? [])
      setLastUpdated(new Date())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timetable')
    } finally {
      setLoading(false)
    }
  }, [canEdit])

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
    fetch(`${API_BASE}/teachers`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTeachers(Array.isArray(d) ? d : d.teachers ?? []))
      .catch(() => setTeachers([]))
  }, [canEdit])

  const removeEntry = async (id: string) => {
    if (!window.confirm('Remove this lesson from the timetable?')) return
    try {
      const res = await fetch(`${API_BASE}/timetable/${id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error()
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch {
      setError('Could not remove lesson. Please try again.')
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
              {error}
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="tt-empty">Loading timetable…</div>
          ) : visible.length === 0 ? (
            <div className="tt-empty">
              <strong>No lessons on the timetable yet.</strong>
              <span>
                {canEdit
                  ? 'Use “Add lesson” to build the timetable.'
                  : 'Your timetable will appear here once the dean or admin publishes it.'}
              </span>
            </div>
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