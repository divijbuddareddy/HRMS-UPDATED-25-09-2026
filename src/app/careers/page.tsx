'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Send,
  CheckCircle2,
  Building2,
  X,
  Layers,
  Search,
  UploadCloud,
  FileText,
  Trash2,
  Paperclip,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function PublicCareersPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [tenantInfo, setTenantInfo] = useState<any>({ name: 'AI Automation Labs LLP' });
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Resume File Attachment State
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    content?: string;
  } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentCompany: '',
    expectedCtc: '1800000',
    skills: 'TypeScript, React, Node.js, SQL',
    resumeText: '',
  });

  useEffect(() => {
    fetch('/api/careers')
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs) setJobs(data.jobs);
        if (data.tenant) setTenantInfo(data.tenant);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();

    // If it's a text-based file, read as text; otherwise as data URL
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setAttachedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          content: text,
        });
        if (!form.resumeText) {
          setForm((prev) => ({ ...prev, resumeText: text.substring(0, 1000) }));
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/pdf',
          content: dataUrl,
        });
        if (!form.resumeText) {
          setForm((prev) => ({
            ...prev,
            resumeText: `[Attached Resume File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/careers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRequisitionId: selectedJob.id,
          ...form,
          resumeFileName: attachedFile?.name,
          resumeDataUrl: attachedFile?.content,
        }),
      });

      if (res.ok) {
        setSubmittedSuccess(true);
      } else {
        const d = await res.json();
        setErrorMessage(d.error || 'Failed to submit application');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredJobs = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.department?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.branchLocation?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl text-white shadow-md shadow-emerald-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">{tenantInfo.name}</span>
              <span className="text-[10px] text-emerald-400 block font-mono">CAREERS PORTAL</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              Employee Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> We Are Actively Hiring Engineers & Product Leaders
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white max-w-2xl mx-auto leading-tight">
          Build the Future of Enterprise AI & Automation
        </h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
          Join our high-velocity engineering team designing next-generation HRMS, financial payroll engines, and distributed intelligence architectures.
        </p>

        {/* Search Bar */}
        <div className="pt-4 max-w-md mx-auto">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, department, or city..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Job Postings Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-400" />
            Open Positions ({filteredJobs.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Loading open requisitions...
          </div>
        ) : filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-emerald-950/20"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {job.department?.name || 'Engineering'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Exp: {job.experienceYears}+ Yrs
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white">{job.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      {job.branchLocation?.city || 'Bengaluru'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      Full-time
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center">
                  <div className="text-xs font-mono text-emerald-400">
                    {job.minCtc && job.maxCtc ? `₹${(job.minCtc / 100000).toFixed(0)}L - ₹${(job.maxCtc / 100000).toFixed(0)}L CTC` : 'Competitive Compensation'}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setIsApplyOpen(true);
                      setSubmittedSuccess(false);
                      setErrorMessage(null);
                      setAttachedFile(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    Apply Now <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No open roles matching your search criteria.
          </div>
        )}
      </section>

      {/* Application Modal */}
      {isApplyOpen && selectedJob && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Apply for {selectedJob.title}</h3>
                <p className="text-xs text-slate-400">{selectedJob.department?.name} • {selectedJob.branchLocation?.city}</p>
              </div>
              <button
                onClick={() => setIsApplyOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {submittedSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="h-12 w-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-base text-white">Thank you for applying!</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  We have received your application for <span className="font-semibold text-emerald-400">{selectedJob.title}</span>.
                </p>
                <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-[11px] text-slate-400 max-w-sm mx-auto flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span>An automated confirmation email has been dispatched to <strong className="text-slate-200">{form.email}</strong>.</span>
                </div>
                <button
                  onClick={() => setIsApplyOpen(false)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-300 block mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Maya"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-300 block mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Nair"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="maya.nair@example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-300 block mb-1">Mobile Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-300 block mb-1">Current Company</label>
                    <input
                      type="text"
                      value={form.currentCompany}
                      onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Current Employer or Organization"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Expected CTC (INR / Year)</label>
                  <input
                    type="number"
                    value={form.expectedCtc}
                    onChange={(e) => setForm({ ...form, expectedCtc: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Key Skills & Competencies (comma separated)</label>
                  <input
                    type="text"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="React, TypeScript, Next.js, Distributed Systems"
                  />
                </div>

                {/* Dedicated Resume Attachment Area */}
                <div>
                  <label className="font-medium text-slate-300 flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-emerald-400" />
                      Attach Resume / CV *
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">PDF, DOCX, DOC, TXT (Max 10MB)</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    id="resume-file-upload"
                  />

                  {attachedFile ? (
                    /* Attached File Card */
                    <div className="p-3 bg-slate-800/90 border border-emerald-500/40 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate text-xs flex items-center gap-1.5">
                            {attachedFile.name}
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Check className="h-3 w-3" /> Attached
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {formatFileSize(attachedFile.size)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={removeAttachedFile}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Remove attached file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    /* Upload Dropzone */
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        isDraggingFile
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 hover:border-emerald-500/60 bg-slate-800/40 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="h-9 w-9 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center border border-slate-700">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">
                            Click to browse or drag & drop your resume file
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Supports PDF, Word Documents (.docx, .doc), or Text files
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Cover Note / Summary (Optional)</label>
                  <textarea
                    rows={2}
                    value={form.resumeText}
                    onChange={(e) => setForm({ ...form, resumeText: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Provide additional details or link to your portfolio/GitHub profile..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsApplyOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                  >
                    {submitting ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Submit Application
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
