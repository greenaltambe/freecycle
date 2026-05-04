import { useEffect, useState } from 'react';

const FALLBACK = { latitude: 40.7484, longitude: -73.9857 }; // NYC

export default function useGeolocation() {
  const [coords, setCoords] = useState(() => {
    const stored = localStorage.getItem('coords');
    return stored ? JSON.parse(stored) : null;
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (coords) return;
    if (!navigator.geolocation) {
      setCoords(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        localStorage.setItem('coords', JSON.stringify(c));
        setCoords(c);
      },
      (err) => {
        setError(err.message);
        setCoords(FALLBACK);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [coords]);

  return { coords, error };
}
