import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import client from './lib/apollo';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';

import Login from './pages/Login';
import OrgDashboard from './pages/org/OrgDashboard';
import Teachers from './pages/org/Teachers';
import Dashboard from './pages/teacher/Dashboard';
import Exams from './pages/teacher/Exams';
import Questions from './pages/teacher/Questions';
import Students from './pages/teacher/Students';
import Results from './pages/teacher/Results';
import StudentDashboard from './pages/student/StudentDashboard';
import Exam from './pages/student/Exam';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, role } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate 
              to={role === 'organisation' ? '/org' : role === 'teacher' ? '/teacher' : '/student'} 
              replace 
            />
          ) : (
            <Login />
          )
        }
      />

      {/* Organisation routes */}
      <Route
        path="/org"
        element={
          <ProtectedRoute requiredRole="organisation">
            <OrgDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Teachers />} />
      </Route>

      {/* Teacher routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute requiredRole="teacher">
            <Dashboard />
          </ProtectedRoute>
        }
      >
        <Route path="exams" element={<Exams />} />
        <Route path="questions" element={<Questions />} />
        <Route path="students" element={<Students />} />
        <Route path="results" element={<Results />} />
      </Route>

      {/* Student routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute requiredRole="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exam/:examId"
        element={
          <ProtectedRoute requiredRole="student">
            <Exam />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AccessibilityProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AccessibilityProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}
