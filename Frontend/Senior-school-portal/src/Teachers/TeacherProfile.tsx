import { useCallback, useEffect, useMemo, useState } from 'react'
import TeacherSidebar from './TeacherSidebar'
import { apiUrl, authHeaders, getUser } from '../api/authApi' // adjust the paths to where these files live


/* ------------------------------------------------------------------ */
/* Types: exactly what TeacherDashboardController@show returns         */
/* ------------------------------------------------------------------ */

interface TeachingLine {
  subject: string
  classes: string[] // e.g. ["10A", "11C"]
}

export interface TeacherProfileData {
  firstName: string
  middleName: string | null
  lastName: string
  staffNumber: string | null
  tscNumber: string | null
  idMasked: string | null // "•••• 1234": the full ID number never leaves the server
  email: string | null
  phone: string | null
  designation: string | null
  employmentType: string | null
  dateOfEmployment: string | null // YYYY-MM-DD
  department: string | null
  isHod: boolean
  subjects: string[]
  teaching: TeachingLine[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const parseDay = (iso: string | null): Date | null => {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatDate = (iso: string | null) => {
  const d = parseDay(iso)
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
}

/** "2 years 3 months", "5 months", "Less than a month". Null for a missing or future date. */
export function serviceLength(iso: string | null, today = new Date()): string | null {
  const start = parseDay(iso)
  if (!start || start > today) return null
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
  if (today.getDate() < start.getDate()) months -= 1
  if (months < 1) return 'Less than a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m) parts.push(`${m} month${m === 1 ? '' : 's'}`)
  return parts.join(' ')
}

const initialsOf = (p: Pick<TeacherProfileData, 'firstName' | 'lastName'>) =>
  `${p.firstName?.charAt(0) ?? ''}${p.lastName?.charAt(0) ?? ''}`.toUpperCase() || 'T'

const messageFrom = async (res: Response): Promise<string> => {
  if (res.status === 401) return 'Your session has ended. Please sign in again.'
  try {
    const data = await res.json()
    if (data?.message) return data.message as string
  } catch {
    /* not JSON */
  }
  return `Could not load your profile (${res.status}).`
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tp-row">
      <dt>{label}</dt>
      <dd>{children ?? <span className="tp-none">Not provided</span>}</dd>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="tp-skeleton" aria-hidden="true">
      <div className="tp-skel tp-skel-hero" />
      <div className="tp-grid">
        <div className="tp-skel tp-skel-card" />
        <div className="tp-skel tp-skel-card" />
      </div>
      <div className="tp-skel tp-skel-card" />
    </div>
  )
}

/** The page body. It only draws, so it is easy to test with sample data. */
export function ProfileView({ profile }: { profile: TeacherProfileData }) {
  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')
  const teaching = profile.teaching ?? []
  const classCount = useMemo(() => new Set(teaching.flatMap((t) => t.classes)).size, [teaching])
  const served = serviceLength(profile.dateOfEmployment)
  const subline = [profile.designation, profile.department].filter(Boolean).join(' · ')

  return (
    <>
      {/* Identity */}
      <section className="tp-hero" aria-label="Teacher summary">
        <div className="tp-avatar" aria-hidden="true">
          {initialsOf(profile)}
        </div>
        <div className="tp-hero-main">
          <h2>{fullName}</h2>
          {subline && <p className="tp-sub">{subline}</p>}
          <div className="tp-badges">
            {profile.isHod && <span className="tp-badge gold">Head of department</span>}
            {profile.employmentType && <span className="tp-badge">{profile.employmentType}</span>}
            {profile.staffNumber && <span className="tp-badge muted">Staff no. {profile.staffNumber}</span>}
          </div>
        </div>
        <dl className="tp-stats">
          <div>
            <dt>Subjects</dt>
            <dd>{profile.subjects?.length ?? 0}</dd>
          </div>
          <div>
            <dt>Classes</dt>
            <dd>{classCount}</dd>
          </div>
          <div>
            <dt>Time at school</dt>
            <dd className="small">{served ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="tp-grid">
        {/* Contact */}
        <section className="tp-card" aria-labelledby="tp-contact">
          <h3 id="tp-contact">Contact</h3>
          <dl>
            <Row label="Email">{profile.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : null}</Row>
            <Row label="Phone">{profile.phone ? <a href={`tel:${profile.phone}`}>{profile.phone}</a> : null}</Row>
          </dl>
        </section>

        {/* Employment */}
        <section className="tp-card" aria-labelledby="tp-employment">
          <h3 id="tp-employment">Employment</h3>
          <dl>
            <Row label="Staff number">{profile.staffNumber}</Row>
            <Row label="TSC number">{profile.tscNumber}</Row>
            <Row label="National ID">{profile.idMasked}</Row>
            <Row label="Department">{profile.department}</Row>
            <Row label="Designation">{profile.designation}</Row>
            <Row label="Employment type">{profile.employmentType}</Row>
            <Row label="Date of employment">{formatDate(profile.dateOfEmployment)}</Row>
          </dl>
        </section>
      </div>

      {/* Teaching */}
      <section className="tp-card" aria-labelledby="tp-teaching">
        <h3 id="tp-teaching">Teaching this year</h3>
        {teaching.length === 0 ? (
          <p className="tp-empty">
            No classes are assigned to you for the current academic year yet. Please contact the school office if this looks wrong.
          </p>
        ) : (
          <ul className="tp-teach">
            {teaching.map((t) => (
              <li key={t.subject}>
                <strong>{t.subject}</strong>
                <span className="tp-chips">
                  {t.classes.map((c) => (
                    <span key={c} className="tp-chip">
                      {c}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="tp-note">These details are managed by the school office. To correct anything here, please contact them.</p>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function TeacherProfile() {
  const user = useMemo(() => getUser(), [])
  const [profile, setProfile] = useState<TeacherProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/teacher/profile'), { headers: authHeaders(), signal })
      if (!res.ok) throw new Error(await messageFrom(res))
      setProfile((await res.json()) as TeacherProfileData)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof TypeError
          ? 'Could not reach the server. Check that the backend is running.'
          : err instanceof Error
            ? err.message
            : 'Could not load your profile.',
      )
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctl = new AbortController()
    void load(ctl.signal)
    return () => ctl.abort()
  }, [load])

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
            <strong>My profile</strong>
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

        <main className="tt-content" aria-busy={loading}>
          <div className="tt-heading">
            <h1>My profile</h1>
            <p>Your staff record, employment details and the classes you teach this year.</p>
          </div>

          {error && (
            <div className="tt-alert" role="alert">
              {error}
              <button onClick={() => void load()}>Retry</button>
            </div>
          )}

          {loading && !profile ? <Skeleton /> : profile ? <ProfileView profile={profile} /> : null}
        </main>
      </div>
    </div>
  )
}

export default TeacherProfile