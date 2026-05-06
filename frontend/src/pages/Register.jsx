import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '', fullName: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  function update(k) { return (e) => setForm({ ...form, [k]: e.target.value }); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container fade-in" style={{ maxWidth: 480, paddingTop: 60 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🌿</div>
        <div className="page-title">Join Freecycle</div>
        <p className="muted">Create a free account and start giving</p>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>
          <label>Email address</label>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            required
          />

          <label>Username</label>
          <input
            value={form.username}
            onChange={update('username')}
            placeholder="coolneighbour42"
            required
            minLength={3}
          />

          <label>Full name <span style={{ fontWeight: 400, textTransform: 'none', color: '#4a5168' }}>(optional)</span></label>
          <input
            value={form.fullName}
            onChange={update('fullName')}
            placeholder="Alex Smith"
          />

          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="min 8 characters"
            required
            minLength={8}
          />

          {err && <p className="error">⚠️ {err}</p>}

          <button className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? '⏳ Creating account…' : '✨ Create account'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: '#38bd78', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
