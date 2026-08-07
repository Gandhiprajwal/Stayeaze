import React from 'react';

export default function HomeDashboard({ propertiesCount, tenantsCount, pendingComplaintsCount }) {
  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>Overview Dashboard</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', textAlign: 'left' }}>
        <div className="card">
          <h3>🏢 Properties</h3>
          <p style={{ fontSize: '32px', margin: '10px 0 0 0', fontWeight: 'bold' }}>{propertiesCount}</p>
        </div>
        <div className="card">
          <h3>👥 Residents</h3>
          <p style={{ fontSize: '32px', margin: '10px 0 0 0', fontWeight: 'bold' }}>{tenantsCount}</p>
        </div>
        <div className="card">
          <h3>🛠️ Queries</h3>
          <p style={{ fontSize: '32px', margin: '10px 0 0 0', fontWeight: 'bold' }}>{pendingComplaintsCount}</p>
        </div>
      </div>
    </>
  );
}
