import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_STUDENTS, ADD_STUDENT, UPDATE_STUDENT, DELETE_STUDENT } from '../../lib/graphql';
import './Admin.css';

const DISABILITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'blind', label: 'Blind (complete visual impairment)' },
  { value: 'visual_impairment', label: 'Visual Impairment (partial sight)' },
  { value: 'dyslexia', label: 'Dyslexia' },
  { value: 'motor', label: 'Motor Impairment' },
  { value: 'adhd', label: 'ADHD' },
  { value: 'hearing', label: 'Hearing Impairment' },
];

const DISABILITY_LABELS = Object.fromEntries(DISABILITY_OPTIONS.map(d => [d.value, d.label]));

export default function Students() {
  const { data, loading, refetch } = useQuery(GET_STUDENTS);
  const [addStudent] = useMutation(ADD_STUDENT);
  const [updateStudent] = useMutation(UPDATE_STUDENT);
  const [deleteStudent] = useMutation(DELETE_STUDENT);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', disabilityType: 'none' });

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', disabilityType: 'none' });
    setModal('add');
  };

  const openEdit = (s) => {
    setForm({ name: s.name, email: s.email, password: '', disabilityType: s.disabilityType || 'none' });
    setModal({ editing: s });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') {
        await addStudent({ variables: form });
      } else {
        const vars = { id: modal.editing.id, name: form.name, email: form.email, disabilityType: form.disabilityType };
        if (form.password) vars.password = form.password;
        await updateStudent({ variables: vars });
      }
      setModal(null);
      refetch();
    } catch (err) {
      alert(err.message);
    }
  };

  // ✅ FIXED DELETE FUNCTION
  const handleDelete = async (id) => {
    if (!confirm('Delete this student?')) return;
    try {
      await deleteStudent({ variables: { id: String(id) } }); // FIX: ensure correct type
      refetch();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Loading students...</div>;

  const students = data?.students || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Student Management</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          ➕ Add Student
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Disability Profile</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No students added yet. Click "Add Student" to create one.
                </td>
              </tr>
            ) : (
              students.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.email}</td>
                  <td>
                    <span className={`badge badge-${s.disabilityType && s.disabilityType !== 'none' ? 'info' : 'neutral'}`}>
                      {DISABILITY_LABELS[s.disabilityType] || s.disabilityType || 'None'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>{modal === 'add' ? 'Add New Student' : 'Edit Profile'}</h2>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ padding: '0.25rem 0.5rem', fontSize: '1.25rem' }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">{modal === 'add' ? 'Temporary Password' : 'New Password (leave blank to keep)'}</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={modal === 'add'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Disability Accommodation Type</label>
                <select className="form-input" value={form.disabilityType} onChange={(e) => setForm({ ...form, disabilityType: e.target.value })}>
                  {DISABILITY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <small style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  This enforces strict accessibility transformations when this student loads their exams.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {modal === 'add' ? 'Enrol Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}