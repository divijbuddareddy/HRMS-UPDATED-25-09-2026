'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { X, Check, Plus, Receipt, AlertCircle, Clock, CheckCircle2, XCircle, Upload, Paperclip, Eye, Download, FileText } from 'lucide-react';

type Category = { id: string; name: string; code: string; maxLimit: number | null };
type Claim = {
  id: string;
  employeeId: string;
  employee?: { firstName: string; lastName: string; employeeCode: string } | null;
  category?: { name: string } | null;
  claimDate: string;
  amount: number;
  description: string;
  receiptUrl?: string | null;
  status: 'SUBMITTED' | 'MANAGER_APPROVED' | 'FINANCE_APPROVED' | 'REJECTED' | 'PAID';
  approverNotes?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  SUBMITTED: { label: 'Waiting for manager', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  MANAGER_APPROVED: { label: 'Waiting for finance', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  FINANCE_APPROVED: { label: 'Approved & paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  PAID: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => format(new Date(), 'yyyy-MM-dd');
const emptyForm = () => ({ categoryId: '', amount: '', claimDate: today(), merchant: '', description: '' });
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const isInternalFile = (u?: string | null) => !!u && u.startsWith('/api/employee-documents/');

export default function ExpensesPage() {
  const { user } = useAuth();
  const canL1 = can(user, 'expense:approve');
  const canL2 = can(user, 'expense:final-approve');
  const isApprover = canL1 || canL2;
  const hasProfile = !!user?.employee?.id;

  const [claims, setClaims] = useState<Claim[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'MINE' | 'TO_APPROVE' | 'ALL'>('MINE');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [acting, setActing] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const pickReceipt = (file?: File | null) => {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) && !/^(application\/pdf|image\/(jpeg|png))$/i.test(file.type)) {
      setFormError('Receipt must be a PDF, JPG or PNG file.');
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setFormError('Receipt is larger than 5 MB.');
      return;
    }
    setFormError(null);
    setReceipt(file);
  };

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

  const load = async () => {
    try {
      const [cRes, catRes] = await Promise.all([fetch('/api/expenses/claims'), fetch('/api/expenses/categories')]);
      const cData = await cRes.json().catch(() => ({}));
      const catData = await catRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(cData.error || 'Could not load expense claims');
      setClaims(cData.claims || []);
      setCategories(catData.categories || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setTab(hasProfile ? 'MINE' : isApprover ? 'TO_APPROVE' : 'MINE');
    load();
  }, [user]);

  const mine = claims.filter((c) => c.employeeId === user?.employee?.id);
  const others = claims.filter((c) => c.employeeId !== user?.employee?.id);
  const canActOn = (c: Claim) =>
    c.employeeId !== user?.employee?.id &&
    ((c.status === 'SUBMITTED' && canL1) || (c.status === 'MANAGER_APPROVED' && canL2));
  const toApprove = others.filter(canActOn);

  const shown = useMemo(() => (tab === 'MINE' ? mine : tab === 'TO_APPROVE' ? toApprove : others), [tab, claims]);

  const sum = (list: Claim[], f: (c: Claim) => boolean) => list.filter(f).reduce((a, c) => a + c.amount, 0);
  const scope = isApprover ? claims : mine;
  const pendingAmt = sum(scope, (c) => c.status === 'SUBMITTED' || c.status === 'MANAGER_APPROVED');
  const paidAmt = sum(scope, (c) => c.status === 'FINANCE_APPROVED' || c.status === 'PAID');

  const selectedCategory = categories.find((c) => c.id === form.categoryId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.categoryId) return setFormError('Choose an expense category.');
    const amount = parseFloat(form.amount);
    if (!isFinite(amount) || amount <= 0) return setFormError('Enter a valid amount.');
    if (selectedCategory?.maxLimit && amount > selectedCategory.maxLimit) {
      return setFormError(`${selectedCategory.name} claims are limited to ${inr(selectedCategory.maxLimit)}.`);
    }
    setSaving(true);
    try {
      const description = form.merchant.trim() ? `${form.merchant.trim()} — ${form.description.trim()}` : form.description.trim();
      const fd = new FormData();
      fd.append('expenseCategoryId', form.categoryId);
      fd.append('amount', String(amount));
      fd.append('claimDate', form.claimDate);
      fd.append('description', description);
      if (receipt) fd.append('receipt', receipt);
      const res = await fetch('/api/expenses/claims', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not submit the claim');
      setShowNew(false);
      setForm(emptyForm());
      setReceipt(null);
      setTab('MINE');
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (c: Claim, decision: 'APPROVED' | 'REJECTED') => {
    let notes = '';
    if (decision === 'REJECTED') {
      const r = prompt('Reason for rejecting this claim (the employee will see it):');
      if (r === null) return;
      if (!r.trim()) return alert('Please enter a reason.');
      notes = r.trim();
    }
    setActing(true);
    try {
      const res = await fetch(`/api/expenses/claims/${c.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: c.status === 'MANAGER_APPROVED' ? 'FINANCE' : 'MANAGER', decision, notes }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setSelected(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  const StatusChip = ({ s }: { s: string }) => {
    const st = STATUS[s] || STATUS.SUBMITTED;
    const Icon = st.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>
        <Icon className="h-3 w-3" /> {st.label}
      </span>
    );
  };

  return (
    <DashboardLayout title="Expenses & Reimbursements" subtitle="Submit expense claims · Manager approval → Finance approval & payout">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">{isApprover ? 'Claims (all visible)' : 'My claims'}</span>
            <span className="text-2xl font-bold text-slate-900">{scope.length}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Pending approval</span>
            <span className="text-2xl font-bold text-amber-600">{inr(pendingAmt)}</span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Approved & paid</span>
            <span className="text-2xl font-bold text-emerald-600">{inr(paidAmt)}</span>
          </div>
        </div>

        {/* Tabs + action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {hasProfile && (
              <TabBtn active={tab === 'MINE'} onClick={() => setTab('MINE')}>
                My Claims ({mine.length})
              </TabBtn>
            )}
            {isApprover && (
              <TabBtn active={tab === 'TO_APPROVE'} onClick={() => setTab('TO_APPROVE')}>
                To Approve
                {toApprove.length > 0 && (
                  <span className="ml-1.5 px-1.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">{toApprove.length}</span>
                )}
              </TabBtn>
            )}
            {isApprover && (
              <TabBtn active={tab === 'ALL'} onClick={() => setTab('ALL')}>
                Team / All Claims ({others.length})
              </TabBtn>
            )}
          </div>
          {hasProfile && (
            <button
              onClick={() => {
                setForm(emptyForm());
                setReceipt(null);
                setFormError(null);
                setShowNew(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Submit Claim
            </button>
          )}
        </div>

        {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        {/* Claims table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  {tab !== 'MINE' && <th className="py-3 px-4">Employee</th>}
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Expense Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">Loading…</td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {tab === 'MINE' ? 'You have not submitted any claims yet.' : tab === 'TO_APPROVE' ? 'Nothing waiting for your approval.' : 'No claims yet.'}
                    </td>
                  </tr>
                ) : (
                  shown.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      {tab !== 'MINE' && (
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '—'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.employee?.employeeCode}</div>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium text-[11px]">
                          {c.category?.name || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        <div className="line-clamp-2">
                          {c.receiptUrl && <Paperclip className="inline h-3 w-3 mr-1 text-slate-400" />}
                          {c.description}
                        </div>
                        {c.status === 'REJECTED' && c.approverNotes && (
                          <div className="text-[11px] text-rose-600 mt-0.5">Reason: {c.approverNotes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{format(new Date(c.claimDate), 'dd MMM yyyy')}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{inr(c.amount)}</td>
                      <td className="py-3 px-4">
                        <StatusChip s={c.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelected(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            canActOn(c) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {canActOn(c) ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review modal */}
      {selected && (
        <Modal title="Expense claim" onClose={() => setSelected(null)}>
          <div className="space-y-2 text-xs">
            <Row k="Employee" v={selected.employee ? `${selected.employee.firstName} ${selected.employee.lastName} (${selected.employee.employeeCode})` : 'You'} />
            <Row k="Category" v={selected.category?.name || '—'} />
            <Row k="Amount" v={<span className="font-bold text-emerald-700 text-sm">{inr(selected.amount)}</span>} />
            <Row k="Expense date" v={format(new Date(selected.claimDate), 'dd MMM yyyy')} />
            <Row k="Submitted" v={format(new Date(selected.createdAt), 'dd MMM yyyy, hh:mm a')} />
            <Row k="Details" v={selected.description} />
            {selected.receiptUrl && (
              <Row
                k="Receipt"
                v={
                  isInternalFile(selected.receiptUrl) ? (
                    <span className="inline-flex items-center gap-3">
                      <a href={selected.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> View
                      </a>
                      <a href={`${selected.receiptUrl}?download=1`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </span>
                  ) : /^https?:\/\//i.test(selected.receiptUrl) ? (
                    <a href={selected.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                      Open receipt
                    </a>
                  ) : (
                    selected.receiptUrl
                  )
                }
              />
            )}
            <Row k="Status" v={<StatusChip s={selected.status} />} />
            {selected.approverNotes && <Row k="Approver note" v={selected.approverNotes} />}
          </div>
          {canActOn(selected) && (
            <div className="flex gap-2 pt-4 mt-2 border-t border-slate-100">
              <button
                disabled={acting}
                onClick={() => decide(selected, 'APPROVED')}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {selected.status === 'SUBMITTED' ? 'Approve (Manager, L1)' : 'Final approve & mark paid (Finance, L2)'}
              </button>
              <button
                disabled={acting}
                onClick={() => decide(selected, 'REJECTED')}
                className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs"
              >
                Reject
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* New claim modal */}
      {showNew && (
        <Modal title="Submit expense claim" onClose={() => setShowNew(false)}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Expense Category *</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.maxLimit ? ` (max ${inr(c.maxLimit)})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  placeholder="e.g. 1500"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  max={today()}
                  value={form.claimDate}
                  onChange={(e) => setForm({ ...form, claimDate: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Merchant / Vendor</label>
              <input
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                placeholder="e.g. Uber, Amazon, Hotel name"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">What was it for? *</label>
              <textarea
                required
                rows={2}
                maxLength={900}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                placeholder="e.g. Cab to client meeting in Whitefield"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 block mb-1">Receipt (PDF, JPG or PNG · max 5 MB)</label>
              {receipt ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{receipt.name}</div>
                      <div className="text-[10px] text-slate-500">{(receipt.size / 1024).toFixed(0)} KB</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setReceipt(null)} className="text-rose-600 font-semibold hover:underline shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickReceipt(e.dataTransfer.files?.[0]);
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer text-center transition-all ${
                    dragOver ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
                  }`}
                >
                  <Upload className={`h-6 w-6 mb-1.5 ${dragOver ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="font-semibold text-slate-700">
                    {dragOver ? 'Drop the receipt here' : 'Click to upload or drag & drop your receipt'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Photo of the bill or a PDF invoice</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      pickReceipt(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> {saving ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center ${
        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" /> {title}
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className="text-slate-800 text-right">{v}</span>
    </div>
  );
}
