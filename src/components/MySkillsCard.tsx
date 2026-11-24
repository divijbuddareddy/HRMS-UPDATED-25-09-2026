'use client';

import React, { useEffect, useState } from 'react';
import { Award, Plus, X, Pencil, Check, Loader2 } from 'lucide-react';
import { SKILL_LEVELS, SKILL_LEVEL_LABEL, SkillLevel } from '@/lib/skills';

type Skill = { id: string; name: string; level: SkillLevel; years: number | null };

export const LEVEL_CHIP: Record<SkillLevel, string> = {
  BEGINNER: 'bg-slate-50 text-slate-700 border-slate-200',
  INTERMEDIATE: 'bg-blue-50 text-blue-700 border-blue-200',
  ADVANCED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPERT: 'bg-purple-50 text-purple-700 border-purple-200',
};

/** Dashboard card where the logged-in employee keeps their skill set. Saved instantly. */
export function MySkillsCard() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [years, setYears] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [editYears, setEditYears] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      if (res.ok) {
        setSkills(data.skills || []);
        setSuggestions(data.suggestions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level, years: years === '' ? null : years }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the skill');
      setMessage({ ok: true, text: data.updated ? `Updated "${data.skill.name}".` : `Added "${data.skill.name}".` });
      setName('');
      setYears('');
      await load();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Skill) => {
    if (!confirm(`Remove "${s.name}" from your skills?`)) return;
    const res = await fetch(`/api/skills/${s.id}`, { method: 'DELETE' });
    if (res.ok) {
      setSkills((list) => list.filter((x) => x.id !== s.id));
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage({ ok: false, text: d.error || 'Could not remove the skill' });
    }
  };

  const startEdit = (s: Skill) => {
    setEditId(s.id);
    setEditLevel(s.level);
    setEditYears(s.years == null ? '' : String(s.years));
  };

  const saveEdit = async (s: Skill) => {
    const res = await fetch(`/api/skills/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: editLevel, years: editYears === '' ? null : editYears }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: d.error || 'Could not update the skill' });
      return;
    }
    setSkills((list) => list.map((x) => (x.id === s.id ? d.skill : x)));
    setEditId(null);
  };

  const mine = new Set(skills.map((s) => s.name.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
          <Award className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">My Skills</h3>
          <p className="text-xs text-slate-500">
            Add the skills you have so HR can find you for the right projects. Only you, HR and the company owner can see them.
          </p>
        </div>
      </div>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Skill</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            list="skill-suggestions"
            maxLength={60}
            placeholder="e.g. Excel, React, Tally, Sales"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          <datalist id="skill-suggestions">
            {suggestions
              .filter((s) => !mine.has(s.toLowerCase()))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as SkillLevel)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
          >
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {SKILL_LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="text-[11px] font-medium text-slate-500 block mb-1">Years (optional)</label>
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex items-center gap-1 text-sm font-medium bg-emerald-600 text-white rounded-lg px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </form>

      {message && <p className={`text-xs mt-2 ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{message.text}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
        {!loading && skills.length === 0 && (
          <span className="text-xs text-slate-400">You haven&apos;t added any skills yet.</span>
        )}
        {skills.map((s) =>
          editId === s.id ? (
            <div key={s.id} className="flex items-center gap-1.5 border border-emerald-300 rounded-full pl-3 pr-1 py-1 text-xs">
              <span className="font-medium text-slate-800">{s.name}</span>
              <select
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value as SkillLevel)}
                className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
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
                value={editYears}
                onChange={(e) => setEditYears(e.target.value)}
                placeholder="yrs"
                className="w-14 text-xs border border-slate-200 rounded px-1 py-0.5"
              />
              <button type="button" onClick={() => saveEdit(s)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-full" title="Save">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-full" title="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div key={s.id} className={`flex items-center gap-1.5 border rounded-full pl-3 pr-1 py-1 text-xs ${LEVEL_CHIP[s.level]}`}>
              <span className="font-medium">{s.name}</span>
              <span className="opacity-75">
                · {SKILL_LEVEL_LABEL[s.level]}
                {s.years != null ? ` · ${s.years} yr${s.years === 1 ? '' : 's'}` : ''}
              </span>
              <button type="button" onClick={() => startEdit(s)} className="p-1 hover:bg-white/70 rounded-full" title="Edit">
                <Pencil className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => remove(s)} className="p-1 hover:bg-white/70 rounded-full" title="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
