'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, ExternalLink, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import { distanceMeters, formatCoords, formatDistance, locationPermissionState, mapsUrl } from '@/lib/geo';

export interface OfficeInfo {
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusMeters?: number | null;
}

export interface PunchWithLocation {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  verificationStatus?: string | null;
}

const hasCoords = (p: { latitude?: number | null; longitude?: number | null } | null | undefined) =>
  p != null && p.latitude != null && p.longitude != null;

/** Inside / outside office badge for one punch. */
export function PunchLocationStatus({ punch }: { punch: PunchWithLocation }) {
  const s = punch.verificationStatus;
  if (!hasCoords(punch)) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <HelpCircle className="h-3 w-3" /> No location
      </span>
    );
  }
  if (s === 'GEOFENCE_WARNING') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3" /> Outside office
      </span>
    );
  }
  if (s === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="h-3 w-3" /> In office
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
      title="HR has not set the office location for this employee's branch, so it can't be checked."
    >
      <MapPin className="h-3 w-3" /> Office not set
    </span>
  );
}

/** Location of one punch: status badge, distance from office, accuracy and a Google Maps link. */
export function PunchLocation({
  punch,
  office,
  compact = false,
}: {
  punch: PunchWithLocation | null | undefined;
  office?: OfficeInfo | null;
  compact?: boolean;
}) {
  if (!punch) return <span className="text-slate-300">—</span>;
  if (!hasCoords(punch)) return <PunchLocationStatus punch={punch} />;

  const lat = punch.latitude as number;
  const lng = punch.longitude as number;
  const dist = hasCoords(office)
    ? distanceMeters({ latitude: lat, longitude: lng }, { latitude: office!.latitude as number, longitude: office!.longitude as number })
    : null;

  return (
    <div className="flex flex-col gap-0.5 font-sans">
      <div className="flex flex-wrap items-center gap-1.5">
        <PunchLocationStatus punch={punch} />
        <a
          href={mapsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          <MapPin className="h-3 w-3" /> View on map <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      <div className="text-[10px] text-slate-400 font-mono">
        {!compact && <>{formatCoords(lat, lng)} · </>}
        {punch.accuracy != null && <>±{Math.round(punch.accuracy)} m</>}
        {dist != null && (
          <>
            {' '}
            · {formatDistance(dist)} from {office?.name || 'office'}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Explains the location requirement next to the clock-in buttons, based on the browser's permission state:
 * first time → "you'll be asked once"; blocked → how to allow it again.
 */
export function LocationRequirementNote({ refreshKey }: { refreshKey?: unknown }) {
  const [state, setState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  useEffect(() => {
    locationPermissionState().then(setState);
  }, [refreshKey]);

  if (state === 'granted') {
    return (
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <MapPin className="h-3 w-3 text-emerald-600" /> Your location is recorded when you clock in and out.
      </p>
    );
  }
  if (state === 'denied') {
    return (
      <div className="text-[11px] p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
        <strong>Location is blocked.</strong> You can't clock in or out until you allow it: tap the lock icon next to the address bar → Location → Allow,
        then reload the page.
      </div>
    );
  }
  return (
    <p className="text-[11px] text-slate-500 flex items-center gap-1">
      <MapPin className="h-3 w-3 text-emerald-600" /> Location is required. Your browser will ask once. Choose <strong>Allow</strong>.
    </p>
  );
}
