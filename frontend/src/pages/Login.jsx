import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container fade-in" style={{ maxWidth: 440, paddingTop: 60 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>⬡</div>
        <div className="page-title">Welcome back</div>
        <p className="muted">Sign in to your Freecycle account</p>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {err && <p className="error">⚠️ {err}</p>}

          <button className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? '⏳ Signing in…' : '🔑 Sign in'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          No account? <Link to="/register" style={{ color: '#38bd78', fontWeight: 600 }}>Register for free</Link>
        </p>
      </div>
    </div>
  );
}
