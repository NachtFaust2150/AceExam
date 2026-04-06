import { useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GET_EXAMS, GET_EXAM_RESULTS } from '../../lib/graphql';
import AccessibilityToolbar from '../../components/AccessibilityToolbar';
import './Exam.css';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch all assigned exams
  const { data: examsData, loading: examsLoading } = useQuery(GET_EXAMS);
  // Fetch user's results to know what they already completed
  const { data: resultsData, loading: resultsLoading } = useQuery(GET_EXAM_RESULTS, {
    variables: { studentId: user.id }
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (examsLoading || resultsLoading) return <div className="exam-loading">Loading Dashboard...</div>;

  const exams = examsData?.exams || [];
  const results = resultsData?.examResults || [];
  
  // Map results by examId for quick lookup
  const completedExams = new Set(results.map(r => r.examId));

  return (
    <div className="exam-container">
      <header className="exam-header">
        <div className="exam-branding">
          <span>🎓</span>
          <h2>AceExam</h2>
        </div>
        <div className="exam-user">
          <span className="user-role-badge">Student</span>
          <span>{user?.name}</span>
          <button className="btn btn-sm btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="exam-body" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', display: 'block' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome, {user?.name}!</h1>
        <p className="subtitle" style={{ marginBottom: '2rem', opacity: 0.8 }}>
          Here are the exams assigned by your teacher.
        </p>

        <div className="exams-grid" style={{ display: 'grid', gap: '1.5rem' }}>
          {exams.map(exam => {
            const isCompleted = completedExams.has(exam.id);
            const myResult = results.find(r => r.examId === exam.id);

            return (
              <div 
                key={exam.id} 
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: isCompleted ? 0.7 : 1
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>{exam.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {exam.questionsCount} Questions • Assessed Online
                  </p>
                </div>
                <div>
                  {isCompleted ? (
                    <div style={{ textAlign: 'center' }}>
                      <span className="badge badge-easy">Completed</span>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        Score: <strong>{myResult?.score}/{myResult?.total}</strong>
                      </div>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigate(`/student/exam/${exam.id}`)}
                    >
                      Start Exam
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {exams.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <span style={{ fontSize: '3rem', opacity: 0.5 }}>📚</span>
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No exams are currently assigned to you.</p>
            </div>
          )}
        </div>
      </div>

      <AccessibilityToolbar />
    </div>
  );
}
