import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import LearnerLayout from './LearnerLayout'
import Icon from './Icon'
import type { IconName } from './Icon'
import { apiUrl, authHeaders } from '../api/authApi'

/* ---------- Types ---------- */

interface Guardian {
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  occupation: string | null
  idMasked: string | null
  isPrimary: boolean
}

interface LearnerProfile {
  firstName: string
  middleName: string | null
  surname: string
  gender: string | null
  dateOfBirth: string | null // ISO date
  nationality: string | null
  birthCertNo: string | null
  upi: string | null
  admissionNo: string
  status: string | null
  admissionDate: string | null // ISO date
  grade: string | null
  stream: string | null
  pathway: string | null
  residence: string | null
  previousSchool: string | null
  kjseaIndexNo: string | null
  kjseaPerformance: string | null
  compulsorySubjects: string[]
  electiveSubjects: string[]
  email: string | null
  phone: string | null
  address: string | null
  guardians: Guardian[]
  emergency: { name: string | null; phone: string | null }
  specialNeeds: string | null
  consents: { dataUse: boolean; aiTools: boolean; photo: boolean }
  account: { username: string; lastLogin: string | null }
}

/* ---------- Data ---------- */

function useLearnerProfile() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(apiUrl('/learner/profile'), {
        headers: { Accept: 'application/json', ...authHeaders() },
      })
      if (res.status === 401) throw new Error('Your session has ended. Please sign in again.')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.message || `Could not load your profile (${res.status})`)
      setProfile(data as LearnerProfile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { profile, error, load }
}

/* ---------- Helpers ---------- */

const MISSING = 'Not on record'

const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : MISSING

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : MISSING

const initials = (first = '', surname = '') => `${first[0] ?? ''}${surname[0] ?? ''}`.toUpperCase()

function Panel({
  title,
  hint,
  wide,
  children,
}: {
  title: string
  hint?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section className={`pf-panel ${wide ? 'is-wide' : ''}`}>
      <div className="pf-panel-header">
        <h2>{title}</h2>
        {hint && <span>{hint}</span>}
      </div>
      <div className="pf-panel-body">{children}</div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="pf-detail">
      <dt>{label}</dt>
      <dd>{value || MISSING}</dd>
    </div>
  )
}

function ContactRow({ icon, label, value }: { icon: IconName; label: string; value: string | null }) {
  return (
    <li className="pf-contact">
      <span className="pf-contact-icon">
        <Icon name={icon} size={18} className="" />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value || MISSING}</strong>
      </div>
    </li>
  )
}

function ConsentRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <li className="pf-consent">
      <span>{label}</span>
      <em className={granted ? 'is-yes' : 'is-no'}>{granted ? 'Granted' : 'Not granted'}</em>
    </li>
  )
}

/* ---------- Page ---------- */

function Profile() {
  const { profile: p, error, load } = useLearnerProfile()

  if (!p) {
    return (
      <LearnerLayout
        title="Profile"
        description="Your personal, academic and guardian details. To correct locked details, contact the school office."
      >
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <p>Loading your profile…</p>
        )}
      </LearnerLayout>
    )
  }

  const fullName = [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ')
  const classLabel = p.grade ? `${p.grade} · ${p.stream} stream` : 'Class not assigned'

  return (
    <LearnerLayout
      title="Profile"
      description="Your personal, academic and guardian details. To correct locked details, contact the school office."
    >
      {/* Hero */}
      <section className="pf-hero">
        <div className="pf-avatar" aria-hidden="true">
          {initials(p.firstName, p.surname)}
        </div>

        <div className="pf-hero-text">
          <h2>{fullName}</h2>
          <p>
            Admission No. {p.admissionNo}
            {p.upi ? ` · UPI ${p.upi}` : ''}
          </p>
          <div className="pf-chips">
            <span>{classLabel}</span>
            {p.pathway && <span>{p.pathway} pathway</span>}
            {p.residence && <span>{p.residence}</span>}
            {p.status === 'active' && <span className="is-ok">Active</span>}
          </div>
        </div>

        <button type="button" className="pf-print" onClick={() => window.print()}>
          <Icon name="printer" size={16} className="" />
          Print profile
        </button>
      </section>

      {/* Quick facts */}
      <div className="pf-stats">
        <div className="pf-stat">
          <span>Admission number</span>
          <b>{p.admissionNo}</b>
          <small>Admitted {formatDate(p.admissionDate)}</small>
        </div>
        <div className="pf-stat">
          <span>Class</span>
          <b>{p.grade ? `${p.grade} ${p.stream}` : MISSING}</b>
          <small>Current stream</small>
        </div>
        <div className="pf-stat">
          <span>Pathway</span>
          <b>{p.pathway || MISSING}</b>
          <small>{p.electiveSubjects.length} elective subjects</small>
        </div>
        <div className="pf-stat">
          <span>Residence</span>
          <b>{p.residence || MISSING}</b>
          <small>{p.nationality ? `${p.nationality} citizen` : ''}</small>
        </div>
      </div>

      <div className="pf-grid">
        <Panel title="Personal details" hint="Managed by the school office">
          <dl className="pf-dl">
            <Detail label="First name" value={p.firstName} />
            <Detail label="Middle name" value={p.middleName} />
            <Detail label="Surname" value={p.surname} />
            <Detail label="Gender" value={p.gender} />
            <Detail label="Date of birth" value={formatDate(p.dateOfBirth)} />
            <Detail label="Nationality" value={p.nationality} />
            <Detail label="Birth certificate no." value={p.birthCertNo} />
            <Detail label="UPI (NEMIS)" value={p.upi} />
          </dl>
        </Panel>

        <Panel title="Contact details">
          <ul className="pf-contacts">
            <ContactRow icon="mail" label="Email" value={p.email} />
            <ContactRow icon="phone" label="Phone" value={p.phone} />
            <ContactRow icon="pin" label="Home address" value={p.address} />
          </ul>
        </Panel>

        <Panel title="Admission and academics" hint="Managed by the school office" wide>
          <dl className="pf-dl pf-dl-3">
            <Detail label="Admission number" value={p.admissionNo} />
            <Detail label="Admission date" value={formatDate(p.admissionDate)} />
            <Detail label="Grade and stream" value={p.grade ? `${p.grade} · ${p.stream}` : null} />
            <Detail label="Pathway" value={p.pathway} />
            <Detail label="Previous school" value={p.previousSchool} />
            <Detail label="KJSEA index number" value={p.kjseaIndexNo} />
            <Detail label="KJSEA performance" value={p.kjseaPerformance} />
            <Detail label="Special needs / support" value={p.specialNeeds} />
          </dl>

          <div className="pf-subjects">
            <div>
              <h3>Compulsory subjects</h3>
              <div className="pf-tags">
                {p.compulsorySubjects.map((s) => (
                  <span key={s} className="pf-tag">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3>Elective subjects</h3>
              <div className="pf-tags">
                {p.electiveSubjects.map((s) => (
                  <span key={s} className="pf-tag is-elective">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Parents and guardians" wide>
          <div className="pf-guardians">
            {p.guardians.map((g, i) => (
              <article key={`${g.name}-${i}`} className="pf-guardian">
                <header>
                  <div className="pf-guardian-avatar">{initials(g.name.split(' ')[0], g.name.split(' ').slice(-1)[0])}</div>
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      {g.relationship || 'Guardian'}
                      {g.isPrimary ? ' · Primary contact' : ''}
                    </small>
                  </div>
                </header>
                <dl className="pf-dl pf-dl-compact">
                  <Detail label="Phone" value={g.phone} />
                  <Detail label="Email" value={g.email} />
                  <Detail label="Occupation" value={g.occupation} />
                  <Detail label="National ID" value={g.idMasked} />
                </dl>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Emergency contact">
          <dl className="pf-dl pf-dl-one">
            <Detail label="Name" value={p.emergency.name} />
            <Detail label="Phone" value={p.emergency.phone} />
          </dl>
        </Panel>

        <Panel title="Consent and account">
          <ul className="pf-consents">
            <ConsentRow label="School data use" granted={p.consents.dataUse} />
            <ConsentRow label="AI Tutor and study tools" granted={p.consents.aiTools} />
            <ConsentRow label="Photo on portal and ID card" granted={p.consents.photo} />
          </ul>
          <div className="pf-account">
            <Icon name="shield" size={18} className="" />
            <div>
              <strong>{p.account.username}</strong>
              <small>Last sign-in {formatDateTime(p.account.lastLogin)}</small>
            </div>
          </div>
        </Panel>
      </div>
    </LearnerLayout>
  )
}

export default Profile