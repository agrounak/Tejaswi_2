import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

function BarChart({ title, data }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-title">{title}</div>
        <div className="empty-state">No data available</div>
      </div>
    );
  }
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="chart-container">
      <div className="chart-title">{title}</div>
      <div className="bar-chart">
        {data.map((item, i) => (
          <div className="bar-wrapper" key={i}>
            <div className="bar-value">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</div>
            <div
              className="bar"
              style={{
                height: `${Math.max((item.value / maxVal) * 140, 4)}px`,
                backgroundColor: item.color || '#4f46e5',
              }}
            />
            <div className="bar-label" title={item.label}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, analyticsRes] = await Promise.all([
        API.dashboard.getSummary(),
        API.dashboard.getAnalytics(),
      ]);
      setSummary(summaryRes.data);
      setAnalytics(analyticsRes.data);
      setError('');
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div><p>Loading dashboard...</p></div>;
  }

  const statusColors = {
    Pending: '#f59e0b', Planned: '#3b82f6', 'In Progress': '#6366f1', Completed: '#10b981',
  };

  // Backend returns arrays, not objects
  const ordersByStatus = (analytics?.orders_by_status || []).map(d => ({
    label: d.status, value: d.count, color: statusColors[d.status] || '#6b7280',
  }));

  const weightByColor = (analytics?.weight_by_color || []).map(d => ({
    label: d.color, value: Math.round(d.weight), color: '#4f46e5',
  }));

  const weightByWidth = (analytics?.weight_by_width || []).map(d => ({
    label: d.width, value: Math.round(d.weight), color: '#10b981',
  }));

  return (
    <div>
      <div className="page-header"><h1>Dashboard</h1><p>Overview of orders and production</p></div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{summary?.total_orders ?? 0}</div>
          <div className="stat-sub">all time</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Pending Orders</div>
          <div className="stat-value">{summary?.pending_orders ?? 0}</div>
          <div className="stat-sub">awaiting planning</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Weight</div>
          <div className="stat-value">{(summary?.total_weight_kg ?? 0).toLocaleString()} kg</div>
          <div className="stat-sub">across all orders</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Planned Runs</div>
          <div className="stat-value">{summary?.planned_runs ?? 0}</div>
          <div className="stat-sub">scheduled shafts</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Avg Utilization</div>
          <div className="stat-value">{(summary?.avg_utilization ?? 0).toFixed(1)}%</div>
          <div className="stat-sub">shaft utilization</div>
        </div>
      </div>

      <div className="charts-grid">
        <BarChart title="Orders by Status" data={ordersByStatus} />
        <BarChart title="Weight by Color (kg)" data={weightByColor} />
        <BarChart title="Weight by Width (kg)" data={weightByWidth} />
      </div>
    </div>
  );
}
