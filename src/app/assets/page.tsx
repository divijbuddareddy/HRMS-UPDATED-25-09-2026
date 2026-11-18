'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { X, Plus, Upload, FileText, Laptop, Search, CheckCircle, AlertCircle, Trash2, UserPlus, Undo2 } from 'lucide-react';

type Assignment = {
  id: string;
  assignedDate: string;
  returnedDate: string | null;
  condition: string;
  notes?: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
};
type Asset = {
  id: string;
  assetName: string;
  assetTag: string;
  serialNumber: string | null;
  category: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  purchaseCost: number | null;
  status: string;
  branchLocation?: { name: string } | null;
  assignments: Assignment[];
};

const CATEGORIES = [
  ['LAPTOP', 'Laptop'],
  ['DESKTOP', 'Desktop'],
  ['MONITOR', 'Monitor'],
  ['PHONE', 'Phone / Tablet'],
  ['ACCESSORY', 'Accessory'],
  ['SOFTWARE_LICENSE', 'Software License'],
  ['OTHER', 'Other'],
] as const;
const catLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] || c.replace(/_/g, ' ');
const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];

const STATUS_CLS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  UNDER_REPAIR: 'bg-amber-50 text-amber-700 border-amber-200',
  RETIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  LOST: 'bg-rose-50 text-rose-700 border-rose-200',
};

const TEMPLATE = `assetName,assetTag,category,serialNumber,purchaseDate,warrantyExpiry,purchaseCost,branch,assignTo,condition
Dell Latitude 5440,,Laptop,DL5440-XY12,2026-04-10,2029-04-09,72000,,,NEW
Samsung 24in Monitor,,Monitor,SM24-9981,10/04/2026,,11500,,amit@yourcompany.com,GOOD
`;

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) => (d ? format(new Date(d), 'dd MMM yyyy') : '—');
const current = (a: Asset) => a.assignments.find((x) => !x.returnedDate);

export default function AssetsPage() {
  const { user } = useAuth();
  const isManager = can(user, 'assets:manage');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const emptyAsset = { assetName: '', assetTag: '', category: 'LAPTOP', serialNumber: '', purchaseDate: '', warrantyExpiry: '', purchaseCost: '' };
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [assignForm, setAssignForm] = useState({ employeeId: '', condition: 'GOOD', notes: '' });
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = async () => {
    try {
      const [aRes, eRes] = await Promise.all([fetch('/api/assets'), isManager ? fetch('/api/employees') : Promise.resolve(null)]);
      const aData = await aRes.json().catch(() => ({}));
      if (!aRes.ok) throw new Error(aData.error || 'Could not load assets');
      setAssets(aData.assets || []);
      if (eRes?.ok) setEmployees(((await eRes.json()).employees || []).filter((e: any) => !['EXITED', 'ARCHIVED'].includes(e.status)));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  // A file dropped outside the drop zone would make the browser open it and leave the page
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (catFilter !== 'ALL' && a.category !== catFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!q) return true;
      const who = current(a)?.employee;
      return [a.assetName, a.assetTag, a.serialNumber, who && `${who.firstName} ${who.lastName}`, who?.employeeCode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [assets, search, catFilter, statusFilter]);

  const totalValue = assets.reduce((a, x) => a + (x.purchaseCost || 0), 0);
  const count = (s: string) => assets.filter((a) => a.status === s).length;

  const post = async (url: string, body: any) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Request failed');
    return d;
  };

  const addAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await post('/api/assets', assetForm);
      setAddOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFor) return;
    setSaving(true);
    setFormError(null);
    try {
      await post(`/api/assets/${assignFor.id}/assign`, assignForm);
      setAssignFor(null);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const returnAsset = async (a: Asset) => {
    const cur = current(a);
    if (!cur) return;
    const cond = prompt(
      `Return ${a.assetName} (${a.assetTag}) from ${cur.employee?.firstName || 'employee'}.\n\nCondition on return: NEW, GOOD, FAIR or DAMAGED`,
      'GOOD',
    );
    if (cond === null) return;
    const condition = cond.trim().toUpperCase();
    if (!CONDITIONS.includes(condition)) return alert('Please enter NEW, GOOD, FAIR or DAMAGED.');
    try {
      await post(`/api/assets/${cur.id}/return`, { condition });
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteAsset = async (a: Asset) => {
    if (!confirm(`Delete ${a.assetName} (${a.assetTag}) and its history? This cannot be undone.`)) return;
    const res = await fetch(`/api/assets/${a.id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || 'Could not delete');
    await load();
  };

  const readCsv = (file?: File | null) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setImportResult({ error: 'Please choose a .csv file (in Excel: File > Save As > CSV UTF-8).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setCsvName(file.name);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setSaving(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });
      const d = await res.json().catch(() => ({}));
      setImportResult(res.ok ? d : { error: d.error || 'Import failed' });
      if (res.ok) await load();
    } catch (err: any) {
      setImportResult({ error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assets-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Employee view: My Assets ----------
  if (!isManager) {
    return (
      <DashboardLayout title="My Assets" subtitle="Company equipment currently issued to you">
        <div className="space-y-4">
          {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}
          {loading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : assets.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No company assets are issued to you right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assets.map((a) => {
                const cur = current(a);
                return (
                  <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <Laptop className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{a.assetName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{a.assetTag}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>Type: {catLabel(a.category)}</div>
                      {a.serialNumber && <div>Serial: <span className="font-mono">{a.serialNumber}</span></div>}
                      {cur && <div>Issued: {fmtDate(cur.assignedDate)} · Condition: {cur.condition}</div>}
                      {a.warrantyExpiry && <div>Warranty until: {fmtDate(a.warrantyExpiry)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ---------- HR / owner view: inventory ----------
  return (
    <DashboardLayout title="Assets" subtitle="Company equipment inventory · assign, return and bulk import">
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total assets" value={String(assets.length)} />
          <Stat label="Assigned" value={String(count('ASSIGNED'))} tone="text-indigo-600" />
          <Stat label="Available" value={String(count('AVAILABLE'))} tone="text-emerald-600" />
          <Stat label="Total value" value={inr(totalValue)} tone="text-slate-900" />
        </div>

        <div className="flex flex-col lg:flex-row justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, tag, serial, employee…"
                className="w-64 pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
              <option value="ALL">All categories</option>
              {CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2">
              <option value="ALL">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_REPAIR">Under repair</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCsvText('');
                setCsvName('');
                setImportResult(null);
                setImportOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs rounded-xl flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Bulk import (CSV)
            </button>
            <button
              onClick={() => {
                setAssetForm(emptyAsset);
                setFormError(null);
                setAddOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add asset
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Serial</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4">Warranty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned to</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading…</td></tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      {assets.length === 0 ? 'No assets yet. Use “Add asset” or “Bulk import (CSV)”.' : 'No assets match these filters.'}
                    </td>
                  </tr>
                ) : (
                  shown.map((a) => {
                    const cur = current(a);
                    const warrantyOver = a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date();
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{a.assetName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{a.assetTag}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{catLabel(a.category)}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{a.serialNumber || '—'}</td>
                        <td className="py-3 px-4 text-slate-800">{a.purchaseCost != null ? inr(a.purchaseCost) : '—'}</td>
                        <td className={`py-3 px-4 ${warrantyOver ? 'text-rose-600' : 'text-slate-600'}`}>
                          {a.warrantyExpiry ? `${fmtDate(a.warrantyExpiry)}${warrantyOver ? ' (expired)' : ''}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_CLS[a.status] || STATUS_CLS.RETIRED}`}>
                            {a.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {cur?.employee ? (
                            <>
                              <div className="font-medium text-slate-800">{cur.employee.firstName} {cur.employee.lastName}</div>
                              <div className="text-[10px] text-slate-400">since {fmtDate(cur.assignedDate)} · {cur.condition}</div>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {a.status === 'AVAILABLE' && (
                            <button
                              onClick={() => {
                                setAssignFor(a);
                                setAssignForm({ employeeId: '', condition: 'GOOD', notes: '' });
                                setFormError(null);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium inline-flex items-center gap-1"
                            >
                              <UserPlus className="h-3 w-3" /> Assign
                            </button>
                          )}
                          {a.status === 'ASSIGNED' && cur && (
                            <button
                              onClick={() => returnAsset(a)}
                              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium inline-flex items-center gap-1"
                            >
                              <Undo2 className="h-3 w-3" /> Return
                            </button>
                          )}
                          {a.status !== 'ASSIGNED' && (
                            <button onClick={() => deleteAsset(a)} title="Delete" className="ml-1 p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 align-middle">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add asset */}
      {addOpen && (
        <Modal title="Add asset" onClose={() => setAddOpen(false)}>
          <form onSubmit={addAsset} className="space-y-3 text-xs">
            <Field label="Asset name *">
              <input required value={assetForm.assetName} onChange={(e) => setAssetForm({ ...assetForm, assetName: e.target.value })} className="inp" placeholder="e.g. Dell Latitude 5440" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category *">
                <select value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} className="inp">
                  {CATEGORIES.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Asset tag (blank = automatic)">
                <input value={assetForm.assetTag} onChange={(e) => setAssetForm({ ...assetForm, assetTag: e.target.value })} className="inp uppercase" placeholder="AST-0001" />
              </Field>
              <Field label="Serial number">
                <input value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} className="inp" />
              </Field>
              <Field label="Purchase cost (₹)">
                <input type="number" min="0" value={assetForm.purchaseCost} onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })} className="inp" />
              </Field>
              <Field label="Purchase date">
                <input type="date" value={assetForm.purchaseDate} onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })} className="inp" />
              </Field>
              <Field label="Warranty until">
                <input type="date" value={assetForm.warrantyExpiry} onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })} className="inp" />
              </Field>
            </div>
            {formError && <Err msg={formError} />}
            <Buttons saving={saving} label="Add asset" onCancel={() => setAddOpen(false)} />
          </form>
        </Modal>
      )}

      {/* Assign */}
      {assignFor && (
        <Modal title={`Assign ${assignFor.assetName}`} onClose={() => setAssignFor(null)}>
          <form onSubmit={assign} className="space-y-3 text-xs">
            <div className="text-slate-500 font-mono">{assignFor.assetTag}{assignFor.serialNumber ? ` · ${assignFor.serialNumber}` : ''}</div>
            <Field label="Employee *">
              <select required value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })} className="inp">
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                ))}
              </select>
            </Field>
            <Field label="Condition at handover">
              <select value={assignForm.condition} onChange={(e) => setAssignForm({ ...assignForm, condition: e.target.value })} className="inp">
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <input value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} className="inp" placeholder="e.g. with charger and bag" />
            </Field>
            {formError && <Err msg={formError} />}
            <Buttons saving={saving} label="Assign" onCancel={() => setAssignFor(null)} />
          </form>
        </Modal>
      )}

      {/* Bulk import */}
      {importOpen && (
        <Modal title="Bulk import assets (CSV)" onClose={() => setImportOpen(false)} wide>
          <div className="space-y-3 text-xs">
            <p className="text-slate-500">
              One row per asset. Only <code>assetName</code> is required. Optional: <code>assetTag</code> (blank = automatic AST-0001…),{' '}
              <code>category</code> (Laptop, Desktop, Monitor, Phone, Accessory, Software License, Other), <code>serialNumber</code>,{' '}
              <code>purchaseDate</code>, <code>warrantyExpiry</code> (YYYY-MM-DD or DD/MM/YYYY), <code>purchaseCost</code>, <code>branch</code>,{' '}
              <code>assignTo</code> (employee email or code — assigns it right away) and <code>condition</code> (NEW/GOOD/FAIR/DAMAGED).
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadTemplate} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Download template
              </button>
            </div>
            <label
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); readCsv(e.dataTransfer.files?.[0]); }}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer text-center transition-all ${
                dragOver ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
              }`}
            >
              <Upload className={`h-7 w-7 mb-1.5 ${dragOver ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="font-semibold text-slate-700">
                {dragOver ? 'Drop the CSV here' : csvName ? `Loaded: ${csvName} — click or drop to replace` : 'Click to choose or drag & drop your CSV file'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">In Excel: File → Save As → CSV UTF-8</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { readCsv(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="…or paste CSV here: assetName,category,serialNumber,purchaseCost"
              className="w-full p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl"
            />
            {importResult && (
              <div className={`p-3 rounded-xl border ${importResult.error ? 'bg-rose-50 border-rose-200 text-rose-800' : importResult.failedCount ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="font-semibold flex items-center gap-1.5">
                  {importResult.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  {importResult.error
                    ? importResult.error
                    : `Added ${importResult.importedCount} of ${importResult.totalProcessed} assets${importResult.assignedCount ? ` (${importResult.assignedCount} assigned to employees)` : ''}.`}
                </div>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto text-rose-700">
                    {importResult.errors.map((er: any, i: number) => (
                      <div key={i}>• Row {er.row}: {er.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Close</button>
              <button disabled={saving || !csvText.trim()} onClick={runImport} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
                {saving ? 'Importing…' : 'Import assets'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`.inp{width:100%;padding:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem}`}</style>
    </DashboardLayout>
  );
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <span className="text-xs text-slate-500 block">{label}</span>
      <span className={`text-2xl font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-medium text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5">
      <AlertCircle className="h-4 w-4 shrink-0" /> {msg}
    </div>
  );
}

function Buttons({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
      <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <Laptop className="h-5 w-5 text-emerald-600" /> {title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
