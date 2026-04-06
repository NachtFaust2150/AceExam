import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_TEACHERS, ADD_TEACHER, DELETE_USER } from '../../lib/graphql';

export default function Teachers() {
  const { data, loading, error, refetch } = useQuery(GET_TEACHERS);
  const [addTeacher, { loading: addLoading }] = useMutation(ADD_TEACHER);
  const [deleteUser] = useMutation(DELETE_USER);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await addTeacher({ variables: formData });
      setFormData({ name: '', email: '', password: '' });
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove Teacher ${name}?`)) {
      try {
        await deleteUser({ variables: { id } });
        refetch();
      } catch (err) {
        alert("Error deleting teacher: " + err.message);
      }
    }
  };

  if (loading) return <div className="loading">Loading teachers...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Teacher Accounts</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          ➕ Add Teacher
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No teachers added yet.</td>
              </tr>
            ) : (
              data.teachers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.email}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => handleDelete(t.id, t.name)}
                      title="Delete Teacher"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Add New Teacher</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Create an account to allow a teacher to curate exams.</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem 0.5rem', fontSize: '1.25rem' }}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {formError && (
                <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <strong>Error:</strong> {formError}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="jane.doe@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Choose a password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addLoading || formData.password.length < 5}>
                  {addLoading ? 'Creating Profile...' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
