import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import type { IconName } from './Icon'

/* Shared shell for every learner page: sidebar + top bar + page body.
   Each page just renders <LearnerLayout title="...">...</LearnerLayout>. */

interface NavItem {
  to: string
  icon: IconName
  label: string
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/Learner/Dashboard', icon: 'home', label: 'Dashboard' },
      { to: '/Learner/Profile', icon: 'user', label: 'Profile' },
    ],
  },
  {
    title: 'ACADEMIC',
    items: [
      { to: '/Academics/Results', icon: 'results', label: 'Academic results' },
      { to: '/Academic/LearningMaterials', icon: 'book', label: 'Learning Materials' },
      { to: '/Academic/Timetable', icon: 'calendar', label: 'Timetable' },
      { to: '/AI/Chat', icon: 'bot', label: 'AI Tutor' },
    ],
  },
  {
    title: 'FINANCES',
    items: [
      { to: '/Finance/PayFees', icon: 'cash', label: 'Pay fees' },
      { to: '/Finance/Fee/Structure', icon: 'clipboard', label: 'Fee structure' },
      { to: '/Finance/Fee/statement', icon: 'scale', label: 'Fees statement and balance' },
    ],
  },
  {
    title: 'CAREER PATHWAY',
    items: [
      { to: '/CareerPathways', icon: 'compass', label: 'Pathway recommender' },
      { to: '/Explore/Pathways', icon: 'map', label: 'Explore pathways' },
    ],
  },
]

/* TODO: replace with the logged-in learner once the API is ready */
const currentLearner = 'Grace Njeri · Grade 10 · East stream'

interface LearnerLayoutProps {
  title: string
  description?: string
  children: ReactNode
}

function LearnerLayout({ title, description, children }: LearnerLayoutProps) {
  const now = new Date()
  const today = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )}`

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">SP</div>
          <div>
            <div className="sidebar-title">Senior School</div>
            <div className="sidebar-role">Learner</div>
            <div className="sidebar-subtitle">PORTAL</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">{currentLearner}</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            <p>{today}</p>
          </div>
        </header>

        <div className="page-body">
          {description && <p className="lm-subtitle">{description}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}

export default LearnerLayout