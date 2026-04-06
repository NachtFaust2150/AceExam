import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../teacher/Admin.css'; // Reuse Dashboard CSS layout

export default function OrgDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-brand">🏢 AceExam Org</span>
        </div>
        
        <nav className="nav-menu">
          <NavLink to="/org" end className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            👨‍🏫 Manage Teachers
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0 0.5rem', marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{user?.name}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Organisation</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ marginBottom: '2.5rem' }}>
          <h1>Organisation Portal</h1>
          <p>Manage your linked Teacher accounts securely.</p>
        </header>
        
        <div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
