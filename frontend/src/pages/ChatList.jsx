import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ChatList() {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    api.get('/api/chats').then((r) => setChats(r.data.chats));
  }, []);

  return (
    <div className="container fade-in" style={{ maxWidth: 720 }}>
      <div className="page-title" style={{ marginBottom: 6 }}>💬 Messages</div>
      <p className="muted" style={{ marginBottom: 28 }}>Your conversations with other users</p>

      {chats.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💌</div>
          <p>No chats yet.<br />Open a listing and message the owner to start a conversation.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chats.map((c) => (
          <Link key={c.id} to={`/chats/${c.id}`} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bd78, #63b3ed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem', color: '#fff', flexShrink: 0,
                }}>
                  {c.otherUserId?.slice(0, 1).toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#e8eaf0' }}>
                    Chat · <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{c.otherUserId?.slice(0, 8)}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {c.lastMessage ? c.lastMessage.slice(0, 80) : 'No messages yet'}
                  </div>
                </div>
              </div>
              {c.unreadCount > 0 && <span className="badge" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>{c.unreadCount}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
