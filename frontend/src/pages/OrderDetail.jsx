import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ customer_name: '', due_date: '', notes: '', status: '' });
  const [saving, setSaving] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.orders.get(id);
      const data = res.data?.order || res.data;
      setOrder(data);
      setEditForm({
        customer_name: data.customer_name || '',
        due_date: data.due_date || '',
        notes: data.notes || '',
        status: data.status || '',
      });
      setError('');
    } catch (err) {
      setError('Failed to load order details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.orders.update(id, editForm);
      setEditing(false);
      fetchOrder();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update order.');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status) => {
    const map = { Pending: 'badge-orange', Planned: 'badge-blue', 'In Progress': 'badge-blue', Completed: 'badge-green', Produced: 'badge-green' };
    return <span className={`badge ${map[status] || 'badge-gray'}`}>{status || 'unknown'}</span>;
  };

  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading order...</div>;
  }

  if (error && !order) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-outline" onClick={() => navigate('/orders')}>Back to Orders</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')} style={{ marginBottom: 8 }}>
            &larr; Back to Orders
          </button>
          <h1>Order #{order.id}</h1>
        </div>
        <div className="btn-group">
          {!editing && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header flex-between">
          <h3 style={{ margin: 0 }}>Order Information</h3>
          {!editing && statusBadge(order.status)}
        </div>
        <div style={{ padding: 16 }}>
          {editing ? (
            <div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer Name</label>
                  <input
                    type="text"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="btn-group" style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div>
                <strong>Customer:</strong>
                <p>{order.customer_name}</p>
              </div>
              <div>
                <strong>Order Date:</strong>
                <p>{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <strong>Due Date:</strong>
                <p>{order.due_date ? new Date(order.due_date).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <strong>Notes:</strong>
                <p>{order.notes || 'None'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Order Items ({order.items?.length || 0})</h3>
        </div>
        {order.items && order.items.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Width (inches)</th>
                  <th>Weight (kg)</th>
                  <th>GSM</th>
                  <th>Color</th>
                  <th>Quality</th>
                  <th>Rolls Needed</th>
                  <th>Rolls/Shaft</th>
                  <th>Shafts Needed</th>
                  <th>Status</th>
                  <th>Rolls Produced</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={item.id || i}>
                    <td>{i + 1}</td>
                    <td>{item.width_inches}</td>
                    <td>{item.weight_kg}</td>
                    <td>{item.gsm}</td>
                    <td>{item.color}</td>
                    <td>{item.quality_code}</td>
                    <td>{item.rolls_needed ?? '-'}</td>
                    <td>{item.rolls_per_shaft ?? '-'}</td>
                    <td>{item.shafts_needed ?? '-'}</td>
                    <td>{statusBadge(item.status || order.status)}</td>
                    <td>{item.rolls_produced ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>No items in this order.</div>
        )}
      </div>

      {order.raw_text && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Raw Order Text</h3>
          </div>
          <div style={{ padding: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13 }}>
              {order.raw_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
