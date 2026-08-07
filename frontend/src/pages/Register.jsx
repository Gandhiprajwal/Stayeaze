import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../store/slices/authSlice';

export default function Register({ setView, setError, setSuccess }) {
  const dispatch = useDispatch();
  const { loading } = useSelector(state => state.auth);

  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(registerUser({ orgName, ownerName, email, mobile, password })).unwrap();
      // App.jsx will automatically route back to sign-in view
    } catch (err) {
      setError(err || 'Registration failed.');
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '60px auto', padding: '30px' }} className="card">
      <h2 style={{ marginBottom: '20px' }}>🏢 Register Organization</h2>
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" className="form-control" placeholder="Organization / Brand Name" required value={orgName} onChange={e => setOrgName(e.target.value)} disabled={loading} />
        <input type="text" className="form-control" placeholder="Owner Full Name" required value={ownerName} onChange={e => setOwnerName(e.target.value)} disabled={loading} />
        <input type="email" className="form-control" placeholder="Owner Email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
        <input type="text" className="form-control" placeholder="Owner Mobile Number" required value={mobile} onChange={e => setMobile(e.target.value)} disabled={loading} />
        <input type="password" className="form-control" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Org & Owner Profile'}
        </button>
      </form>
      <p style={{ marginTop: '15px', fontSize: '14px' }}>
        Already have an account?{' '}
        <span
          onClick={() => { setError(''); setSuccess(''); setView('login'); }}
          style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Sign In
        </span>
      </p>
    </div>
  );
}
