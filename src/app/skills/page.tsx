'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Search, X, Award, Users, Download } from 'lucide-react';
import { SKILL_LEVELS, SKILL_LEVEL_LABEL, SkillLevel } from '@/lib/skills';
import { LEVEL_CHIP } from '@/components/MySkillsCard';

type ResultSkill = { id: string; name: string; level: SkillLevel; years: number | null; matched: boolean };
type Result = {
  id: string;
  name: string;
  employeeCode: string;
  workEmail: string;
  department: string | null;
  designation: string | null;
  skills: ResultSkill[];
};
type CatalogEntry = { key: string; name: string; count: number };

export default function SkillsDirectoryPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [totals, setTotals] = useState({ employees: 0, withSkills: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    if (debounced.trim()) params.set('q', debounced);
    if (minLevel) params.set('minLevel', minLevel);
    if (departmentId) params.set('departmentId', departmentId);
    let cancelled = false;
    setLoading(true);
    fetch(`/api/skills/search?${params}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load skills');
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setResults(d.results);
        setCatalog(d.catalog);
        setDepartments(d.departments);
        setTotals(d.totals);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, debounced, minLevel, departmentId]);

  const activeTerms = useMemo(
    () => query.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    [query],
  );

  const toggleSkill = (name: string) => {
    const terms = query.split(',').map((t) => t.trim()).filter(Boolean);
    const i = terms.findIndex((t) => t.toLowerCase() === name.toLowerCase());
    if (i >= 0) terms.splice(i, 1);
    else terms.push(name);
    setQuery(terms.join(', '));
    setDebounced(terms.join(', '));
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['Employee', 'Code', 'Email', 'Department', 'Designation', 'Skills'],
      ...results.map((r) => [
        r.name,
        r.employeeCode,
        r.workEmail,
        r.department || '',
        r.designation || '',
        r.skills.map((s) => `${s.name} (${SKILL_LEVEL_LABEL[s.level]}${s.years != null ? `, ${s.years} yrs` : ''})`).join('; '),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skills-${debounced.trim() ? debounced.trim().replace(/[^a-z0-9]+/gi, '-') : 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const visibleCatalog = showAllCatalog ? catalog : catalog.slice(0, 30);
  const filtersOn = !!(query.trim() || minLevel || departmentId);

  return (
    <DashboardLayout title="Skills Directory" subtitle="Find employees by the skills they have added on their dashboard">
      <div className="space-y-5">
        {error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">{error}</div>
        ) : (
          <>
            {/* Search & filters */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search skills, e.g. React  —  use commas to require several: React, Node"
                    className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        setDebounced('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      title="Clear"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                >
                  <option value="">Any level</option>
                  {SKILL_LEVELS.slice(1).map((l) => (
                    <option key={l} value={l}>
                      {SKILL_LEVEL_LABEL[l]} or above
                    </option>
                  ))}
                </select>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={exportCsv}
                  disabled={!results.length}
                  className="flex items-center gap-1 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> CSV
                </button>
              </div>

              {/* Skill catalog */}
              <div>
                <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                  Skills in your company ({catalog.length}) · click to search
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {catalog.length === 0 && !loading && (
                    <span className="text-xs text-slate-400">No employee has added skills yet.</span>
                  )}
                  {visibleCatalog.map((c) => {
                    const on = activeTerms.includes(c.name.toLowerCase());
                    return (
                      <button
                        key={c.key}
                        onClick={() => toggleSkill(c.name)}
                        className={`text-xs border rounded-full px-2.5 py-1 transition-colors ${
                          on
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200'
                        }`}
                      >
                        {c.name} <span className={on ? 'text-emerald-100' : 'text-slate-400'}>{c.count}</span>
                      </button>
                    );
                  })}
                  {catalog.length > 30 && (
                    <button onClick={() => setShowAllCatalog((v) => !v)} className="text-xs text-emerald-700 hover:underline px-1">
                      {showAllCatalog ? 'Show fewer' : `Show all ${catalog.length}`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {filtersOn
                    ? `${results.length} employee${results.length === 1 ? '' : 's'} found`
                    : `${totals.withSkills} of ${totals.employees} employees have added skills`}
                </div>
                {loading && <span className="text-xs text-slate-400">Searching…</span>}
              </div>
              {!loading && results.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  <Award className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  {filtersOn ? 'Nobody matches this search.' : 'Employees can add their skills from the My Skills card on their dashboard.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                      <div className="md:w-64 shrink-0">
                        <div className="text-sm font-medium text-slate-800">{r.name}</div>
                        <div className="text-xs text-slate-500">
                          {r.employeeCode}
                          {r.designation ? ` · ${r.designation}` : ''}
                          {r.department ? ` · ${r.department}` : ''}
                        </div>
                        <a href={`mailto:${r.workEmail}`} className="text-xs text-emerald-700 hover:underline">
                          {r.workEmail}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...r.skills]
                          .sort((a, b) => Number(b.matched) - Number(a.matched))
                          .map((s) => (
                            <span
                              key={s.id}
                              className={`text-xs border rounded-full px-2.5 py-0.5 ${LEVEL_CHIP[s.level]} ${
                                s.matched ? 'ring-2 ring-emerald-400 font-semibold' : ''
                              }`}
                            >
                              {s.name}
                              <span className="opacity-70">
                                {' '}
                                · {SKILL_LEVEL_LABEL[s.level]}
                                {s.years != null ? ` · ${s.years}y` : ''}
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
