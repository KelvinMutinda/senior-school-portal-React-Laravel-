import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TeacherSidebar from '../TeacherSidebar'
import { apiUrl, authHeaders, getUser } from '../../api/authApi' // adjust the path to where authApi.ts lives

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
const PAGE_SIZE = 12

type MaterialType = 'pdf' | 'doc' | 'ppt' | 'video' | 'other'


interface ApiMaterial {
  id: number
  title: string
  description: string | null
  class_name: string
  subject: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  file_url: string | null
  uploaded_by: string | null
  is_mine: boolean
  created_at: string
}

/** The shape this page works with. */
interface LearningMaterial {
  id: number
  title: string
  description?: string
  subject: string
  className: string
  type: MaterialType
  fileName?: string
  fileSize?: number
  uploadedByName?: string
  uploadedAt: string
  isMine: boolean
}

const TYPE_LABELS: Record<MaterialType, string> = {
  pdf: 'PDF',
  doc: 'Document',
  ppt: 'Slides',
  video: 'Video',
  other: 'Other',
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const typeFromExt = (ext: string | null, fileName: string | null): MaterialType => {
  const e = (ext || fileName?.split('.').pop() || '').toLowerCase()
  if (e === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(e)) return 'doc'
  if (['ppt', 'pptx'].includes(e)) return 'ppt'
  if (e === 'mp4') return 'video'
  return 'other'
}

const normalise = (m: ApiMaterial): LearningMaterial => ({
  id: m.id,
  title: m.title,
  description: m.description ?? undefined,
  subject: m.subject,
  className: m.class_name,
  type: typeFromExt(m.file_type, m.file_name),
  fileName: m.file_name ?? undefined,
  fileSize: m.file_size ?? undefined,
  uploadedByName: m.uploaded_by ?? undefined,
  uploadedAt: m.created_at,
  isMine: m.is_mine,
})

const formatSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const errorFrom = async (res: Response, fallback: string) => {
  if (res.status === 401) return 'Your session has ended. Please sign in again.'
  try {
    const data = await res.json()
    if (data?.message) return data.message as string
  } catch {
   
  }
  return `${fallback} (${res.status})`
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function GetLearningMaterial() {
  const user = useMemo(() => getUser(), [])

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
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(apiUrl('/learning-materials'), { headers: authHeaders() })
      if (!res.ok) throw new Error(await errorFrom(res, 'Failed to load learning materials'))
      const data = await res.json()
      const list: ApiMaterial[] = Array.isArray(data) ? data : data.materials ?? []
      setMaterials(list.map(normalise))
      setError('')
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Could not reach the server. Check that the backend is running.'
          : err instanceof Error
            ? err.message
            : 'Failed to load learning materials',
      )
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

  // Files are behind sign-in, so fetch as a blob and trigger the download
  const download = async (m: LearningMaterial) => {
    setBusyId(m.id)
    setError('')
    try {
      const res = await fetch(apiUrl(`/learning-materials/${m.id}/download`), { headers: authHeaders() })
      if (!res.ok) throw new Error(await errorFrom(res, `Could not download “${m.title}”`))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = m.fileName || m.title
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not download “${m.title}”. Please try again.`)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (m: LearningMaterial) => {
    if (!window.confirm(`Delete “${m.title}”? This cannot be undone.`)) return
    setBusyId(m.id)
    setError('')
    try {
      const res = await fetch(apiUrl(`/learning-materials/${m.id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(await errorFrom(res, `Could not delete “${m.title}”`))
      setMaterials((list) => list.filter((x) => x.id !== m.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not delete “${m.title}”.`)
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
  const canUpload = user?.role === 'TEACHER'

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
            <div className="tt-avatar">{(user?.name || 'T').charAt(0).toUpperCase()}</div>
            <div>
              <div className="tt-user-name">{user?.name || 'Teacher'}</div>
              <div className="tt-user-role">{user?.role === 'TEACHER' ? 'Subject teacher' : user?.role || 'Subject teacher'}</div>
            </div>
          </div>
        </header>

        <main className="tt-content">
          <div className="tt-heading lm-heading">
            <div>
              <h1>Learning materials</h1>
              <p>Browse, search and download notes, slides, past papers and resources shared in your school.</p>
            </div>
            {canUpload && (
              <Link to="/Upload/LearningMaterial" className="tt-btn tt-btn-primary lm-upload-link">
                + Upload material
              </Link>
            )}
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
                      onClick={() => download(m)}
                    >
                      {busyId === m.id ? 'Please wait…' : 'Download'}
                    </button>
                    {m.isMine && (
                      <button
                        className="tt-btn tt-btn-ghost lm-action"
                        disabled={busyId === m.id}
                        onClick={() => remove(m)}
                      >
                        Delete
                      </button>
                    )}
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