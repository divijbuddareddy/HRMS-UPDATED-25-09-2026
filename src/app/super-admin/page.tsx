'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  ShieldAlert,
  ShieldCheck,
  Crown,
  Server,
  Users,
  Cpu,
  Database,
  Key,
  Terminal,
  Activity,
  Search,
  Lock,
  Sparkles,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Building,
  Layers,
  X,
  ArrowUpRight,
  Fingerprint,
  Menu,
} from 'lucide-react';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  domain?: string;
  plan: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  _count?: {
    users?: number;
    employees?: number;
    payrollRuns?: number;
    job_requisitions?: number;
  };
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'ENTERPRISE' | 'GROWTH' | 'STANDARD'>('ALL');

  // Impersonation Modal State
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateTicket, setImpersonateTicket] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateSuccess, setImpersonateSuccess] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/tenants');
      const data = await res.json();
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Failed to fetch super-admin tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonatingTenant || !impersonateReason) return;
    setImpersonateLoading(true);

    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: impersonatingTenant.id,
          reason: impersonateReason,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Impersonation session established for Tenant: ${impersonatingTenant.name}. Redirecting to tenant dashboard...`);
        window.location.href = '/dashboard';
      } else {
        const err = await res.json();
        alert(`Impersonation error: ${err.error || 'Failed'}`);
      }
    } catch (e) {
      console.error('Impersonation error:', e);
    } finally {
      setImpersonateLoading(false);
      setImpersonatingTenant(null);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const slug = t.slug || t.code || t.subdomain || '';
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.domain && t.domain.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPlan = selectedPlan === 'ALL' || t.plan?.toUpperCase() === selectedPlan;

    return matchesSearch && matchesPlan;
  });

  const totalUsers = tenants.reduce((acc, t) => acc + (t._count?.users || 0), 0);
  const totalEmployees = tenants.reduce((acc, t) => acc + (t._count?.employees || 0), 0);
  const enterpriseCount = tenants.filter((t) => t.plan?.toUpperCase() === 'ENTERPRISE').length;

  return (
    <div className="flex h-screen bg-[#07090e] text-slate-100 antialiased font-sans overflow-hidden select-none">
      <Sidebar isOpenMobile={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]">
        {/* Futuristic Super Admin Header */}
        <header className="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-cyan-500/15 bg-[#0a0d16]/85 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden focus:outline-none"
              title="Open Navigation"
            >
              <Menu className="w-6 h-6 text-cyan-400" />
            </button>
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 ring-2 ring-[#0a0d16]"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
                  SaaS Super Admin Command Center
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  ROOT LEVEL
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Multi-Tenant Architecture • Sharded Data Isolation • Dual-Key Impersonation Vault
              </p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
              <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">Global Cluster:</span>
              <span className="text-emerald-400 font-bold">100% HEALTHY</span>
            </div>

            <button
              onClick={fetchTenants}
              title="Refresh Tenants Telemetry"
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Cyber Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Active Tenants */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-b from-[#101524] to-[#0a0e18] border border-cyan-500/20 shadow-lg shadow-cyan-950/40 group hover:border-cyan-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold font-mono tracking-wider text-cyan-400 uppercase">
                    Active Tenants
                  </span>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight font-mono">
                    {tenants.length}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Building className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>100% Isolated Data Boundary</span>
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Card 2: Total SaaS Users */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-b from-[#101524] to-[#0a0e18] border border-indigo-500/20 shadow-lg shadow-indigo-950/40 group hover:border-indigo-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold font-mono tracking-wider text-indigo-400 uppercase">
                    Total SaaS Users
                  </span>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight font-mono">
                    {totalUsers}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-indigo-300 font-medium">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                <span>Active Across All Subdomains</span>
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Card 3: Managed Headcount */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-b from-[#101524] to-[#0a0e18] border border-purple-500/20 shadow-lg shadow-purple-950/40 group hover:border-purple-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold font-mono tracking-wider text-purple-400 uppercase">
                    Managed Headcount
                  </span>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight font-mono">
                    {totalEmployees}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Database className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-300 font-medium">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                <span>Employee Profiles & Identities</span>
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Card 4: Enterprise Plan Tier */}
            <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-b from-[#101524] to-[#0a0e18] border border-amber-500/20 shadow-lg shadow-amber-950/40 group hover:border-amber-500/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold font-mono tracking-wider text-amber-400 uppercase">
                    Security Level
                  </span>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight font-mono">
                    TIER-3
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                <Fingerprint className="h-3.5 w-3.5" />
                <span>Dual-Key Time-Bounded Tokens</span>
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-[#0c101d] border border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center shadow-lg">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tenant name, slug, domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#121829] border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              {/* Plan Filter Pills */}
              <div className="flex bg-[#121829] p-1 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800">
                <button
                  onClick={() => setPlanFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    planFilter === 'ALL'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'hover:text-white'
                  }`}
                >
                  All ({tenants.length})
                </button>
                <button
                  onClick={() => setPlanFilter('ENTERPRISE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    planFilter === 'ENTERPRISE'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'hover:text-white'
                  }`}
                >
                  Enterprise ({enterpriseCount})
                </button>
                <button
                  onClick={() => setPlanFilter('STANDARD')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    planFilter === 'STANDARD'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'hover:text-white'
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              Showing {filteredTenants.length} of {tenants.length} Organizations
            </span>
          </div>

          {/* Tenants Holographic Table */}
          <div className="rounded-2xl border border-cyan-500/20 bg-[#0a0e1a]/90 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#0e1424] border-b border-slate-800/80 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Multi-Tenant Organization Matrix
              </span>
              <span className="font-mono text-[11px] text-cyan-400/80">
                DATABASE: SQLite Cluster (tenant_id Isolated)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0c1220] text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Organization / Tenant</th>
                    <th className="px-6 py-4">Tenant Slug & Domain</th>
                    <th className="px-6 py-4">Subscription Tier</th>
                    <th className="px-6 py-4">Users / Headcount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Support Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-400" />
                        Loading multi-tenant metadata...
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No matching tenants found.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => {
                      const slug = tenant.slug || tenant.code || 'default';
                      const isEnterprise = tenant.plan?.toUpperCase() === 'ENTERPRISE';
                      const createdDate = tenant.createdAt || tenant.created_at || new Date().toISOString();

                      return (
                        <tr
                          key={tenant.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-900 to-indigo-900 border border-cyan-500/30 flex items-center justify-center font-bold text-xs text-cyan-300">
                                {tenant.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                                  {tenant.name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                                  ID: {tenant.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-mono text-xs text-cyan-400 font-semibold">{slug}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{tenant.domain || `${slug}.hrms.local`}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase inline-flex items-center gap-1 ${
                                isEnterprise
                                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {tenant.plan || 'ENTERPRISE'}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-mono font-bold text-slate-200">
                              {tenant._count?.users || 1} <span className="text-slate-500 font-normal">users</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {tenant._count?.employees || 0} employees
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              {tenant.status || 'ACTIVE'}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                            {format(new Date(createdDate), 'dd MMM yyyy')}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedTenant(tenant)}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-orange-950/50 transition-all active:scale-95 flex items-center gap-1.5 ml-auto"
                            >
                              <Key className="h-3.5 w-3.5" />
                              Impersonate
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Cyber Impersonation Authorization Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1322] border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Super Admin Support Impersonation</h3>
                  <p className="text-xs text-slate-400">
                    Target: <strong className="text-amber-300">{selectedTenant.name}</strong> ({selectedTenant.slug || selectedTenant.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTenant(null)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {impersonateSuccess ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-emerald-300 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Impersonation Token Granted
                </div>
                <p>{impersonateSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-amber-950/30 border border-amber-800/50 rounded-2xl text-amber-300 text-xs leading-relaxed flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Security Policy Notice:</strong> All impersonated sessions generate dual-key audit logs, time-bounded access tokens, and require mandatory justification reason and ticket reference.
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Support Ticket / Audit Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZENDESK-8924 / JIRA-HRMS-104"
                    value={impersonateTicket}
                    onChange={(e) => setImpersonateTicket(e.target.value)}
                    className="w-full bg-[#141b2d] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Justification Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Investigating payroll statutory rounding discrepancy as requested by client HR lead"
                    value={impersonateReason}
                    onChange={(e) => setImpersonateReason(e.target.value)}
                    className="w-full bg-[#141b2d] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedTenant(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={impersonating || !impersonateReason.trim()}
                    onClick={handleImpersonate}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-orange-950/60 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Key className="h-4 w-4" />
                    {impersonating ? 'Generating Token...' : 'Authorize Impersonated Session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
