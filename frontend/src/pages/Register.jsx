import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '', fullName: '' });
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);

  function update(k) { return (e) => setForm({ ...form, [k]: e.target.value }); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
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
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <h2>Create an account</h2>
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={update('email')} required />
          <label>Username</label>
          <input value={form.username} onChange={update('username')} required minLength={3} />
          <label>Full name</label>
          <input value={form.fullName} onChange={update('fullName')} />
          <label>Password (min 8 chars)</label>
          <input type="password" value={form.password} onChange={update('password')} required minLength={8} />
          {err && <p className="error">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? '...' : 'Register'}</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
