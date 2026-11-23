'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { getPunchLocation, LocationError, mapsUrl, formatCoords } from '@/lib/geo';
import { MapPin, Crosshair, Check, AlertCircle, Plus, ExternalLink, Pencil, X, Users } from 'lucide-react';

type Branch = {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  legalEntityId: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
};

type Draft = { latitude: string; longitude: string; radius: string };

export default function OfficeLocationsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'org:manage');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [people, setPeople] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ latitude: '', longitude: '', radius: '200' });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');

  const load = async () => {
    try {
      const [oRes, eRes] = await Promise.all([fetch('/api/organization'), fetch('/api/employees')]);
      const o = await oRes.json();
      if (!oRes.ok) throw new Error(o.error || 'Could not load offices');
      setBranches(o.branchLocations || []);
      setLegalEntities(o.legalEntities || []);
      if (eRes.ok) {
        const counts: Record<string, number> = {};
        for (const e of (await eRes.json()).employees || []) {
          if (['EXITED', 'ARCHIVED'].includes(e.status) || !e.branchLocationId) continue;
          counts[e.branchLocationId] = (counts[e.branchLocationId] || 0) + 1;
        }
        setPeople(counts);
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const startEdit = (b: Branch) => {
    setEditing(b.id);
    setMsg(null);
    setDraft({
      latitude: b.latitude != null ? String(b.latitude) : '',
      longitude: b.longitude != null ? String(b.longitude) : '',
      radius: String(b.geofenceRadiusMeters || 200),
    });
  };

  /** Fill the form with where this device is now (HR standing in the office). */
  const useMyLocation = async () => {
    setLocating(true);
    setMsg(null);
    try {
      const loc = await getPunchLocation();
      setDraft((d) => ({ ...d, latitude: loc.latitude.toFixed(6), longitude: loc.longitude.toFixed(6) }));
      setMsg({
        ok: true,
        text: `Location found (accurate to about ±${loc.accuracy} m). Check it on the map, then press Save.`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e instanceof LocationError ? e.message : 'Could not get your location.' });
    } finally {
      setLocating(false);
    }
  };

  /** Accepts "12.9716, 77.5946" pasted from Google Maps into either box. */
  const onCoordInput = (field: 'latitude' | 'longitude', value: string) => {
    const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) setDraft((d) => ({ ...d, latitude: pair[1], longitude: pair[2] }));
    else setDraft((d) => ({ ...d, [field]: value }));
  };

  const save = async (b: Branch) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/organization/branches/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: draft.latitude.trim() || null,
          longitude: draft.longitude.trim() || null,
          geofenceRadiusMeters: draft.radius,
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Could not save');
      setEditing(null);
      setMsg({
        ok: true,
        text:
          r.latitude != null
            ? `Saved. Clock-ins within ${r.geofenceRadiusMeters} m of ${r.name} now show as "In office".`
            : `Location cleared for ${r.name}.`,
      });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (!legalEntities[0]) return setMsg({ ok: false, text: 'Add your company (legal entity) first.' });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BRANCH',
          data: { name: newName.trim(), city: newCity.trim(), legalEntityId: legalEntities[0].id },
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Could not add office');
      setNewName('');
      setNewCity('');
      await load();
      startEdit(r);
      setMsg({ ok: true, text: `Office "${r.name}" added. Now set its location below.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const withLocation = branches.filter((b) => b.latitude != null && b.longitude != null).length;

  return (
    <DashboardLayout title="Office Locations" subtitle="Where each office is, so clock-ins show as in office or outside office">
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900">How location check works</div>
          <div>• Every clock-in and clock-out records the employee's location. Employees must allow location access to clock in.</div>
          <div>
            • If the employee's office has a location set, each punch is marked <strong>In office</strong> (within the radius) or{' '}
            <strong>Outside office</strong>. Without it, the punch shows <strong>Office not set</strong>.
          </div>
          <div>
            • Easiest way: stand in the office with your phone, press <strong>Edit</strong> → <strong>Use my current location</strong> → Save. Or copy the
            coordinates from Google Maps (right-click the office → click the numbers) and paste them.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Offices</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{branches.length}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">With location set</div>
            <div className={`text-2xl font-black mt-1 ${withLocation < branches.length ? 'text-amber-600' : 'text-emerald-600'}`}>
              {withLocation} / {branches.length}
            </div>
          </div>
        </div>

        {msg && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-center gap-1.5 ${
              msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {msg.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />} {msg.text}
          </div>
        )}

        {canManage && (
          <form onSubmit={add} className="flex flex-wrap gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New office name, e.g. Hyderabad Office"
              className="flex-1 min-w-[180px] px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="City"
              className="w-40 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <button
              disabled={busy || !newName.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add office
            </button>
          </form>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading…</div>
          ) : branches.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No offices yet. Add one above.</div>
          ) : (
            branches.map((b) => {
              const set = b.latitude != null && b.longitude != null;
              return (
                <div key={b.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${set ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {b.name} <span className="text-[11px] font-mono text-slate-400">{b.code}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{[b.city, b.state].filter(Boolean).join(', ')}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {people[b.id] || 0} employee{people[b.id] === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="text-xs mt-1">
                          {set ? (
                            <span className="text-slate-600">
                              <span className="font-mono">{formatCoords(b.latitude!, b.longitude!)}</span> · radius {b.geofenceRadiusMeters} m ·{' '}
                              <a
                                href={mapsUrl(b.latitude!, b.longitude!)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                View on map <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">Location not set: clock-ins can't be checked against this office.</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canManage && editing !== b.id && (
                      <button
                        onClick={() => startEdit(b)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" /> {set ? 'Edit' : 'Set location'}
                      </button>
                    )}
                  </div>

                  {editing === b.id && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                      <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={locating}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <Crosshair className="h-3.5 w-3.5" /> {locating ? 'Finding your location…' : 'Use my current location'}
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="text-[11px] text-slate-600 space-y-1">
                          <span>Latitude</span>
                          <input
                            value={draft.latitude}
                            onChange={(e) => onCoordInput('latitude', e.target.value)}
                            placeholder="12.971600"
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-[11px] text-slate-600 space-y-1">
                          <span>Longitude</span>
                          <input
                            value={draft.longitude}
                            onChange={(e) => onCoordInput('longitude', e.target.value)}
                            placeholder="77.594600"
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                        <label className="text-[11px] text-slate-600 space-y-1">
                          <span>Radius (metres)</span>
                          <input
                            type="number"
                            min={25}
                            max={50000}
                            value={draft.radius}
                            onChange={(e) => setDraft((d) => ({ ...d, radius: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Tip: you can paste "12.9716, 77.5946" from Google Maps into either box. 200 m suits most offices; use more for large campuses.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => save(b)}
                          disabled={busy}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-white text-slate-700 flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
