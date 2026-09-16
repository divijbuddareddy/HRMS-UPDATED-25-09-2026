'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Send,
  CheckCircle,
  Building2,
  X,
  Layers,
  Search,
} from 'lucide-react';

export default function PublicCareersPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [tenantInfo, setTenantInfo] = useState<any>({ name: 'AI Automation Labs LLP' });
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      const res = await fetch('/api/careers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRequisitionId: selectedJob.id,
          ...form,
        }),
      });

      if (res.ok) {
        setSubmittedSuccess(true);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to submit application');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredJobs = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.department?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.branchLocation?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Apply for {selectedJob.title}</h3>
                <p className="text-xs text-slate-400">{selectedJob.department?.name} • {selectedJob.branchLocation?.city}</p>
              </div>
              <button onClick={() => setIsApplyOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {submittedSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="h-12 w-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-base text-white">Application Received!</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Thank you for applying. Our AI screening pipeline and recruiting team will review your application shortly.
                </p>
                <button
                  onClick={() => setIsApplyOpen(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-3 text-xs">
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
                    <label className="font-medium text-slate-300 block mb-1">Expected CTC (INR)</label>
                    <input
                      type="number"
                      value={form.expectedCtc}
                      onChange={(e) => setForm({ ...form, expectedCtc: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Skills (comma separated for AI matching)</label>
                  <input
                    type="text"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="React, TypeScript, Next.js, Distributed Systems"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">Resume Summary / Profile Link</label>
                  <textarea
                    rows={3}
                    value={form.resumeText}
                    onChange={(e) => setForm({ ...form, resumeText: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Briefly describe your experience or paste LinkedIn/GitHub profile URL..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsApplyOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit Application
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
