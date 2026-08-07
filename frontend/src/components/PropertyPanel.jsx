import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addProperty, setSelectedProperty, fetchBuildings } from '../store/slices/propertySlice';

export default function PropertyPanel({ token, properties, setError, setSuccess }) {
  const dispatch = useDispatch();
  const selectedProperty = useSelector(state => state.property.selectedProperty);
  
  const [propName, setPropName] = useState('');
  const [propAddress, setPropAddress] = useState('');

  const handleSaveProperty = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await dispatch(addProperty({ token, name: propName, address: propAddress })).unwrap();
      setSuccess('Property saved successfully!');
      setPropName('');
      setPropAddress('');
    } catch (err) {
      setError(err || 'Failed to save property.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>Properties & Buildings</h1>
      </header>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', textAlign: 'left' }}>
        <div style={{ flex: '1', minWidth: '300px' }} className="card">
          <h3>🏢 Save Property</h3>
          <form onSubmit={handleSaveProperty} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Property Name"
              required
              value={propName}
              onChange={e => setPropName(e.target.value)}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Property Address"
              required
              value={propAddress}
              onChange={e => setPropAddress(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Create Property</button>
          </form>
        </div>

        <div style={{ flex: '2', minWidth: '350px' }} className="card">
          <h3>List of Properties</h3>
          {properties.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No properties added yet.</p>
          ) : (
            properties.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '12px',
                  background: selectedProperty?.id === p.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-input)',
                  border: selectedProperty?.id === p.id ? '1px solid var(--primary)' : '1px solid transparent',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  dispatch(setSelectedProperty(p));
                  dispatch(fetchBuildings({ token, propertyId: p.id }));
                }}
              >
                <strong>{p.name}</strong> - {p.address}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
