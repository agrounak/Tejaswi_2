import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, anaRes] = await Promise.all([
        API.dashboard.getSummary(),
        API.dashboard.getAnalytics(),
      ])
      setSummary(sumRes.data)
      setAnalytics(anaRes.data)
      setError('')
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  const maxBarValue = (data) => {
    if (!data || data.length === 0) return 1
    return Math.max(...data.map((d) => d.value || 0), 1)
  }

  const renderBarChart = (data, title, colorClass) => {
    if (!data || data.length === 0) {
      return (
        <div className="card chart-container">
          <div className="chart-title">{title}</div>
          <div className="empty-state"><p>No data available</p></div>
        </div>
      )
    }
    const max = maxBarValue(data)
    return (
      <div className="card chart-container">
        <div className="chart-title">{title}</div>
        <div className="bar-chart">
          {data.map((item, i) => (
            <div className="bar-wrapper" key={i}>
              <span className="bar-value">{item.value}</span>
              <div
                className={`bar ${colorClass || ''}`}
                style={{ height: `${Math.max((item.value / max) * 150, 2)}px` }}
              ></div>
              <span className="bar-label" title={item.label}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const shiftData = analytics?.production_by_shift
    ? analytics.production_by_shift.map((d) => ({ label: `Shift ${d.shift}`, value: d.count || 0 }))
    : []

  const trendData = analytics?.production_trend
    ? analytics.production_trend.map((d) => ({
        label: d.date ? d.date.slice(5) : '',
        value: d.count || d.value || 0,
      }))
    : []

  const inventoryData = analytics?.inventory_by_type
    ? analytics.inventory_by_type.map((d) => ({ label: d.product_type || 'Unknown', value: d.count || 0 }))
    : []

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of production, inventory, and dispatch operations</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Today's Production</div>
          <div className="stat-value">{summary?.today_production ?? '-'}</div>
          <div className="stat-sub">items produced today</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Stock</div>
          <div className="stat-value">{summary?.total_stock ?? '-'}</div>
          <div className="stat-sub">items in inventory</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Active Dispatches</div>
          <div className="stat-value">{summary?.active_dispatches ?? '-'}</div>
          <div className="stat-sub">ongoing dispatches</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Dispatched Today</div>
          <div className="stat-value">{summary?.dispatched_today ?? '-'}</div>
          <div className="stat-sub">items dispatched</div>
        </div>
      </div>

      <div className="charts-grid">
        {renderBarChart(shiftData, 'Production by Shift', '')}
        {renderBarChart(trendData, 'Production Trend (Last 30 Days)', 'green')}
        {renderBarChart(inventoryData, 'Inventory by Type', 'orange')}
      </div>
    </div>
  )
}
