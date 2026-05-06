import { useEffect, useState, useCallback } from 'react';
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
  const [files, setFiles] = useState([]);       // File objects
  const [previews, setPreviews] = useState([]);  // Object URLs
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/categories').then((r) => setCategories(r.data.categories));
  }, []);

  // Revoke preview URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function update(k) { return (e) => setForm({ ...form, [k]: e.target.value }); }

  function addFiles(newFiles) {
    const combined = [...files, ...newFiles].slice(0, 6);
    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function handleFileInput(e) {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  function removeFile(idx) {
    URL.revokeObjectURL(previews[idx]);
    const newFiles = files.filter((_, i) => i !== idx);
    const newPreviews = previews.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setPreviews(newPreviews);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (dropped.length) addFiles(dropped);
  }, [files, previews]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!coords) { setErr('Waiting for location…'); return; }
    setErr(null);
    setBusy(true);
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
    <div className="container fade-in" style={{ maxWidth: 660 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-title">Give something away 🎁</div>
        <p className="muted">Help someone out — list an item you no longer need, completely free.</p>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>

          {/* Title */}
          <label>What are you giving away?</label>
          <input
            value={form.title}
            onChange={update('title')}
            placeholder="e.g. Vintage wooden bookshelf"
            required
            minLength={3}
            maxLength={140}
          />

          {/* Description */}
          <label>Description</label>
          <textarea
            rows="4"
            value={form.description}
            onChange={update('description')}
            maxLength={5000}
            placeholder="Condition, dimensions, any details the receiver should know…"
          />

          {/* Category */}
          <label>Category</label>
          <select value={form.categorySlug} onChange={update('categorySlug')}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>

          {/* Pickup area */}
          <label>Pickup area <span style={{ fontWeight: 400, textTransform: 'none', color: '#4a5168' }}>(optional)</span></label>
          <input
            value={form.addressText}
            onChange={update('addressText')}
            placeholder="e.g. Near Central Park, NYC"
            maxLength={255}
          />

          {/* ── Image Upload ── */}
          <label>Photos <span style={{ fontWeight: 400, textTransform: 'none', color: '#4a5168' }}>(up to 6 · 5 MB each)</span></label>

          {previews.length < 6 && (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInput}
              />
              <div className="upload-icon">📷</div>
              <h4>Drag & drop photos here</h4>
              <p>or click to browse · {6 - files.length} slot{6 - files.length !== 1 ? 's' : ''} remaining</p>
            </div>
          )}

          {previews.length > 0 && (
            <div className="preview-grid">
              {previews.map((src, idx) => (
                <div className="preview-item" key={src}>
                  <img src={src} alt={`Preview ${idx + 1}`} />
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeFile(idx)}
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <hr className="divider" />

          {/* Location status */}
          {coords ? (
            <div className="location-chip">
              📍 Location detected ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})
            </div>
          ) : (
            <div className="location-waiting">
              ⏳ Waiting for location permission…
            </div>
          )}

          {err && <p className="error">⚠️ {err}</p>}

          <button className="btn" disabled={busy || !coords} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? '⏳ Posting…' : '🚀 Post listing'}
          </button>
        </form>
      </div>
    </div>
  );
}
