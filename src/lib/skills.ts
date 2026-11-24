import { canCompanyWide, isOwner } from './access-policy';
import type { PolicyUser } from './access-policy';

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export const MAX_SKILLS_PER_EMPLOYEE = 50;
export const MAX_SKILL_NAME = 60;

export function levelRank(level: string | null | undefined): number {
  const i = SKILL_LEVELS.indexOf(level as SkillLevel);
  return i < 0 ? 0 : i;
}

/** Trim and collapse whitespace; the display form of a skill name. */
export function cleanSkillName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}

/** Matching key: "  react.JS " -> "react.js". */
export function skillKey(raw: unknown): string {
  return cleanSkillName(raw).toLowerCase();
}

/** HR (HR Admin / HR Executive) and the company owner can search everyone's skills. */
export function canSearchSkills(user: PolicyUser | null | undefined): boolean {
  return isOwner(user) || canCompanyWide(user, 'employees:manage');
}

/** Validate a skill payload; returns an error message or the cleaned values. */
export function parseSkillInput(body: any):
  | { error: string }
  | { name: string; nameKey: string; level: SkillLevel; years: number | null } {
  const name = cleanSkillName(body?.name);
  if (!name) return { error: 'Enter a skill name.' };
  if (name.length > MAX_SKILL_NAME) return { error: `Skill name can be at most ${MAX_SKILL_NAME} characters.` };
  const level = (body?.level ?? 'INTERMEDIATE') as SkillLevel;
  if (!SKILL_LEVELS.includes(level)) return { error: 'Choose a valid level.' };
  let years: number | null = null;
  if (body?.years !== undefined && body?.years !== null && body?.years !== '') {
    const n = Number(body.years);
    if (!Number.isFinite(n) || n < 0 || n > 60) return { error: 'Years of experience must be between 0 and 60.' };
    years = Math.round(n * 10) / 10;
  }
  return { name, nameKey: skillKey(name), level, years };
}
