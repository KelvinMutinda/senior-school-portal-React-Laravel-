import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TeacherSidebar from '../TeacherSidebar'

/* ------------------------------------------------------------------ */
/* Config – adjust to match your backend                               */
/* ------------------------------------------------------------------ */
const API_BASE = '/api'
const PAGE_SIZE = 12

type MaterialType = 'pdf' | 'doc' | 'ppt' | 'xls' | 'video' | 'image' | 'link' | 'other'

interface LearningMaterial {
  id: string
  title: string
  description?: string
  subject: string
  className: string
  type: MaterialType
  fileName?: string
  fileUrl?: string // used for type === 'link'
  fileSize?: number // bytes
  uploadedByName?: string
  uploadedAt: string // ISO date
}

interface StoredUser {
  name?: string
  role?: string
}

const TYPE_LABELS: Record<MaterialType, string> = {
  pdf: 'PDF',
  doc: 'Document',
  ppt: 'Slides',
  xls: 'Sheet',
  video: 'Video',
  image: 'Image',
  link: 'Link',
  other: 'Other',
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
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
})

const formatSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function GetLearningMaterial() {
  const user = useMemo(getUser, [])

  const [materials, setMaterials] = useState<LearningMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('all')
  const [className, setClassName] = useState('all')
  const [type, setType] = useState<MaterialType | 'all'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/learning-materials`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`Failed to load learning materials (${res.status})`)
      const data = await res.json()
      setMaterials(Array.isArray(data) ? data : data.materials ?? [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning materials')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  // reset pagination whenever filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, subject, className, type, sort])

  const subjects = useMemo(() => [...new Set(materials.map((m) => m.subject))].sort(), [materials])
  const classes = useMemo(() => [...new Set(materials.map((m) => m.className))].sort(), [materials])

  // everything except the type filter, so chip counts stay meaningful
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter(
      (m) =>
        (subject === 'all' || m.subject === subject) &&
        (className === 'all' || m.className === className) &&
        (!q ||
          m.title.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q)),
    )
  }, [materials, search, subject, className])

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<MaterialType, number>> = {}
    baseFiltered.forEach((m) => {
      counts[m.type] = (counts[m.type] || 0) + 1
    })
    return counts
  }, [baseFiltered])

  const results = useMemo(() => {
    const list = type === 'all' ? [...baseFiltered] : baseFiltered.filter((m) => m.type === type)
    list.sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'oldest'
          ? +new Date(a.uploadedAt) - +new Date(b.uploadedAt)
          : +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
    )
    return list
  }, [baseFiltered, type, sort])

  const open = async (m: LearningMaterial) => {
    // external links just open in a new tab
    if (m.type === 'link' && m.fileUrl) {
      window.open(m.fileUrl, '_blank', 'noopener,noreferrer')
      return
    }
    // files are protected by auth, so fetch as a blob and trigger the download
    setBusyId(m.id)
    try {
      const res = await fetch(`${API_BASE}/learning-materials/${m.id}/download`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = m.fileName || m.title
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError(`Could not download “${m.title}”. Please try again.`)
    } finally {
      setBusyId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSubject('all')
    setClassName('all')
    setType('all')
  }
  const hasFilters = search || subject !== 'all' || className !== 'all' || type !== 'all'

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const shown = results.slice(0, visibleCount)

  return (
    <div className="tt-shell">
      <TeacherSidebar />

      <div className="tt-main">
        <header className="tt-topbar">
          <div className="tt-topbar-title">
            <strong>Learning materials</strong>
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
          <div className="tt-heading lm-heading">
            <div>
              <h1>Learning materials</h1>
              <p>Browse, search and download notes, slides, past papers and resources shared in your school.</p>
            </div>
            <Link to="/Upload/LearningMaterial" className="tt-btn tt-btn-primary lm-upload-link">
              + Upload material
            </Link>
          </div>

          {/* Filters */}
          <section className="lm-filters">
            <div className="lm-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search by title, subject or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select value={className} onChange={(e) => setClassName(e.target.value)} aria-label="Class">
              <option value="all">All classes</option>
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>

            <div className="tt-tabs lm-view">
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
                Grid
              </button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                List
              </button>
            </div>
          </section>

          <div className="lm-chips">
            <button className={`lm-chip${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>
              All <span>{baseFiltered.length}</span>
            </button>
            {(Object.keys(typeCounts) as MaterialType[]).map((t) => (
              <button key={t} className={`lm-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
                {TYPE_LABELS[t]} <span>{typeCounts[t]}</span>
              </button>
            ))}
            {hasFilters && (
              <button className="lm-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {error && (
            <div className="tt-alert">
              {error}
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className={`lm-collection ${view}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="lm-card lm-skeleton" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="tt-empty">
              <strong>{materials.length === 0 ? 'No learning materials yet.' : 'No materials match your filters.'}</strong>
              <span>
                {materials.length === 0
                  ? 'Materials uploaded by teachers will appear here.'
                  : 'Try a different search or clear the filters.'}
              </span>
            </div>
          ) : (
            <>
              <div className="lm-count">
                Showing {shown.length} of {results.length} material{results.length === 1 ? '' : 's'}
              </div>

              <div className={`lm-collection ${view}`}>
                {shown.map((m) => (
                  <article key={m.id} className="lm-card">
                    <div className="lm-type" data-type={m.type}>
                      {TYPE_LABELS[m.type]}
                    </div>

                    <div className="lm-body">
                      <h3 className="lm-title" title={m.title}>
                        {m.title}
                      </h3>
                      {m.description && <p className="lm-desc">{m.description}</p>}

                      <div className="lm-tags">
                        <span className="lm-tag">{m.subject}</span>
                        <span className="lm-tag alt">{m.className}</span>
                      </div>

                      <div className="lm-meta">
                        {m.uploadedByName && <span>{m.uploadedByName}</span>}
                        <span>{formatDate(m.uploadedAt)}</span>
                        {m.fileSize ? <span>{formatSize(m.fileSize)}</span> : null}
                      </div>
                    </div>

                    <button
                      className="tt-btn tt-btn-primary lm-action"
                      disabled={busyId === m.id}
                      onClick={() => open(m)}
                    >
                      {busyId === m.id ? 'Downloading…' : m.type === 'link' ? 'Open link' : 'Download'}
                    </button>
                  </article>
                ))}
              </div>

              {shown.length < results.length && (
                <div className="lm-more">
                  <button className="tt-btn tt-btn-ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default GetLearningMaterial