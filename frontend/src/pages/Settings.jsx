import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Operator');
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await API.auth.getUsers();
      setUsers(res.data?.users || []);
    } catch { setError('Failed to load users.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) { setError('Username and password required.'); return; }
    setCreating(true); setError('');
    try {
      await API.auth.register({ username: newUsername, password: newPassword, role: newRole });
      setSuccess(`User "${newUsername}" created.`);
      setNewUsername(''); setNewPassword(''); setNewRole('Operator');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    } finally { setCreating(false); }
  };

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await API.auth.deleteUser(id);
      setSuccess(`User "${username}" deleted.`);
      loadUsers();
    } catch { setError('Failed to delete user.'); }
  };

  if (!isAdmin) {
    return (
      <div>
        <div className="page-header"><h1>Settings</h1></div>
        <div className="alert alert-error">Admin access required.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Settings</h1><p>User management</p></div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="card">
        <div className="card-header"><h3>Create User</h3></div>
        <div style={{ padding: '16px' }}>
          <form onSubmit={handleCreateUser}>
            <div className="form-grid">
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="Operator">Operator</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginTop: '12px' }}>
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header"><h3>Users</h3></div>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td><span className={`badge ${u.role === 'Admin' ? 'badge-blue' : 'badge-gray'}`}>{u.role}</span></td>
                    <td>{u.created_at?.split('T')[0] || '-'}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.username)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
