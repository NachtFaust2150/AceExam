import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LOGIN } from '../lib/graphql';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginMutation, { loading }] = useMutation(LOGIN);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await loginMutation({ variables: { email, password } });
      const { token, role, user } = data.login;
      login(token, role, user);
      navigate(
        role === 'organisation' 
          ? '/org' 
          : role === 'teacher' 
          ? '/teacher' 
          : '/student'
      );
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative' }}>
      <div className="login-bg-grid"></div>

      <div className="card" style={{ width: '100%', maxWidth: '420px', zIndex: 10, padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎓</div>
          <h1 style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.5px' }}>AceExam</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Accessible Assessment Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'var(--danger-light)', color: 'var(--danger-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem' }} role="alert">
              <strong>Login Error:</strong> {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontSize: '1rem' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Demo Access Credentials:</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Org:</span> <strong>org@ace.com / org123</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Teacher:</span> <strong>teacher@ace.com / teacher123</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Student:</span> <strong>student@ace.com / student123</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
