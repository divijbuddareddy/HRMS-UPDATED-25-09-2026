'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import {
  Target,
  Award,
  Plus,
  X,
  Upload,
  FileText,
  Eye,
  Download,
  Trash2,
  Users,
  FolderOpen,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type Tab = 'MY_GOALS' | 'TEAM_GOALS' | 'DOCUMENTS' | 'APPRAISALS';

const GOAL_TEMPLATE = `employeeEmail,title,description,category,weight,target
amit@yourcompany.com,Ship the mobile app v2,Release to Play Store and App Store,OKR,40,Live by 31 Dec
amit@yourcompany.com,Reduce bug backlog,Close critical and high bugs,KPI,30,Under 10 open bugs
`;

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const empName = (e?: { firstName: string; lastName: string } | null) => (e ? `${e.firstName} ${e.lastName}` : '—');

export default function PerformancePage() {
  const { user } = useAuth();
  const canManage = can(user, 'performance:review');
  const hasProfile = !!user?.employee?.id;

  const [cycles, setCycles] = useState<any[]>([]);
  const [myGoals, setMyGoals] = useState<any[]>([]);
  const [teamGoals, setTeamGoals] = useState<any[]>([]);
  const [myDocs, setMyDocs] = useState<any[]>([]);
  const [teamDocs, setTeamDocs] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState('');

  // Modals
  const [goalModal, setGoalModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ employeeId: '', title: '', description: '', category: 'OKR', weight: '25', targetValue: '' });
  const [docForm, setDocForm] = useState<{ employeeId: string; title: string; file: File | null }>({ employeeId: '', title: '', file: null });
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);
  const [progressDraft, setProgressDraft] = useState<Record<string, string>>({});

  // Review modal (appraisals)
  const [reviewAppraisal, setReviewAppraisal] = useState<any | null>(null);
  const [rating, setRating] = useState('4.5');
  const [notes, setNotes] = useState('');
  const [increment, setIncrement] = useState('12');
  const [promotion, setPromotion] = useState(false);

  const getJson = async (url: string) => {
    const r = await fetch(url);
    return r.ok ? r.json() : null;
  };

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const [c, mg, md, a, tg, td] = await Promise.all([
        getJson('/api/performance/cycles'),
        hasProfile ? getJson('/api/performance/goals') : Promise.resolve(null),
        hasProfile ? getJson('/api/performance/documents') : Promise.resolve(null),
        getJson('/api/performance/appraisals'),
        canManage ? getJson('/api/performance/goals?scope=team') : Promise.resolve(null),
        canManage ? getJson('/api/performance/documents?scope=team') : Promise.resolve(null),
      ]);
      setCycles(c?.cycles || []);
      setMyGoals(mg?.goals || []);
      setMyDocs(md?.documents || []);
      setAppraisals(a?.appraisals || []);
      setTeamGoals((tg?.goals || []).filter((g: any) => g.employeeId !== user?.employee?.id));
      setTeamDocs(td?.documents || []);
      setTeam(td?.employees || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setActiveTab((t) => t || (hasProfile ? 'MY_GOALS' : canManage ? 'TEAM_GOALS' : 'APPRAISALS'));
    fetchPerformance();
  }, [user]);

  const currentCycle = cycles.find((c) => c.status === 'ACTIVE') || cycles[0];

  const openGoalModal = (employeeId = '') => {
    setGoalForm({ employeeId, title: '', description: '', category: 'OKR', weight: '25', targetValue: '' });
    setFormError(null);
    setGoalModal(true);
  };
  const openDocModal = (employeeId = '') => {
    setDocForm({ employeeId, title: '', file: null });
    setFormError(null);
    setDocModal(true);
  };

  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/performance/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalForm),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save the goal');
      setGoalModal(false);
      await fetchPerformance();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shareDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.file) return setFormError('Choose a file.');
    if (docForm.file.size > 5 * 1024 * 1024) return setFormError('File is larger than 5 MB.');
    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append('file', docForm.file);
      fd.append('employeeId', docForm.employeeId);
      fd.append('title', docForm.title);
      const res = await fetch('/api/performance/documents', { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Upload failed');
      setDocModal(false);
      await fetchPerformance();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runImport = async () => {
    setSaving(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/performance/goals/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });
      const d = await res.json().catch(() => ({}));
      setImportResult(res.ok ? d : { error: d.error || 'Import failed' });
      if (res.ok) await fetchPerformance();
    } catch (err: any) {
      setImportResult({ error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const readCsvFile = (file?: File | null) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setImportResult({ error: 'Please choose a .csv file (in Excel: File > Save As > CSV UTF-8).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([GOAL_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goals-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveProgress = async (goalId: string) => {
    const value = progressDraft[goalId];
    if (value === undefined) return;
    const res = await fetch(`/api/performance/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressPercent: value }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || 'Could not update progress');
    setProgressDraft((p) => {
      const n = { ...p };
      delete n[goalId];
      return n;
    });
    await fetchPerformance();
  };

  const deleteGoal = async (goalId: string) => {
    if (!confirm('Remove this goal?')) return;
    const res = await fetch(`/api/performance/goals/${goalId}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || 'Could not remove goal');
    await fetchPerformance();
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm('Remove this document? The employee will no longer see it.')) return;
    const res = await fetch(`/api/performance/documents/${docId}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || 'Could not remove document');
    await fetchPerformance();
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAppraisal) return;
    try {
      const res = await fetch('/api/performance/appraisals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANAGER_REVIEW',
          cycleId: reviewAppraisal.performanceCycleId,
          employeeId: reviewAppraisal.employeeId,
          managerRating: rating,
          managerReviewNotes: notes,
          incrementPercent: increment,
          promotionRecommend: promotion,
        }),
      });
      if (res.ok) {
        setReviewAppraisal(null);
        await fetchPerformance();
      } else {
        alert('Failed to submit appraisal review');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredTeamGoals = useMemo(
    () => teamGoals.filter((g) => !teamFilter || g.employeeId === teamFilter),
    [teamGoals, teamFilter],
  );
  const filteredTeamDocs = useMemo(
    () => teamDocs.filter((d) => !teamFilter || d.employeeId === teamFilter),
    [teamDocs, teamFilter],
  );

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'MY_GOALS', label: `My Goals (${myGoals.length})`, show: hasProfile },
    { key: 'TEAM_GOALS', label: `Team Goals (${teamGoals.length})`, show: canManage },
    { key: 'DOCUMENTS', label: `Documents (${canManage ? teamDocs.length : myDocs.length})`, show: hasProfile || canManage },
    { key: 'APPRAISALS', label: `Appraisal Reviews (${appraisals.length})`, show: true },
  ];

  const DocRow = ({ d, showEmployee, removable }: { d: any; showEmployee?: boolean; removable?: boolean }) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{d.title || d.fileName}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {showEmployee && <span className="text-slate-600 font-medium">{empName(d.employee)} · </span>}
            {d.fileName} · {kb(d.sizeBytes)} · {format(new Date(d.createdAt), 'dd MMM yyyy')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a href={`/api/employee-documents/${d.id}`} target="_blank" rel="noopener noreferrer" title="View" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
          <Eye className="h-4 w-4" />
        </a>
        <a href={`/api/employee-documents/${d.id}?download=1`} title="Download" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
          <Download className="h-4 w-4" />
        </a>
        {removable && (
          <button onClick={() => deleteDoc(d.id)} title="Remove" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Performance Management & OKRs" subtitle="Goals, key results, review documents and appraisals">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">Current Cycle</span>
            <span className="text-base font-bold text-slate-900 block mt-1">{currentCycle?.title || 'Created when the first goal is added'}</span>
            {currentCycle && (
              <span className="text-[11px] text-emerald-600 block">
                {format(new Date(currentCycle.startDate), 'dd MMM yyyy')} – {format(new Date(currentCycle.endDate), 'dd MMM yyyy')}
              </span>
            )}
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">{canManage ? 'Goals assigned to my team' : 'My goals'}</span>
            <span className="text-2xl font-bold text-purple-700">{canManage ? teamGoals.length : myGoals.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {canManage ? `${team.length} people you can assign to` : 'Update progress as you go'}
            </span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block">{canManage ? 'Documents shared with team' : 'My review documents'}</span>
            <span className="text-2xl font-bold text-emerald-600">{canManage ? teamDocs.length : myDocs.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Appraisal letters, review reports, OKR sheets</span>
          </div>
        </div>

        {/* Actions for managers / HR / owner */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => openGoalModal()} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add goal
            </button>
            <button
              onClick={() => {
                setCsvText('');
                setImportResult(null);
                setImportModal(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs rounded-xl flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Bulk upload goals (CSV)
            </button>
            <button onClick={() => openDocModal()} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs rounded-xl flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Share document
            </button>
            {team.length === 0 && !loading && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                No team members yet. Managers need employees with them set as Reporting Manager.
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  activeTab === t.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {/* My goals */}
        {activeTab === 'MY_GOALS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myGoals.length === 0 && (
              <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No goals assigned to you yet. Your manager or HR will add them.
              </div>
            )}
            {myGoals.map((g) => (
              <div key={g.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                      {g.category} • Weight {g.weight}%
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-2">{g.title}</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 font-mono">{g.progressPercent}%</span>
                </div>
                {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                {g.targetValue && (
                  <p className="text-[11px] text-slate-600">
                    <strong>Target:</strong> {g.targetValue}
                  </p>
                )}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${g.progressPercent}%` }} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressDraft[g.id] ?? g.progressPercent}
                    onChange={(e) => setProgressDraft((p) => ({ ...p, [g.id]: e.target.value }))}
                    className="flex-1 accent-emerald-600"
                  />
                  <span className="w-10 text-right font-mono text-slate-600">{progressDraft[g.id] ?? g.progressPercent}%</span>
                  {progressDraft[g.id] !== undefined && Number(progressDraft[g.id]) !== g.progressPercent && (
                    <button onClick={() => saveProgress(g.id)} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium">
                      Save
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Team goals */}
        {activeTab === 'TEAM_GOALS' && canManage && (
          <div className="space-y-3">
            <TeamFilter team={team} value={teamFilter} onChange={setTeamFilter} />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Goal</th>
                      <th className="py-3 px-4">Type / Weight</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Progress</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeamGoals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No goals yet. Use “Add goal” or “Bulk upload goals”.
                        </td>
                      </tr>
                    ) : (
                      filteredTeamGoals.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{empName(g.employee)}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{g.employee?.employeeCode}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{g.title}</div>
                            {g.description && <div className="text-[11px] text-slate-400 line-clamp-2">{g.description}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {g.category} · {g.weight}%
                          </td>
                          <td className="py-3 px-4 text-slate-600">{g.targetValue || '—'}</td>
                          <td className="py-3 px-4 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-emerald-500 h-1.5" style={{ width: `${g.progressPercent}%` }} />
                              </div>
                              <span className="font-mono text-slate-600">{g.progressPercent}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => deleteGoal(g.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Remove goal">
                              <Trash2 className="h-3.5 w-3.5" />
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
        )}

        {/* Documents */}
        {activeTab === 'DOCUMENTS' && (
          <div className="space-y-5">
            {canManage && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-500" /> Shared with my team
                  </h3>
                  <TeamFilter team={team} value={teamFilter} onChange={setTeamFilter} />
                </div>
                {filteredTeamDocs.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Nothing shared yet. Use “Share document”.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTeamDocs.map((d) => (
                      <DocRow key={d.id} d={d} showEmployee removable />
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasProfile && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">My documents</h3>
                {myDocs.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    No review documents shared with you yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {myDocs.map((d) => (
                      <DocRow key={d.id} d={d} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Appraisals (unchanged) */}
        {activeTab === 'APPRAISALS' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Self Rating</th>
                    <th className="py-3 px-4">Manager Rating</th>
                    <th className="py-3 px-4">Final Calibrated Rating</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appraisals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No appraisals yet.
                      </td>
                    </tr>
                  )}
                  {appraisals.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {app.employee?.displayName || app.employee?.firstName}
                        <span className="text-[11px] text-slate-400 font-mono block">{app.employee?.employeeCode}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 font-mono">{app.selfRating ? `${app.selfRating} / 5.0` : '—'}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 font-mono">{app.managerRating ? `${app.managerRating} / 5.0` : '—'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700 font-mono">{app.finalRating ? `${app.finalRating} / 5.0` : '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && app.employeeId !== user?.employee?.id && (
                          <button
                            onClick={() => {
                              setReviewAppraisal(app);
                              setRating(String(app.managerRating || 4.5));
                              setNotes(app.managerReviewNotes || '');
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium rounded-lg text-xs transition-colors border border-slate-200"
                          >
                            Evaluate & Rate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add goal modal */}
        {goalModal && (
          <Modal title="Add goal" icon={<Target className="h-5 w-5 text-emerald-600" />} onClose={() => setGoalModal(false)}>
            <form onSubmit={saveGoal} className="space-y-3 text-xs">
              <EmployeeSelect team={team} value={goalForm.employeeId} onChange={(v) => setGoalForm({ ...goalForm, employeeId: v })} />
              <div>
                <label className="font-medium text-slate-700 block mb-1">Goal / Objective *</label>
                <input required maxLength={200} value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" placeholder="e.g. Launch the customer portal" />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">Key results / details</label>
                <textarea rows={3} value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Type</label>
                  <select value={goalForm.category} onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <option value="OKR">OKR</option>
                    <option value="KRA">KRA</option>
                    <option value="KPI">KPI</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Weight %</label>
                  <input type="number" min={1} max={100} value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Target</label>
                  <input value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" placeholder="e.g. 95%" />
                </div>
              </div>
              {formError && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{formError}</div>}
              <ModalButtons saving={saving} label="Save goal" onCancel={() => setGoalModal(false)} />
            </form>
          </Modal>
        )}

        {/* Bulk upload goals modal */}
        {importModal && (
          <Modal title="Bulk upload goals (CSV)" icon={<Upload className="h-5 w-5 text-emerald-600" />} onClose={() => setImportModal(false)} wide>
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                One row per goal. Columns: <code>employeeEmail</code> (or <code>employeeCode</code>), <code>title</code>, and optional{' '}
                <code>description, category (OKR/KRA/KPI), weight, target</code>. Goals go into the current cycle
                {currentCycle ? ` (${currentCycle.title})` : ''}.
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-medium cursor-pointer flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Choose CSV file
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { readCsvFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <button type="button" onClick={downloadTemplate} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Download template
                </button>
              </div>
              <textarea rows={7} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="employeeEmail,title,description,category,weight,target" className="w-full p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl" />
              {importResult && (
                <div className={`p-3 rounded-xl border ${importResult.error ? 'bg-rose-50 border-rose-200 text-rose-800' : importResult.failedCount ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {importResult.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    {importResult.error ? importResult.error : `Added ${importResult.importedCount} of ${importResult.totalProcessed} goals.`}
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
                <button onClick={() => setImportModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">Close</button>
                <button disabled={saving || !csvText.trim()} onClick={runImport} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
                  {saving ? 'Importing…' : 'Import goals'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Share document modal */}
        {docModal && (
          <Modal title="Share a document" icon={<FolderOpen className="h-5 w-5 text-emerald-600" />} onClose={() => setDocModal(false)}>
            <form onSubmit={shareDoc} className="space-y-3 text-xs">
              <EmployeeSelect team={team} value={docForm.employeeId} onChange={(v) => setDocForm({ ...docForm, employeeId: v })} />
              <div>
                <label className="font-medium text-slate-700 block mb-1">Title *</label>
                <input required maxLength={150} value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg" placeholder="e.g. FY26 Appraisal Letter" />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">File *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx,.pptx"
                  onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <div className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG, Excel, Word or PowerPoint · max 5 MB. The employee sees it on their Dashboard.</div>
              </div>
              {formError && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{formError}</div>}
              <ModalButtons saving={saving} label="Upload & share" onCancel={() => setDocModal(false)} />
            </form>
          </Modal>
        )}

        {/* Evaluate Modal */}
        {reviewAppraisal && (
          <Modal title="Appraisal Rating & Recommendation" icon={<Award className="h-5 w-5 text-emerald-600" />} onClose={() => setReviewAppraisal(null)}>
            <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Performance Rating (1.0 to 5.0) *</label>
                <input type="number" step="0.1" min="1.0" max="5.0" required value={rating} onChange={(e) => setRating(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold" />
              </div>
              <div>
                <label className="font-medium text-slate-700 block mb-1">Manager Review Feedback & Strengths *</label>
                <textarea rows={3} required value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Recommended Hike %</label>
                  <input type="number" value={increment} onChange={(e) => setIncrement(e.target.value)} className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold" />
                </div>
                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" checked={promotion} onChange={(e) => setPromotion(e.target.checked)} className="rounded text-emerald-600" />
                    <span>Promote to Next Level</span>
                  </label>
                </div>
              </div>
              <ModalButtons saving={false} label="Save & Finalize Appraisal" onCancel={() => setReviewAppraisal(null)} />
            </form>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

function Modal({ title, icon, onClose, wide, children }: { title: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            {icon}
            {title}
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

function ModalButtons({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium">
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function EmployeeSelect({ team, value, onChange }: { team: any[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="font-medium text-slate-700 block mb-1">Employee *</label>
      <select required value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg">
        <option value="">Select an employee…</option>
        {team.map((e) => (
          <option key={e.id} value={e.id}>
            {e.firstName} {e.lastName} ({e.employeeCode})
          </option>
        ))}
      </select>
    </div>
  );
}

function TeamFilter({ team, value, onChange }: { team: any[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-3">
      <option value="">All team members</option>
      {team.map((e) => (
        <option key={e.id} value={e.id}>
          {e.firstName} {e.lastName}
        </option>
      ))}
    </select>
  );
}
