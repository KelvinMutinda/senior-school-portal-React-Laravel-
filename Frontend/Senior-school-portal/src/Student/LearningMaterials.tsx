import React, { useState } from 'react';

const categories = [
  { id: 'all', label: 'All materials', count: 24 },
  { id: 'revision', label: 'Revision Papers', count: 9 },
  { id: 'learning', label: 'Learning Materials', count: 8 },
  { id: 'exams', label: 'Exams', count: 5 },
  { id: 'notes', label: 'Notes & Summaries', count: 2 },
];

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
];

function LearningMaterials() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [activeNav, setActiveNav] = useState('learning-materials');

  const filtered = materials.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subject.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="app-layout">
      {/* ========== SIDEBAR ========== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">SP</div>
          <div>
            <div className="sidebar-title">Senior School</div>
            <div className="sidebar-subtitle">Learner PORTAL</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">OVERVIEW</div>
            <button
              className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveNav('dashboard')}
            >
              <span className="nav-icon">⌂</span>
              Dashboard
            </button>
            <button
              className={`nav-item ${activeNav === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveNav('profile')}
            >
              <span className="nav-icon">👤</span>
              Profile
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">ACADEMIC</div>
            <button
              className={`nav-item ${activeNav === 'transcript' ? 'active' : ''}`}
              onClick={() => setActiveNav('transcript')}
            >
              <span className="nav-icon">📄</span>
              Academic transcript
            </button>
            <button
              className={`nav-item ${activeNav === 'academic-dashboard' ? 'active' : ''}`}
              onClick={() => setActiveNav('academic-dashboard')}
            >
              <span className="nav-icon">📊</span>
              Academic dashboard
            </button>
            <button
              className={`nav-item ${activeNav === 'learning-materials' ? 'active' : ''}`}
              onClick={() => setActiveNav('learning-materials')}
            >
              <span className="nav-icon">📚</span>
              Learning Materials
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">FINANCES</div>
            <button
              className={`nav-item ${activeNav === 'pay-fees' ? 'active' : ''}`}
              onClick={() => setActiveNav('pay-fees')}
            >
              <span className="nav-icon">💳</span>
              Pay fees
            </button>
            <button
              className={`nav-item ${activeNav === 'fee-structure' ? 'active' : ''}`}
              onClick={() => setActiveNav('fee-structure')}
            >
              <span className="nav-icon">📋</span>
              Fee structure
            </button>
            <button
              className={`nav-item ${activeNav === 'fees-statement' ? 'active' : ''}`}
              onClick={() => setActiveNav('fees-statement')}
            >
              <span className="nav-icon">🧾</span>
              Fees statement and balance
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">CAREER PATHWAY</div>
            <button
              className={`nav-item ${activeNav === 'pathway' ? 'active' : ''}`}
              onClick={() => setActiveNav('pathway')}
            >
              <span className="nav-icon">🎯</span>
              Pathway recommender
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">GN</div>
            <div>
              <div className="user-name">Grace Njeri</div>
              <div className="user-meta">Grade 10 · Fast stream</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ========== MAIN CONTENT ========== */}
      <main className="main-content">
        <div className="lm-page">
          {/* Header */}
          <div className="lm-header">
            <div>
              <h1>Learning Materials</h1>
              <p className="lm-date">Wednesday, 18 November 2026</p>
            </div>
          </div>

          <p className="lm-subtitle">
            Browse revision papers, notes, exams and learning resources.
          </p>

          {/* Category Tabs */}
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

          {/* Search + Filters */}
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

          {/* Materials Grid */}
          <div className="lm-grid">
            {filtered.map((item) => (
              <div key={item.id} className="lm-card">
                <div className="lm-card-top">
                  <span className={`lm-badge lm-badge-${item.category}`}>
                    {item.category === 'revision' && 'Revision'}
                    {item.category === 'learning' && 'Learning'}
                    {item.category === 'exams' && 'Exam'}
                    {item.category === 'notes' && 'Notes'}
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
      </main>
    </div>
  );
}

export default LearningMaterials;