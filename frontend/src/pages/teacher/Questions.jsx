import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ALL_QUESTIONS, ADD_QUESTION, UPDATE_QUESTION, DELETE_QUESTION } from '../../lib/graphql';
import './Admin.css';

export default function Questions({ examId }) {
  const { data, loading, refetch } = useQuery(GET_ALL_QUESTIONS, {
    variables: { examId },
    fetchPolicy: 'network-only'
  });
  const [addQuestion] = useMutation(ADD_QUESTION);
  const [updateQuestion] = useMutation(UPDATE_QUESTION);
  const [deleteQuestion] = useMutation(DELETE_QUESTION);
  const [modal, setModal] = useState(null); // null | 'add' | {editing: question}
  const [form, setForm] = useState({ text: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', difficulty: 'medium' });

  const openAdd = () => {
    setForm({ text: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', difficulty: 'medium' });
    setModal('add');
  };

  const openEdit = (q) => {
    setForm({
      text: q.text,
      optionA: q.options[0],
      optionB: q.options[1],
      optionC: q.options[2],
      optionD: q.options[3],
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
    });
    setModal({ editing: q });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') {
        await addQuestion({ variables: { ...form, examId } });
      } else {
        await updateQuestion({ variables: { id: modal.editing.id, ...form } });
      }
      setModal(null);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion({ variables: { id } });
    refetch();
  };

  if (loading) return <div className="loading">Loading questions...</div>;

  const questions = data?.allQuestions || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Questions</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          ➕ Add Question
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Question</th>
            <th>Answer</th>
            <th>Difficulty</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => (
            <tr key={q.id}>
              <td>{i + 1}</td>
              <td>{q.text}</td>
              <td>{q.correctAnswer}</td>
              <td><span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span></td>
              <td>
                <div className="btn-group">
                  <button className="btn btn-primary btn-sm" onClick={() => openEdit(q)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {questions.length === 0 && (
        <div className="loading">No questions yet. Click "Add Question" to create one.</div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>{modal === 'add' ? 'Add Question' : 'Edit Question'}</h2>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ padding: '0.25rem 0.5rem', fontSize: '1.25rem' }}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Question Text <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea className="form-input" style={{ minHeight: '80px' }} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Option A <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-input" value={form.optionA} onChange={(e) => setForm({ ...form, optionA: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Option B <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-input" value={form.optionB} onChange={(e) => setForm({ ...form, optionB: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Option C <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-input" value={form.optionC} onChange={(e) => setForm({ ...form, optionC: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Option D <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-input" value={form.optionD} onChange={(e) => setForm({ ...form, optionD: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Correct Answer</label>
                  <select className="form-input" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select className="form-input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {modal === 'add' ? 'Add Question' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
