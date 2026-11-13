import React from 'react';

function LearnerDashboard() {
  return (
    <div className="learner-layout">
      {/* ========== SIDEBAR ========== */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">KS</div>
          <div>
            <h2>Kanja Senior School</h2>
            <p>AIM HIGHER</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section">Overview</p>
          <a href="#" className="nav-item active">
            <span className="nav-icon">🏠</span> Dashboard
          </a>

          <p className="nav-section">Academics</p>
          <a href="#" className="nav-item">
            <span className="nav-icon">📚</span> My Subjects
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">📝</span> Assignments
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">📄</span> Report Cards
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">📅</span> Timetable
          </a>

          <p className="nav-section">Finance</p>
          <a href="#" className="nav-item">
            <span className="nav-icon">💳</span> Fees & Payments
          </a>

          <p className="nav-section">AI Tools</p>
          <a href="#" className="nav-item">
            <span className="nav-icon">✨</span> AI Study Assistant
          </a>
        </nav>

        <div className="sidebar-footer">
          <p>Senior School Portal · v1.0</p>
        </div>
      </aside>

      {/* ========== MAIN CONTENT ========== */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1>Learner Dashboard</h1>
            <p className="date">Friday, 13 November 2026</p>
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <input type="text" placeholder="Search subjects, assignments..." />
            </div>
            <button className="icon-btn">🔔</button>
            <div className="user-chip">
              <div className="avatar">JW</div>
              <div>
                <strong>James Wanjiku</strong>
                <span>Grade 11 · Science</span>
              </div>
            </div>
          </div>
        </header>

        {/* Welcome Banner */}
        <section className="welcome-banner">
          <div className="welcome-text">
            <p className="role-label">LEARNER</p>
            <h2>Good evening, James 👋</h2>
            <p>You have <strong>3 assignments</strong> due this week and <strong>1 upcoming exam</strong>.</p>
            <div className="banner-actions">
              <button className="btn-primary">View Assignments</button>
              <button className="btn-secondary">Open Timetable</button>
            </div>
          </div>
          <div className="welcome-stats">
            <div className="stat">
              <span className="stat-value">6</span>
              <span className="stat-label">Subjects</span>
            </div>
            <div className="stat">
              <span className="stat-value">92%</span>
              <span className="stat-label">Attendance</span>
            </div>
            <div className="stat">
              <span className="stat-value">B+</span>
              <span className="stat-label">Average</span>
            </div>
          </div>
        </section>

        {/* Metric Cards */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span>📅 Attendance</span>
            </div>
            <h3>92%</h3>
            <p>Present this term</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '92%' }}></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span>📊 Current Average</span>
            </div>
            <h3>78%</h3>
            <p>Across all subjects</p>
            <div className="progress-bar">
              <div className="progress-fill green" style={{ width: '78%' }}></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span>📝 Pending Tasks</span>
            </div>
            <h3>5</h3>
            <p>Assignments & quizzes</p>
            <div className="progress-bar">
              <div className="progress-fill orange" style={{ width: '60%' }}></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span>💳 Fee Status</span>
            </div>
            <h3>Paid</h3>
            <p>Term 3 balance: KES 0</p>
            <div className="progress-bar">
              <div className="progress-fill green" style={{ width: '100%' }}></div>
            </div>
          </div>
        </section>

        {/* Bottom Grid */}
        <section className="bottom-grid">
          {/* Upcoming Tasks */}
          <div className="card">
            <div className="card-header">
              <h3>Upcoming Tasks</h3>
              <a href="#">View all →</a>
            </div>

            <div className="task-item">
              <div className="task-info">
                <strong>Mathematics – Calculus Worksheet</strong>
                <span>Due in 2 days · Mr. Kamau</span>
              </div>
              <button className="btn-small">Open</button>
            </div>

            <div className="task-item">
              <div className="task-info">
                <strong>Chemistry – Practical Report</strong>
                <span>Due in 4 days · Mrs. Otieno</span>
              </div>
              <button className="btn-small">Open</button>
            </div>

            <div className="task-item">
              <div className="task-info">
                <strong>English – Essay Draft</strong>
                <span>Due in 5 days · Ms. Wanjiru</span>
              </div>
              <button className="btn-small">Open</button>
            </div>
          </div>

          {/* Alerts / Announcements */}
          <div className="card">
            <div className="card-header">
              <h3>Announcements</h3>
              <a href="#">View all →</a>
            </div>

            <div className="alert-item warning">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>Mid-term exams start next week</strong>
                <p>Prepare using the revision timetable shared by your class teacher.</p>
              </div>
            </div>

            <div className="alert-item info">
              <span className="alert-icon">📢</span>
              <div>
                <strong>Career Guidance Session</strong>
                <p>Friday 2:00 PM – Main Hall. All Grade 11 learners to attend.</p>
              </div>
            </div>

            <div className="alert-item success">
              <span className="alert-icon">✅</span>
              <div>
                <strong>Fee payment confirmed</strong>
                <p>Your Term 3 fees have been fully cleared. Thank you.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LearnerDashboard;