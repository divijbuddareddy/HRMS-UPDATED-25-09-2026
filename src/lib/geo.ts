/**
 * Location helpers for clock-in / clock-out.
 *
 * Location is mandatory for every self-service punch. The browser asks the employee for permission
 * once per device/browser and remembers the answer; if they block it, the punch is not sent.
 */

export interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LocationErrorCode = 'UNSUPPORTED' | 'INSECURE' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MESSAGES: Record<LocationErrorCode, string> = {
  UNSUPPORTED: 'This browser cannot share your location. Please clock in from a phone or a recent version of Chrome, Edge, Safari or Firefox.',
  INSECURE: 'Location only works on the secure (https://) address of the HRMS. Please open the HRMS using its https:// link.',
  DENIED:
    'Location is required to clock in or out, and it is blocked for this site. Tap the lock icon next to the address bar, set Location to "Allow", then try again.',
  UNAVAILABLE: 'Your location could not be found. Turn on Location / GPS on your device, then try again.',
  TIMEOUT: 'Finding your location took too long. Move closer to a window or turn on GPS, then try again.',
};

export function locationErrorMessage(code: LocationErrorCode) {
  return MESSAGES[code];
}

/** Ask the browser for the current position. Rejects with a LocationError (never falls back to a fake location). */
export function getPunchLocation(): Promise<PunchLocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return reject(new LocationError('UNSUPPORTED', MESSAGES.UNSUPPORTED));
    }
    if (window.isSecureContext === false) {
      return reject(new LocationError('INSECURE', MESSAGES.INSECURE));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        }),
      (err) => {
        const code: LocationErrorCode =
          err.code === err.PERMISSION_DENIED ? 'DENIED' : err.code === err.TIMEOUT ? 'TIMEOUT' : 'UNAVAILABLE';
        reject(new LocationError(code, MESSAGES[code]));
      },
      // The timeout starts after the employee answers the permission prompt.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

/** Current permission state, where the browser supports asking without prompting ('unknown' otherwise). */
export async function locationPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const s = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return s.state as 'granted' | 'prompt' | 'denied';
  } catch {
    return 'unknown';
  }
}

export function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function formatCoords(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Distance in metres between two points (Haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Valid coordinate pair (rejects missing values, NaN, out-of-range, and the 0,0 "null island"). */
export function isValidCoordinate(latitude: unknown, longitude: unknown) {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : (latitude as number);
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : (longitude as number);
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}
