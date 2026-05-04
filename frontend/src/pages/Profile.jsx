import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import useGeolocation from '../hooks/useGeolocation.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { coords } = useGeolocation();
  const [myListings, setMyListings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get('/api/listings', { params: { userId: user.id, status: 'available' } })
      .then((r) => setMyListings(r.data.listings));
    api.get('/api/notifications').then((r) => setNotifications(r.data.notifications));
  }, [user]);

  async function saveLocation() {
    if (!coords) return;
    const { data } = await api.put('/api/users/me/location', {
      latitude: coords.latitude, longitude: coords.longitude,
    });
    setUser(data.user);
    setSavedMsg('Location saved.');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Hi, {user.username}</h2>
        <p className="muted">{user.email}</p>
        {coords && (
          <button className="btn secondary" onClick={saveLocation}>
            Save current location for nearby alerts
          </button>
        )}
        {savedMsg && <p className="muted" style={{ marginTop: 8 }}>{savedMsg}</p>}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Notifications</h3>
          <button className="btn secondary" onClick={markAllRead}>Mark all read</button>
        </div>
        {notifications.length === 0 && <p className="muted">No notifications yet.</p>}
        {notifications.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee', opacity: n.readAt ? 0.6 : 1 }}>
            <strong>{n.type}</strong> - <span className="muted">{new Date(n.createdAt).toLocaleString()}</span>
            <pre style={{ fontSize: '0.8rem', margin: 0 }}>{JSON.stringify(n.payload, null, 2)}</pre>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Your active listings</h3>
        {myListings.length === 0 && <p className="muted">You haven't posted anything yet.</p>}
        <div className="grid">
          {myListings.map((l) => (
            <Link key={l.id} to={`/listings/${l.id}`} className="card listing-card" style={{ color: 'inherit', textDecoration: 'none' }}>
              {l.images?.[0]
                ? <img src={l.images[0].url} alt={l.title} />
                : <div style={{ background: '#e0e0e0', height: 160, borderRadius: 8 }} />}
              <div className="title">{l.title}</div>
              <span className={`tag ${l.status}`}>{l.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
