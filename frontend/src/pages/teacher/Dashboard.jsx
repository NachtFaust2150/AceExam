import { useQuery } from '@apollo/client/react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GET_EXAMS, GET_STUDENTS } from '../../lib/graphql';
import './Admin.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: eData } = useQuery(GET_EXAMS);
  const { data: sData } = useQuery(GET_STUDENTS);

  const totalExams = eData?.exams?.length || 0;
  const totalStudents = sData?.students?.length || 0;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-brand">🎓 AceExam</span>
          <span className="badge badge-info" style={{ marginLeft: 'auto' }}>Teacher</span>
        </div>

        <nav className="nav-menu">
          <Link to="/teacher" className={`nav-item ${location.pathname === '/teacher' ? 'active' : ''}`}>
            📊 Dashboard
          </Link>
          <Link to="/teacher/exams" className={`nav-item ${location.pathname.includes('/exams') ? 'active' : ''}`}>
            📋 Exams
          </Link>
          <Link to="/teacher/students" className={`nav-item ${location.pathname.includes('/students') ? 'active' : ''}`}>
            👥 Students
          </Link>
          <Link to="/teacher/results" className={`nav-item ${location.pathname.includes('/results') ? 'active' : ''}`}>
            📈 Results
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0 0.5rem', marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>🧑 {user?.name || 'Teacher'}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%' }}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
        {/* Default dashboard view when at /teacher exactly */}
        {location.pathname === '/teacher' && (
          <div>
            <header style={{ marginBottom: '2.5rem' }}>
              <h1>Teacher Dashboard</h1>
              <p>Welcome back! Here's an overview of your classes.</p>
            </header>

            <div className="stats-grid">
              <div className="card stat-card-custom">
                <div className="stat-icon">📋</div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalExams}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Exams</div>
                </div>
              </div>
              <div className="card stat-card-custom">
                <div className="stat-icon">👥</div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalStudents}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Enrolled Students</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '3rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Quick Links</h2>
              <div className="actions-grid">
                <Link to="/teacher/exams" className="card action-card-custom">
                  <span>➕</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Manage Exams</p>
                </Link>
                <Link to="/teacher/students" className="card action-card-custom">
                  <span>👤</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Manage Students</p>
                </Link>
                <Link to="/teacher/results" className="card action-card-custom">
                  <span>📈</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>View Results</p>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
