// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { useGeoStore } from '../../stores/geoStore';
import { geocodeZip } from '../../api/geo';

/**
 * Prominent location bar — user sets ZIP code + radius before searching.
 * Per spec: no generic results. Location is required for meaningful search.
 */
export default function LocationBar() {
  const { lat, lng, radius, zipCode, setLocation, setRadius, setZipCode } = useGeoStore();
  const [zipInput, setZipInput] = useState(zipCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetZip = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!zipInput || zipInput.length < 5) { setError('Enter a valid ZIP code'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await geocodeZip(zipInput);
      if (result) {
        setLocation(result.lat, result.lng);
        setZipCode(zipInput);
      } else {
        setError('Could not find that ZIP code');
      }
    } catch {
      setError('Geocoding failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude);
        setZipCode('📍 Current');
        setLoading(false);
      },
      () => { setError('Location access denied'); setLoading(false); },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  };

  const isLocationSet = lat !== null && lng !== null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <form onSubmit={handleSetZip} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-indigo-700 whitespace-nowrap">📍 Your Location:</span>
          <input
            type="text"
            value={zipInput}
            onChange={e => setZipInput(e.target.value.replace(/\D/g, '').substring(0, 5))}
            placeholder="Enter ZIP code"
            maxLength={5}
            className="w-28 rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            aria-label="ZIP code"
          />
          <button type="submit" disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? '...' : 'Set'}
          </button>
          <button type="button" onClick={handleUseMyLocation} disabled={loading}
            className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
            Use My Location
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="radius-select" className="text-sm text-indigo-600 whitespace-nowrap">Radius:</label>
          <select id="radius-select" value={radius} onChange={e => setRadius(Number(e.target.value))}
            className="rounded-md border border-indigo-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
            <option value={5}>5 mi</option>
            <option value={10}>10 mi</option>
            <option value={15}>15 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
          </select>
        </div>
      </form>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {isLocationSet && !error && (
        <p className="mt-2 text-xs text-indigo-500">
          ✓ Location set: {zipCode || 'Custom'} — searching within {radius} miles
        </p>
      )}
    </div>
  );
}
