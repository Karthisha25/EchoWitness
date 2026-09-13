import { useEffect, useState } from 'react';

type GeoState = {
  lat: number | null;
  lng: number | null;
  description: string | null;
  error: string | null;
};

export function useGeolocation() {
  const [geo, setGeo] = useState<GeoState>({
    lat: null,
    lng: null,
    description: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo((current) => ({
        ...current,
        error: 'Geolocation is not supported on this device.',
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          description: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
          error: null,
        });
      },
      (error) => {
        setGeo((current) => ({
          ...current,
          error: error.message,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return geo;
}
