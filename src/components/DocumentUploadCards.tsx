'use client';

import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Eye, Download, ShieldCheck, XCircle } from 'lucide-react';

export type DocType = { key: string; label: string; required: boolean; hint: string; multiple?: boolean };
export type UploadRow = {
  id: string;
  docType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export function StatusChip({ status }: { status?: string }) {
  if (status === 'VERIFIED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="h-3 w-3" /> VERIFIED
      </span>
    );
  if (status === 'REJECTED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="h-3 w-3" /> REJECTED
      </span>
    );
  if (status === 'SUBMITTED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="h-3 w-3" /> UPLOADED · AWAITING HR
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
      NOT UPLOADED
    </span>
  );
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * One card per document type. Used by the employee ("My Onboarding") and by HR ("Employee Documents").
 * `employeeId` is passed only when HR uploads on someone's behalf.
 */
export function DocumentUploadCards({
  docTypes,
  uploads,
  employeeId,
  reviewer,
  onChanged,
}: {
  docTypes: DocType[];
  uploads: UploadRow[];
  employeeId?: string;
  reviewer?: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (docType: string, file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'err', text: `${file.name} is larger than 5 MB.` });
      return;
    }
    setBusy(docType);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      if (employeeId) fd.append('employeeId', employeeId);
      const res = await fetch('/api/employee-documents', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage({ type: 'ok', text: `${docTypes.find((d) => d.key === docType)?.label} uploaded.` });
      await onChanged();
    } catch (e: any) {
      setMessage({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const review = async (id: string, action: 'VERIFY' | 'REJECT') => {
    let note = '';
    if (action === 'REJECT') {
      const r = prompt('Why is this document rejected? The employee will see this reason.');
      if (r === null) return;
      if (!r.trim()) {
        alert('Please enter a reason.');
        return;
      }
      note = r;
    }
    setBusy(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/employee-documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await onChanged();
    } catch (e: any) {
      setMessage({ type: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docTypes.map((dt) => {
          const files = uploads.filter((u) => u.docType === dt.key);
          const current = files[0];
          const locked = !reviewer && !dt.multiple && current?.status === 'VERIFIED';
          return (
            <div key={dt.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    {dt.label}
                    {dt.required && <span className="text-rose-500">*</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{dt.hint}</div>
                </div>
                {!dt.multiple && <StatusChip status={current?.status} />}
                {dt.multiple && dt.required && files.length === 0 && <StatusChip />}
              </div>

              {files.map((f) => (
                <div key={f.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{f.fileName}</div>
                      <div className="text-[10px] text-slate-400">
                        {kb(f.sizeBytes)} · uploaded {format(new Date(f.createdAt), 'dd MMM yyyy, hh:mm a')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/api/employee-documents/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600"
                        title="View"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`/api/employee-documents/${f.id}?download=1`}
                        className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  {dt.multiple && <StatusChip status={f.status} />}
                  {f.status === 'REJECTED' && f.reviewNote && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">
                      <strong>HR note:</strong> {f.reviewNote} — please upload a corrected file.
                    </div>
                  )}
                  {reviewer && (
                    <div className="flex gap-1.5 pt-0.5">
                      {f.status !== 'VERIFIED' && (
                        <button
                          disabled={busy === f.id}
                          onClick={() => review(f.id, 'VERIFY')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-medium flex items-center gap-1"
                        >
                          <ShieldCheck className="h-3 w-3" /> Verify
                        </button>
                      )}
                      {f.status !== 'REJECTED' && (
                        <button
                          disabled={busy === f.id}
                          onClick={() => review(f.id, 'REJECT')}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-medium flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {locked ? (
                <div className="text-[11px] text-slate-500">Verified by HR. Contact HR if it needs to change.</div>
              ) : (
                <>
                  <input
                    ref={(el) => {
                      inputs.current[dt.key] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      upload(dt.key, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    disabled={busy === dt.key}
                    onClick={() => inputs.current[dt.key]?.click()}
                    className="w-full px-3 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {busy === dt.key
                      ? 'Uploading…'
                      : dt.multiple
                      ? 'Upload a document'
                      : current
                      ? 'Replace file'
                      : 'Upload file'}
                  </button>
                  <div className="text-[10px] text-slate-400 text-center">PDF, JPG or PNG · max 5 MB</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
