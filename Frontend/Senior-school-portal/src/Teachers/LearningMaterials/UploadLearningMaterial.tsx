import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TeacherSidebar, { ROUTE } from '../TeacherSidebar'
import { apiUrl, authHeaders, getUser } from '../../api/authApi' // adjust the path to where authApi.ts lives

/* ------------------------------------------------------------------ */
/* Config - must match LearningMaterialController::store               */
/* ------------------------------------------------------------------ */
const MAX_SIZE_MB = 50
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024
const MAX_DESCRIPTION = 255
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.mp4'

type MaterialType = 'pdf' | 'doc' | 'ppt' | 'video' | 'other'

interface TeacherClass {
  className: string
  subject: string
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
const extOf = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || ''

const detectType = (fileName: string): MaterialType => {
  const ext = extOf(fileName)
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'doc'
  if (['ppt', 'pptx'].includes(ext)) return 'ppt'
  if (ext === 'mp4') return 'video'
  return 'other'
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const titleFromFile = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()

/** Turns a Laravel error response into one readable message. */
const messageFromResponse = (status: number, text: string): string => {
  try {
    const data = JSON.parse(text) as { message?: string; errors?: Record<string, string[]> }
    if (data?.errors) {
      const first = Object.values(data.errors)[0]
      if (Array.isArray(first) && first[0]) return first[0]
    }
    if (data?.message) return data.message
  } catch {
    /* not JSON */
  }
  if (status === 401) return 'Your session has ended. Please sign in again.'
  if (status === 413) return 'The file is too large for the server. Ask the administrator to raise the upload limit.'
  return `Upload failed (${status}).`
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function UploadLearningMaterial() {
  const user = useMemo(() => getUser(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classesLoaded, setClassesLoaded] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classKey, setClassKey] = useState('') // "className|subject"
  const [manualClass, setManualClass] = useState('')
  const [manualSubject, setManualSubject] = useState('')

  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  // The teacher's own class/subject combinations. If this endpoint does not
  // exist yet, the form falls back to typing the class and subject by hand.
  useEffect(() => {
    fetch(apiUrl('/classes/mine'), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClasses(Array.isArray(d) ? d : d.classes ?? []))
      .catch(() => setClasses([]))
      .finally(() => setClassesLoaded(true))
  }, [])

  const useManual = classesLoaded && classes.length === 0

  const pickFile = (f: File | undefined | null) => {
    if (!f) return
    const ext = extOf(f.name)
    if (!ACCEPT.split(',').includes(`.${ext}`)) {
      setError('Only PDF, Word, PowerPoint and MP4 files can be uploaded.')
      return
    }
    if (f.size > MAX_SIZE) {
      setError(`“${f.name}” is ${formatSize(f.size)}. The limit is ${MAX_SIZE_MB} MB.`)
      return
    }
    setError('')
    setFile(f)
    if (!title.trim()) setTitle(titleFromFile(f.name))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const resetForm = () => {
    setFile(null)
    setTitle('')
    setDescription('')
    setProgress(0)
    setError('')
    setSuccess(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const [selClass, selSubject] = useManual ? [manualClass.trim(), manualSubject.trim()] : classKey.split('|')

    if (!title.trim()) return setError('Please give the material a title.')
    if (!selClass || !selSubject) return setError('Please choose the class and subject this material is for.')
    if (!description.trim()) return setError('Please add a short description.')
    if (!file) return setError('Please choose a file to upload.')

    // Field names must match the Laravel validator exactly
    const body = new FormData()
    body.append('title', title.trim())
    body.append('class_name', selClass)
    body.append('subject', selSubject)
    body.append('description', description.trim())
    body.append('file', file)

    // XMLHttpRequest so we can show real upload progress and allow cancelling
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', apiUrl('/learning-materials'))

    // Accept + Authorization. Content-Type is NOT set: the browser adds the
    // multipart boundary itself, and setting it by hand breaks the upload.
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v))

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        setSuccess(title.trim())
      } else {
        setError(messageFromResponse(xhr.status, xhr.responseText))
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Network error. Check your connection and try again.')
    }
    xhr.onabort = () => {
      setUploading(false)
      setProgress(0)
    }

    setUploading(true)
    setProgress(0)
    xhr.send(body)
  }

  const cancelUpload = () => xhrRef.current?.abort()

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const detected = file ? detectType(file.name) : null

  return (
    <div className="tt-shell">
      <TeacherSidebar />

      <div className="tt-main">
        <header className="tt-topbar">
          <div className="tt-topbar-title">
            <strong>Upload learning material</strong>
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
          <div className="tt-heading">
            <h1>Upload learning material</h1>
            <p>Share notes, slides or past papers with your learners and colleagues.</p>
          </div>

          {success ? (
            <div className="um-success">
              <div className="um-success-icon">✓</div>
              <h2>Material uploaded</h2>
              <p>“{success}” is now available in Learning materials.</p>
              <div className="um-success-actions">
                <Link to={ROUTE.materials} className="tt-btn tt-btn-primary um-link-btn">
                  View learning materials
                </Link>
                <button className="tt-btn tt-btn-ghost" onClick={resetForm}>
                  Upload another
                </button>
              </div>
            </div>
          ) : (
            <div className="um-layout">
              <form className="um-card" onSubmit={submit} noValidate>
                {/* Content */}
                <div className="um-section-head">
                  <h2>1. Add the file</h2>
                </div>

                {file ? (
                  <div className="um-file">
                    <span className="um-file-type" data-type={detected}>
                      {TYPE_LABELS[detected!]}
                    </span>
                    <div className="um-file-info">
                      <strong title={file.name}>{file.name}</strong>
                      <span>{formatSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="um-file-remove"
                      disabled={uploading}
                      onClick={() => {
                        setFile(null)
                        if (inputRef.current) inputRef.current.value = ''
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    className={`um-drop${dragOver ? ' over' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    <strong>Drag a file here, or click to browse</strong>
                    <span>PDF, Word, PowerPoint or MP4 · up to {MAX_SIZE_MB} MB</span>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />

                {/* Details */}
                <div className="um-section-head">
                  <h2>2. Describe it</h2>
                </div>

                <label className="um-field">
                  Title
                  <input
                    placeholder="e.g. Quadratic equations – revision notes"
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                {useManual ? (
                  <div className="um-row">
                    <label className="um-field">
                      Class
                      <input placeholder="11A" value={manualClass} onChange={(e) => setManualClass(e.target.value)} />
                    </label>
                    <label className="um-field">
                      Subject
                      <input placeholder="Mathematics" value={manualSubject} onChange={(e) => setManualSubject(e.target.value)} />
                    </label>
                  </div>
                ) : (
                  <label className="um-field">
                    Class and subject
                    <select value={classKey} onChange={(e) => setClassKey(e.target.value)} disabled={!classesLoaded}>
                      <option value="">{classesLoaded ? 'Select class · subject' : 'Loading your classes…'}</option>
                      {classes.map((c) => (
                        <option key={`${c.className}|${c.subject}`} value={`${c.className}|${c.subject}`}>
                          {c.className} · {c.subject}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="um-field">
                  Description
                  <textarea
                    rows={4}
                    maxLength={MAX_DESCRIPTION}
                    placeholder="What is covered, and how should learners use it?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <small>
                    {description.length}/{MAX_DESCRIPTION}
                  </small>
                </label>

                {error && <div className="tt-alert um-error">{error}</div>}

                {uploading && (
                  <div className="um-progress" aria-live="polite">
                    <div className="um-progress-bar">
                      <div style={{ width: `${progress}%` }} />
                    </div>
                    <span>Uploading… {progress}%</span>
                  </div>
                )}

                <div className="um-actions">
                  {uploading ? (
                    <button type="button" className="tt-btn tt-btn-ghost" onClick={cancelUpload}>
                      Cancel upload
                    </button>
                  ) : (
                    <Link to={ROUTE.materials} className="tt-btn tt-btn-ghost um-link-btn">
                      Cancel
                    </Link>
                  )}
                  <button type="submit" className="tt-btn tt-btn-primary" disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Upload material'}
                  </button>
                </div>
              </form>

              <aside className="um-tips">
                <h3>Tips for good materials</h3>
                <ul>
                  <li>Use a clear title that includes the topic, e.g. “Photosynthesis – Grade 10 notes”.</li>
                  <li>Pick the exact class and subject so learners and colleagues find it quickly.</li>
                  <li>Keep videos under {MAX_SIZE_MB} MB. Compress longer recordings before uploading.</li>
                  <li>Check a document for learner names or private information before sharing.</li>
                </ul>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default UploadLearningMaterial