'use client';

import React, { useEffect, useState } from 'react';
import { useDayRollover } from '@/lib/useDayRollover';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  Clock,
  Calendar,
  Users,
  Banknote,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  ArrowRight,
  ShieldAlert,
  ClipboardCheck,
  Target,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { getPunchLocation, LocationError } from '@/lib/geo';
import { PunchLocation, LocationRequirementNote } from '@/components/attendance/PunchLocation';
import { MySkillsCard } from '@/components/MySkillsCard';

const TEAM_TODAY: Record<string, { label: string; cls: string }> = {
  WORKING: { label: 'Working', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOCKED_OUT: { label: 'Clocked out', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  ON_LEAVE: { label: 'On leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  LEAVE_PENDING: { label: 'Leave requested', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ABSENT: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  NOT_CLOCKED_IN: { label: 'Not clocked in', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};


export default function DashboardPage() {
  const { user } = useAuth();
  const [punchStatus, setPunchStatus] = useState<any>(null);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [employeesCount, setEmployeesCount] = useState<number>(0);
  const [punching, setPunching] = useState(false);
  const [punchMessage, setPunchMessage] = useState<string | null>(null);
  const [locationCheck, setLocationCheck] = useState(0);

  const activeRole = user?.activeRole || 'EMPLOYEE';
  const isManagerOrAdmin = ['PLATFORM_SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE', 'MANAGER'].includes(activeRole);
  const isManagerView = activeRole === 'MANAGER';

  // My Team: only the employees HR assigned to this user as Reporting Manager
  const [myTeam, setMyTeam] = useState<{ team: any[]; pendingLeave: number; pendingExpenses: number } | null>(null);

  const loadData = async () => {
    try {
      // 1. Fetch today's punch status
      if (user?.employee?.id) {
        const punchRes = await fetch('/api/attendance/punch');
        if (punchRes.ok) {
          const pData = await punchRes.json();
          setPunchStatus(pData);
        }

        // 2. Fetch leave balances
        const leaveRes = await fetch(`/api/leave/balances?employeeId=${user.employee.id}`);
        if (leaveRes.ok) {
          const lData = await leaveRes.json();
          setLeaveBalances(lData.balances || []);
        }

        // 3. Fetch monthly attendance summary
        const attRes = await fetch(`/api/attendance/records?employeeId=${user.employee.id}`);
        if (attRes.ok) {
          const aData = await attRes.json();
          setAttendanceSummary(aData.summary);
        }
      }

      // 4. My Team (reporting managers)
      if (user?.employee?.id) {
        const tRes = await fetch('/api/team/today');
        if (tRes.ok) setMyTeam(await tRes.json());
      }

      // 5. Fetch team pending requests if manager or admin
      if (isManagerOrAdmin) {
        const leaveReqRes = await fetch('/api/leave/requests?view=team');
        if (leaveReqRes.ok) {
          const lrData = await leaveReqRes.json();
          // Own requests are never in your approval queue
          setTeamRequests(
            lrData.requests?.filter((r: any) => r.status === 'PENDING' && r.employeeId !== user?.employee?.id) || [],
          );
        }

        const empRes = await fetch('/api/employees');
        if (empRes.ok) {
          const eData = await empRes.json();
          setEmployeesCount(eData.employees?.length || 0);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, activeRole]);

  useDayRollover(() => {
    loadData();
  });

  // Onboarding document progress for the logged-in employee
  const [docStatus, setDocStatus] = useState<{ required: number; uploaded: number; verified: number; rejected: number } | null>(null);
  useEffect(() => {
    if (!user?.employee?.id) return;
    fetch(`/api/employee-documents?employeeId=${user.employee.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.docTypes) return;
        const req = d.docTypes.filter((t: any) => t.required).map((t: any) => t.key);
        const latest = (k: string) => (d.uploads || []).find((u: any) => u.docType === k);
        setDocStatus({
          required: req.length,
          uploaded: req.filter((k: string) => latest(k) && latest(k).status !== 'REJECTED').length,
          verified: req.filter((k: string) => latest(k)?.status === 'VERIFIED').length,
          rejected: req.filter((k: string) => latest(k)?.status === 'REJECTED').length,
        });
      })
      .catch(() => undefined);
  }, [user?.employee?.id]);

  // Goals and review documents shared with the logged-in employee
  const [perf, setPerf] = useState<{ goals: any[]; documents: any[] } | null>(null);
  useEffect(() => {
    if (!user?.employee?.id) return;
    Promise.all([
      fetch('/api/performance/goals').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/performance/documents').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([g, d]) => setPerf({ goals: g?.goals || [], documents: d?.documents || [] }))
      .catch(() => undefined);
  }, [user?.employee?.id]);

  const handleQuickPunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunching(true);
    setPunchMessage(null);
    try {
      // Location is mandatory: if the employee blocks it, nothing is sent.
      let loc;
      try {
        setPunchMessage('Getting your location…');
        loc = await getPunchLocation();
      } catch (e: any) {
        setPunchMessage(e instanceof LocationError ? e.message : 'Your location could not be found. Please try again.');
        setLocationCheck((n) => n + 1);
        return;
      }
      setLocationCheck((n) => n + 1);
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punchType,
          deviceType: 'WEB',
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPunchMessage(data.message);
        await loadData();
      } else {
        setPunchMessage(data.error);
        await loadData(); // resync buttons with the server's state
      }
    } catch (err: any) {
      setPunchMessage(err.message);
    } finally {
      setPunching(false);
    }
  };

  const handleApproveLeave = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveRequestId: id,
          decision,
          notes: `${decision} from Dashboard quick-action`,
        }),
      });
      if (res.ok) {
        await loadData();
      } else {
        const d = await res.json();
        alert(d.error || 'Action failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.employee?.firstName || user?.email.split('@')[0]}!`}
      subtitle={`Tenant: ${user?.tenantName} • Role: ${activeRole.replace(/_/g, ' ')}`}
    >
      <div className="space-y-6">
        {/* Onboarding documents (employees) */}
        {docStatus && docStatus.verified < docStatus.required && (
          <Link
            href="/my-onboarding"
            className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm hover:bg-emerald-50/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">My Onboarding</h3>
                <p className="text-xs text-slate-500">
                  {docStatus.uploaded < docStatus.required
                    ? `Upload your joining documents: ${docStatus.uploaded} of ${docStatus.required} uploaded`
                    : `All documents uploaded: ${docStatus.verified} of ${docStatus.required} verified by HR`}
                  {docStatus.rejected > 0 ? ` · ${docStatus.rejected} rejected, please re-upload` : ''}
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-0.5 shrink-0">
              {docStatus.uploaded < docStatus.required || docStatus.rejected > 0 ? 'Upload' : 'View'} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        )}

        {/* My goals & review documents (employees) */}
        {perf && (perf.goals.length > 0 || perf.documents.length > 0) && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">My Goals & Reviews</h3>
                  <p className="text-xs text-slate-500">
                    {perf.goals.length} goal{perf.goals.length === 1 ? '' : 's'} · {perf.documents.length} document
                    {perf.documents.length === 1 ? '' : 's'} from your manager / HR
                  </p>
                </div>
              </div>
              <Link href="/performance" className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-0.5">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                {perf.goals.length === 0 && <div className="text-xs text-slate-400">No goals assigned yet.</div>}
                {perf.goals.slice(0, 4).map((g) => (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-700 font-medium truncate">{g.title}</span>
                      <span className="font-mono text-emerald-600 shrink-0">{g.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5" style={{ width: `${g.progressPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {perf.documents.length === 0 && <div className="text-xs text-slate-400">No documents shared yet.</div>}
                {perf.documents.slice(0, 4).map((d) => (
                  <a
                    key={d.id}
                    href={`/api/employee-documents/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-purple-50 border border-slate-100 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    <span className="text-slate-800 font-medium truncate">{d.title || d.fileName}</span>
                    <span className="text-[10px] text-slate-400 ml-auto shrink-0">{format(new Date(d.createdAt), 'dd MMM')}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top Summary Banner / Quick Punch */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Web Punch Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Today's Attendance</h3>
                  <p className="text-xs text-slate-500">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <MapPin className="h-3 w-3" /> Location on
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-3 text-xs space-y-2">
              {(['CHECK_IN', 'CHECK_OUT'] as const).map((type) => {
                const punch = (punchStatus?.rawPunches || []).find((p: any) => p.punchType === type);
                const time = type === 'CHECK_IN' ? punchStatus?.todayRecord?.firstCheckIn : punchStatus?.todayRecord?.lastCheckOut;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>{type === 'CHECK_IN' ? 'Check-In:' : 'Check-Out:'}</span>
                      <span className="font-semibold text-slate-900 font-mono">{time ? format(new Date(time), 'hh:mm a') : '—'}</span>
                    </div>
                    {punch && <PunchLocation punch={punch} office={punchStatus?.office} compact />}
                  </div>
                );
              })}
              <div className="flex justify-between text-slate-600">
                <span>Shift Status:</span>
                <span className="font-semibold text-emerald-600">
                  {punchStatus?.todayRecord?.status || 'NOT_STARTED'}
                </span>
              </div>
            </div>

            {!punchStatus?.hasCheckedOut && (
              <div className="mb-3">
                <LocationRequirementNote refreshKey={locationCheck} />
              </div>
            )}

            {punchMessage && (
              <div className="mb-3 text-xs p-2 rounded bg-slate-100 text-slate-800 border border-slate-200 font-medium">
                {punchMessage}
              </div>
            )}

            <div className="flex gap-2">
              <button
                disabled={punching || punchStatus?.hasCheckedIn}
                onClick={() => handleQuickPunch('CHECK_IN')}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
              >
                {punchStatus?.hasCheckedIn ? 'Checked In' : 'Clock In'}
              </button>
              <button
                disabled={punching || !punchStatus?.hasCheckedIn || punchStatus?.hasCheckedOut}
                onClick={() => handleQuickPunch('CHECK_OUT')}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
              >
                {punchStatus?.hasCheckedOut ? 'Checked Out' : 'Clock Out'}
              </button>
            </div>
          </div>

          {/* Leave Balances Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Leave Balances</h3>
                    <p className="text-xs text-slate-500">Ledger-derived live credits</p>
                  </div>
                </div>
                <Link href="/leave" className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-0.5">
                  Apply <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {leaveBalances.filter((lb) => lb.isPaid).slice(0, 3).map((lb) => (
                  <div key={lb.leaveTypeId} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">{lb.leaveTypeCode}</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">{lb.currentBalance}</div>
                    <div className="text-[10px] text-slate-400">Available</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
              <span>Next Holiday: <strong>Gandhi Jayanti</strong> (02 Oct)</span>
            </div>
          </div>

          {/* Quick Metrics / Month Tracker */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Monthly Snapshot</h3>
                <p className="text-xs text-slate-500">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Present Days</span>
                <span className="text-lg font-bold text-emerald-600">{attendanceSummary?.presentDays ?? '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Worked Hours</span>
                <span className="text-lg font-bold text-purple-600">{attendanceSummary?.totalWorkedHours ?? '—'}h</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Late Marks</span>
                <span className="text-lg font-bold text-amber-600">{attendanceSummary?.lateDays ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">LOP / Absent</span>
                <span className="text-lg font-bold text-rose-600">{attendanceSummary?.absentDays ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* My skills (employees) */}
        {user?.employee?.id && <MySkillsCard />}

        {/* Manager / Admin Section: Team Approvals & Headcount */}
        {/* My Team: only employees assigned to me as Reporting Manager */}
        {myTeam && myTeam.team.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">My Team ({myTeam.team.length})</h3>
                  <p className="text-xs text-slate-500">Employees who report to you · today&apos;s attendance</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {myTeam.team.filter((m) => m.today === 'WORKING' || m.today === 'CLOCKED_OUT').length} in today
                </span>
                <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                  {myTeam.team.filter((m) => m.today === 'ON_LEAVE').length} on leave
                </span>
                <Link href="/leave" className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:underline">
                  {myTeam.pendingLeave} leave to approve
                </Link>
                <Link href="/expenses" className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:underline">
                  {myTeam.pendingExpenses} expenses to approve
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTeam.team.map((m) => {
                const chip = TEAM_TODAY[m.today] || TEAM_TODAY.NOT_CLOCKED_IN;
                return (
                  <div key={m.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{m.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {[m.designation, m.department].filter(Boolean).join(' · ') || m.code}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {m.today === 'ON_LEAVE' && m.leaveType
                          ? m.leaveType
                          : m.firstCheckIn
                          ? `In ${format(new Date(m.firstCheckIn), 'hh:mm a')}${m.lastCheckOut ? ` · Out ${format(new Date(m.lastCheckOut), 'hh:mm a')}` : ''}${m.isLate ? ' · Late' : ''}`
                          : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${chip.cls}`}>{chip.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Link href="/attendance" className="text-emerald-600 font-medium hover:underline">Team attendance →</Link>
              <Link href="/performance" className="text-emerald-600 font-medium hover:underline">Team goals →</Link>
              <Link href="/employees" className="text-emerald-600 font-medium hover:underline">Team profiles →</Link>
            </div>
          </div>
        )}

        {isManagerOrAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Pending Approvals Queue */}
            <div className={`${isManagerView ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white rounded-2xl p-6 border border-slate-200 shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Pending Leave Approvals</h3>
                    <p className="text-xs text-slate-500">Leaves and Attendance Regularizations awaiting action</p>
                  </div>
                </div>
                <Link href="/leave" className="text-xs text-emerald-600 font-medium hover:underline">
                  View all in Leave Queue →
                </Link>
              </div>

              {teamRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/60" />
                  All caught up! No pending leave requests in your approval queue.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {teamRequests.map((req) => (
                    <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {req.employee?.firstName} {req.employee?.lastName}{' '}
                          <span className="font-normal text-slate-500 font-mono">({req.employee?.employeeCode})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {req.leaveType?.name} • {req.totalDays} Day(s) •{' '}
                          {format(new Date(req.startDate), 'dd MMM')} to {format(new Date(req.endDate), 'dd MMM')}
                        </div>
                        <div className="text-[11px] text-slate-600 italic mt-0.5">"{req.reason}"</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveLeave(req.id, 'APPROVED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveLeave(req.id, 'REJECTED')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs rounded-lg border border-rose-200 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Admin Summary (HR / owner only) */}
            {!isManagerView && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Organization Master</h3>
                  <p className="text-xs text-slate-500">Live tenant overview</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Total Active Employees</span>
                  <span className="text-base font-bold text-slate-900">{employeesCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Active Salary Structure</span>
                  <span className="text-xs font-semibold text-emerald-600">Standard Tech CTC</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600">Statutory Compliance</span>
                  <span className="text-xs font-semibold text-slate-800">EPF + ESI + PT + TDS</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/payroll"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Banknote className="h-4 w-4" />
                  <span>Run Monthly Payroll</span>
                </Link>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
