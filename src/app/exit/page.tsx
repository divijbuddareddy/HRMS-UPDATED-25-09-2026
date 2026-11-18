'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { X, LogOut, Check, CheckCircle2, Clock, XCircle, Undo2, Plus, Zap, AlertCircle, UserCheck, Users } from 'lucide-react';

type Perms = { canManagerDecide: boolean; canHrDecide: boolean; canWithdraw: boolean; canSettle: boolean };
type Exit = {
  id: string;
  employeeId: string;
  resignationDate: string;
  requestedLwd: string;
  approvedLwd: string;
  reason: string;
  reasonCategory: string;
  status: string;
  managerApproval: string;
  managerDecidedAt: string | null;
  managerNote: string | null;
  hrApproval: string;
  hrDecidedAt: string | null;
  hrNote: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    joiningDate: string;
    noticePeriodDays: number;
    reportingManagerId: string | null;
    reportingManager?: { firstName: string; lastName: string } | null;
    department?: { name: string } | null;
    designation?: { title: string } | null;
  };
  settlement?: {
    payableDays: number;
    earnedSalaryAmount: number;
    leaveEncashmentDays: number;
    leaveEncashmentAmount: number;
    noticePayShortfallDays: number;
    noticeRecoveryAmount: number;
    gratuityAmount: number;
    finalSettlementAmount: number;
    status: string;
    settledAt: string | null;
  } | null;
  permissions: Perms;
};

const REASONS: [string, string][] = [
  ['BETTER_OPPORTUNITY', 'Better career opportunity'],
  ['CAREER_CHANGE', 'Higher studies / career change'],
  ['RELOCATION', 'Personal / relocation'],
  ['HEALTH_REASONS', 'Health / medical'],
  ['PERFORMANCE_EXIT', 'Performance separation'],
  ['MUTUAL_SEPARATION', 'Mutual separation'],
  ['OTHER', 'Other'],
];
const reasonLabel = (k: string) => REASONS.find(([v]) => v === k)?.[1] || k.replace(/_/g, ' ').toLowerCase();

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_MANAGER: { label: 'Waiting for manager', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDING_HR: { label: 'Waiting for HR', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  INITIATED: { label: 'Pending approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved · serving notice', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  CLEARANCE_IN_PROGRESS: { label: 'Clearance in progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  SETTLED: { label: 'Relieved & settled', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  WITHDRAWN: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};
const OPEN = ['PENDING_MANAGER', 'PENDING_HR', 'INITIATED', 'APPROVED', 'CLEARANCE_IN_PROGRESS'];
const d = (v?: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '—');
const inr = (n?: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const name = (e: Exit) => `${e.employee.firstName} ${e.employee.lastName}`;
const isoDay = (offsetDays: number) => format(new Date(Date.now() + offsetDays * 86400000), 'yyyy-MM-dd');

export default function ExitPage() {
  const { user } = useAuth();
  const canProcess = can(user, 'exit:process');
  const [exits, setExits] = useState<Exit[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [isHr, setIsHr] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resignOpen, setResignOpen] = useState<null | 'SELF' | 'HR'>(null);
  const [form, setForm] = useState({ employeeId: '', requestedLwd: isoDay(30), reasonCategory: 'BETTER_OPPORTUNITY', reason: '' });
  const [decideFor, setDecideFor] = useState<{ exit: Exit; stage: 'MANAGER' | 'HR'; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [decideForm, setDecideForm] = useState({ note: '', approvedLwd: '' });
  const [fnf, setFnf] = useState<Exit | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/exit/requests');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load resignations');
      setExits(data.exits || []);
      setMe(data.me);
      setIsHr(!!data.isHr);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    if (can(user, 'employees:manage')) {
      fetch('/api/employees')
        .then((r) => (r.ok ? r.json() : null))
        .then((x) => setEmployees((x?.employees || []).filter((e: any) => !['EXITED', 'ARCHIVED'].includes(e.status))))
        .catch(() => undefined);
    }
  }, [user]);

  const mine = exits.filter((e) => e.employeeId === me);
  const myOpen = mine.find((e) => OPEN.includes(e.status));
  const myHistory = mine.filter((e) => e !== myOpen);
  const toDecide = exits.filter((e) => e.permissions.canManagerDecide || e.permissions.canHrDecide);
  const others = useMemo(() => exits.filter((e) => e.employeeId !== me), [exits, me]);
  const showPipeline = isHr || canProcess || others.length > 0;

  const post = async (url: string, body: any) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await post('/api/exit/requests', resignOpen === 'SELF' ? { ...form, employeeId: undefined } : form);
      setResignOpen(null);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decideFor) return;
    if (decideFor.decision === 'REJECTED' && !decideForm.note.trim()) return setFormError('Please give a reason.');
    setSaving(true);
    setFormError(null);
    try {
      await post(`/api/exit/requests/${decideFor.exit.id}/decision`, {
        stage: decideFor.stage,
        decision: decideFor.decision,
        note: decideForm.note,
        approvedLwd: decideFor.stage === 'HR' && decideFor.decision === 'APPROVED' ? decideForm.approvedLwd : undefined,
      });
      setDecideFor(null);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (x: Exit) => {
    const self = x.employeeId === me;
    const r = prompt(
      self ? 'Withdraw your resignation? You will continue as an active employee.\n\nReason (optional):' : `Cancel the exit of ${name(x)}? They will return to active status.\n\nReason (optional):`,
    );
    if (r === null) return;
    try {
      await post(`/api/exit/requests/${x.id}/withdraw`, { reason: r });
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const calculate = async (x: Exit) => {
    setSaving(true);
    try {
      await post(`/api/exit/requests/${x.id}/calculate`, {});
      const res = await fetch('/api/exit/requests');
      const data = await res.json();
      setExits(data.exits || []);
      setFnf((data.exits || []).find((y: Exit) => y.id === x.id) || null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const settle = async (x: Exit) => {
    if (!confirm(`Approve the full & final payout for ${name(x)} and mark them as relieved? Their login will be deactivated.`)) return;
    try {
      await post(`/api/exit/requests/${x.id}/settle`, {});
      setFnf(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openDecide = (exit: Exit, stage: 'MANAGER' | 'HR', decision: 'APPROVED' | 'REJECTED') => {
    setDecideFor({ exit, stage, decision });
    setDecideForm({ note: '', approvedLwd: format(new Date(exit.approvedLwd || exit.requestedLwd), 'yyyy-MM-dd') });
    setFormError(null);
  };

  return (
    <DashboardLayout title="Resignation & Exit" subtitle="Resign, get manager and HR approval, withdraw, and full & final settlement">
      <div className="space-y-6">
        {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        {/* ---------------- My resignation ---------------- */}
        {user?.employee?.id && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <LogOut className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">My Resignation</h3>
                  <p className="text-xs text-slate-500">Approved by your reporting manager, then HR. You can withdraw it while it is pending.</p>
                </div>
              </div>
              {!myOpen && (
                <button
                  onClick={() => {
                    setForm({ employeeId: '', requestedLwd: isoDay(30), reasonCategory: 'BETTER_OPPORTUNITY', reason: '' });
                    setFormError(null);
                    setResignOpen('SELF');
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" /> Submit Resignation
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-xs text-slate-400">Loading…</div>
            ) : myOpen ? (
              <div className="space-y-4">
                <Timeline x={myOpen} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <Info k="Submitted" v={d(myOpen.resignationDate)} />
                  <Info k="Requested last day" v={d(myOpen.requestedLwd)} />
                  <Info k={myOpen.status === 'APPROVED' ? 'Approved last day' : 'Reason'} v={myOpen.status === 'APPROVED' ? d(myOpen.approvedLwd) : reasonLabel(myOpen.reasonCategory)} />
                </div>
                <Notes x={myOpen} />
                <div className="flex justify-end">
                  {myOpen.permissions.canWithdraw ? (
                    <button
                      onClick={() => withdraw(myOpen)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Withdraw resignation
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">Approved — to withdraw now, please ask HR to cancel it.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">You have no open resignation.</div>
            )}

            {myHistory.length > 0 && (
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">History</div>
                {myHistory.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Chip s={x.status} /> submitted {d(x.resignationDate)}
                    {x.status === 'WITHDRAWN' && x.withdrawnAt && <> · withdrawn {d(x.withdrawnAt)}</>}
                    {x.status === 'REJECTED' && (x.hrNote || x.managerNote) && <> · “{x.hrNote || x.managerNote}”</>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Awaiting my approval ---------------- */}
        {toDecide.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Waiting for your approval ({toDecide.length})</h3>
                <p className="text-xs text-slate-500">Resignations from your team (as manager) or company-wide (as HR)</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {toDecide.map((x) => {
                const stage = x.permissions.canManagerDecide ? 'MANAGER' : 'HR';
                return (
                  <div key={x.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="text-xs">
                      <div className="font-semibold text-slate-900">
                        {name(x)} <span className="font-normal text-slate-400 font-mono">({x.employee.employeeCode})</span>
                      </div>
                      <div className="text-slate-500">
                        {[x.employee.designation?.title, x.employee.department?.name].filter(Boolean).join(' · ')} · submitted {d(x.resignationDate)} · wants last day{' '}
                        <strong>{d(x.requestedLwd)}</strong>
                      </div>
                      <div className="text-slate-600 italic mt-0.5">
                        {reasonLabel(x.reasonCategory)} — “{x.reason}”
                      </div>
                      {stage === 'HR' && x.managerApproval === 'APPROVED' && (
                        <div className="text-[11px] text-emerald-700 mt-0.5">
                          ✓ Manager approved{x.managerNote ? `: “${x.managerNote}”` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase">{stage === 'MANAGER' ? 'Manager step' : 'HR final step'}</span>
                      <button onClick={() => openDecide(x, stage, 'APPROVED')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg">
                        Approve
                      </button>
                      <button onClick={() => openDecide(x, stage, 'REJECTED')} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs rounded-lg border border-rose-200">
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- Pipeline (managers: team; HR: everyone) ---------------- */}
        {showPipeline && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-500" /> {isHr || canProcess ? 'All resignations & exits' : 'My team’s resignations'}
              </h3>
              {(isHr || canProcess) && (
                <button
                  onClick={() => {
                    setForm({ employeeId: '', requestedLwd: isoDay(30), reasonCategory: 'MUTUAL_SEPARATION', reason: '' });
                    setFormError(null);
                    setResignOpen('HR');
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Initiate exit for an employee
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4">Last working day</th>
                      <th className="py-3 px-4">Manager</th>
                      <th className="py-3 px-4">HR</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {others.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">No resignations.</td>
                      </tr>
                    ) : (
                      others.map((x) => (
                        <tr key={x.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{name(x)}</div>
                            <div className="text-[11px] text-slate-400">
                              {x.employee.employeeCode}
                              {x.employee.designation?.title ? ` · ${x.employee.designation.title}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{d(x.resignationDate)}</td>
                          <td className="py-3 px-4 text-slate-800">{d(x.status === 'APPROVED' || x.status === 'SETTLED' ? x.approvedLwd : x.requestedLwd)}</td>
                          <td className="py-3 px-4"><StepChip v={x.managerApproval} /></td>
                          <td className="py-3 px-4"><StepChip v={x.hrApproval} /></td>
                          <td className="py-3 px-4"><Chip s={x.status} /></td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            {x.permissions.canWithdraw && (
                              <button onClick={() => withdraw(x)} className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-medium">
                                Cancel exit
                              </button>
                            )}
                            {(x.permissions.canSettle || x.status === 'SETTLED') && canProcess && (
                              <button onClick={() => setFnf(x)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
                                F&amp;F
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
          </div>
        )}
      </div>

      {/* Submit / initiate */}
      {resignOpen && (
        <Modal title={resignOpen === 'SELF' ? 'Submit resignation' : 'Initiate exit for an employee'} onClose={() => setResignOpen(null)}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            {resignOpen === 'HR' ? (
              <Field label="Employee *">
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="inp">
                  <option value="">Select an employee…</option>
                  {employees
                    .filter((e) => e.id !== me)
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">An exit started by HR is approved immediately (no manager step).</p>
              </Field>
            ) : (
              <p className="text-slate-500">Your resignation goes to your reporting manager first, then HR. You can withdraw it until it is approved.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reason *">
                <select value={form.reasonCategory} onChange={(e) => setForm({ ...form, reasonCategory: e.target.value })} className="inp">
                  {REASONS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Requested last working day *">
                <input type="date" required min={isoDay(0)} value={form.requestedLwd} onChange={(e) => setForm({ ...form, requestedLwd: e.target.value })} className="inp" />
              </Field>
            </div>
            <Field label="Details *">
              <textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="inp" placeholder="Reason, handover plan, anything HR should know" />
            </Field>
            {formError && <Err msg={formError} />}
            <Buttons saving={saving} danger label={resignOpen === 'SELF' ? 'Submit resignation' : 'Initiate exit'} onCancel={() => setResignOpen(null)} />
          </form>
        </Modal>
      )}

      {/* Approve / reject */}
      {decideFor && (
        <Modal
          title={`${decideFor.decision === 'APPROVED' ? 'Approve' : 'Reject'} resignation — ${name(decideFor.exit)}`}
          onClose={() => setDecideFor(null)}
        >
          <form onSubmit={decide} className="space-y-3 text-xs">
            <p className="text-slate-500">
              {decideFor.stage === 'MANAGER'
                ? decideFor.decision === 'APPROVED'
                  ? 'As reporting manager. After your approval it goes to HR for the final approval.'
                  : 'As reporting manager. The employee will see your reason.'
                : decideFor.decision === 'APPROVED'
                ? 'Final HR approval. The notice period starts and the employee works until the last working day below.'
                : 'Final HR decision. The employee will see your reason.'}
            </p>
            {decideFor.stage === 'HR' && decideFor.decision === 'APPROVED' && (
              <Field label="Approved last working day">
                <input type="date" required value={decideForm.approvedLwd} onChange={(e) => setDecideForm({ ...decideForm, approvedLwd: e.target.value })} className="inp" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Requested: {d(decideFor.exit.requestedLwd)} · Notice period: {decideFor.exit.employee.noticePeriodDays} days
                </p>
              </Field>
            )}
            <Field label={decideFor.decision === 'REJECTED' ? 'Reason *' : 'Note (optional)'}>
              <textarea rows={2} required={decideFor.decision === 'REJECTED'} value={decideForm.note} onChange={(e) => setDecideForm({ ...decideForm, note: e.target.value })} className="inp" />
            </Field>
            {formError && <Err msg={formError} />}
            <Buttons saving={saving} danger={decideFor.decision === 'REJECTED'} label={decideFor.decision === 'APPROVED' ? 'Approve' : 'Reject'} onCancel={() => setDecideFor(null)} />
          </form>
        </Modal>
      )}

      {/* Full & final */}
      {fnf && (
        <Modal title={`Full & final settlement — ${name(fnf)}`} onClose={() => setFnf(null)} wide>
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Info k="Joined" v={d(fnf.employee.joiningDate)} />
              <Info k="Last working day" v={d(fnf.approvedLwd)} />
              <Info k="Notice period" v={`${fnf.employee.noticePeriodDays} days`} />
              <Info k="Status" v={<Chip s={fnf.status} />} />
            </div>
            {fnf.settlement ? (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                <Line k={`Earned salary (${fnf.settlement.payableDays} days)`} v={inr(fnf.settlement.earnedSalaryAmount)} />
                <Line k={`Leave encashment (${fnf.settlement.leaveEncashmentDays} days)`} v={`+ ${inr(fnf.settlement.leaveEncashmentAmount)}`} tone="text-emerald-700" />
                <Line k="Gratuity" v={`+ ${inr(fnf.settlement.gratuityAmount)}`} tone="text-emerald-700" />
                <Line k={`Notice recovery (${fnf.settlement.noticePayShortfallDays} days short)`} v={`− ${inr(fnf.settlement.noticeRecoveryAmount)}`} tone="text-rose-700" />
                <Line k="Net final settlement" v={inr(fnf.settlement.finalSettlementAmount)} bold />
              </div>
            ) : (
              <div className="p-5 text-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 mb-3">Calculate the settlement from salary, leave balance, gratuity and notice served.</p>
                <button disabled={saving} onClick={() => calculate(fnf)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> {saving ? 'Calculating…' : 'Calculate F&F'}
                </button>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {fnf.settlement && fnf.status !== 'SETTLED' && (
                <button onClick={() => calculate(fnf)} disabled={saving} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium">
                  Recalculate
                </button>
              )}
              {fnf.settlement && fnf.status !== 'SETTLED' && (
                <button onClick={() => settle(fnf)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Approve payout & relieve
                </button>
              )}
              {fnf.status === 'SETTLED' && (
                <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Settled {d(fnf.settlement?.settledAt)}
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      <style>{`.inp{width:100%;padding:.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:.5rem}`}</style>
    </DashboardLayout>
  );
}

function Timeline({ x }: { x: Exit }) {
  const mgrState = x.managerApproval;
  const steps: { label: string; sub: string; state: 'done' | 'current' | 'todo' | 'bad' | 'skip' }[] = [
    { label: 'Submitted', sub: d(x.resignationDate), state: 'done' },
    {
      label: 'Manager approval',
      sub:
        mgrState === 'NOT_REQUIRED'
          ? 'Not required'
          : x.employee.reportingManager
          ? `${x.employee.reportingManager.firstName} ${x.employee.reportingManager.lastName}`
          : 'Reporting manager',
      state: mgrState === 'APPROVED' ? 'done' : mgrState === 'REJECTED' ? 'bad' : mgrState === 'NOT_REQUIRED' ? 'skip' : 'current',
    },
    {
      label: 'HR approval',
      sub: x.hrApproval === 'APPROVED' ? d(x.hrDecidedAt) : 'HR',
      state: x.hrApproval === 'APPROVED' ? 'done' : x.hrApproval === 'REJECTED' ? 'bad' : x.status === 'PENDING_HR' ? 'current' : 'todo',
    },
    {
      label: 'Notice period',
      sub: x.status === 'APPROVED' || x.status === 'SETTLED' ? `until ${d(x.approvedLwd)}` : '—',
      state: x.status === 'SETTLED' ? 'done' : x.status === 'APPROVED' ? 'current' : 'todo',
    },
    { label: 'Relieved', sub: x.status === 'SETTLED' ? 'Done' : '—', state: x.status === 'SETTLED' ? 'done' : 'todo' },
  ];
  const dot: Record<string, string> = {
    done: 'bg-emerald-500 text-white',
    current: 'bg-amber-400 text-white',
    todo: 'bg-slate-200 text-slate-500',
    bad: 'bg-rose-500 text-white',
    skip: 'bg-slate-300 text-white',
  };
  return (
    <div className="flex flex-wrap gap-y-3">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${dot[s.state]}`}>
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" /> : s.state === 'bad' ? <XCircle className="h-3.5 w-3.5" /> : s.state === 'current' ? <Clock className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="text-xs leading-tight">
              <div className="font-semibold text-slate-800">{s.label}</div>
              <div className="text-[10px] text-slate-500">{s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && <div className="w-6 sm:w-10 h-px bg-slate-300 mx-2" />}
        </div>
      ))}
    </div>
  );
}

function Notes({ x }: { x: Exit }) {
  const items = [
    x.managerNote && { who: 'Manager', text: x.managerNote, bad: x.managerApproval === 'REJECTED' },
    x.hrNote && { who: 'HR', text: x.hrNote, bad: x.hrApproval === 'REJECTED' },
  ].filter(Boolean) as { who: string; text: string; bad: boolean }[];
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      {items.map((n) => (
        <div key={n.who} className={`text-[11px] p-2 rounded-lg border ${n.bad ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
          <strong>{n.who}:</strong> {n.text}
        </div>
      ))}
    </div>
  );
}

function Chip({ s }: { s: string }) {
  const st = STATUS[s] || { label: s, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>;
}

function StepChip({ v }: { v: string }) {
  if (v === 'APPROVED') return <span className="text-emerald-700 font-semibold inline-flex items-center gap-1"><Check className="h-3 w-3" /> Approved</span>;
  if (v === 'REJECTED') return <span className="text-rose-700 font-semibold">Rejected</span>;
  if (v === 'NOT_REQUIRED') return <span className="text-slate-400">Not required</span>;
  return <span className="text-amber-700">Pending</span>;
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
      <div className="text-[10px] text-slate-500 uppercase">{k}</div>
      <div className="text-slate-800 font-medium mt-0.5">{v}</div>
    </div>
  );
}

function Line({ k, v, tone = 'text-slate-800', bold }: { k: string; v: string; tone?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between p-3 ${bold ? 'bg-slate-50 text-sm' : ''}`}>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-600'}>{k}</span>
      <span className={`${bold ? 'font-extrabold text-emerald-700' : `font-semibold ${tone}`}`}>{v}</span>
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

function Buttons({ saving, label, onCancel, danger }: { saving: boolean; label: string; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
      <button type="submit" disabled={saving} className={`px-5 py-2 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50 text-white rounded-xl font-medium`}>
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
            <LogOut className="h-5 w-5 text-rose-600" /> {title}
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
