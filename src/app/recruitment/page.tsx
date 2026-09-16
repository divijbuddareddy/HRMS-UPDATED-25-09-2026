'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  UserPlus2,
  Sparkles,
  Plus,
  Briefcase,
  Users,
  ChevronRight,
  CheckCircle,
  X,
  Star,
  Send,
  Trash2,
} from 'lucide-react';

export default function RecruitmentPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [orgData, setOrgData] = useState<any>({
    departments: [],
    designations: [],
    branchLocations: [],
    legalEntities: [],
  });
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'JOBS'>('PIPELINE');
  const [loading, setLoading] = useState(true);

  const isHRAdmin = user?.roles.some((r) => ['HR_ADMIN', 'COMPANY_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(r));


  // New Job Opening modal
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    code: '',
    departmentId: '',
    designationId: '',
    branchLocationId: '',
    legalEntityId: '',
    headcount: '1',
    experienceYears: '3',
    minCtc: '1200000',
    maxCtc: '2500000',
    description: '',
    requirements: '',
  });

  // Quick inline creation states for Department, Designation, Branch
  const [quickAddType, setQuickAddType] = useState<'NONE' | 'DEPT' | 'DESIG' | 'BRANCH'>('NONE');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDesigTitle, setNewDesigTitle] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [savingOrgEntity, setSavingOrgEntity] = useState(false);

  // New Candidate modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [candForm, setCandForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentCompany: '',
    expectedCtc: '1800000',
    skills: 'React, TypeScript, Next.js, Node.js, PostgreSQL',
  });

  const fetchATS = async () => {
    setLoading(true);
    try {
      const [jRes, cRes, oRes] = await Promise.all([
        fetch('/api/ats/jobs'),
        fetch('/api/ats/candidates'),
        fetch('/api/organization'),
      ]);
      if (jRes.ok) {
        const jData = await jRes.json();
        setJobs(jData.jobs || []);
        if (jData.jobs?.[0] && !jobId) setJobId(jData.jobs[0].id);
      }
      if (cRes.ok) setCandidates((await cRes.json()).candidates || []);
      if (oRes.ok) {
        const oData = await oRes.json();
        setOrgData(oData);
        if (oData.departments?.[0] && !jobForm.departmentId) {
          setJobForm((prev) => ({
            ...prev,
            departmentId: oData.departments[0].id,
            designationId: oData.designations?.[0]?.id || '',
            branchLocationId: oData.branchLocations?.[0]?.id || '',
            legalEntityId: oData.legalEntities?.[0]?.id || '',
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchATS();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingJob(true);
    try {
      const res = await fetch('/api/ats/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobForm),
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreateJobOpen(false);
        setJobForm({
          title: '',
          code: '',
          departmentId: orgData.departments?.[0]?.id || '',
          designationId: orgData.designations?.[0]?.id || '',
          branchLocationId: orgData.branchLocations?.[0]?.id || '',
          legalEntityId: orgData.legalEntities?.[0]?.id || '',
          headcount: '1',
          experienceYears: '3',
          minCtc: '1200000',
          maxCtc: '2500000',
          description: '',
          requirements: '',
        });
        await fetchATS();
        alert('🎉 Job Opening successfully published to ATS & Public Careers page!');
      } else {
        alert(data.error || 'Failed to create job opening');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreatingJob(false);
    }
  };

  const handleQuickCreateDept = async () => {
    if (!newDeptName.trim()) return;
    setSavingOrgEntity(true);
    try {
      const code = newDeptName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DEPT';
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DEPARTMENT',
          data: { name: newDeptName.trim(), code },
        }),
      });
      const created = await res.json();
      if (res.ok) {
        const oRes = await fetch('/api/organization');
        if (oRes.ok) {
          const oData = await oRes.json();
          setOrgData(oData);
          setJobForm((prev) => ({ ...prev, departmentId: created.id }));
        }
        setNewDeptName('');
        setQuickAddType('NONE');
      } else {
        alert(created.error || 'Failed to create department');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingOrgEntity(false);
    }
  };

  const handleQuickCreateDesig = async () => {
    if (!newDesigTitle.trim()) return;
    setSavingOrgEntity(true);
    try {
      const code = newDesigTitle.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ROLE';
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DESIGNATION',
          data: { title: newDesigTitle.trim(), code, departmentId: jobForm.departmentId || null },
        }),
      });
      const created = await res.json();
      if (res.ok) {
        const oRes = await fetch('/api/organization');
        if (oRes.ok) {
          const oData = await oRes.json();
          setOrgData(oData);
          setJobForm((prev) => ({ ...prev, designationId: created.id }));
        }
        setNewDesigTitle('');
        setQuickAddType('NONE');
      } else {
        alert(created.error || 'Failed to create designation');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingOrgEntity(false);
    }
  };

  const handleQuickCreateBranch = async () => {
    if (!newBranchCity.trim()) return;
    setSavingOrgEntity(true);
    try {
      const name = newBranchName.trim() || `${newBranchCity.trim()} Office`;
      const code = newBranchCity.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'LOC';
      const legalEntityId = jobForm.legalEntityId || orgData.legalEntities?.[0]?.id;
      const res = await fetch('/api/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BRANCH',
          data: {
            name,
            code,
            city: newBranchCity.trim(),
            state: 'KARNATAKA',
            country: 'India',
            legalEntityId,
          },
        }),
      });
      const created = await res.json();
      if (res.ok) {
        const oRes = await fetch('/api/organization');
        if (oRes.ok) {
          const oData = await oRes.json();
          setOrgData(oData);
          setJobForm((prev) => ({ ...prev, branchLocationId: created.id }));
        }
        setNewBranchName('');
        setNewBranchCity('');
        setQuickAddType('NONE');
      } else {
        alert(created.error || 'Failed to create branch location');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingOrgEntity(false);
    }
  };


  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ats/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...candForm,
          jobRequisitionId: jobId,
          skills: candForm.skills.split(',').map((s) => s.trim()),
          expectedCtc: parseFloat(candForm.expectedCtc),
        }),
      });
      if (res.ok) {
        setIsApplyOpen(false);
        await fetchATS();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add candidate');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateStage = async (id: string, stage: string) => {
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        await fetchATS();
        if (selectedCandidate?.id === id) {
          setSelectedCandidate({ ...selectedCandidate, stage });
        }
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleHireCandidate = async (id: string) => {
    if (!confirm('Are you sure you want to hire this candidate and create an active Employee profile?')) return;
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'HIRE' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`🎉 Success! Candidate hired as Employee ${data.employee?.employeeCode}`);
        setSelectedCandidate(null);
        await fetchATS();
      } else {
        alert(data.error || 'Hire conversion failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleJobStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PUBLISHED' ? 'ON_HOLD' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/ats/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchATS();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update job status');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteJob = async (id: string, code: string, title: string) => {
    if (!confirm(`Are you sure you want to delete job opening ${code} (${title})? This will also remove it from the Careers portal.`)) return;
    try {
      const res = await fetch(`/api/ats/jobs/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchATS();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete job opening');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const stages = ['APPLIED', 'SCREENED', 'INTERVIEW', 'OFFERED', 'HIRED'];

  return (
    <DashboardLayout title="Recruitment & ATS Pipeline" subtitle="Manage job requisitions, candidate pipeline, AI resume match, and hiring">
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('PIPELINE')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                activeTab === 'PIPELINE' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Candidate Pipeline ({candidates.length})
            </button>
            <button
              onClick={() => setActiveTab('JOBS')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                activeTab === 'JOBS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Job Openings & Careers Portal ({jobs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isHRAdmin && (
              <button
                onClick={() => setIsCreateJobOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Post New Job
              </button>
            )}
            <button
              onClick={() => setIsApplyOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Candidate
            </button>
          </div>
        </div>

        {/* Tab 1: Kanban Pipeline Board */}
        {activeTab === 'PIPELINE' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {stages.map((stage) => {
              const stageCandidates = candidates.filter((c) => c.stage === stage);
              return (
                <div key={stage} className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 flex flex-col min-h-[400px]">
                  <div className="flex justify-between items-center mb-3 px-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{stage}</span>
                    <span className="text-[11px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {stageCandidates.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCandidate(c)}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 cursor-pointer transition-all space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-semibold text-xs text-slate-900">
                            {c.firstName} {c.lastName}
                          </div>
                          {c.aiMatchScore && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Sparkles className="h-2.5 w-2.5" /> {c.aiMatchScore}% Match
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 truncate">
                          {c.jobRequisition?.title || 'Engineer'}
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono">
                          Exp CTC: ₹{(c.expectedCtc / 100000).toFixed(1)}L
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Job Requisitions Catalog */}
        {activeTab === 'JOBS' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Active Job Openings & Careers Portal Sync</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jobs with <span className="font-semibold text-emerald-700">PUBLISHED</span> status are automatically broadcasted to the public Careers portal.
                </p>
              </div>
              <a
                href="/careers"
                target="_blank"
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-1.5 transition-colors"
              >
                Open Public Careers Portal ↗
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Job Title</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">CTC Range</th>
                    <th className="py-3 px-4">Applicants</th>
                    <th className="py-3 px-4">Careers Portal Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {j.title}
                        <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{j.description}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{j.code}</td>
                      <td className="py-3 px-4 text-slate-700">{j.department?.name || 'Engineering'}</td>
                      <td className="py-3 px-4 text-slate-700">{j.branchLocation?.city || 'Bengaluru'}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        ₹{(j.minCtc / 100000).toFixed(1)}L – ₹{(j.maxCtc / 100000).toFixed(1)}L
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        {j.candidates?.length || 0} candidate(s)
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          j.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {j.status === 'PUBLISHED' ? '● LIVE ON CAREERS' : 'PAUSED / DRAFT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isHRAdmin && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleJobStatus(j.id, j.status)}
                              className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-colors border ${
                                j.status === 'PUBLISHED'
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                              }`}
                            >
                              {j.status === 'PUBLISHED' ? 'Pause' : 'Publish'}
                            </button>
                            <button
                              onClick={() => handleDeleteJob(j.id, j.code, j.title)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                              title="Delete Job Opening"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No job requisitions created yet. Click "Post New Job" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* HR Create Job Requisition Modal */}
        {isCreateJobOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                  Post New Job Opening
                </h3>
                <button onClick={() => setIsCreateJobOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Job Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Frontend Engineer"
                      value={jobForm.title}
                      onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Job Code (Unique) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JOB-2026-ENG-04"
                      value={jobForm.code}
                      onChange={(e) => setJobForm({ ...jobForm, code: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Department */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-medium text-slate-700">Department *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddType(quickAddType === 'DEPT' ? 'NONE' : 'DEPT');
                          setNewDeptName('');
                        }}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        {quickAddType === 'DEPT' ? 'Cancel' : '+ Add New'}
                      </button>
                    </div>
                    {quickAddType === 'DEPT' ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Artificial Intelligence"
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                          className="flex-1 p-2 bg-slate-50 border border-emerald-400 rounded-lg text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={savingOrgEntity || !newDeptName.trim()}
                          onClick={handleQuickCreateDept}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs"
                        >
                          {savingOrgEntity ? '...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <select
                        value={jobForm.departmentId}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_DEPT__') {
                            setQuickAddType('DEPT');
                          } else {
                            setJobForm({ ...jobForm, departmentId: e.target.value });
                          }
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        {orgData.departments?.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                        ))}
                        <option value="__NEW_DEPT__" className="text-emerald-600 font-semibold">+ Add New Department...</option>
                      </select>
                    )}
                  </div>

                  {/* Designation */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-medium text-slate-700">Designation *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddType(quickAddType === 'DESIG' ? 'NONE' : 'DESIG');
                          setNewDesigTitle('');
                        }}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        {quickAddType === 'DESIG' ? 'Cancel' : '+ Add New'}
                      </button>
                    </div>
                    {quickAddType === 'DESIG' ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Lead AI Engineer"
                          value={newDesigTitle}
                          onChange={(e) => setNewDesigTitle(e.target.value)}
                          className="flex-1 p-2 bg-slate-50 border border-emerald-400 rounded-lg text-xs"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={savingOrgEntity || !newDesigTitle.trim()}
                          onClick={handleQuickCreateDesig}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs"
                        >
                          {savingOrgEntity ? '...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <select
                        value={jobForm.designationId}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_DESIG__') {
                            setQuickAddType('DESIG');
                          } else {
                            setJobForm({ ...jobForm, designationId: e.target.value });
                          }
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        {orgData.designations?.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.title} ({d.code})</option>
                        ))}
                        <option value="__NEW_DESIG__" className="text-emerald-600 font-semibold">+ Add New Designation...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Location / Branch */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-medium text-slate-700">Location / Branch *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddType(quickAddType === 'BRANCH' ? 'NONE' : 'BRANCH');
                          setNewBranchCity('');
                          setNewBranchName('');
                        }}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        {quickAddType === 'BRANCH' ? 'Cancel' : '+ Add New'}
                      </button>
                    </div>
                    {quickAddType === 'BRANCH' ? (
                      <div className="space-y-1.5 p-2.5 bg-slate-50 border border-emerald-400 rounded-lg">
                        <input
                          type="text"
                          placeholder="City (e.g. Hyderabad, Mumbai)"
                          value={newBranchCity}
                          onChange={(e) => setNewBranchCity(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Branch Name (Optional)"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            className="flex-1 p-1.5 bg-white border border-slate-200 rounded text-xs"
                          />
                          <button
                            type="button"
                            disabled={savingOrgEntity || !newBranchCity.trim()}
                            onClick={handleQuickCreateBranch}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold text-xs"
                          >
                            {savingOrgEntity ? '...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={jobForm.branchLocationId}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_BRANCH__') {
                            setQuickAddType('BRANCH');
                          } else {
                            setJobForm({ ...jobForm, branchLocationId: e.target.value });
                          }
                        }}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        {orgData.branchLocations?.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                        ))}
                        <option value="__NEW_BRANCH__" className="text-emerald-600 font-semibold">+ Add New Branch Location...</option>
                      </select>
                    )}
                  </div>

                  {/* Legal Entity */}
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Legal Entity *</label>
                    <select
                      value={jobForm.legalEntityId}
                      onChange={(e) => setJobForm({ ...jobForm, legalEntityId: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      {orgData.legalEntities?.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Headcount</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={jobForm.headcount}
                      onChange={(e) => setJobForm({ ...jobForm, headcount: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Experience (Yrs)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={jobForm.experienceYears}
                      onChange={(e) => setJobForm({ ...jobForm, experienceYears: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Min CTC (₹)</label>
                    <input
                      type="number"
                      step="50000"
                      required
                      value={jobForm.minCtc}
                      onChange={(e) => setJobForm({ ...jobForm, minCtc: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Max CTC (₹)</label>
                    <input
                      type="number"
                      step="50000"
                      required
                      value={jobForm.maxCtc}
                      onChange={(e) => setJobForm({ ...jobForm, maxCtc: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Job Description *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe the role responsibilities and team context..."
                    value={jobForm.description}
                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Required Skills & Qualifications (Keywords for AI matching) *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. React, Next.js, TypeScript, PostgreSQL, REST APIs, Tailwind CSS, 3+ years experience"
                    value={jobForm.requirements}
                    onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateJobOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingJob}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm shadow-emerald-600/20"
                  >
                    {creatingJob ? 'Publishing...' : 'Publish Job Opening'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Candidate Detail Modal / Drawer */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedCandidate.firstName} {selectedCandidate.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedCandidate.email} • {selectedCandidate.phone || '+91 9876543210'}</p>
                </div>
                <button onClick={() => setSelectedCandidate(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-emerald-900 block">AI Resume Match Score</span>
                      <span className="text-[11px] text-emerald-700">Matched with {selectedCandidate.jobRequisition?.title}</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-emerald-800 font-mono">{selectedCandidate.aiMatchScore || 85}%</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="font-semibold text-slate-800">Candidate Info</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>Current Company: <strong>{selectedCandidate.currentCompany || 'Freelance / Tech'}</strong></div>
                    <div>Notice Period: <strong>{selectedCandidate.noticePeriodDays} Days</strong></div>
                    <div>Expected CTC: <strong>₹{(selectedCandidate.expectedCtc || 1800000).toLocaleString('en-IN')}</strong></div>
                    <div>Current Stage: <strong className="text-emerald-600">{selectedCandidate.stage}</strong></div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-slate-700 block">Move Candidate to Next Stage:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStage(selectedCandidate.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                          selectedCandidate.stage === st
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
                >
                  Close
                </button>

                {selectedCandidate.stage !== 'HIRED' && (
                  <button
                    onClick={() => handleHireCandidate(selectedCandidate.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Hire as Active Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Candidate Modal */}
        {isApplyOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  <UserPlus2 className="h-5 w-5 text-emerald-600" />
                  Add New Candidate
                </h3>
                <button onClick={() => setIsApplyOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Applying For Position *</label>
                  <select
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title} ({j.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={candForm.firstName}
                      onChange={(e) => setCandForm({ ...candForm, firstName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Maya"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={candForm.lastName}
                      onChange={(e) => setCandForm({ ...candForm, lastName: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Nair"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={candForm.email}
                    onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="maya.nair@email.com"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Skills (comma separated for AI matching)</label>
                  <input
                    type="text"
                    value={candForm.skills}
                    onChange={(e) => setCandForm({ ...candForm, skills: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsApplyOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm"
                  >
                    Add to Pipeline
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

