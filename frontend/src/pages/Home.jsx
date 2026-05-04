import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import useGeolocation from '../hooks/useGeolocation.js';

export default function Home() {
  const { coords, error: geoError } = useGeolocation();
  const [listings, setListings] = useState([]);
  const [radius, setRadius]     = useState(5);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(null);

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
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Free stuff near you</h2>
        {geoError && <p className="muted">Geolocation: {geoError} (using fallback)</p>}
        <label>Radius (km)</label>
        <input
          type="range" min="1" max="50" value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
        <span className="muted">{radius} km</span>
      </div>

      {err && <p className="error">{err}</p>}
      {loading && <p>Loading...</p>}

      {!loading && listings.length === 0 && (
        <p className="muted">No listings nearby. Be the first to give something away!</p>
      )}

      <div className="grid">
        {listings.map((l) => (
          <Link to={`/listings/${l.id}`} key={l.id} className="card listing-card" style={{ color: 'inherit', textDecoration: 'none' }}>
            {l.images?.[0]
              ? <img src={l.images[0].url} alt={l.title} />
              : <div style={{ background: '#e0e0e0', height: 160, borderRadius: 8 }} />}
            <div className="title">{l.title}</div>
            <div className="meta">
              {l.distanceKm != null && <>{l.distanceKm} km away · </>}
              {l.categoryName || 'Uncategorized'}
            </div>
            <span className={`tag ${l.status}`}>{l.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
