import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_STUDENTS, GET_EXAM_RESULTS, GET_EXAMS } from '../../lib/graphql';
import './Admin.css';

export default function Results() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const { data: studentsData } = useQuery(GET_STUDENTS);
  const { data: examsData } = useQuery(GET_EXAMS);
  const { data: resultsData, loading } = useQuery(GET_EXAM_RESULTS, {
    variables: selectedStudent ? { studentId: selectedStudent } : {},
  });

  const students = studentsData?.students || [];
  const exams = examsData?.exams || [];
  const results = resultsData?.examResults || [];

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Exam Results</h1>
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: '200px' }}
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
        >
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading results...</div>
      ) : results.length === 0 ? (
        <div className="loading">No exam results found.</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Total</th>
                <th>Percentage</th>
                <th>Time Taken</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const examTitle = exams.find(e => e.id === r.examId)?.title || r.examId;
                return (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                    <td>{examTitle}</td>
                    <td style={{ fontWeight: 800 }}>{r.score}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.total}</td>
                    <td>
                      <span className={`badge ${r.total > 0 && (r.score / r.total) >= 0.5 ? 'badge-success' : 'badge-danger'}`}>
                        {r.total > 0 ? Math.round((r.score / r.total) * 100) : 0}%
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatTime(r.timeTaken)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(r.submittedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
