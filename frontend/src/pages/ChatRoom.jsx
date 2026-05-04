import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080';

export default function ChatRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft]       = useState('');
  const [typing, setTyping]     = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

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

  let typingTimer;
  function onTyping(e) {
    setDraft(e.target.value);
    socketRef.current?.emit('typing', { chatId: id, isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socketRef.current?.emit('typing', { chatId: id, isTyping: false });
    }, 1500);
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card chat-window">
        <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column' }}>
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === user.id ? 'me' : 'them'}`}>
              {m.body}
              <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {typing && <div className="muted" style={{ padding: 6 }}>typing...</div>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="row" style={{ marginTop: 8 }}>
          <input
            value={draft}
            onChange={onTyping}
            placeholder="Type a message..."
            style={{ flex: 1, margin: 0 }}
          />
          <button className="btn" type="submit" disabled={!draft.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
