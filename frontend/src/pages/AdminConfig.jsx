import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

const CONFIG_TYPES = ['quality', 'colour', 'product_type', 'location', 'machine']

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState('quality')
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newValue, setNewValue] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(CONFIG_TYPES.map((t) => API.config.list(t)))
      const cfg = {}
      CONFIG_TYPES.forEach((t, i) => {
        cfg[t] = results[i].data?.configs || results[i].data || []
      })
      setConfigs(cfg); setError('')
    } catch { setError('Failed to load configurations.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newValue.trim()) return
    setAddLoading(true); setError('')
    try {
      await API.config.create({ config_type: activeTab, value: newValue.trim() })
      setNewValue(''); setSuccess(`Added "${newValue.trim()}" to ${activeTab}.`); loadAll()
    } catch (err) { setError(err.response?.data?.error || 'Failed to add config value.') }
    finally { setAddLoading(false) }
  }

  const handleDelete = async (config) => {
    const id = config.id || config._id
    const val = config.value || config.name || config
    if (!window.confirm(`Delete "${val}" from ${activeTab}?`)) return
    try {
      await API.config.remove(id); setSuccess(`Deleted "${val}".`); loadAll()
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete.') }
  }

  const handleSeed = async () => {
    if (!window.confirm('Seed default configuration values? This will add standard defaults.')) return
    try {
      await API.config.seed(); setSuccess('Default values seeded successfully.'); loadAll()
    } catch (err) { setError(err.response?.data?.error || 'Failed to seed defaults.') }
  }

  const currentConfigs = configs[activeTab] || []

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div><h1>Configuration</h1><p>Manage dropdown values and system settings</p></div>
          <button className="btn btn-warning" onClick={handleSeed}>Seed Defaults</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="tabs">
          {CONFIG_TYPES.map((type) => (
            <button key={type} className={`tab ${activeTab === type ? 'active' : ''}`}
              onClick={() => { setActiveTab(type); setNewValue(''); setError(''); setSuccess('') }}>
              {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>

        <form onSubmit={handleAdd} className="form-row" style={{ marginBottom: '20px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Add New {activeTab.replace('_', ' ')}</label>
            <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={`Enter ${activeTab.replace('_', ' ')} value`} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={addLoading}>{addLoading ? 'Adding...' : 'Add'}</button>
        </form>

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : currentConfigs.length === 0 ? (
          <div className="empty-state"><p>No values configured for {activeTab.replace('_', ' ')}. Add some above or seed defaults.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Value</th><th>Action</th></tr></thead>
              <tbody>
                {currentConfigs.map((config, i) => {
                  const val = typeof config === 'string' ? config : config.value || config.name || ''
                  return (
                    <tr key={config.id || config._id || i}>
                      <td>{i + 1}</td>
                      <td>{val}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(config)}>Delete</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
