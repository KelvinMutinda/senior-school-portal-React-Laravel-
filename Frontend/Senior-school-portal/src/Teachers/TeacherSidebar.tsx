import React, { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout as apiLogout } from '../api/authApi' // adjust the path to where authApi.ts lives

export const ROUTE = {
  dashboard: '/Teacher/Dashboard',
  classes: '/Academics/classes',
  students: '/Students',
  attendance: '/Academics/Attendance',
  marks: '/Results/Upload/Results',
  results: '/Results/View/Results',
  progress: '/Academics/Progress',
  timetable: '/Academics/Timetable',
  materials: '/Teacher/materials',
  upload: '/Upload/LearningMaterial',
  generate: '/AI/Chat',
  tutor: '/AI/Chat',
  announcements: '/Announcements',
  comments: '/Academics/Comments',
} as const

type RouteKey = keyof typeof ROUTE

interface NavItem {
  key: RouteKey // unique React key (some routes share the same path)
  label: string
  icon: string
}

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: 'grid' }],
  },
  {
    heading: 'Class management',
    items: [
      { key: 'classes', label: 'My classes', icon: 'users' },
      { key: 'students', label: 'Learners', icon: 'user' },
      { key: 'attendance', label: 'Attendance', icon: 'check' },
    ],
  },
  {
    heading: 'Assessment',
    items: [
      { key: 'marks', label: 'Upload marks', icon: 'pen' },
      { key: 'results', label: 'View marks', icon: 'bars' },
      { key: 'progress', label: 'Progress records', icon: 'trend' },
      { key: 'comments', label: 'Comments', icon: 'chat' },
    ],
  },
  {
    heading: 'Teaching',
    items: [
      { key: 'timetable', label: 'Timetable', icon: 'calendar' },
      { key: 'materials', label: 'Learning materials', icon: 'book' },
      { key: 'upload', label: 'Upload learning materials', icon: 'upload' },
      { key: 'generate', label: 'Generate learning material', icon: 'spark' },
    ],
  },
  {
    heading: 'AI',
    items: [{ key: 'tutor', label: 'AI Mwalimu', icon: 'cap' }],
  },
  {
    heading: 'Communication',
    items: [{ key: 'announcements', label: 'Announcements', icon: 'megaphone' }],
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
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  calendar: 'M4 6h16v14H4zM8 3v4M16 3v4M4 10h16',
  book: 'M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2zM5 18a2 2 0 012-2h12',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  megaphone: 'M4 10v4h3l7 4V6L7 10zM18 9a4 4 0 010 6',
  logout: 'M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4M16 17l5-5-5-5M21 12H9',
}

export const Icon = ({ name }: { name: string }) => (
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

const TeacherSidebar: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close the drawer whenever the route changes
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // Close on Escape and lock page scroll while the drawer is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const handleLogout = async () => {
    setSigningOut(true)
    // authApi.logout() clears the token, user and expiry straight away,
    // then tells the server to revoke the token.
    await apiLogout()
    // replace: the Back button will not return to a signed-in page
    navigate('/auth/Login', { replace: true })
  }

  return (
    <>
      <button
        type="button"
        className="tt-burger"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="tt-sidebar"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && <div className="tt-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="tt-sidebar" className={`tt-sidebar${open ? ' is-open' : ''}`}>
        <div className="tt-brand">
          <div className="tt-brand-logo">SP</div>
          <div>
            <div className="tt-brand-name">Senior School</div>
            <div className="tt-brand-role">Teacher</div>
            <div className="tt-brand-portal">PORTAL</div>
          </div>
          <button
            type="button"
            className="tt-close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="tt-nav">
          {NAV.map((group) => (
            <div key={group.heading} className="tt-nav-group">
              <div className="tt-nav-heading">{group.heading}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={ROUTE[item.key]}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `tt-nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="tt-nav-group tt-logout-group">
            <div className="tt-nav-heading">Account</div>
            <button
              type="button"
              className="tt-nav-link tt-logout"
              onClick={handleLogout}
              disabled={signingOut}
            >
              <Icon name="logout" />
              <span>{signingOut ? 'Signing out…' : 'Logout'}</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  )
}

export default TeacherSidebar