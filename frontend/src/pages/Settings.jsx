import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';
import { useAuth } from '../contexts/AuthContext.jsx';

function ConfigSection({ title, configType, configs, onAdd, onDelete }) {
  const [newValue, setNewValue] = useState('');
  const items = configs[configType] || [];

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    await onAdd(configType, newValue.trim());
    setNewValue('');
  };

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div className="card-header"><h3>{title}</h3></div>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={`Add new ${configType}...`}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAdd} type="button">Add</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map(item => (
            <span key={item.id} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 14 }}>
              {item.value}
              <button
                onClick={() => onDelete(item.id)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1, opacity: 0.7 }}
                title="Remove"
              >
                x
              </button>
            </span>
          ))}
          {items.length === 0 && <span style={{ color: '#888' }}>No {configType} values configured.</span>}
        </div>
      </div>
    </div>
  );
}

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
  const [configs, setConfigs] = useState({});

  const loadUsers = useCallback(async () => {
    try {
      const res = await API.auth.getUsers();
      setUsers(res.data?.users || []);
    } catch { setError('Failed to load users.'); }
    finally { setLoading(false); }
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const res = await API.orders.getConfigs();
      setConfigs(res.data || {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadUsers(); loadConfigs(); }, [loadUsers, loadConfigs]);

  const handleAddConfig = async (configType, value) => {
    setError(''); setSuccess('');
    try {
      await API.orders.addConfig({ config_type: configType, value });
      setSuccess(`Added "${value}" to ${configType}.`);
      loadConfigs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add config.');
    }
  };

  const handleDeleteConfig = async (id) => {
    setError(''); setSuccess('');
    try {
      await API.orders.deleteConfig(id);
      setSuccess('Config removed.');
      loadConfigs();
    } catch { setError('Failed to delete config.'); }
  };

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
      <div className="page-header"><h1>Settings</h1><p>User management & configuration</p></div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <ConfigSection title="Quality Options" configType="quality" configs={configs} onAdd={handleAddConfig} onDelete={handleDeleteConfig} />
      <ConfigSection title="Color Options" configType="color" configs={configs} onAdd={handleAddConfig} onDelete={handleDeleteConfig} />
      <ConfigSection title="GSM Options" configType="gsm" configs={configs} onAdd={handleAddConfig} onDelete={handleDeleteConfig} />

      <div className="card" style={{ marginTop: '16px' }}>
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

      <div className="card" style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div className="card-header"><h3>Machine Info</h3></div>
        <div style={{ padding: '16px' }}>
          <p><strong>Total Shaft Size:</strong> 123 inches (3124.2 mm)</p>
        </div>
      </div>
    </div>
  );
}
