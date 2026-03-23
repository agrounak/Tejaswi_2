import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

export default function DispatchHistory() {
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedDispatch, setSelectedDispatch] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.client_name = search
      if (dateFilter) params.date = dateFilter
      const res = await API.dispatch.history(params)
      setDispatches(res.data?.dispatches || res.data || [])
      setError('')
    } catch {
      setError('Failed to load dispatch history.')
    } finally {
      setLoading(false)
    }
  }, [search, dateFilter])

  useEffect(() => { loadHistory() }, [loadHistory])

  const viewDetails = async (dispatch) => {
    setDetailLoading(true)
    try {
      const id = dispatch.id || dispatch._id
      const res = await API.dispatch.get(id)
      setSelectedDispatch(res.data?.dispatch || res.data)
    } catch {
      setError('Failed to load dispatch details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const downloadSheet = async (dispatch) => {
    const id = dispatch.id || dispatch._id
    try {
      const res = await API.dispatch.getSheet(id)
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank')
    } catch {
      setError('Failed to download dispatch sheet.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dispatch History</h1>
        <p>View past dispatches and download documents</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="filters-bar">
          <div className="form-group">
            <label>Search Client</label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client name..." />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setDateFilter('') }}>Clear</button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : dispatches.length === 0 ? (
          <div className="empty-state"><p>No dispatches found</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Dispatch #</th><th>Client</th><th>Date</th><th>Items</th><th>Weight (kg)</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d, i) => (
                  <tr key={d.id || d._id || i}>
                    <td><strong>{d.dispatch_number || d.id}</strong></td>
                    <td>{d.client_name}</td>
                    <td>{d.dispatch_date?.split('T')[0] || '-'}</td>
                    <td>{d.items?.length || d.item_count || 0}</td>
                    <td>{d.total_weight ? Number(d.total_weight).toFixed(1) : '-'}</td>
                    <td>
                      <span className={`badge ${
                        d.status === 'Finalized' || d.status === 'Completed' ? 'badge-green' :
                        d.status === 'Active' || d.status === 'In Progress' ? 'badge-blue' : 'badge-gray'
                      }`}>{d.status || 'N/A'}</span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => viewDetails(d)}>View</button>
                        <button className="btn btn-primary btn-sm" onClick={() => downloadSheet(d)}>Sheet</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDispatch && (
        <div className="modal-overlay" onClick={() => setSelectedDispatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dispatch {selectedDispatch.dispatch_number || selectedDispatch.id}</h3>
              <button className="modal-close" onClick={() => setSelectedDispatch(null)}>x</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : (
                <>
                  <div className="form-grid" style={{ marginBottom: '16px' }}>
                    <div><strong>Client:</strong> {selectedDispatch.client_name}</div>
                    <div><strong>Date:</strong> {selectedDispatch.dispatch_date?.split('T')[0]}</div>
                    <div><strong>Vehicle:</strong> {selectedDispatch.vehicle_number || '-'}</div>
                    <div><strong>Driver:</strong> {selectedDispatch.driver_name || '-'}</div>
                    <div><strong>Phone:</strong> {selectedDispatch.driver_phone || '-'}</div>
                    <div><strong>Status:</strong> {selectedDispatch.status}</div>
                  </div>
                  <h4 style={{ marginBottom: '8px' }}>Items ({selectedDispatch.items?.length || 0})</h4>
                  {selectedDispatch.items && selectedDispatch.items.length > 0 ? (
                    <div className="table-container">
                      <table>
                        <thead><tr><th>#</th><th>Product #</th><th>Quality</th><th>GSM</th><th>Weight</th></tr></thead>
                        <tbody>
                          {selectedDispatch.items.map((item, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{item.product?.product_number || '-'}</td>
                              <td>{item.product?.quality || '-'}</td>
                              <td>{item.product?.gsm || '-'}</td>
                              <td>{item.product?.net_weight || item.weight || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (<p>No items</p>)}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedDispatch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
