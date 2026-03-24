import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

export default function ProductionPlan() {
  const [orders, setOrders] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupByColor, setGroupByColor] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [shaftPlans, setShaftPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('plan');

  const loadOrders = useCallback(async () => {
    try {
      const res = await API.orders.list({ status: 'Pending' });
      const pending = res.data?.orders || [];
      setOrders(pending);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const res = await API.planning.getRuns({});
      setRuns(res.data?.runs || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadOrders(); loadRuns(); }, [loadOrders, loadRuns]);

  const toggleOrder = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.length === orders.length ? [] : orders.map(o => o.id));
  };

  const handlePreview = async () => {
    setLoading(true); setError(''); setShaftPlans([]); setSummary(null);
    try {
      const res = await API.planning.preview({
        order_ids: selectedIds.length > 0 ? selectedIds : [],
        group_by_color: groupByColor,
      });
      setShaftPlans(res.data?.shafts || []);
      setSummary(res.data?.summary || null);
      if ((res.data?.shafts || []).length === 0) {
        setError(res.data?.message || 'No items to plan.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to preview plan.');
    } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (shaftPlans.length === 0) { setError('Preview a plan first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await API.planning.generate({
        order_ids: selectedIds.length > 0 ? selectedIds : [],
        group_by_color: groupByColor,
        start_date: startDate || null,
      });
      setSuccess(res.data?.message || 'Plan generated!');
      setShaftPlans([]); setSummary(null); setSelectedIds([]);
      loadOrders(); loadRuns();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate plan.');
    } finally { setLoading(false); }
  };

  const handleClearPlans = async () => {
    if (!window.confirm('Clear all planned production runs?')) return;
    try {
      const res = await API.planning.clearPlans();
      setSuccess(res.data?.message || 'Plans cleared.');
      loadRuns(); loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear plans.');
    }
  };

  const handleDeleteRun = async (id) => {
    if (!window.confirm('Delete this run?')) return;
    try {
      await API.planning.deleteRun(id);
      loadRuns();
    } catch { setError('Failed to delete run.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div><h1>Production Plan</h1><p>Plan shaft layouts and schedule production</p></div>
          <div className="btn-group">
            <button className={`btn ${tab === 'plan' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('plan')}>Plan</button>
            <button className={`btn ${tab === 'runs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('runs')}>Runs ({runs.length})</button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {tab === 'plan' && (
        <>
          <div className="card">
            <div className="card-header"><h3>Select Orders to Plan</h3></div>
            <div style={{ padding: '16px' }}>
              {orders.length === 0 ? (
                <p className="text-muted">No pending orders to plan.</p>
              ) : (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedIds.length === orders.length && orders.length > 0} onChange={selectAll} />
                      <strong>Select All ({orders.length} orders)</strong>
                    </label>
                  </div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    {orders.map(o => (
                      <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                        <div style={{ flex: 1 }}>
                          <strong>{o.customer_name}</strong>
                          <span className="text-muted" style={{ marginLeft: '8px' }}>{o.item_count} items, {o.total_weight?.toFixed(0)} kg</span>
                        </div>
                        <span className="badge badge-gray">{o.status}</span>
                        {o.due_date && <span className="text-muted">Due: {o.due_date}</span>}
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="form-grid" style={{ marginTop: '16px' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                  <input type="checkbox" checked={groupByColor} onChange={e => setGroupByColor(e.target.checked)} id="grpColor" />
                  <label htmlFor="grpColor">Group by Color (minimize color changes)</label>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
                  {loading ? 'Computing...' : 'Preview Plan'}
                </button>
                <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || shaftPlans.length === 0}>
                  Generate & Schedule
                </button>
              </div>
            </div>
          </div>

          {summary && (
            <div className="stats-grid" style={{ marginTop: '16px' }}>
              <div className="stat-card blue"><div className="stat-label">Total Shafts</div><div className="stat-value">{summary.total_shafts}</div></div>
              <div className="stat-card green"><div className="stat-label">Avg Utilization</div><div className="stat-value">{summary.avg_utilization}%</div></div>
              <div className="stat-card orange"><div className="stat-label">Total Trim Loss</div><div className="stat-value">{summary.total_trim_loss} mm</div></div>
              <div className="stat-card purple"><div className="stat-label">Total Rolls</div><div className="stat-value">{summary.total_rolls}</div></div>
            </div>
          )}

          {shaftPlans.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3>Shaft Plans (3200mm shaft)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '12px', marginTop: '12px' }}>
                {shaftPlans.map((shaft, i) => (
                  <div key={i} className="shaft-card">
                    <div className="shaft-header">
                      <strong>Shaft #{shaft.shaft_index}</strong>
                      <span>{shaft.utilization_pct}% used</span>
                    </div>
                    <div className="utilization-bar">
                      <div className="utilization-fill" style={{
                        width: `${shaft.utilization_pct}%`,
                        background: shaft.utilization_pct >= 80 ? '#10b981' : shaft.utilization_pct >= 50 ? '#f59e0b' : '#ef4444',
                      }}></div>
                    </div>
                    <div className="shaft-items">
                      {shaft.items.map((item, j) => (
                        <div key={j} className="shaft-item">
                          <span>{Math.round(item.width_mm / 25.4)}" x{item.rolls_count}</span>
                          <span className="text-muted" style={{ marginLeft: '8px' }}>{item.color}</span>
                          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '12px' }}>{item.customer_name}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                      Used: {shaft.total_width_used}mm | Trim: {shaft.trim_loss}mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'runs' && (
        <div className="card">
          <div className="card-header">
            <div className="flex-between">
              <h3>Production Runs</h3>
              <button className="btn btn-warning btn-sm" onClick={handleClearPlans}>Clear Planned</button>
            </div>
          </div>
          {runs.length === 0 ? (
            <div className="empty-state"><p>No production runs yet. Generate a plan first.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Shaft #</th><th>Items</th><th>Width Used</th><th>Utilization</th><th>Trim Loss</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id}>
                      <td>{r.run_date}</td>
                      <td>#{r.shaft_number}</td>
                      <td>{r.items?.length || 0}</td>
                      <td>{r.total_width_used_mm}mm</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="utilization-bar" style={{ width: '60px' }}>
                            <div className="utilization-fill" style={{
                              width: `${r.utilization_pct}%`,
                              background: r.utilization_pct >= 80 ? '#10b981' : r.utilization_pct >= 50 ? '#f59e0b' : '#ef4444',
                            }}></div>
                          </div>
                          <span>{r.utilization_pct}%</span>
                        </div>
                      </td>
                      <td>{r.trim_loss_mm}mm</td>
                      <td><span className={`badge ${r.status === 'Completed' ? 'badge-green' : r.status === 'In Progress' ? 'badge-orange' : 'badge-blue'}`}>{r.status}</span></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteRun(r.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
