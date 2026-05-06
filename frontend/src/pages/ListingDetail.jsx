import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [err, setErr] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    api.get(`/api/listings/${id}`)
      .then((r) => setListing(r.data.listing))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load listing'));
  }, [id]);

  if (err) return (
    <div className="container">
      <p className="error">⚠️ {err}</p>
    </div>
  );

  if (!listing) return (
    <div className="container">
      <div className="spinner" />
    </div>
  );

  const isOwner = user && user.id === listing.userId;

  async function setStatus(status) {
    await api.patch(`/api/listings/${id}/status`, { status });
    setListing((l) => ({ ...l, status }));
  }

  async function remove() {
    if (!confirm('Delete this listing?')) return;
    await api.delete(`/api/listings/${id}`);
    navigate('/');
  }

  async function startChat() {
    const { data } = await api.post('/api/chats', {
      otherUserId: listing.userId,
      listingId: listing.id,
    });
    navigate(`/chats/${data.chat.id}`);
  }

  const imgs = listing.images || [];

  return (
    <div className="container fade-in" style={{ maxWidth: 760 }}>
      {/* Back link */}
      <button
        className="btn secondary"
        style={{ marginBottom: 20, padding: '7px 14px', fontSize: '0.85rem' }}
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="card">
        {/* Title & Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>{listing.title}</h2>
          <span className={`tag ${listing.status}`}>{listing.status}</span>
        </div>
        <p className="muted" style={{ marginBottom: 20 }}>
          {listing.categoryName} · posted {new Date(listing.createdAt).toLocaleString()}
        </p>

        {/* Image gallery */}
        {imgs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {/* Main image */}
            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: '#1a1d27' }}>
              <img
                src={imgs[activeImg].url}
                alt={listing.title}
                style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
              />
            </div>
            {/* Thumbnails */}
            {imgs.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {imgs.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImg(idx)}
                    style={{
                      padding: 0, border: 'none', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      outline: activeImg === idx ? '2px solid #38bd78' : '2px solid transparent',
                      outlineOffset: 2,
                      background: 'transparent',
                    }}
                  >
                    <img
                      src={img.url}
                      alt={`img ${idx + 1}`}
                      style={{ width: 72, height: 72, objectFit: 'cover', display: 'block', borderRadius: 8 }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <>
            <h3 style={{ marginBottom: 8 }}>About this item</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: '#c8ccdb', lineHeight: 1.7, marginBottom: 16 }}>
              {listing.description}
            </p>
          </>
        )}

        {listing.addressText && (
          <p className="muted" style={{ marginBottom: 8 }}>
            📍 Pickup: {listing.addressText}
          </p>
        )}

        <hr className="divider" />

        {/* Actions */}
        <div className="btn-row">
          {!isOwner && user && listing.status === 'available' && (
            <button className="btn" onClick={startChat}>💬 Message owner</button>
          )}
          {isOwner && listing.status === 'available' && (
            <button className="btn secondary" onClick={() => setStatus('taken')}>✅ Mark as taken</button>
          )}
          {isOwner && listing.status === 'taken' && (
            <button className="btn secondary" onClick={() => setStatus('available')}>🔄 Mark available</button>
          )}
          {isOwner && (
            <button className="btn danger" onClick={remove}>🗑️ Delete listing</button>
          )}
          {!user && listing.status === 'available' && (
            <p className="muted">
              <a href="/login" style={{ color: '#38bd78' }}>Login</a> to message the owner
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
