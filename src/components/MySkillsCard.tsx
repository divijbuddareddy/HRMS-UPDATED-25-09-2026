'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, Plus, Trash2, Loader2, Send, RotateCcw } from 'lucide-react';
import { SKILL_LEVELS, SKILL_LEVEL_LABEL, SkillLevel } from '@/lib/skills';
import { format } from 'date-fns';

type Skill = { id: string; name: string; level: SkillLevel; years: number | null; updatedAt?: string };
type Row = { key: string; id?: string; name: string; level: SkillLevel; years: string };

export const LEVEL_CHIP: Record<SkillLevel, string> = {
  BEGINNER: 'bg-slate-50 text-slate-700 border-slate-200',
  INTERMEDIATE: 'bg-blue-50 text-blue-700 border-blue-200',
  ADVANCED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPERT: 'bg-purple-50 text-purple-700 border-purple-200',
};

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;
const toRows = (skills: Skill[]): Row[] =>
  skills.map((s) => ({ key: newKey(), id: s.id, name: s.name, level: s.level, years: s.years == null ? '' : String(s.years) }));
const blankRow = (): Row => ({ key: newKey(), name: '', level: 'INTERMEDIATE', years: '' });
const norm = (v: string) => v.replace(/\s+/g, ' ').trim();
const signature = (rows: Row[]) =>
  JSON.stringify(
    rows
      .filter((r) => norm(r.name))
      .map((r) => [r.id || '', norm(r.name), r.level, r.years === '' ? '' : String(Number(r.years))]),
  );

/**
 * Dashboard card where the logged-in employee edits their skill set and submits it.
 * Nothing is saved until Submit; HR, managers and the owner see the last submitted list.
 */
export function MySkillsCard() {
  const [saved, setSaved] = useState<Skill[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      if (res.ok) {
        setSaved(data.skills || []);
        setRows(data.skills?.length ? toRows(data.skills) : [blankRow()]);
        setSuggestions(data.suggestions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => signature(rows) !== signature(toRows(saved)), [rows, saved]);

  // Warn before leaving the page with unsubmitted changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (key: string, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMessage(null);
    setErrorKey(null);
  };
  const removeRow = (key: string) => {
    setRows((list) => {
      const next = list.filter((r) => r.key !== key);
      return next.length ? next : [blankRow()];
    });
    setMessage(null);
    setErrorKey(null);
  };
  const addRow = () => setRows((list) => [...list, blankRow()]);

  const discard = () => {
    setRows(saved.length ? toRows(saved) : [blankRow()]);
    setMessage(null);
    setErrorKey(null);
  };

  const submit = async () => {
    const filled = rows.filter((r) => norm(r.name));
    // Client-side checks so the employee sees the problem next to the row.
    const seen = new Set<string>();
    for (const r of filled) {
      const k = norm(r.name).toLowerCase();
      if (seen.has(k)) {
        setErrorKey(r.key);
        setMessage({ ok: false, text: `"${norm(r.name)}" is listed twice. Remove one of them.` });
        return;
      }
      seen.add(k);
      if (r.years !== '' && (Number(r.years) < 0 || Number(r.years) > 60 || !Number.isFinite(Number(r.years)))) {
        setErrorKey(r.key);
        setMessage({ ok: false, text: `Years for "${norm(r.name)}" must be between 0 and 60.` });
        return;
      }
    }

    setSubmitting(true);
    setMessage(null);
    setErrorKey(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: filled.map((r) => ({ id: r.id, name: norm(r.name), level: r.level, years: r.years === '' ? null : r.years })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.index === 'number' && filled[data.index]) setErrorKey(filled[data.index].key);
        throw new Error(data.error || 'Could not submit your skills');
      }
      setSaved(data.skills);
      setRows(data.skills.length ? toRows(data.skills) : [blankRow()]);
      setMessage({ ok: true, text: `Submitted. ${data.skills.length} skill${data.skills.length === 1 ? '' : 's'} saved.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const lastSubmitted = saved.reduce<string | null>(
    (max, s) => (s.updatedAt && (!max || s.updatedAt > max) ? s.updatedAt : max),
    null,
  );
  const used = new Set(rows.map((r) => norm(r.name).toLowerCase()));

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">My Skills</h3>
            <p className="text-xs text-slate-500">
              Edit your skills and click Submit. Only you, HR, managers and the company owner can see them.
            </p>
          </div>
        </div>
        <div className="text-[11px] text-right">
          {dirty ? (
            <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
              Unsaved changes
            </span>
          ) : lastSubmitted ? (
            <span className="text-slate-400">Last submitted {format(new Date(lastSubmitted), 'dd MMM yyyy, h:mm a')}</span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-400">Loading…</div>
      ) : (
        <>
          <datalist id="skill-suggestions">
            {suggestions
              .filter((s) => !used.has(s.toLowerCase()))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>

          <div className="hidden sm:grid grid-cols-[1fr_150px_90px_36px] gap-2 text-[11px] font-medium text-slate-500 px-1 mb-1">
            <span>Skill</span>
            <span>Level</span>
            <span>Years (optional)</span>
            <span />
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.key}
                className={`grid grid-cols-[1fr_80px_36px] sm:grid-cols-[1fr_150px_90px_36px] gap-2 items-center rounded-lg ${
                  errorKey === r.key ? 'ring-2 ring-rose-300 p-1' : ''
                }`}
              >
                <input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  list="skill-suggestions"
                  maxLength={60}
                  placeholder="e.g. Excel, React, Tally, Sales"
                  className="col-span-3 sm:col-span-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <select
                  value={r.level}
                  onChange={(e) => update(r.key, { level: e.target.value as SkillLevel })}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                >
                  {SKILL_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {SKILL_LEVEL_LABEL[l]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={r.years}
                  onChange={(e) => update(r.key, { years: e.target.value })}
                  placeholder="yrs"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2"
                />
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg justify-self-end"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-sm text-emerald-700 font-medium hover:bg-emerald-50 rounded-lg px-2 py-1.5"
            >
              <Plus className="h-4 w-4" /> Add another skill
            </button>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={discard}
                  disabled={submitting}
                  className="flex items-center gap-1 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Discard
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !dirty}
                className="flex items-center gap-1 text-sm font-medium bg-emerald-600 text-white rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
              </button>
            </div>
          </div>

          {message && <p className={`text-xs mt-2 ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{message.text}</p>}
        </>
      )}
    </div>
  );
}
