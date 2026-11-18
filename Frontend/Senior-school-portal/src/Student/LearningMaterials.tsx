import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import '../App.css'

/* ---------- Line icons (24x24, stroke) - no extra dependency ---------- */
const icons: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  results: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  bot: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </>
  ),
  cash: (
    <>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  clipboard: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </>
  ),
  scale: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
    </>
  ),
  map: (
    <>
      <path d="M14.1 5.55a2 2 0 0 0 1.79 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.55 2.27a2 2 0 0 1-1.79 0l-4.21-2.1a2 2 0 0 0-1.79 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.55-2.27a2 2 0 0 1 1.79 0z" />
      <path d="M15 5.76v15" />
      <path d="M9 3.24v15" />
    </>
  ),
}

function Icon({ name }: { name: string }) {
  return (
    <svg
      className="nav-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  )
}

const navSections = [
  {
    title: 'OVERVIEW',
    items: [{ to: '/Learner/Dashboard', icon: 'home', label: 'Dashboard' }],
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

const categories = [
  { id: 'all', label: 'All materials', count: 24 },
  { id: 'revision', label: 'Revision Papers', count: 9 },
  { id: 'learning', label: 'Learning Materials', count: 8 },
  { id: 'exams', label: 'Exams', count: 5 },
  { id: 'notes', label: 'Notes & Summaries', count: 2 },
]

const categoryBadge: Record<string, string> = {
  revision: 'Revision',
  learning: 'Learning',
  exams: 'Exam',
  notes: 'Notes',
}

const materials = [
  {
    id: 1,
    title: 'Form 4 Mathematics Revision Paper',
    category: 'revision',
    subject: 'Mathematics',
    type: 'PDF',
    pages: 12,
    match: 92,
    tags: ['Algebra', 'Calculus', 'Statistics'],
  },
  {
    id: 2,
    title: 'Biology Notes - Human Reproduction',
    category: 'learning',
    subject: 'Biology',
    type: 'PDF',
    pages: 18,
    match: 88,
    tags: ['Reproduction', 'Genetics'],
  },
  {
    id: 3,
    title: 'KCSE 2025 Chemistry Paper 1',
    category: 'exams',
    subject: 'Chemistry',
    type: 'PDF',
    pages: 8,
    match: 95,
    tags: ['Organic', 'Inorganic'],
  },
  {
    id: 4,
    title: 'Physics Practical Guide',
    category: 'learning',
    subject: 'Physics',
    type: 'PDF',
    pages: 22,
    match: 81,
    tags: ['Mechanics', 'Electricity'],
  },
  {
    id: 5,
    title: 'History Revision Questions - Paper 2',
    category: 'revision',
    subject: 'History',
    type: 'PDF',
    pages: 15,
    match: 76,
    tags: ['Colonialism', 'Independence'],
  },
  {
    id: 6,
    title: 'English Literature Notes - Blossoms of the Savannah',
    category: 'notes',
    subject: 'English',
    type: 'PDF',
    pages: 14,
    match: 90,
    tags: ['Literature', 'Themes'],
  },
]

function LearningMaterials() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')

  const now = new Date()
  const today = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )}`

  const query = search.toLowerCase()

  const filtered = materials.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    const matchesSearch =
      item.title.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query))
    return matchesCategory && matchesSearch
  })

  return (
    <div className="app-layout">
      {/* ========== SIDEBAR ========== */}
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

        <div className="sidebar-footer">Grace Njeri · Grade 10 · East stream</div>
      </aside>

      {/* ========== MAIN CONTENT ========== */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>Learning Materials</h1>
            <p>{today}</p>
          </div>
        </header>

        <div className="page-body">
          <p className="lm-subtitle">
            Browse revision papers, notes, exams and learning resources.
          </p>

          {/* Category cards */}
          <div className="lm-categories">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`lm-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="lm-cat-label">{cat.label}</span>
                <span className="lm-cat-count">{cat.count} to explore</span>
              </button>
            ))}
          </div>

          {/* Materials panel */}
          <section className="lm-panel">
            <div className="lm-panel-header">
              <h2>Materials</h2>
              <span>
                {filtered.length} of {materials.length} materials, best match first
              </span>
            </div>

            <div className="lm-panel-body">
              <div className="lm-toolbar">
                <div className="lm-search">
                  <input
                    type="text"
                    placeholder="Search by subject, topic or keyword..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="lm-filters">
                  <select className="lm-sort">
                    <option>Best match first</option>
                    <option>Newest first</option>
                    <option>Most popular</option>
                  </select>
                </div>
              </div>

              <div className="lm-grid">
                {filtered.map((item) => (
                  <div key={item.id} className="lm-card">
                    <div className="lm-card-top">
                      <span className={`lm-badge lm-badge-${item.category}`}>
                        {categoryBadge[item.category]}
                      </span>
                      <span className="lm-match">{item.match}% match</span>
                    </div>

                    <h3 className="lm-card-title">{item.title}</h3>
                    <p className="lm-card-subject">{item.subject}</p>

                    <div className="lm-card-meta">
                      <span>{item.type}</span>
                      <span>•</span>
                      <span>{item.pages} pages</span>
                    </div>

                    <div className="lm-tags">
                      {item.tags.map((tag) => (
                        <span key={tag} className="lm-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="lm-card-actions">
                      <button className="lm-btn-primary">Open</button>
                      <button className="lm-btn-secondary">Save</button>
                    </div>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="lm-empty">
                  <p>No materials found. Try a different search or category.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default LearningMaterials