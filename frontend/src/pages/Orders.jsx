import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const emptyItem = { width_inches: '', weight_kg: '', gsm: '', color: '', quality_code: '', rolls_count: '' };

export default function Orders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Configs
  const [configs, setConfigs] = useState({ color: [], quality: [] });

  // New order form
  const [entryMode, setEntryMode] = useState('paste');
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [manualItems, setManualItems] = useState([{ ...emptyItem }]);
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.customer = searchQuery;
      const res = await API.orders.list(params);
      setOrders(res.data?.orders || res.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await API.orders.getConfigs();
      setConfigs(res.data);
    } catch (err) {
      // ignore, use defaults
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    setError('');
    try {
      const res = await API.orders.parse({ raw_text: rawText });
      setParsedItems(res.data.items || []);
      if (res.data.customer_name) setCustomerName(res.data.customer_name);
      if (res.data.due_date) setDueDate(res.data.due_date);
    } catch (err) {
      setError('Failed to parse order text. Please check the format.');
    } finally {
      setParsing(false);
    }
  };

  const handleParsedItemChange = (index, field, value) => {
    setParsedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeParsedItem = (index) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleManualItemChange = (index, field, value) => {
    setManualItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addManualItem = () => {
    setManualItems((prev) => [...prev, { ...emptyItem }]);
  };

  const removeManualItem = (index) => {
    setManualItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const items = entryMode === 'paste' ? parsedItems : manualItems;
    if (items.length === 0) {
      setError('At least one order item is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        customer_name: customerName,
        due_date: dueDate || null,
        notes: notes || null,
        raw_text: entryMode === 'paste' ? rawText : null,
        items: items.map((item) => ({
          width_inches: parseFloat(item.width_inches) || 0,
          weight_kg: parseFloat(item.weight_kg) || 0,
          gsm: parseFloat(item.gsm) || 0,
          color: item.color,
          quality_code: item.quality_code,
          rolls_count: parseInt(item.rolls_count) || 0,
        })),
      };
      await API.orders.create(payload);
      setSuccess('Order created successfully!');
      setCustomerName('');
      setDueDate('');
      setNotes('');
      setRawText('');
      setParsedItems([]);
      setManualItems([{ ...emptyItem }]);
      setTimeout(() => {
        setSuccess('');
        setActiveTab('list');
        fetchOrders();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await API.orders.delete(id);
      fetchOrders();
    } catch (err) {
      setError('Failed to delete order.');
    }
  };

  const statusBadge = (status) => {
    const map = { Pending: 'badge-orange', Planned: 'badge-blue', 'In Progress': 'badge-blue', Completed: 'badge-green' };
    return <span className={`badge ${map[status] || 'badge-gray'}`}>{status || 'unknown'}</span>;
  };

  const filteredOrders = orders;

  const renderItemsTable = (items, mode) => {
    const isParsed = mode === 'parsed';
    const changeHandler = isParsed ? handleParsedItemChange : handleManualItemChange;
    const removeHandler = isParsed ? removeParsedItem : removeManualItem;

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Rolls (pcs)</th>
              <th>Width (inches)</th>
              <th>Weight (kg)</th>
              <th>GSM</th>
              <th>Color</th>
              <th>Quality</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="number"
                    value={item.rolls_count}
                    onChange={(e) => changeHandler(i, 'rolls_count', e.target.value)}
                    min="1"
                    step="1"
                    placeholder="e.g. 30"
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.width_inches}
                    onChange={(e) => changeHandler(i, 'width_inches', e.target.value)}
                    step="0.1"
                    placeholder="e.g. 44"
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.weight_kg}
                    onChange={(e) => changeHandler(i, 'weight_kg', e.target.value)}
                    step="0.1"
                    placeholder="optional"
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.gsm}
                    onChange={(e) => changeHandler(i, 'gsm', e.target.value)}
                    step="1"
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <select value={item.color} onChange={(e) => changeHandler(i, 'color', e.target.value)}>
                    <option value="">Select color</option>
                    {(configs.color || []).map((c) => (
                      <option key={c.value || c} value={c.value || c}>{c.value || c}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={item.quality_code} onChange={(e) => changeHandler(i, 'quality_code', e.target.value)}>
                    <option value="">Select quality</option>
                    {(configs.quality || []).map((q) => (
                      <option key={q.value || q} value={q.value || q}>{q.value || q}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => removeHandler(i)} type="button">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header flex-between">
        <h1>Orders</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>All Orders</button>
        <button className={`tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>New Order</button>
      </div>

      {activeTab === 'list' && (
        <div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Search by Customer</label>
              <input
                type="text"
                placeholder="Search customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ width: 200 }}>
              <label>Filter by Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /> Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">No orders found. Create a new order to get started.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Order Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Total Weight (kg)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.customer_name}</td>
                      <td>{order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
                      <td>{order.due_date ? new Date(order.due_date).toLocaleDateString() : '-'}</td>
                      <td>{statusBadge(order.status)}</td>
                      <td>{order.item_count ?? order.items?.length ?? 0}</td>
                      <td>{(order.total_weight ?? 0).toLocaleString()}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/orders/${order.id}`)}>View</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(order.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'new' && (
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3 style={{ margin: 0 }}>Order Details</h3></div>
            <div style={{ padding: 16 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header flex-between">
              <h3 style={{ margin: 0 }}>Order Items</h3>
              <div className="btn-group">
                <button
                  type="button"
                  className={`btn btn-sm ${entryMode === 'paste' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setEntryMode('paste')}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${entryMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setEntryMode('manual')}
                >
                  Manual Entry
                </button>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              {entryMode === 'paste' && (
                <div>
                  <div className="form-group">
                    <label>Paste raw order text</label>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste the order text here..."
                      rows={6}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleParse}
                    disabled={parsing || !rawText.trim()}
                    style={{ marginBottom: 16 }}
                  >
                    {parsing ? <><span className="spinner" /> Parsing...</> : 'Parse'}
                  </button>

                  {parsedItems.length > 0 && (
                    <div>
                      <h4>Extracted Items (editable)</h4>
                      {renderItemsTable(parsedItems, 'parsed')}
                    </div>
                  )}
                </div>
              )}

              {entryMode === 'manual' && (
                <div>
                  {renderItemsTable(manualItems, 'manual')}
                  <button type="button" className="btn btn-outline btn-sm" onClick={addManualItem} style={{ marginTop: 8 }}>
                    + Add Item
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Creating...</> : 'Create Order'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setActiveTab('list')}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
