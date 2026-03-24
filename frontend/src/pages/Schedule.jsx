import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

export default function Schedule() {
  const [schedule, setSchedule] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFrom) params.start = dateFrom;
      if (dateTo) params.end = dateTo;
      const [schedRes, sumRes] = await Promise.all([
        API.schedule.get(params),
        API.schedule.getSummary(),
      ]);
      setSchedule(schedRes.data?.schedule || []);
      setSummary(sumRes.data);
      setError('');
    } catch {
      setError('Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleStatusChange = async (runId, newStatus) => {
    try {
      await API.planning.updateRun(runId, { status: newStatus });
      fetchSchedule();
    } catch {
      setError('Failed to update status.');
    }
  };

  const getNextStatus = (current) => {
    if (current === 'Planned') return 'In Progress';
    if (current === 'In Progress') return 'Completed';
    return null;
  };

  return (
    <div>
      <div className="page-header"><h1>Production Schedule</h1><p>View and manage scheduled production runs</p></div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card blue">
          <div className="stat-label">Planned</div>
          <div className="stat-value">{summary?.total_planned ?? 0}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{summary?.total_in_progress ?? 0}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{summary?.total_completed ?? 0}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Today</div>
          <div className="stat-value">{summary?.today_runs ?? 0}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ padding: '16px' }}>
          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : schedule.length === 0 ? (
        <div className="empty-state"><p>No scheduled runs. Generate a production plan first.</p></div>
      ) : (
        schedule.map(day => (
          <div key={day.date} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>{new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
              <span className="badge badge-blue">{day.total_shafts} shafts</span>
              <span className="text-muted">{day.avg_utilization}% avg utilization</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {day.runs.map(run => {
                const nextStatus = getNextStatus(run.status);
                return (
                  <div key={run.id} className="shaft-card">
                    <div className="shaft-header">
                      <strong>Shaft #{run.shaft_number}</strong>
                      <span className={`badge ${run.status === 'Completed' ? 'badge-green' : run.status === 'In Progress' ? 'badge-orange' : 'badge-blue'}`}>{run.status}</span>
                    </div>
                    <div className="utilization-bar">
                      <div className="utilization-fill" style={{
                        width: `${run.utilization_pct}%`,
                        background: run.utilization_pct >= 80 ? '#10b981' : run.utilization_pct >= 50 ? '#f59e0b' : '#ef4444',
                      }}></div>
                    </div>
                    <div className="shaft-items">
                      {(run.items || []).map((item, j) => (
                        <div key={j} className="shaft-item">
                          <span>{item.width_inches}" x{item.rolls_count}</span>
                          <span className="text-muted" style={{ marginLeft: '8px' }}>{item.color}</span>
                          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '12px' }}>{item.customer_name}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{run.utilization_pct}% utilized</span>
                      <span>Trim: {run.trim_loss_mm}mm</span>
                    </div>
                    {nextStatus && (
                      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb' }}>
                        <button
                          className={`btn ${nextStatus === 'Completed' ? 'btn-success' : 'btn-primary'} btn-sm`}
                          style={{ width: '100%' }}
                          onClick={() => handleStatusChange(run.id, nextStatus)}
                        >
                          Mark as {nextStatus}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
