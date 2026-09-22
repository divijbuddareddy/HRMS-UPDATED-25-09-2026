'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  UserPlus2,
  Sparkles,
  Plus,
  Briefcase,
  Users,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  UserCheck,
  X,
  Star,
  Send,
  Trash2,
  FileText,
  Paperclip,
  ExternalLink,
  UploadCloud,
  Check,
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

  // Job Description PDF attachment states
  const [attachedJdFile, setAttachedJdFile] = useState<{
    name: string;
    size: number;
    type: string;
    content?: string;
  } | null>(null);
  const [isDraggingJdFile, setIsDraggingJdFile] = useState(false);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [candResumeFile, setCandResumeFile] = useState<{
    name: string;
    size: number;
    type: string;
    content?: string;
  } | null>(null);
  const candFileInputRef = useRef<HTMLInputElement>(null);
  const pipelineScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollPipeline = (direction: 'left' | 'right') => {
    if (pipelineScrollRef.current) {
      pipelineScrollRef.current.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' });
    }
  };

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

  const handleJdFileProcess = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    const reader = new FileReader();
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setAttachedJdFile({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          content: text,
        });
        if (!jobForm.description) {
          setJobForm((prev) => ({ ...prev, description: text.substring(0, 2000) }));
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachedJdFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/pdf',
          content: dataUrl,
        });
        if (!jobForm.description) {
          setJobForm((prev) => ({
            ...prev,
            description: `[Attached JD Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\nRole overview and responsibilities are detailed in the attached PDF.`,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleJdFileProcess(file);
  };

  const handleJdDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingJdFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleJdFileProcess(file);
  };

  const removeAttachedJdFile = () => {
    setAttachedJdFile(null);
    if (jdFileInputRef.current) {
      jdFileInputRef.current.value = '';
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingJob(true);
    try {
      let finalDescription = jobForm.description.trim();
      if (attachedJdFile) {
        if (!finalDescription) {
          finalDescription = `[Attached JD Document: ${attachedJdFile.name} (${(attachedJdFile.size / 1024).toFixed(1)} KB)]\nDetailed job description provided in attached PDF.`;
        } else if (!finalDescription.includes(attachedJdFile.name)) {
          finalDescription = `[Attached JD Document: ${attachedJdFile.name}]\n${finalDescription}`;
        }
      }

      const res = await fetch('/api/ats/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...jobForm,
          description: finalDescription,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreateJobOpen(false);
        setAttachedJdFile(null);
        if (jdFileInputRef.current) jdFileInputRef.current.value = '';
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
        alert('Job Opening successfully published to ATS & Public Careers page!');
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
          resumeFileName: candResumeFile?.name,
          resumeDataUrl: candResumeFile?.content,
        }),
      });
      if (res.ok) {
        setIsApplyOpen(false);
        setCandResumeFile(null);
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

  const handleSignOffer = async (id: string) => {
    if (!confirm('Accept and sign Offer Letter for this candidate? This will officially add them as an Active Employee in the Employees Tab.')) return;
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIGN_OFFER' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Success! Offer letter signed. Candidate is now enrolled as Active Employee (${data.employee?.employeeCode}) in the Employees Tab.`);
        setSelectedCandidate(null);
        await fetchATS();
      } else {
        alert(data.error || 'Failed to sign offer');
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
        alert(`Success! Candidate hired as Employee ${data.employee?.employeeCode}`);
        setSelectedCandidate(null);
        await fetchATS();
      } else {
        alert(data.error || 'Hire conversion failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOnboardCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/ats/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ONBOARD' }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchATS();
        setSelectedCandidate(null);
        if (confirm(`Candidate initialized into Onboarding workflow as Employee ${data.employee?.employeeCode}!\n\nWould you like to open the Employee Onboarding dashboard now?`)) {
          window.location.href = '/onboarding';
        }
      } else {
        alert(data.error || 'Failed to send to onboarding');
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
          <div className="space-y-4">
            {/* Pipeline Stage Flow Navigation Bar with Arrow Indicators */}
            <div className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 sm:mr-2">
                  Pipeline Progression:
                </span>
                {stages.map((stage, idx) => {
                  const count = candidates.filter((c) => c.stage === stage).length;
                  return (
                    <React.Fragment key={stage}>
                      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                        <span>{stage}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                          {count}
                        </span>
                      </div>
                      {idx < stages.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 ml-2 shrink-0">
                <button
                  onClick={() => handleScrollPipeline('left')}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 text-xs font-medium"
                  title="Navigate Pipeline Left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleScrollPipeline('right')}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 text-xs font-medium"
                  title="Navigate Pipeline Right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Kanban Columns Grid with Horizontal Scroll */}
            <div
              ref={pipelineScrollRef}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-2 scroll-smooth"
            >
              {stages.map((stage, stageIdx) => {
                const stageCandidates = candidates.filter((c) => c.stage === stage);
                return (
                  <div key={stage} className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200/80 flex flex-col min-h-[420px] min-w-[240px]">
                    <div className="flex justify-between items-center mb-3 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{stage}</span>
                      </div>
                      <span className="text-[11px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                        {stageCandidates.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1">
                      {stageCandidates.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCandidate(c)}
                          className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 cursor-pointer transition-all space-y-2.5 hover:shadow-md"
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

                          {/* Stage Arrow Navigation Actions on Candidate Card */}
                          <div
                            className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {stageIdx > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateStage(c.id, stages[stageIdx - 1])}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 font-medium transition-colors"
                                title={`Move back to ${stages[stageIdx - 1]}`}
                              >
                                <ArrowLeft className="h-3 w-3 text-slate-500" />
                                <span className="hidden sm:inline">{stages[stageIdx - 1]}</span>
                              </button>
                            ) : (
                              <div />
                            )}

                            {stageIdx < stages.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateStage(c.id, stages[stageIdx + 1])}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-semibold transition-colors ml-auto"
                                title={`Advance to ${stages[stageIdx + 1]}`}
                              >
                                <span>{stages[stageIdx + 1]}</span>
                                <ArrowRight className="h-3 w-3 text-emerald-600" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50 text-[10px] ml-auto">
                                <CheckCircle className="h-3 w-3" /> Hired
                              </span>
                            )}
                          </div>

                          {/* Sign Offer Action for Offered Candidates */}
                          {c.stage === 'OFFERED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSignOffer(c.id);
                              }}
                              className="w-full mt-1.5 py-1.5 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold text-[11px] shadow-sm shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                              title="Sign Offer Letter & Add to Employees Directory"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Sign Offer (Add to Employees)
                            </button>
                          )}

                          {/* Send to Onboarding Button for Hired Candidates */}
                          {c.stage === 'HIRED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOnboardCandidate(c.id);
                              }}
                              className="w-full mt-1.5 py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold text-[11px] shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                              title="Send Candidate to Employee Onboarding"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              Onboard
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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

                {/* Job Description with PDF upload support */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-slate-700 flex items-center gap-1.5">
                      <span>Job Description *</span>
                      {attachedJdFile && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">
                          <Check className="h-3 w-3" /> PDF Document Attached
                        </span>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={() => jdFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                      title="Upload PDF or Document for Job Description"
                    >
                      <Paperclip className="h-3 w-3" />
                      {attachedJdFile ? 'Replace PDF / Doc' : 'Upload PDF / Doc'}
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={jdFileInputRef}
                    onChange={handleJdFileChange}
                    accept=".pdf,.doc,.docx,.txt,application/pdf"
                    className="hidden"
                  />

                  {attachedJdFile && (
                    <div className="mb-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{attachedJdFile.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {(attachedJdFile.size / 1024).toFixed(1)} KB • PDF Document
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeAttachedJdFile}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove attached PDF"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingJdFile(true);
                    }}
                    onDragLeave={() => setIsDraggingJdFile(false)}
                    onDrop={handleJdDrop}
                    className={`relative rounded-lg transition-all ${
                      isDraggingJdFile ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''
                    }`}
                  >
                    <textarea
                      rows={2}
                      required={!attachedJdFile}
                      placeholder={
                        attachedJdFile
                          ? 'Optional notes or summary (full spec provided in attached PDF)...'
                          : 'Describe the role responsibilities and team context, or click Upload PDF above...'
                      }
                      value={jobForm.description}
                      onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-500 transition-colors"
                    />

                    {!attachedJdFile && (
                      <div className="absolute right-2 bottom-2.5 flex items-center gap-1 text-[11px] text-slate-400 pointer-events-none">
                        <UploadCloud className="h-3.5 w-3.5 text-slate-400" />
                        <span>Drop PDF here</span>
                      </div>
                    )}
                  </div>
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

                {/* Attached Resume Document */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                      Attached Resume / Application Details
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Verified
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {selectedCandidate.resumeText?.startsWith('[Attached File:')
                          ? selectedCandidate.resumeText.split('\n')[0].replace('[Attached File:', '').replace(']', '').trim()
                          : `${selectedCandidate.firstName}_${selectedCandidate.lastName}_Resume.pdf`}
                      </div>
                      <div className="text-[10px] text-slate-400">Candidate Attached Profile & Skill Matrix</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="font-semibold text-slate-700 block text-xs">Stage Navigation & Progression:</span>
                  
                  {/* Previous / Next Arrow Action Bar */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      disabled={stages.indexOf(selectedCandidate.stage) === 0}
                      onClick={() => {
                        const currIdx = stages.indexOf(selectedCandidate.stage);
                        if (currIdx > 0) handleUpdateStage(selectedCandidate.id, stages[currIdx - 1]);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Previous Stage
                    </button>

                    <div className="text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                      {selectedCandidate.stage}
                    </div>

                    <button
                      type="button"
                      disabled={stages.indexOf(selectedCandidate.stage) === stages.length - 1}
                      onClick={() => {
                        const currIdx = stages.indexOf(selectedCandidate.stage);
                        if (currIdx < stages.length - 1) handleUpdateStage(selectedCandidate.id, stages[currIdx + 1]);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      Next Stage <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Stage Flow Breadcrumbs with Arrow Connectors */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {stages.map((st, idx) => (
                      <React.Fragment key={st}>
                        <button
                          type="button"
                          onClick={() => handleUpdateStage(selectedCandidate.id, st)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            selectedCandidate.stage === st
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                        {idx < stages.length - 1 && (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                >
                  Close
                </button>

                {selectedCandidate.stage === 'HIRED' ? (
                  <button
                    onClick={() => handleOnboardCandidate(selectedCandidate.id)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Send to Onboarding
                  </button>
                ) : selectedCandidate.stage === 'OFFERED' ? (
                  <button
                    onClick={() => handleSignOffer(selectedCandidate.id)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
                  >
                    <FileText className="h-4 w-4" />
                    Sign Offer & Add to Employees
                  </button>
                ) : (
                  <button
                    onClick={() => handleHireCandidate(selectedCandidate.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
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

                {/* Attach Resume Document in ATS */}
                <div>
                  <label className="font-medium text-slate-700 flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                      Attach Resume / CV
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">PDF, DOCX, DOC, TXT (Max 10MB)</span>
                  </label>

                  <input
                    type="file"
                    ref={candFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert('File size exceeds 10MB limit.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setCandResumeFile({
                            name: file.name,
                            size: file.size,
                            type: file.type || 'application/pdf',
                            content: ev.target?.result as string,
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    accept=".pdf,.docx,.doc,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                  />

                  {candResumeFile ? (
                    <div className="p-2.5 bg-slate-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate text-xs flex items-center gap-1.5">
                            {candResumeFile.name}
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="h-3 w-3" /> Attached
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {(candResumeFile.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCandResumeFile(null);
                          if (candFileInputRef.current) candFileInputRef.current.value = '';
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove attached file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => candFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-emerald-500/60 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-slate-100/80 transition-all"
                    >
                      <div className="flex items-center justify-center gap-2 text-slate-600 text-xs">
                        <UploadCloud className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-medium">Click to upload candidate resume file</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsApplyOpen(false);
                      setCandResumeFile(null);
                    }}
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

