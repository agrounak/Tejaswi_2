import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

export default function RegisterUser() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'Sticker User' })

  const loadUsers = useCallback(async () => {
    try {
      const res = await API.auth.getUsers()
      setUsers(res.data?.users || res.data || [])
      setError('')
    } catch { setError('Failed to load users.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) { setError('Username and password are required.'); return }
    if (form.password.length < 4) { setError('Password must be at least 4 characters.'); return }
    setFormLoading(true); setError('')
    try {
      await API.auth.register(form)
      setSuccess(`User "${form.username}" created successfully.`)
      setForm({ username: '', password: '', role: 'Sticker User' }); loadUsers()
    } catch (err) { setError(err.response?.data?.error || 'Failed to create user.') }
    finally { setFormLoading(false) }
  }

  const handleDelete = async (user) => {
    const id = user.id || user._id
    if (!window.confirm(`Delete user "${user.username}"?`)) return
    try {
      await API.auth.deleteUser(id); setSuccess(`User "${user.username}" deleted.`); loadUsers()
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete user.') }
  }

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <p>Create and manage user accounts</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header"><h3>Create New User</h3></div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group"><label>Username *</label><input type="text" name="username" value={form.username} onChange={handleChange} placeholder="Username" /></div>
            <div className="form-group"><label>Password *</label><input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" /></div>
            <div className="form-group">
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="Admin">Admin</option>
                <option value="Sticker User">Sticker User</option>
                <option value="Dispatch User">Dispatch User</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><h3>All Users</h3></div>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : users.length === 0 ? (
          <div className="empty-state"><p>No users found</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Username</th><th>Role</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id || u._id || i}>
                    <td>{i + 1}</td>
                    <td><strong>{u.username}</strong></td>
                    <td>
                      <span className={`badge ${
                        u.role === 'Admin' ? 'badge-purple' :
                        u.role === 'Dispatch User' ? 'badge-blue' : 'badge-green'
                      }`}>{u.role}</span>
                    </td>
                    <td>{u.created_at?.split('T')[0] || '-'}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
