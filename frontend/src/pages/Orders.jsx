import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

const emptyItem = { product_type: '', gsm: '', colour: '', width: '', quantity_kg: '' }

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_address: '',
    order_date: new Date().toISOString().split('T')[0],
    required_date: '', notes: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await API.orders.list()
      setOrders(res.data?.orders || res.data || [])
      setError('')
    } catch { setError('Failed to load orders.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (index, e) => {
    const { name, value } = e.target
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [name]: value }
      return updated
    })
  }

  const addItemRow = () => setItems((prev) => [...prev, { ...emptyItem }])
  const removeItemRow = (index) => setItems((prev) => prev.filter((_, i) => i !== index))

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!form.client_name.trim()) { setError('Client name is required.'); return }
    const validItems = items.filter((it) => it.product_type || it.gsm || it.quantity_kg)
    if (validItems.length === 0) { setError('Add at least one item.'); return }
    setFormLoading(true); setError('')
    try {
      await API.orders.create({
        ...form,
        items: validItems.map((it) => ({
          ...it,
          gsm: it.gsm ? Number(it.gsm) : undefined,
          width: it.width ? Number(it.width) : undefined,
          quantity_kg: it.quantity_kg ? Number(it.quantity_kg) : undefined,
        })),
      })
      setSuccess('Order created successfully.')
      setShowForm(false)
      setForm({ client_name: '', client_phone: '', client_address: '', order_date: new Date().toISOString().split('T')[0], required_date: '', notes: '' })
      setItems([{ ...emptyItem }])
      loadOrders()
    } catch (err) { setError(err.response?.data?.error || 'Failed to create order.') }
    finally { setFormLoading(false) }
  }

  const handleAllocate = async (order) => {
    try {
      await API.orders.allocate(order.id || order._id)
      setSuccess('Order allocated successfully.')
      loadOrders()
    } catch (err) { setError(err.response?.data?.error || 'Failed to allocate order.') }
  }

  const viewOrder = async (order) => {
    try {
      const res = await API.orders.get(order.id || order._id)
      setSelectedOrder(res.data?.order || res.data)
    } catch { setError('Failed to load order details.') }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div><h1>Orders</h1><p>Manage client orders</p></div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Order'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="card">
          <div className="card-header"><h3>Create New Order</h3></div>
          <form onSubmit={handleCreateOrder}>
            <div className="form-grid">
              <div className="form-group"><label>Client Name *</label><input type="text" name="client_name" value={form.client_name} onChange={handleFormChange} placeholder="Client name" /></div>
              <div className="form-group"><label>Client Phone</label><input type="text" name="client_phone" value={form.client_phone} onChange={handleFormChange} placeholder="Phone" /></div>
              <div className="form-group"><label>Client Address</label><input type="text" name="client_address" value={form.client_address} onChange={handleFormChange} placeholder="Address" /></div>
              <div className="form-group"><label>Order Date</label><input type="date" name="order_date" value={form.order_date} onChange={handleFormChange} /></div>
              <div className="form-group"><label>Required Date</label><input type="date" name="required_date" value={form.required_date} onChange={handleFormChange} /></div>
              <div className="form-group"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handleFormChange} placeholder="Additional notes" rows="2" /></div>
            </div>
            <h4 style={{ margin: '20px 0 10px' }}>Order Items</h4>
            <div className="table-container">
              <table>
                <thead><tr><th>Product Type</th><th>GSM</th><th>Colour</th><th>Width</th><th>Qty (kg)</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td><input type="text" name="product_type" value={item.product_type} onChange={(e) => handleItemChange(i, e)} placeholder="Type" style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></td>
                      <td><input type="number" name="gsm" value={item.gsm} onChange={(e) => handleItemChange(i, e)} placeholder="GSM" style={{ width: '80px', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></td>
                      <td><input type="text" name="colour" value={item.colour} onChange={(e) => handleItemChange(i, e)} placeholder="Colour" style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></td>
                      <td><input type="number" name="width" value={item.width} onChange={(e) => handleItemChange(i, e)} placeholder="Width" step="0.01" style={{ width: '80px', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></td>
                      <td><input type="number" name="quantity_kg" value={item.quantity_kg} onChange={(e) => handleItemChange(i, e)} placeholder="Kg" step="0.01" style={{ width: '80px', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }} /></td>
                      <td>{items.length > 1 && (<button type="button" className="btn btn-danger btn-sm" onClick={() => removeItemRow(i)}>x</button>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '8px' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={addItemRow}>+ Add Item</button>
            </div>
            <div style={{ marginTop: '20px' }} className="btn-group">
              <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Creating...' : 'Create Order'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>All Orders</h3></div>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : orders.length === 0 ? (
          <div className="empty-state"><p>No orders found</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Order #</th><th>Client</th><th>Date</th><th>Required Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id || o._id || i}>
                    <td><strong>{o.order_number || o.id}</strong></td>
                    <td>{o.client_name}</td>
                    <td>{o.order_date?.split('T')[0] || '-'}</td>
                    <td>{o.required_date?.split('T')[0] || '-'}</td>
                    <td>
                      <span className={`badge ${
                        o.status === 'Fulfilled' || o.status === 'Completed' ? 'badge-green' :
                        o.status === 'Allocated' ? 'badge-blue' :
                        o.status === 'Pending' ? 'badge-yellow' :
                        o.status === 'Cancelled' ? 'badge-red' : 'badge-gray'
                      }`}>{o.status || 'N/A'}</span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => viewOrder(o)}>View</button>
                        {(o.status === 'Pending' || o.status === 'New') && (
                          <button className="btn btn-success btn-sm" onClick={() => handleAllocate(o)}>Allocate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Order {selectedOrder.order_number || selectedOrder.id}</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>x</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div><strong>Client:</strong> {selectedOrder.client_name}</div>
                <div><strong>Phone:</strong> {selectedOrder.client_phone || '-'}</div>
                <div><strong>Address:</strong> {selectedOrder.client_address || '-'}</div>
                <div><strong>Order Date:</strong> {selectedOrder.order_date?.split('T')[0] || '-'}</div>
                <div><strong>Required:</strong> {selectedOrder.required_date?.split('T')[0] || '-'}</div>
                <div><strong>Status:</strong> {selectedOrder.status}</div>
              </div>
              {selectedOrder.notes && <p><strong>Notes:</strong> {selectedOrder.notes}</p>}
              <h4 style={{ margin: '16px 0 8px' }}>Items</h4>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Type</th><th>GSM</th><th>Colour</th><th>Width</th><th>Qty (kg)</th></tr></thead>
                    <tbody>
                      {selectedOrder.items.map((it, i) => (
                        <tr key={i}>
                          <td>{it.product_type || '-'}</td>
                          <td>{it.gsm || '-'}</td>
                          <td>{it.colour || '-'}</td>
                          <td>{it.width || '-'}</td>
                          <td>{it.quantity_kg || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<p>No items</p>)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
