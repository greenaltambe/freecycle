import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    const fetchUnread = () =>
      api.get('/api/notifications/unread-count')
        .then((r) => { if (!cancel) setUnread(r.data.count); })
        .catch(() => {});
    fetchUnread();
    const t = setInterval(fetchUnread, 15000);
    return () => { cancel = true; clearInterval(t); };
  }, [user]);

  return (
    <nav className="navbar">
      <div>
        <Link to="/" className="brand">Freecycle</Link>
        <Link to="/">Home</Link>
        {user && <Link to="/new">+ New listing</Link>}
        {user && (
          <Link to="/chats">
            Chats {unread > 0 && <span className="badge">{unread}</span>}
          </Link>
        )}
      </div>
      <div>
        {user ? (
          <>
            <Link to="/profile">{user.username}</Link>
            <button onClick={() => { logout(); navigate('/'); }}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
