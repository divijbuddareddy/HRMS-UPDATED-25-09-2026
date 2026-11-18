'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Settings2, AlertCircle } from 'lucide-react';

type CatalogItem = { key: string; label: string; hint: string; multiple?: boolean };
type Doc = { key: string; label: string; hint: string; required: boolean; multiple?: boolean; custom?: boolean };
type Choice = 'REQUIRED' | 'OPTIONAL' | 'NONE';

/** HR / owner: choose which documents new joiners upload (Required / Optional / Not needed) + custom ones. */
export function OnboardingDocSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [custom, setCustom] = useState<Doc[]>([]);
  const [newCustom, setNewCustom] = useState({ label: '', hint: '', required: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/onboarding/document-settings')
      .then((r) => r.json())
      .then((d) => {
        setCatalog(d.catalog || []);
        const c: Record<string, Choice> = {};
        for (const item of d.catalog || []) c[item.key] = 'NONE';
        for (const doc of d.documents || []) if (!doc.custom) c[doc.key] = doc.required ? 'REQUIRED' : 'OPTIONAL';
        setChoice(c);
        setCustom((d.documents || []).filter((x: Doc) => x.custom));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const documents = [
        ...catalog.filter((c) => choice[c.key] !== 'NONE').map((c) => ({ key: c.key, required: choice[c.key] === 'REQUIRED' })),
        ...custom.map((c) => ({ key: c.key, label: c.label, hint: c.hint, required: c.required, multiple: c.multiple })),
      ];
      const res = await fetch('/api/onboarding/document-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save');
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const required = Object.values(choice).filter((c) => c === 'REQUIRED').length + custom.filter((c) => c.required).length;
  const optional = Object.values(choice).filter((c) => c === 'OPTIONAL').length + custom.filter((c) => !c.required).length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-600" /> Onboarding documents for your company
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Employees see and upload only these. <strong>Required</strong> ones show a reminder until uploaded.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : (
          <>
            <div className="text-xs text-slate-600">
              {required} required · {optional} optional
            </div>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {catalog.map((c) => (
                <div key={c.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{c.label}</div>
                    <div className="text-[11px] text-slate-500">{c.hint}{c.multiple ? ' · several files allowed' : ''}</div>
                  </div>
                  <Segmented value={choice[c.key] || 'NONE'} onChange={(v) => setChoice({ ...choice, [c.key]: v })} />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">Your own documents</div>
              {custom.map((c, i) => (
                <div key={c.key} className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-xl">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{c.label}</div>
                    {c.hint && <div className="text-[11px] text-slate-500">{c.hint}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Segmented
                      value={c.required ? 'REQUIRED' : 'OPTIONAL'}
                      noNone
                      onChange={(v) => setCustom(custom.map((x, j) => (j === i ? { ...x, required: v === 'REQUIRED' } : x)))}
                    />
                    <button onClick={() => setCustom(custom.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={newCustom.label}
                  onChange={(e) => setNewCustom({ ...newCustom, label: e.target.value })}
                  placeholder="Document name, e.g. Police Verification Certificate"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <input
                  value={newCustom.hint}
                  onChange={(e) => setNewCustom({ ...newCustom, hint: e.target.value })}
                  placeholder="Short instruction (optional)"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <button
                  disabled={!newCustom.label.trim()}
                  onClick={() => {
                    const label = newCustom.label.trim();
                    const key = `CUSTOM_${label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)}`;
                    if (custom.some((c) => c.key === key)) return setError('That document is already in the list.');
                    setCustom([...custom, { key, label, hint: newCustom.hint.trim(), required: newCustom.required, custom: true }]);
                    setNewCustom({ label: '', hint: '', required: true });
                    setError(null);
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">Cancel</button>
          <button disabled={saving || loading} onClick={save} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium">
            {saving ? 'Saving…' : 'Save document list'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, noNone }: { value: Choice; onChange: (v: Choice) => void; noNone?: boolean }) {
  const opts: [Choice, string, string][] = [
    ['REQUIRED', 'Required', 'bg-emerald-600 text-white'],
    ['OPTIONAL', 'Optional', 'bg-blue-600 text-white'],
    ...(noNone ? [] : ([['NONE', 'Not needed', 'bg-slate-600 text-white']] as [Choice, string, string][])),
  ];
  return (
    <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold shrink-0">
      {opts.map(([k, label, active]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`px-2.5 py-1 rounded-md ${value === k ? active : 'text-slate-600 hover:text-slate-900'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
