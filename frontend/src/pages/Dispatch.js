import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

export default function Dispatch() {
  const [step, setStep] = useState(1);
  const [activeDispatches, setActiveDispatches] = useState([]);
  const [currentDispatch, setCurrentDispatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 1 fields
  const [clientName, setClientName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 2 fields
  const [scanInput, setScanInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);

  // Step 3 fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  const loadActiveDispatches = useCallback(async () => {
    try {
      const res = await API.dispatch.list();
      setActiveDispatches(res.data?.dispatches || res.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { loadActiveDispatches(); }, [loadActiveDispatches]);

  const handleStartDispatch = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await API.dispatch.start({ client_name: clientName, dispatch_date: dispatchDate });
      setCurrentDispatch(res.data?.dispatch || res.data);
      setStep(2);
      setSuccess('Dispatch started.');
      loadActiveDispatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start dispatch.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeDispatch = async (dispatch) => {
    try {
      const res = await API.dispatch.get(dispatch.id || dispatch._id);
      setCurrentDispatch(res.data?.dispatch || res.data);
      setStep(2);
      setError('');
    } catch (err) {
      setError('Failed to load dispatch.');
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    setScanLoading(true);
    setError('');
    try {
      const id = currentDispatch.id || currentDispatch._id;
      await API.dispatch.scan(id, { product_number: scanInput.trim() });
      // Reload dispatch to get updated items list
      const refreshRes = await API.dispatch.get(id);
      setCurrentDispatch(refreshRes.data?.dispatch || refreshRes.data);
      setScanInput('');
      setSuccess('Item scanned successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Scan failed. Product not found or already dispatched.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const id = currentDispatch.id || currentDispatch._id;
      await API.dispatch.removeItem(id, itemId);
      // Reload dispatch to get updated items list
      const refreshRes = await API.dispatch.get(id);
      setCurrentDispatch(refreshRes.data?.dispatch || refreshRes.data);
      setSuccess('Item removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove item.');
    }
  };

  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const id = currentDispatch.id || currentDispatch._id;
      const res = await API.dispatch.updateDetails(id, {
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        driver_phone: driverPhone,
      });
      setCurrentDispatch(res.data?.dispatch || res.data);
      setStep(4);
      setSuccess('Details updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update details.');
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm('Finalize this dispatch? This cannot be undone.')) return;
    setLoading(true);
    try {
      const id = currentDispatch.id || currentDispatch._id;
      await API.dispatch.finalize(id);
      setSuccess('Dispatch finalized successfully!');
      setCurrentDispatch(null);
      setStep(1);
      setClientName('');
      loadActiveDispatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to finalize dispatch.');
    } finally {
      setLoading(false);
    }
  };

  const openSlip = async (type) => {
    const id = currentDispatch.id || currentDispatch._id;
    try {
      const res = type === 'rough'
        ? await API.dispatch.roughSlip(id)
        : await API.dispatch.finalSlip(id);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.response?.data?.error || `Failed to generate ${type} slip.`);
    }
  };

  const dispatchItems = currentDispatch?.items || [];
  const totalItems = dispatchItems.length;
  const totalWeight = dispatchItems.reduce((sum, item) => sum + (Number(item.net_weight) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Dispatch</h1>
        <p>Manage product dispatches</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {currentDispatch && (
        <div className="steps">
          <div className={`step ${step >= 1 ? 'completed' : ''} ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>1. Start</div>
          <div className={`step ${step >= 2 ? 'completed' : ''} ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>2. Scan Items</div>
          <div className={`step ${step >= 3 ? 'completed' : ''} ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>3. Details</div>
          <div className={`step ${step >= 4 ? 'completed' : ''} ${step === 4 ? 'active' : ''}`} onClick={() => setStep(4)}>4. Finalize</div>
        </div>
      )}

      {/* Step 1: Start or resume */}
      {step === 1 && !currentDispatch && (
        <>
          <div className="card">
            <div className="card-header"><h3>Start New Dispatch</h3></div>
            <form onSubmit={handleStartDispatch}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Client Name *</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Starting...' : 'Start Dispatch'}
                </button>
              </div>
            </form>
          </div>

          {activeDispatches.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>Active Dispatches</h3></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Dispatch #</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDispatches.map((d, i) => (
                      <tr key={d.id || d._id || i}>
                        <td><strong>{d.dispatch_number || d.id}</strong></td>
                        <td>{d.client_name}</td>
                        <td>{d.dispatch_date?.split('T')[0] || '-'}</td>
                        <td>{d.items?.length || d.item_count || 0}</td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleResumeDispatch(d)}>Resume</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 2: Scan items */}
      {step === 2 && currentDispatch && (
        <div className="card">
          <div className="card-header">
            <h3>Scan Items - {currentDispatch.dispatch_number || ''} ({currentDispatch.client_name})</h3>
          </div>

          <div className="stats-grid" style={{ marginBottom: '16px' }}>
            <div className="stat-card blue">
              <div className="stat-label">Total Items</div>
              <div className="stat-value">{totalItems}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Total Weight</div>
              <div className="stat-value">{totalWeight.toFixed(1)} kg</div>
            </div>
          </div>

          <form onSubmit={handleScan} className="form-row" style={{ marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Product Number</label>
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan or enter product number"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={scanLoading}>
              {scanLoading ? 'Scanning...' : 'Scan'}
            </button>
          </form>

          {dispatchItems.length > 0 && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product #</th>
                    <th>Quality</th>
                    <th>GSM</th>
                    <th>Weight</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchItems.map((item, i) => (
                    <tr key={item.id || item._id || i}>
                      <td>{i + 1}</td>
                      <td><strong>{item.product_number || '-'}</strong></td>
                      <td>{item.quality || '-'}</td>
                      <td>{item.gsm || '-'}</td>
                      <td>{item.net_weight || '-'}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveItem(item.id || item._id || item.product_id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '16px' }} className="btn-group">
            <button className="btn btn-primary" onClick={() => setStep(3)}>Next: Add Details</button>
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && currentDispatch && (
        <div className="card">
          <div className="card-header"><h3>Dispatch Details</h3></div>
          <form onSubmit={handleUpdateDetails}>
            <div className="form-grid">
              <div className="form-group">
                <label>Vehicle Number</label>
                <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g., MH12AB1234" />
              </div>
              <div className="form-group">
                <label>Driver Name</label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver name" />
              </div>
              <div className="form-group">
                <label>Driver Phone</label>
                <input type="text" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="Phone number" />
              </div>
            </div>
            <div style={{ marginTop: '16px' }} className="btn-group">
              <button className="btn btn-secondary" type="button" onClick={() => setStep(2)}>Back</button>
              <button type="submit" className="btn btn-primary">Save & Continue</button>
            </div>
          </form>
        </div>
      )}

      {/* Step 4: Actions */}
      {step === 4 && currentDispatch && (
        <div className="card">
          <div className="card-header"><h3>Dispatch Summary & Actions</h3></div>

          <div className="stats-grid" style={{ marginBottom: '16px' }}>
            <div className="stat-card blue">
              <div className="stat-label">Client</div>
              <div className="stat-value" style={{ fontSize: '18px' }}>{currentDispatch.client_name}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Total Items</div>
              <div className="stat-value">{totalItems}</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-label">Total Weight</div>
              <div className="stat-value">{totalWeight.toFixed(1)} kg</div>
            </div>
          </div>

          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back to Scan</button>
            <button className="btn btn-warning" onClick={() => openSlip('rough')}>Rough Slip</button>
            <button className="btn btn-primary" onClick={() => openSlip('final')}>Final Slip</button>
            <button className="btn btn-success" onClick={handleFinalize} disabled={loading}>
              {loading ? 'Finalizing...' : 'Finalize Dispatch'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
