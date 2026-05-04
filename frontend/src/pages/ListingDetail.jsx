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

  useEffect(() => {
    api.get(`/api/listings/${id}`)
      .then((r) => setListing(r.data.listing))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load listing'));
  }, [id]);

  if (err) return <div className="container"><p className="error">{err}</p></div>;
  if (!listing) return <div className="container">Loading...</div>;

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

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card">
        <h2>{listing.title} <span className={`tag ${listing.status}`}>{listing.status}</span></h2>
        <p className="muted">{listing.categoryName} · posted {new Date(listing.createdAt).toLocaleString()}</p>

        {listing.images?.length > 0 && (
          <div className="grid">
            {listing.images.map((img) => (
              <img key={img.id} src={img.url} alt="" style={{ width: '100%', borderRadius: 8 }} />
            ))}
          </div>
        )}

        <p style={{ whiteSpace: 'pre-wrap' }}>{listing.description}</p>
        {listing.addressText && <p className="muted">Pickup: {listing.addressText}</p>}

        <div className="row" style={{ marginTop: 16 }}>
          {!isOwner && user && listing.status === 'available' && (
            <button className="btn" onClick={startChat}>Message owner</button>
          )}
          {isOwner && listing.status === 'available' && (
            <button className="btn secondary" onClick={() => setStatus('taken')}>Mark as taken</button>
          )}
          {isOwner && listing.status === 'taken' && (
            <button className="btn secondary" onClick={() => setStatus('available')}>Mark available</button>
          )}
          {isOwner && (
            <button className="btn danger" onClick={remove}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
