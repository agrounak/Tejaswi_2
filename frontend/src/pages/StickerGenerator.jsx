import React, { useState, useEffect, useCallback } from 'react'
import API from '../api'

const initialForm = {
  shift: 'A',
  production_date: new Date().toISOString().split('T')[0],
  trading_name: '',
  quality: '',
  gsm: '',
  colour: '',
  product_type: '',
  gross_weight: '',
  net_weight: '',
  length: '',
  width: '',
  laminated: false,
  machine: '',
}

export default function StickerGenerator() {
  const [form, setForm] = useState(initialForm)
  const [configs, setConfigs] = useState({ quality: [], colour: [], product_type: [], machine: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdProduct, setCreatedProduct] = useState(null)
  const [recentEntries, setRecentEntries] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [previewUrl, setPreviewUrl] = useState(null)

  const loadConfigs = useCallback(async () => {
    try {
      const types = ['quality', 'colour', 'product_type', 'machine']
      const results = await Promise.all(types.map((t) => API.config.list(t)))
      const cfg = {}
      types.forEach((t, i) => {
        cfg[t] = results[i].data?.configs || results[i].data || []
      })
      setConfigs(cfg)
    } catch {
      // configs may not be available yet
    }
  }, [])

  const loadRecent = useCallback(async () => {
    try {
      const res = await API.production.getProducts({ limit: 10, sort: 'newest' })
      setRecentEntries(res.data?.products || res.data || [])
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
    loadRecent()
  }, [loadConfigs, loadRecent])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.quality || !form.gsm || !form.net_weight || !form.gross_weight) {
      setError('Please fill in all required fields (quality, GSM, weights).')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await API.production.createEntry({
        ...form,
        gsm: Number(form.gsm),
        gross_weight: Number(form.gross_weight),
        net_weight: Number(form.net_weight),
        length: form.length ? Number(form.length) : undefined,
        width: form.width ? Number(form.width) : undefined,
      })
      const product = res.data?.product || res.data
      setCreatedProduct(product)
      setSuccess(`Product created: ${product.product_number || product.id}`)
      setForm(initialForm)
      loadRecent()
      try {
        const previewRes = await API.sticker.getPreview(product.id || product._id)
        const url = URL.createObjectURL(previewRes.data)
        setPreviewUrl(url)
      } catch {
        setPreviewUrl(null)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create entry.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!previewUrl) return
    const printWin = window.open('', '_blank')
    printWin.document.write(`<html><body style="text-align:center;margin:20px;"><img src="${previewUrl}" onload="window.print();window.close();" style="max-width:100%;" /></body></html>`)
  }

  const handleDownload = async () => {
    if (!createdProduct) return
    const id = createdProduct.id || createdProduct._id
    try {
      const res = await API.sticker.download(id)
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `sticker_${createdProduct.product_number || id}.png`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download sticker.')
    }
  }

  const configValues = (type) => {
    const list = configs[type] || []
    return list.map((c) => (typeof c === 'string' ? c : c.value || c.name || ''))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sticker Generator</h1>
        <p>Create production entries and generate stickers</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h3>New Production Entry</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Shift *</label>
              <select name="shift" value={form.shift} onChange={handleChange}>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
                <option value="C">Shift C</option>
              </select>
            </div>
            <div className="form-group">
              <label>Production Date *</label>
              <input type="date" name="production_date" value={form.production_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Trading Name</label>
              <input type="text" name="trading_name" value={form.trading_name} onChange={handleChange} placeholder="Trading name" />
            </div>
            <div className="form-group">
              <label>Quality *</label>
              <select name="quality" value={form.quality} onChange={handleChange}>
                <option value="">Select quality</option>
                {configValues('quality').map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>GSM *</label>
              <input type="number" name="gsm" value={form.gsm} onChange={handleChange} placeholder="GSM" min="0" />
            </div>
            <div className="form-group">
              <label>Colour</label>
              <select name="colour" value={form.colour} onChange={handleChange}>
                <option value="">Select colour</option>
                {configValues('colour').map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Product Type</label>
              <select name="product_type" value={form.product_type} onChange={handleChange}>
                <option value="">Select type</option>
                {configValues('product_type').map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Gross Weight (kg) *</label>
              <input type="number" name="gross_weight" value={form.gross_weight} onChange={handleChange} placeholder="Gross weight" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Net Weight (kg) *</label>
              <input type="number" name="net_weight" value={form.net_weight} onChange={handleChange} placeholder="Net weight" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Length (m)</label>
              <input type="number" name="length" value={form.length} onChange={handleChange} placeholder="Length" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Width (m)</label>
              <input type="number" name="width" value={form.width} onChange={handleChange} placeholder="Width" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Machine</label>
              <select name="machine" value={form.machine} onChange={handleChange}>
                <option value="">Select machine</option>
                {configValues('machine').map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Laminated</label>
              <input type="checkbox" name="laminated" checked={form.laminated} onChange={handleChange} />
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Entry & Generate Sticker'}
            </button>
          </div>
        </form>
      </div>

      {createdProduct && (
        <div className="card">
          <div className="card-header">
            <h3>Sticker Preview</h3>
            <div className="btn-group">
              <button className="btn btn-primary btn-sm" onClick={handleDownload}>Download</button>
              <button className="btn btn-success btn-sm" onClick={handlePrint}>Print</button>
            </div>
          </div>
          <div className="sticker-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Sticker preview" />
            ) : (
              <p>Loading preview...</p>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Recent Entries</h3>
        </div>
        {loadingRecent ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : recentEntries.length === 0 ? (
          <div className="empty-state"><p>No recent entries</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product #</th>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Quality</th>
                  <th>GSM</th>
                  <th>Colour</th>
                  <th>Net Wt</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((p, i) => (
                  <tr key={p.id || p._id || i}>
                    <td><strong>{p.product_number || '-'}</strong></td>
                    <td>{p.production_date || '-'}</td>
                    <td>{p.shift || '-'}</td>
                    <td>{p.quality || '-'}</td>
                    <td>{p.gsm || '-'}</td>
                    <td>{p.colour || '-'}</td>
                    <td>{p.net_weight || '-'}</td>
                    <td>{p.product_type || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
