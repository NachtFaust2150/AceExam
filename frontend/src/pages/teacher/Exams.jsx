import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_EXAMS, CREATE_EXAM, GET_STUDENTS, ASSIGN_STUDENT_TO_EXAM } from '../../lib/graphql';
import Questions from './Questions';
import './Admin.css';

export default function Exams() {
  const { data, loading, refetch } = useQuery(GET_EXAMS);
  const { data: sData } = useQuery(GET_STUDENTS);
  const [createExam] = useMutation(CREATE_EXAM);
  const [assignStudent] = useMutation(ASSIGN_STUDENT_TO_EXAM);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  
  const [selectedExamId, setSelectedExamId] = useState(null); // Which exam is open?

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createExam({ variables: { title } });
      setTitle('');
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      alert("Error creating exam: " + err.message);
    }
  };

  const handleAssign = async (examId, studentId, assign) => {
    try {
      await assignStudent({ variables: { examId, studentId, assign } });
      alert(assign ? 'Student assigned successfuly!' : 'Student removed!');
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  if (loading) return <div className="loading">Loading exams...</div>;
  const exams = data?.exams || [];
  const students = sData?.students || [];

  if (selectedExamId) {
    const selectedExam = exams.find(e => e.id === selectedExamId);
    return (
      <div>
        <button className="btn btn-ghost" onClick={() => setSelectedExamId(null)} style={{ marginBottom: '1rem' }}>
          ← Back to Exams
        </button>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Managing Exam: {selectedExam?.title}</h2>
        
        {/* Render the generic Questions manager explicitly injecting examId prop */}
        <Questions examId={selectedExamId} />

        {/* Student Assignment Section */}
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Assign Students to Exam</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Only assigned students will see this exam on their dashboard.</p>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No students found. Add students first.</td>
                  </tr>
                ) : (
                  students.map(s => {
                    const isAssigned = s.assignedExams?.includes(selectedExamId);
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td>
                          <span className={`badge ${isAssigned ? 'badge-success' : 'badge-neutral'}`}>
                            {isAssigned ? 'Assigned' : 'Unassigned'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className={`btn btn-sm ${isAssigned ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => handleAssign(selectedExamId, s.id, !isAssigned)}
                          >
                            {isAssigned ? 'Remove' : 'Assign Student'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Exams Management</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          ➕ Create Exam
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Questions</th>
              <th>Created At</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No exams found. Click "Create Exam" to start.</td>
              </tr>
            ) : (
              exams.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.title}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.questionsCount} questions</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setSelectedExamId(e.id)}>
                      Manage Exam
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Create New Exam</h2>
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem 0.5rem', fontSize: '1.25rem' }}>×</button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Exam Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input"
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required 
                  placeholder="e.g. Midterm Physics" 
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Create Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
