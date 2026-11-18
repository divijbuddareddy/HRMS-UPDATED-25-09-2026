'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Upload, FileText, Search, X, AlertCircle, CheckCircle, IndianRupee, History, Pencil } from 'lucide-react';

type Assignment = {
  id: string;
  ctc: number;
  grossSalary: number;
  netSalary: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  taxRegime: string;
  isCurrent: boolean;
  structure?: { name: string } | null;
};
type Row = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workEmail: string;
  joiningDate: string;
  department?: { name: string } | null;
  designation?: { title: string } | null;
  current: Assignment | null;
  upcoming: Assignment | null;
  history: Assignment[];
};

const inr = (n?: number | null) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);
const d = (v?: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '—');
const firstOfMonth = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
const TEMPLATE = `employeeEmail,annualCtc,effectiveFrom,taxRegime
amit@yourcompany.com,"6,00,000",${firstOfMonth()},NEW
EMP-2026-0002,900000,${firstOfMonth()},OLD
`;

export function SalariesTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ annualCtc: '', effectiveFrom: firstOfMonth(), taxRegime: 'NEW_REGIME' });
  const [history, setHistory] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvName, setCsvName] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/payroll/salaries');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load salaries');
      setRows(data.employees || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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
    return rows.filter((r) => {
      if (onlyMissing && (r.current || r.upcoming)) return false;
      return !q || `${r.firstName} ${r.lastName} ${r.employeeCode} ${r.workEmail}`.toLowerCase().includes(q);
    });
  }, [rows, search, onlyMissing]);

  const missing = rows.filter((r) => !r.current && !r.upcoming).length;
  const monthlyPayroll = rows.reduce((a, r) => a + (r.current ? r.current.ctc / 12 : 0), 0);

  const openEdit = (r: Row) => {
    setEdit(r);
    setForm({
      annualCtc: r.current ? String(Math.round(r.current.ctc)) : '',
      effectiveFrom: r.current ? firstOfMonth() : format(new Date(r.joiningDate), 'yyyy-MM-dd'),
      taxRegime: r.current?.taxRegime || 'NEW_REGIME',
    });
    setFormError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/payroll/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: edit.id, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save salary');
      setEdit(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const readCsv = (file?: File | null) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setResult({ error: 'Please choose a .csv file (in Excel: File > Save As > CSV UTF-8).' });
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setCsvName(file.name);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/payroll/salaries/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(res.ok ? data : { error: data.error || 'Upload failed' });
      if (res.ok) {
        await load();
        onChanged?.();
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salaries-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const estMonthly = parseFloat(form.annualCtc.replace(/[,\s]/g, '')) / 12;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Employees with a salary" value={`${rows.length - missing} / ${rows.length}`} />
        <Stat label="Missing salary (not paid in payroll)" value={String(missing)} tone={missing ? 'text-rose-600' : 'text-emerald-600'} />
        <Stat label="Monthly CTC (current)" value={inr(monthlyPayroll)} />
      </div>

      {missing > 0 && (
        <div className="p-3 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {missing} employee(s) have no salary, so payroll will skip them. Set it below or use Bulk upload.
        </div>
      )}
      {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

      <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, email…"
              className="w-60 pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only missing salary
          </label>
        </div>
        <button
          onClick={() => {
            setCsvText('');
            setCsvName('');
            setResult(null);
            setImportOpen(true);
          }}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" /> Bulk upload salaries (CSV)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Annual CTC</th>
                <th className="py-3 px-4">Monthly gross</th>
                <th className="py-3 px-4">Est. take-home</th>
                <th className="py-3 px-4">Tax regime</th>
                <th className="py-3 px-4">Effective from</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No employees match.</td></tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.firstName} {r.lastName}</div>
                      <div className="text-[11px] text-slate-400">
                        {r.employeeCode}
                        {r.designation?.title ? ` · ${r.designation.title}` : ''}
                      </div>
                    </td>
                    {r.current ? (
                      <>
                        <td className="py-3 px-4 font-semibold text-slate-900">{inr(r.current.ctc)}</td>
                        <td className="py-3 px-4 text-slate-700">{inr(r.current.grossSalary)}</td>
                        <td className="py-3 px-4 text-emerald-700">{inr(r.current.netSalary)}</td>
                        <td className="py-3 px-4 text-slate-600">{r.current.taxRegime === 'OLD_REGIME' ? 'Old' : 'New'}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {d(r.current.effectiveFrom)}
                          {r.upcoming && <div className="text-[10px] text-indigo-600">Revision {inr(r.upcoming.ctc)} from {d(r.upcoming.effectiveFrom)}</div>}
                        </td>
                      </>
                    ) : r.upcoming ? (
                      <td colSpan={5} className="py-3 px-4 text-indigo-700">
                        Starts {d(r.upcoming.effectiveFrom)} at {inr(r.upcoming.ctc)} per year
                      </td>
                    ) : (
                      <td colSpan={5} className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">NO SALARY SET</span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button onClick={() => openEdit(r)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium inline-flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> {r.current || r.upcoming ? 'Revise' : 'Set salary'}
                      </button>
                      {r.history.length > 0 && (
                        <button onClick={() => setHistory(r)} title="Salary history" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 align-middle">
                          <History className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Set / revise */}
      {edit && (
        <Modal title={`${edit.current ? 'Revise' : 'Set'} salary — ${edit.firstName} ${edit.lastName}`} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3 text-xs">
            {edit.current && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                Current: <strong>{inr(edit.current.ctc)}</strong> per year since {d(edit.current.effectiveFrom)}
              </div>
            )}
            <Field label="Annual CTC (₹) *">
              <input required inputMode="numeric" value={form.annualCtc} onChange={(e) => setForm({ ...form, annualCtc: e.target.value })} className="inp" placeholder="e.g. 600000" />
              {isFinite(estMonthly) && estMonthly > 0 && <div className="text-[10px] text-slate-500 mt-1">≈ {inr(estMonthly)} per month before deductions</div>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Effective from *">
                <input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="inp" />
              </Field>
              <Field label="Tax regime">
                <select value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })} className="inp">
                  <option value="NEW_REGIME">New regime</option>
                  <option value="OLD_REGIME">Old regime</option>
                </select>
              </Field>
            </div>
            <p className="text-[10px] text-slate-400">
              Payroll uses the salary in force for each month. A revision from a future date only applies from that month; an entry on the same date as an existing one corrects it.
            </p>
            {formError && <Err msg={formError} />}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
                {saving ? 'Saving…' : 'Save salary'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* History */}
      {history && (
        <Modal title={`Salary history — ${history.firstName} ${history.lastName}`} onClose={() => setHistory(null)}>
          <div className="divide-y divide-slate-100 text-xs">
            {history.history.map((h) => (
              <div key={h.id} className="py-2 flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{inr(h.ctc)} / year</div>
                  <div className="text-[11px] text-slate-500">
                    {d(h.effectiveFrom)} → {h.effectiveTo ? d(h.effectiveTo) : 'now'} · {h.taxRegime === 'OLD_REGIME' ? 'Old' : 'New'} regime
                  </div>
                </div>
                {h.isCurrent && <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CURRENT</span>}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Bulk upload */}
      {importOpen && (
        <Modal title="Bulk upload salaries (CSV)" onClose={() => setImportOpen(false)} wide>
          <div className="space-y-3 text-xs">
            <p className="text-slate-500">
              One row per employee: <code>employeeEmail</code> (or <code>employeeCode</code>), <code>annualCtc</code> (or <code>monthlyCtc</code>),
              optional <code>effectiveFrom</code> (YYYY-MM-DD or DD/MM/YYYY; blank = 1st of this month) and <code>taxRegime</code> (NEW / OLD).
              Amounts like “6,00,000” are fine.
            </p>
            <button type="button" onClick={downloadTemplate} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-medium inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Download template
            </button>
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
            <textarea rows={5} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="…or paste CSV here" className="w-full p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl" />
            {result && (
              <div className={`p-3 rounded-xl border ${result.error ? 'bg-rose-50 border-rose-200 text-rose-800' : result.failedCount ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="font-semibold flex items-center gap-1.5">
                  {result.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  {result.error ? result.error : `Saved ${result.appliedCount} of ${result.totalProcessed} salaries${result.correctedCount ? ` (${result.correctedCount} corrected)` : ''}.`}
                </div>
                {result.errors?.length > 0 && (
                  <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto text-rose-700">
                    {result.errors.map((er: any, i: number) => (
                      <div key={i}>• Row {er.row}: {er.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Close</button>
              <button disabled={saving || !csvText.trim()} onClick={runImport} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
                {saving ? 'Uploading…' : 'Upload salaries'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`.inp{width:100%;padding:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem}`}</style>
    </div>
  );
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><IndianRupee className="h-5 w-5" /></div>
      <div>
        <div className={`text-xl font-bold ${tone}`}>{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
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

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-600" /> {title}
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
