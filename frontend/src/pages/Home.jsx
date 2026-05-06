import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import useGeolocation from '../hooks/useGeolocation.js';

const CATEGORY_ICONS = {
  furniture: '🛋️', electronics: '💻', clothing: '👗', books: '📚',
  toys: '🧸', appliances: '🏠', garden: '🌱', sports: '⚽',
  music: '🎸', art: '🎨', other: '📦',
};

export default function Home() {
  const { coords, error: geoError } = useGeolocation();
  const [listings, setListings] = useState([]);
  const [radius, setRadius] = useState(5);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    setErr(null);
    api.get('/api/listings/nearby', {
      params: { latitude: coords.latitude, longitude: coords.longitude, radiusKm: radius, pageSize: 30 },
    })
      .then((r) => setListings(r.data.listings))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load listings'))
      .finally(() => setLoading(false));
  }, [coords, radius]);

  return (
    <div className="container fade-in">
      {/* Hero / Filter */}
      <div className="home-hero">
        <h1>Free stuff near you 🌿</h1>
        <p className="muted">Discover items your neighbours are giving away for free.</p>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        {geoError && (
          <p className="muted" style={{ marginBottom: 12 }}>📍 {geoError} — using fallback location</p>
        )}
        <label>Search radius</label>
        <div className="radius-control">
          <input
            type="range" min="1" max="50" value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <span className="radius-value">{radius} km</span>
        </div>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      {loading && <div className="spinner" />}

      {!loading && listings.length === 0 && !err && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No listings within {radius} km.<br />Be the first to give something away!</p>
        </div>
      )}

      {!loading && (
        <div className="grid">
          {listings.map((l) => {
            const icon = CATEGORY_ICONS[l.categorySlug] || CATEGORY_ICONS.other;
            return (
              <Link to={`/listings/${l.id}`} key={l.id} className="card listing-card">
                {l.images?.[0]
                  ? <img className="card-img" src={l.images[0].url} alt={l.title} />
                  : (
                    <div className="card-img-placeholder">
                      <span>{icon}</span>
                    </div>
                  )}
                <div className="card-body">
                  <div className="title">{l.title}</div>
                  <div className="meta">
                    {l.distanceKm != null && <>{l.distanceKm} km · </>}
                    {l.categoryName || 'Uncategorized'}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`tag ${l.status}`}>{l.status}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
