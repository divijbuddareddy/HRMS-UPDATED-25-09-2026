'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/access-policy';
import { Network, Search, ChevronDown, ChevronRight, Users, Building, List, RefreshCw } from 'lucide-react';

type Person = {
  id: string;
  name: string;
  code: string;
  managerId: string | null;
  status: string;
  designation: string | null;
  department: string | null;
  location: string | null;
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const PALETTE = ['bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'];
const colorFor = (key: string) => PALETTE[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

export default function OrgChartPage() {
  const { user } = useAuth();
  const isAdmin = can(user, 'employees:manage');
  const [people, setPeople] = useState<Person[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'CHART' | 'LIST'>('CHART');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const res = await fetch('/api/org-chart');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the organization chart');
      setPeople(data.employees || []);
      setMe(data.me);
      setCompany(data.companyName || '');
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
    // Stay current: refresh when the tab is focused again and every 2 minutes.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    const t = window.setInterval(load, 120_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(t);
    };
  }, [user]);

  const { roots, childrenOf, byId } = useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const childrenOf = new Map<string, Person[]>();
    const roots: Person[] = [];
    for (const p of people) {
      if (p.managerId && byId.has(p.managerId) && p.managerId !== p.id) {
        const list = childrenOf.get(p.managerId) || [];
        list.push(p);
        childrenOf.set(p.managerId, list);
      } else {
        roots.push(p);
      }
    }
    // People who manage others first among the roots, then alphabetical
    roots.sort((a, b) => (childrenOf.get(b.id)?.length || 0) - (childrenOf.get(a.id)?.length || 0) || a.name.localeCompare(b.name));
    return { roots, childrenOf, byId };
  }, [people]);

  const teamSize = useMemo(() => {
    const memo = new Map<string, number>();
    const count = (id: string, seen = new Set<string>()): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = (childrenOf.get(id) || []).reduce((a, c) => a + 1 + count(c.id, seen), 0);
      memo.set(id, n);
      return n;
    };
    return (id: string) => count(id);
  }, [childrenOf]);

  // Search: matching people plus everyone above them stay visible and expanded
  const q = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const hit = new Set<string>();
    const path = new Set<string>();
    for (const p of people) {
      if ([p.name, p.code, p.designation, p.department].some((v) => v?.toLowerCase().includes(q))) {
        hit.add(p.id);
        let m = p.managerId;
        for (let i = 0; m && i < people.length; i++) {
          path.add(m);
          m = byId.get(m)?.managerId || null;
        }
      }
    }
    return { hit, path };
  }, [q, people, byId]);

  const visible = (p: Person): boolean => {
    if (!matches) return true;
    if (matches.hit.has(p.id) || matches.path.has(p.id)) return true;
    return false;
  };
  const isOpen = (id: string) => (matches ? true : !collapsed.has(id));
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const managers = people.filter((p) => (childrenOf.get(p.id) || []).length > 0).length;
  const departments = new Set(people.map((p) => p.department).filter(Boolean)).size;
  const hierarchyMissing = people.length > 1 && managers === 0;

  const Card = ({ p }: { p: Person }) => {
    const kids = (childrenOf.get(p.id) || []).filter(visible);
    const direct = (childrenOf.get(p.id) || []).length;
    const highlighted = matches?.hit.has(p.id);
    return (
      <div
        className={`inline-flex flex-col items-center w-48 bg-white rounded-2xl border shadow-sm px-3 py-3 text-center transition-shadow ${
          p.id === me ? 'border-emerald-400 ring-2 ring-emerald-200' : highlighted ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'
        }`}
      >
        <div className={`h-10 w-10 rounded-full ${colorFor(p.id)} text-white text-sm font-bold flex items-center justify-center`}>
          {initials(p.name)}
        </div>
        <div className="mt-2 text-xs font-semibold text-slate-900 leading-tight">
          {p.name}
          {p.id === me && <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">YOU</span>}
        </div>
        <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{p.designation || '—'}</div>
        {p.department && (
          <div className="mt-1.5 text-[10px] text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 truncate max-w-full">{p.department}</div>
        )}
        {direct > 0 && (
          <button
            onClick={() => toggle(p.id)}
            className="mt-2 text-[10px] font-medium text-slate-600 hover:text-emerald-700 inline-flex items-center gap-0.5"
          >
            {isOpen(p.id) && kids.length ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {direct} direct · {teamSize(p.id)} total
          </button>
        )}
      </div>
    );
  };

  const Branch = ({ p }: { p: Person }) => {
    const kids = (childrenOf.get(p.id) || []).filter(visible);
    return (
      <li>
        <Card p={p} />
        {kids.length > 0 && isOpen(p.id) && (
          <ul>
            {kids.map((c) => (
              <Branch key={c.id} p={c} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const ListRow = ({ p, depth }: { p: Person; depth: number }) => {
    const kids = (childrenOf.get(p.id) || []).filter(visible);
    return (
      <>
        <div
          className={`flex items-center gap-3 py-2 pr-3 border-b border-slate-100 ${p.id === me ? 'bg-emerald-50/60' : matches?.hit.has(p.id) ? 'bg-amber-50/60' : ''}`}
          style={{ paddingLeft: 12 + depth * 24 }}
        >
          {kids.length > 0 ? (
            <button onClick={() => toggle(p.id)} className="text-slate-400 hover:text-slate-700">
              {isOpen(p.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <div className={`h-7 w-7 rounded-full ${colorFor(p.id)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
            {initials(p.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {p.name} <span className="text-slate-400 font-mono font-normal">{p.code}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {[p.designation, p.department, p.location].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {(childrenOf.get(p.id) || []).length > 0 && (
            <span className="text-[10px] text-slate-500 shrink-0">{teamSize(p.id)} in team</span>
          )}
        </div>
        {isOpen(p.id) && kids.map((c) => <ListRow key={c.id} p={c} depth={depth + 1} />)}
      </>
    );
  };

  const visibleRoots = roots.filter(visible);

  return (
    <DashboardLayout title="Organization Chart" subtitle={company ? `Who reports to whom at ${company}` : 'Who reports to whom'}>
      <style>{`
        .oc ul { padding-top: 20px; position: relative; display: flex; justify-content: center; margin: 0; }
        .oc li { list-style: none; position: relative; padding: 20px 8px 0; display: flex; flex-direction: column; align-items: center; }
        .oc li::before, .oc li::after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 20px; border-top: 1.5px solid #cbd5e1; }
        .oc li::after { right: auto; left: 50%; border-left: 1.5px solid #cbd5e1; }
        .oc li:only-child::before, .oc li:only-child::after { display: none; }
        .oc li:only-child { padding-top: 0; }
        .oc li:first-child::before, .oc li:last-child::after { border: 0 none; }
        .oc li:last-child::before { border-right: 1.5px solid #cbd5e1; border-radius: 0 6px 0 0; }
        .oc li:first-child::after { border-radius: 6px 0 0 0; }
        .oc ul ul::before { content: ''; position: absolute; top: 0; left: 50%; height: 20px; border-left: 1.5px solid #cbd5e1; }
        .oc > ul.oc-roots { padding-top: 0; flex-wrap: wrap; gap: 28px 12px; align-items: flex-start; }
        .oc > ul.oc-roots > li { padding-top: 0; }
        .oc > ul.oc-roots > li::before, .oc > ul.oc-roots > li::after { display: none; }
      `}</style>

      <div className="space-y-5">
        {/* Summary + controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Users className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold text-slate-900">{people.length}</div>
              <div className="text-[11px] text-slate-500">People</div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Network className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold text-slate-900">{managers}</div>
              <div className="text-[11px] text-slate-500">Managers</div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600"><Building className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold text-slate-900">{departments}</div>
              <div className="text-[11px] text-slate-500">Departments</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a person, role or department…"
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setView('CHART')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 ${view === 'CHART' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Network className="h-3.5 w-3.5" /> Chart
            </button>
            <button
              onClick={() => setView('LIST')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 ${view === 'LIST' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button onClick={() => setCollapsed(new Set())} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
              Expand all
            </button>
            <button onClick={load} title="Refresh" className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {hierarchyMissing && (
          <div className="p-3 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900">
            Nobody has a reporting manager yet, so everyone appears at the top level.
            {isAdmin ? (
              <>
                {' '}Set it in <Link href="/employees" className="font-semibold underline">Employees</Link> → Edit → <strong>Reporting Manager</strong>, and the chart builds itself.
              </>
            ) : (
              ' HR will set this up.'
            )}
          </div>
        )}
        {error && <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : visibleRoots.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            {q ? 'Nobody matches your search.' : 'No employees yet.'}
          </div>
        ) : view === 'CHART' ? (
          <div className="bg-slate-50/60 rounded-2xl border border-slate-200 p-6 overflow-x-auto">
            <div className={`oc mx-auto ${hierarchyMissing ? '' : 'min-w-max'}`}>
              <ul className="oc-roots">
                {visibleRoots.map((r) => (
                  <Branch key={r.id} p={r} />
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {visibleRoots.map((r) => (
              <ListRow key={r.id} p={r} depth={0} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
