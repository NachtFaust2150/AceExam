import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('aceexam_token'));
  const [role, setRole] = useState(localStorage.getItem('aceexam_role'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('aceexam_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (tokenVal, roleVal, userData) => {
    localStorage.setItem('aceexam_token', tokenVal);
    localStorage.setItem('aceexam_role', roleVal);
    localStorage.setItem('aceexam_user', JSON.stringify(userData));
    setToken(tokenVal);
    setRole(roleVal);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('aceexam_token');
    localStorage.removeItem('aceexam_role');
    localStorage.removeItem('aceexam_user');
    setToken(null);
    setRole(null);
    setUser(null);
  };

  const isAuthenticated = !!token;
  const isAdmin = role === 'admin';
  const isStudent = role === 'student';

  return (
    <AuthContext.Provider value={{ token, role, user, login, logout, isAuthenticated, isAdmin, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
