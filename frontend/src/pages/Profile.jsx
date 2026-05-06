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
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    setUser(data.user);
    setSavedMsg(`Location saved! You'll now receive nearby alerts.`);
    setTimeout(() => setSavedMsg(null), 3000);
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }

  const initial = user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="container fade-in">

      {/* Profile header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="profile-avatar">{initial}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{user.username}</h2>
          <p className="muted">{user.email}</p>
        </div>
        {coords && (
          <button className="btn secondary" onClick={saveLocation}>
            📍 Save location
          </button>
        )}
      </div>
      {savedMsg && <p className="success-msg">{savedMsg}</p>}

      {/* Notifications */}
      <div className="card">
        <div className="section-header">
          <h3>🔔 Notifications</h3>
          {notifications.some((n) => !n.readAt) && (
            <button className="btn secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 && (
          <p className="muted">No notifications yet.</p>
        )}

        {notifications.map((n) => (
          <div key={n.id} className={`notif-item ${n.readAt ? 'read' : ''}`}>
            <strong>{n.type}</strong>
            <span className="muted" style={{ marginLeft: 8 }}>{new Date(n.createdAt).toLocaleString()}</span>
            {n.payload && (
              <div className="payload">{JSON.stringify(n.payload)}</div>
            )}
          </div>
        ))}
      </div>

      {/* My listings */}
      <div className="card">
        <div className="section-header">
          <h3>📦 Your active listings</h3>
          <Link to="/new" className="btn" style={{ padding: '7px 14px', fontSize: '0.85rem', textDecoration: 'none' }}>
            + New listing
          </Link>
        </div>

        {myListings.length === 0 && (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <div className="empty-icon">📭</div>
            <p>You haven't posted anything yet.</p>
          </div>
        )}

        <div className="grid">
          {myListings.map((l) => (
            <Link key={l.id} to={`/listings/${l.id}`} className="card listing-card">
              {l.images?.[0]
                ? <img className="card-img" src={l.images[0].url} alt={l.title} />
                : <div className="card-img-placeholder">📦</div>}
              <div className="card-body">
                <div className="title">{l.title}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`tag ${l.status}`}>{l.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
