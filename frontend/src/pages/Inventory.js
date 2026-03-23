import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

export default function Inventory() {
  const [stock, setStock] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ quality: '', colour: '', location: '', product_type: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [configs, setConfigs] = useState({ quality: [], colour: [], product_type: [], location: [] });

  const loadConfigs = useCallback(async () => {
    try {
      const types = ['quality', 'colour', 'product_type', 'location'];
      const results = await Promise.all(types.map((t) => API.config.list(t)));
      const cfg = {};
      types.forEach((t, i) => {
        cfg[t] = results[i].data?.configs || results[i].data || [];
      });
      setConfigs(cfg);
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [stockRes, sumRes] = await Promise.all([
        API.inventory.getStock(params),
        API.inventory.getSummary(),
      ]);
      const stockData = stockRes.data;
      setStock(stockData?.stock || stockData?.items || stockData || []);
      setTotalPages(stockData?.total_pages || stockData?.totalPages || 1);
      setSummary(sumRes.data);
      setError('');
    } catch (err) {
      setError('Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);
  useEffect(() => { loadData(); }, [loadData]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await API.inventory.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'inventory_export.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export CSV.');
    }
  };

  const configValues = (type) => {
    const list = configs[type] || [];
    return list.map((c) => (typeof c === 'string' ? c : c.value || c.name || ''));
  };

  const typeBreakdown = summary?.by_type || summary?.breakdown || {};

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>Inventory</h1>
            <p>Stock levels and inventory management</p>
          </div>
          <button className="btn btn-success" onClick={handleExportCSV}>Export CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{summary?.total_items ?? summary?.total_count ?? '-'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Weight</div>
          <div className="stat-value">{summary?.total_weight ? `${Number(summary.total_weight).toFixed(1)} kg` : '-'}</div>
        </div>
        {Object.entries(typeBreakdown).map(([type, count]) => (
          <div className="stat-card orange" key={type}>
            <div className="stat-label">{type}</div>
            <div className="stat-value">{count}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="form-group">
            <label>Quality</label>
            <select name="quality" value={filters.quality} onChange={handleFilterChange}>
              <option value="">All</option>
              {configValues('quality').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Colour</label>
            <select name="colour" value={filters.colour} onChange={handleFilterChange}>
              <option value="">All</option>
              {configValues('colour').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Location</label>
            <select name="location" value={filters.location} onChange={handleFilterChange}>
              <option value="">All</option>
              {configValues('location').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Product Type</label>
            <select name="product_type" value={filters.product_type} onChange={handleFilterChange}>
              <option value="">All</option>
              {configValues('product_type').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : stock.length === 0 ? (
          <div className="empty-state"><p>No inventory items found</p></div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product #</th>
                    <th>Type</th>
                    <th>Quality</th>
                    <th>GSM</th>
                    <th>Colour</th>
                    <th>Weight (kg)</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item, i) => (
                    <tr key={item.id || item._id || i}>
                      <td><strong>{item.product_number || '-'}</strong></td>
                      <td>{item.product_type || '-'}</td>
                      <td>{item.quality || '-'}</td>
                      <td>{item.gsm || '-'}</td>
                      <td>{item.colour || '-'}</td>
                      <td>{item.net_weight || item.weight || '-'}</td>
                      <td>{item.location || '-'}</td>
                      <td>
                        <span className={`badge ${
                          item.status === 'In Stock' ? 'badge-green' :
                          item.status === 'Dispatched' ? 'badge-blue' :
                          item.status === 'Reserved' ? 'badge-yellow' : 'badge-gray'
                        }`}>
                          {item.status || 'N/A'}
                        </span>
                      </td>
                      <td>{item.production_date || item.created_at?.split('T')[0] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
