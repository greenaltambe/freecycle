import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080';

export default function ChatRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    api.get(`/api/chats/${id}/messages`)
      .then((r) => setMessages(r.data.messages))
      .catch(() => {});
    api.post(`/api/chats/${id}/read`).catch(() => {});
  }, [id]);

  useEffect(() => {
    const socket = io(WS_URL, {
      path: '/socket.io',
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_chat', { chatId: id });
    });
    socket.on('message_received', (m) => {
      if (m.chatId !== id) return;
      setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
      api.post(`/api/chats/${id}/read`).catch(() => {});
    });
    socket.on('typing', ({ chatId, userId, isTyping }) => {
      if (chatId === id && userId !== user.id) setTyping(isTyping);
    });

    return () => {
      socket.emit('leave_chat', { chatId: id });
      socket.disconnect();
    };
  }, [id, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  function send(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    socketRef.current.emit('send_message', { chatId: id, body: draft }, (ack) => {
      if (ack?.ok) {
        setMessages((prev) => prev.some((x) => x.id === ack.message.id) ? prev : [...prev, ack.message]);
        setDraft('');
      }
    });
  }

  function onTyping(e) {
    setDraft(e.target.value);
    socketRef.current?.emit('typing', { chatId: id, isTyping: true });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { chatId: id, isTyping: false });
    }, 1500);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  }

  return (
    <div className="container fade-in" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="btn secondary"
          style={{ padding: '7px 14px', fontSize: '0.85rem' }}
          onClick={() => navigate('/chats')}
        >
          ← Back
        </button>
        <div className="page-title" style={{ fontSize: '1.3rem', margin: 0 }}>💬 Chat</div>
      </div>

      {/* Chat window */}
      <div className="chat-window">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6b7489', marginTop: 40, fontSize: '0.9rem' }}>
              No messages yet. Say hello! 👋
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === user.id ? 'me' : 'them'}`}>
              {m.body}
              <div style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: 3, textAlign: m.senderId === user.id ? 'right' : 'left' }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {typing && (
            <div className="bubble them" style={{ opacity: 0.6, fontSize: '0.82rem' }}>
              ✍️ typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="chat-input-row">
          <input
            value={draft}
            onChange={onTyping}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
          />
          <button className="btn" type="submit" disabled={!draft.trim()} style={{ flexShrink: 0 }}>
            Send ➤
          </button>
        </form>
      </div>
    </div>
  );
}
