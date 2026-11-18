'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { DocumentUploadCards, DocType, StatusChip, UploadRow } from '@/components/DocumentUploadCards';
import { Search, X, FolderOpen, Settings2 } from 'lucide-react';
import { OnboardingDocSettings } from '@/components/OnboardingDocSettings';

type EmpRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workEmail: string;
  department?: { name: string } | null;
  uploads: UploadRow[];
};

export default function EmployeeDocumentsPage() {
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'TO_REVIEW' | 'MISSING' | 'COMPLETE'>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/employee-documents');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load documents');
      if (!data.employees) throw new Error('Only HR or the company owner can see all employee documents.');
      setDocTypes(data.docTypes || []);
      setEmployees(data.employees);
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

  const required = docTypes.filter((d) => d.required);
  const latest = (e: EmpRow, key: string) => e.uploads.find((u) => u.docType === key);
  const summary = (e: EmpRow) => {
    const states = required.map((d) => latest(e, d.key)?.status);
    return {
      missing: states.filter((s) => !s || s === 'REJECTED').length,
      toReview: e.uploads.filter((u) => u.status === 'SUBMITTED').length,
      verified: states.filter((s) => s === 'VERIFIED').length,
    };
  };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const s = summary(e);
      if (filter === 'TO_REVIEW' && s.toReview === 0) return false;
      if (filter === 'MISSING' && s.missing === 0) return false;
      if (filter === 'COMPLETE' && s.verified !== required.length) return false;
      return (
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.workEmail.toLowerCase().includes(q)
      );
    });
  }, [employees, search, filter, docTypes]);

  const toReviewTotal = employees.reduce((a, e) => a + summary(e).toReview, 0);
  const open = employees.find((e) => e.id === openId) || null;

  return (
    <DashboardLayout title="Employee Documents" subtitle="Onboarding documents uploaded by employees — view, verify or reject">
      <div className="space-y-5">
        {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, email…"
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1"
            >
              <Settings2 className="h-3.5 w-3.5" /> Choose documents
            </button>
            {(
              [
                ['ALL', 'All'],
                ['TO_REVIEW', `To review${toReviewTotal ? ` (${toReviewTotal})` : ''}`],
                ['MISSING', 'Missing documents'],
                ['COMPLETE', 'All verified'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  {required.map((d) => (
                    <th key={d.key} className="py-3 px-4">
                      {d.label}
                    </th>
                  ))}
                  <th className="py-3 px-4">Other</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={required.length + 3} className="py-8 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={required.length + 3} className="py-8 text-center text-slate-400">
                      No employees match.
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {e.firstName} {e.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {e.employeeCode}
                          {e.department?.name ? ` · ${e.department.name}` : ''}
                        </div>
                      </td>
                      {required.map((d) => (
                        <td key={d.key} className="py-3 px-4">
                          <StatusChip status={latest(e, d.key)?.status} />
                        </td>
                      ))}
                      <td className="py-3 px-4 text-slate-500">{e.uploads.filter((u) => u.docType === 'OTHER').length || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setOpenId(e.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-medium inline-flex items-center gap-1"
                        >
                          <FolderOpen className="h-3.5 w-3.5" /> Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {docTypes.length > 0 && (
          <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
            <strong>Your company asks for:</strong>{' '}
            {docTypes.filter((d) => d.key !== 'OTHER').map((d) => `${d.label}${d.required ? '' : ' (optional)'}`).join(', ') || 'nothing yet'}
          </div>
        )}

        {settingsOpen && <OnboardingDocSettings onClose={() => setSettingsOpen(false)} onSaved={load} />}

        {open && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-base">
                    {open.firstName} {open.lastName}
                  </h3>
                  <div className="text-xs text-slate-500">
                    {open.employeeCode} · {open.workEmail}
                  </div>
                </div>
                <button onClick={() => setOpenId(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <DocumentUploadCards
                docTypes={docTypes}
                uploads={open.uploads}
                employeeId={open.id}
                reviewer
                onChanged={load}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
