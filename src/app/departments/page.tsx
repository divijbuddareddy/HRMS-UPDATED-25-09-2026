'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { Building2, Plus, Pencil, Trash2, Users, Crown, Check, X, AlertCircle } from 'lucide-react';

type Dept = {
  id: string;
  name: string;
  code: string;
  employeeCount: number;
  headEmployeeId: string | null;
  head: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
};

const STANDARD = ['SALES', 'MARKETING', 'FINANCE', 'IT', 'ENGINEERING', 'HR', 'OPERATIONS', 'ADMIN', 'SUPPORT', 'PRODUCT', 'DESIGN', 'LEGAL', 'PROCUREMENT', 'MANAGEMENT'];

export default function DepartmentsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'org:manage');
  const [depts, setDepts] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [oRes, eRes] = await Promise.all([fetch('/api/organization'), fetch('/api/employees')]);
      const o = await oRes.json();
      if (!oRes.ok) throw new Error(o.error || 'Could not load departments');
      setDepts(o.departments || []);
      if (eRes.ok) setEmployees(((await eRes.json()).employees || []).filter((e: any) => !['EXITED', 'ARCHIVED'].includes(e.status)));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const patch = async (d: Dept, body: any) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/organization/departments/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Update failed');
      if (body.headEmployeeId) {
        setMsg({
          ok: true,
          text: `Head of ${d.name} updated.${r.reportingAssigned ? ` ${r.reportingAssigned} employee(s) without a manager now report to them.` : ''}`,
        });
      } else if (body.name) {
        setMsg({ ok: true, text: `Renamed to “${body.name}”.` });
      }
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
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DEPARTMENT', data: { name: newName.trim() } }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Could not add department');
      setNewName('');
      setMsg({ ok: true, text: `Department “${r.name}” is ready.` });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Dept) => {
    if (!confirm(`Delete the department “${d.name}”?`)) return;
    const res = await fetch(`/api/organization/departments/${d.id}`, { method: 'DELETE' });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: r.error || 'Could not delete' });
    setMsg({ ok: true, text: `Deleted “${d.name}”.` });
    await load();
  };

  const totalPeople = depts.reduce((a, d) => a + d.employeeCount, 0);
  const withHead = depts.filter((d) => d.head).length;

  return (
    <DashboardLayout title="Departments" subtitle="Company departments, their heads, and default reporting">
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900">How departments and reporting work</div>
          <div>• Each department has a <strong>Head</strong>. Employees in the department report to the head by default.</div>
          <div>
            • New employees, bulk-imported employees and people moved into a department get the head as their Reporting Manager automatically. HR can still choose a
            different manager in <Link href="/employees" className="underline font-medium">Employees → Edit</Link>.
          </div>
          <div>• Heads automatically get manager access for their people: approvals, team attendance, goals.</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat icon={<Building2 className="h-5 w-5" />} label="Departments" value={depts.length} />
          <Stat icon={<Crown className="h-5 w-5" />} label="With a head" value={`${withHead} / ${depts.length}`} />
          <Stat icon={<Users className="h-5 w-5" />} label="People" value={totalPeople} />
        </div>

        {msg && (
          <div className={`p-3 rounded-xl text-xs border flex items-center gap-1.5 ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {msg.ok ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
          </div>
        )}

        {canManage && (
          <form onSubmit={add} className="flex gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add another department, e.g. Quality Assurance"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button disabled={busy || !newName.trim()} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add department
            </button>
          </form>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">People</th>
                  <th className="py-3 px-4">Department head (default manager)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="py-10 text-center text-slate-400">Loading…</td></tr>
                ) : (
                  depts.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        {editing === d.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                            />
                            <button
                              onClick={async () => {
                                await patch(d, { name: editName });
                                setEditing(null);
                              }}
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-slate-900">{d.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{d.code}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{d.employeeCount}</td>
                      <td className="py-3 px-4">
                        {canManage ? (
                          <select
                            disabled={busy}
                            value={d.headEmployeeId || ''}
                            onChange={(e) => patch(d, { headEmployeeId: e.target.value })}
                            className="w-64 max-w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">— No head —</option>
                            {employees.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.firstName} {e.lastName} ({e.employeeCode}){e.departmentId === d.id ? '' : ` · ${e.department?.name || 'other dept'}`}
                              </option>
                            ))}
                          </select>
                        ) : d.head ? (
                          `${d.head.firstName} ${d.head.lastName}`
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {canManage && (
                          <>
                            <button
                              onClick={() => {
                                setEditing(d.id);
                                setEditName(d.name);
                              }}
                              title="Rename"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {!STANDARD.includes(d.code.toUpperCase()) && d.employeeCount === 0 && (
                              <button onClick={() => remove(d)} title="Delete" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
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
    </DashboardLayout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">{icon}</div>
      <div>
        <div className="text-xl font-bold text-slate-900">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}
