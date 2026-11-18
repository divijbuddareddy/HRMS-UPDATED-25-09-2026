'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { DocumentUploadCards, DocType, UploadRow } from '@/components/DocumentUploadCards';
import { ClipboardCheck } from 'lucide-react';

export default function MyOnboardingPage() {
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/employee-documents');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load your documents');
      setDocTypes(data.docTypes || []);
      // HR with their own profile get the overview shape; take their own uploads from it.
      setUploads(data.uploads || data.employees?.find((e: any) => e.id === user?.employee?.id)?.uploads || []);
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
  const done = required.filter((d) => uploads.some((u) => u.docType === d.key && u.status !== 'REJECTED')).length;
  const verified = required.filter((d) => uploads.some((u) => u.docType === d.key && u.status === 'VERIFIED')).length;

  return (
    <DashboardLayout title="My Onboarding" subtitle="Upload your joining documents for HR verification">
      <div className="space-y-6 max-w-4xl">
        {!user?.employee?.id ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm text-slate-600">
            Your login is not linked to an employee profile, so there is nothing to upload here.
          </div>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {done === required.length && required.length > 0
                      ? verified === required.length
                        ? 'All documents verified by HR'
                        : 'All documents uploaded — HR will verify them'
                      : `${done} of ${required.length} required documents uploaded`}
                  </div>
                  <div className="text-xs text-slate-500">
                    Upload a clear PDF or photo of each document. HR can see them once uploaded.
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-48">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${required.length ? (done / required.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1 text-right">
                  {verified}/{required.length} verified
                </div>
              </div>
            </div>

            {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}
            {loading ? (
              <div className="text-sm text-slate-400">Loading…</div>
            ) : (
              <DocumentUploadCards docTypes={docTypes} uploads={uploads} onChanged={load} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
