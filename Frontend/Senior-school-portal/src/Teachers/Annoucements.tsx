import React, { useCallback, useEffect, useMemo, useState } from 'react'
import TeacherSidebar from './TeacherSidebar'

/* ------------------------------------------------------------------ */
/* Config – adjust to match your backend                               */
/* ------------------------------------------------------------------ */
const API_BASE = '/api'
const REFRESH_MS = 60_000
const EDITOR_ROLES = ['admin', 'dean'] // can post school-wide / staff, pin, and delete any
const LONG_BODY = 220 // characters before a message is collapsed

type Priority = 'normal' | 'important' | 'urgent'
type Audience = 'school' | 'staff' | 'class'
type Filter = 'all' | 'unread' | 'school' | 'class' | 'mine'

interface Announcement {
  id: string
  title: string
  body: string
  audience: Audience
  className?: string
  priority: Priority
  pinned?: boolean
  authorId?: string
  authorName: string
  authorRole?: string
  createdAt: string // ISO
  readByMe?: boolean
}

interface TeacherClass {
  className: string
  subject: string
}

interface StoredUser {
  id?: string
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

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const audienceLabel = (a: Announcement) =>
  a.audience === 'school' ? 'Whole school' : a.audience === 'staff' ? 'Staff only' : a.className || 'Class'

const PRIORITY_LABEL: Record<Priority, string> = {
  normal: 'Normal',
  important: 'Important',
  urgent: 'Urgent',
}

/* ------------------------------------------------------------------ */
/* Compose modal                                                       */
/* ------------------------------------------------------------------ */
const ComposeModal: React.FC<{
  classes: TeacherClass[]
  canPostWide: boolean
  onClose: () => void
  onSaved: () => void
}> = ({ classes, canPostWide, onClose, onSaved }) => {
  const classNames = useMemo(() => [...new Set(classes.map((c) => c.className))], [classes])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState(canPostWide ? 'school' : classNames[0] ? `class:${classNames[0]}` : '')
  const [priority, setPriority] = useState<Priority>('normal')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return setError('Please add a title and a message.')
    if (!audience) return setError('Please choose who this announcement is for.')

    const isClass = audience.startsWith('class:')
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/announcements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience: isClass ? 'class' : audience,
          className: isClass ? audience.slice(6) : undefined,
          priority,
          pinned: canPostWide ? pinned : false,
        }),
      })
      if (!res.ok) throw new Error((await res.text()) || 'Could not post announcement')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post announcement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tt-modal-backdrop" onClick={onClose}>
      <form className="tt-modal an-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>New announcement</h3>

        <label>
          Title
          <input
            required
            maxLength={120}
            placeholder="e.g. Grade 11 maths test moved to Friday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          Message
          <textarea
            required
            rows={5}
            maxLength={1000}
            placeholder="Write the details learners or colleagues need to know."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <small>{body.length}/1000</small>
        </label>

        <div className="tt-form-row">
          <label>
            Send to
            <select value={audience} onChange={(e) => setAudience(e.target.value)}>
              {!canPostWide && classNames.length === 0 && <option value="">No classes assigned</option>}
              {canPostWide && <option value="school">Whole school</option>}
              {canPostWide && <option value="staff">Staff only</option>}
              {classNames.map((c) => (
                <option key={c} value={`class:${c}`}>
                  Class: {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>

        {canPostWide && (
          <label className="an-check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to the top of everyone’s feed
          </label>
        )}

        {error && <div className="tt-form-error">{error}</div>}

        <div className="tt-modal-actions">
          <button type="button" className="tt-btn tt-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tt-btn tt-btn-primary" disabled={saving}>
            {saving ? 'Posting…' : 'Post announcement'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function Announcements() {
  const user = useMemo(getUser, [])
  const isEditor = EDITOR_ROLES.includes((user.role || '').toLowerCase())

  const [items, setItems] = useState<Announcement[]>([])
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/announcements`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`Failed to load announcements (${res.status})`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : data.announcements ?? [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

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

  useEffect(() => {
    fetch(`${API_BASE}/classes/mine`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClasses(Array.isArray(d) ? d : d.classes ?? []))
      .catch(() => setClasses([]))
  }, [])

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, readByMe: true } : a)))
    try {
      await fetch(`${API_BASE}/announcements/${id}/read`, { method: 'POST', headers: authHeaders() })
    } catch {
      /* non-critical – will resync on next refresh */
    }
  }

  const markAllRead = () => items.filter((a) => !a.readByMe).forEach((a) => markRead(a.id))

  const toggle = (a: Announcement) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(a.id) ? next.delete(a.id) : next.add(a.id)
      return next
    })
    if (!a.readByMe) markRead(a.id)
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE}/announcements/${id}`, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('Could not delete the announcement. Please try again.')
    }
  }

  const isMine = (a: Announcement) => !!user.id && a.authorId === user.id

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((a) => !a.readByMe).length,
      school: items.filter((a) => a.audience !== 'class').length,
      class: items.filter((a) => a.audience === 'class').length,
      mine: items.filter(isMine).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, user.id],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((a) => {
        if (filter === 'unread' && a.readByMe) return false
        if (filter === 'school' && a.audience === 'class') return false
        if (filter === 'class' && a.audience !== 'class') return false
        if (filter === 'mine' && !isMine(a)) return false
        return !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1
        return +new Date(b.createdAt) - +new Date(a.createdAt)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, search, user.id])

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'school', label: 'School-wide' },
    { key: 'class', label: 'My classes' },
    { key: 'mine', label: 'Posted by me' },
  ]

  const dateLabel = new Date().toLocaleDateString('en-GB', {
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
            <strong>Announcements</strong>
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
          <div className="tt-heading an-heading">
            <div>
              <h1>Announcements</h1>
              <p>
                Notices from the school and your colleagues.{' '}
                {isEditor
                  ? 'You can post to the whole school, staff or a class.'
                  : 'You can post updates to the classes you teach.'}
              </p>
            </div>
            <div className="an-heading-actions">
              {counts.unread > 0 && (
                <button className="tt-btn tt-btn-ghost" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
              <button className="tt-btn tt-btn-primary" onClick={() => setShowModal(true)}>
                + New announcement
              </button>
            </div>
          </div>

          <section className="an-toolbar">
            <div className="an-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`an-chip${filter === f.key ? ' active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="an-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search announcements"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </section>

          {error && (
            <div className="tt-alert">
              {error}
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="an-feed">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="an-card an-skeleton" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="tt-empty">
              <strong>{items.length === 0 ? 'No announcements yet.' : 'Nothing matches your filters.'}</strong>
              <span>
                {items.length === 0
                  ? 'New notices from the school will appear here.'
                  : 'Try another filter or clear your search.'}
              </span>
            </div>
          ) : (
            <div className="an-feed">
              {visible.map((a) => {
                const open = expanded.has(a.id)
                const long = a.body.length > LONG_BODY
                const canDelete = isEditor || isMine(a)

                return (
                  <article
                    key={a.id}
                    className={`an-card priority-${a.priority}${a.readByMe ? '' : ' unread'}${a.pinned ? ' pinned' : ''}`}
                  >
                    <header className="an-card-head">
                      <div className="an-avatar">{a.authorName.charAt(0).toUpperCase()}</div>
                      <div className="an-author">
                        <strong>{a.authorName}</strong>
                        <span>
                          {a.authorRole ? `${a.authorRole} · ` : ''}
                          {timeAgo(a.createdAt)}
                        </span>
                      </div>
                      <div className="an-badges">
                        {a.pinned && <span className="an-badge pin">Pinned</span>}
                        {a.priority !== 'normal' && (
                          <span className={`an-badge ${a.priority}`}>{PRIORITY_LABEL[a.priority]}</span>
                        )}
                        <span className="an-badge aud">{audienceLabel(a)}</span>
                      </div>
                    </header>

                    <h3 className="an-title">
                      {!a.readByMe && <i className="an-dot" aria-label="Unread" />}
                      {a.title}
                    </h3>

                    <p className={`an-body${long && !open ? ' clamp' : ''}`}>{a.body}</p>

                    <footer className="an-card-foot">
                      {long || !a.readByMe ? (
                        <button className="an-link" onClick={() => toggle(a)}>
                          {long ? (open ? 'Show less' : 'Read more') : 'Mark as read'}
                        </button>
                      ) : (
                        <span />
                      )}
                      {canDelete && (
                        <button className="an-delete" onClick={() => remove(a.id)}>
                          Delete
                        </button>
                      )}
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <ComposeModal classes={classes} canPostWide={isEditor} onClose={() => setShowModal(false)} onSaved={() => load(true)} />
      )}
    </div>
  )
}

export default Announcements