// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback } from 'react';
import { useGeoStore } from '@/stores/geoStore';

export function useGeoLocation() {
  const { setLocation } = useGeoStore();

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation(pos.coords.latitude, pos.coords.longitude),
      () => { /* User denied — use default Phoenix location */ },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, [setLocation]);

  return { requestLocation };
}
