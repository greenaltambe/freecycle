import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ChatList() {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    api.get('/api/chats').then((r) => setChats(r.data.chats));
  }, []);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2>Your chats</h2>
      {chats.length === 0 && <p className="muted">No chats yet. Open a listing and message the owner.</p>}
      {chats.map((c) => (
        <Link key={c.id} to={`/chats/${c.id}`} className="card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Chat with user {c.otherUserId.slice(0, 8)}</strong>
            {c.unreadCount > 0 && <span className="badge">{c.unreadCount}</span>}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {c.lastMessage ? c.lastMessage.slice(0, 80) : 'No messages yet'}
          </div>
        </Link>
      ))}
    </div>
  );
}
