import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import useGeolocation from '../hooks/useGeolocation.js';

export default function CreateListing() {
  const navigate = useNavigate();
  const { coords } = useGeolocation();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', categorySlug: 'other', addressText: '',
  });
  const [files, setFiles] = useState([]);
  const [err, setErr]     = useState(null);
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    api.get('/api/categories').then((r) => setCategories(r.data.categories));
  }, []);

  function update(k) { return (e) => setForm({ ...form, [k]: e.target.value }); }

  async function onSubmit(e) {
    e.preventDefault();
    if (!coords) { setErr('Waiting for location...'); return; }
    setErr(null); setBusy(true);
    try {
      const { data } = await api.post('/api/listings', {
        ...form,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      const listingId = data.listing.id;

      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append('images', f));
        await api.post(`/api/listings/${listingId}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigate(`/listings/${listingId}`);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Failed to create listing');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <div className="card">
        <h2>Give something away</h2>
        <form onSubmit={onSubmit}>
          <label>Title</label>
          <input value={form.title} onChange={update('title')} required minLength={3} maxLength={140} />

          <label>Description</label>
          <textarea rows="4" value={form.description} onChange={update('description')} maxLength={5000} />

          <label>Category</label>
          <select value={form.categorySlug} onChange={update('categorySlug')}>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>

          <label>Pickup area (optional)</label>
          <input value={form.addressText} onChange={update('addressText')} maxLength={255} />

          <label>Images (up to 6, 5MB each)</label>
          <input type="file" multiple accept="image/*"
            onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 6))} />

          {coords
            ? <p className="muted">Location: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</p>
            : <p className="muted">Waiting for location permission...</p>}

          {err && <p className="error">{err}</p>}
          <button className="btn" disabled={busy || !coords}>{busy ? 'Posting...' : 'Post listing'}</button>
        </form>
      </div>
    </div>
  );
}
