import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../store/slices/authSlice';

export default function Login({ setView, setError, setSuccess }) {
  const dispatch = useDispatch();
  const { loading } = useSelector(state => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const result = await dispatch(loginUser({ email, password })).unwrap();
      if (result) {
        // App.jsx will automatically see user state and view dashboard
      }
    } catch (err) {
      setError(err || 'Login failed.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px' }} className="card">
      <h2 style={{ marginBottom: '20px' }}>🔑 Sign In</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          type="email"
          className="form-control"
          placeholder="Email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
        />
        <input
          type="password"
          className="form-control"
          placeholder="Password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging In...' : 'Log In'}
        </button>
      </form>
      <p style={{ marginTop: '15px', fontSize: '14px' }}>
        New owner?{' '}
        <span
          onClick={() => { setError(''); setSuccess(''); setView('register'); }}
          style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Register organization
        </span>
      </p>
    </div>
  );
}
