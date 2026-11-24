import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/access';
import { canSearchSkills, levelRank, skillKey } from '@/lib/skills';

/**
 * Skills Directory (HR / owner only).
 * GET ?q=react, node   -> employees having ALL listed skills (partial, case-insensitive match)
 *     &minLevel=ADVANCED -> ...at this level or higher
 *     &departmentId=...  -> ...in this department
 * Always returns the company skill catalog with how many employees have each skill.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canSearchSkills(user)) return forbidden('Only HR or the company owner can search skills.');

    const sp = req.nextUrl.searchParams;
    const terms = (sp.get('q') || '')
      .split(',')
      .map(skillKey)
      .filter(Boolean)
      .slice(0, 10);
    const minRank = levelRank(sp.get('minLevel'));
    const departmentId = sp.get('departmentId') || undefined;

    const [employees, departments, catalogRows] = await Promise.all([
      prisma.employee.findMany({
        where: {
          tenantId: user.tenantId,
          status: { notIn: ['EXITED', 'ARCHIVED'] },
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          workEmail: true,
          department: { select: { id: true, name: true } },
          designation: { select: { title: true } },
          skills: { select: { id: true, name: true, nameKey: true, level: true, years: true }, orderBy: { name: 'asc' } },
        },
        orderBy: { firstName: 'asc' },
      }),
      prisma.department.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.employeeSkill.findMany({
        where: { tenantId: user.tenantId, employee: { status: { notIn: ['EXITED', 'ARCHIVED'] } } },
        select: { name: true, nameKey: true },
      }),
    ]);

    // Catalog: one entry per skill, most common spelling wins, with employee counts.
    const byKey = new Map<string, { count: number; spellings: Map<string, number> }>();
    for (const r of catalogRows) {
      const e = byKey.get(r.nameKey) || { count: 0, spellings: new Map() };
      e.count += 1;
      e.spellings.set(r.name, (e.spellings.get(r.name) || 0) + 1);
      byKey.set(r.nameKey, e);
    }
    const catalog = [...byKey.entries()]
      .map(([key, e]) => ({
        key,
        name: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
        count: e.count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const withSkills = employees.filter((e) => e.skills.length > 0);
    const results = withSkills
      .map((e) => {
        const matched = terms.map((t) =>
          e.skills.filter((s) => s.nameKey.includes(t) && levelRank(s.level) >= minRank),
        );
        if (terms.length === 0) {
          if (minRank > 0 && !e.skills.some((s) => levelRank(s.level) >= minRank)) return null;
        } else if (matched.some((m) => m.length === 0)) {
          return null;
        }
        const matchedIds = new Set(matched.flat().map((s) => s.id));
        // Rank by the strongest matching skill: highest level, then most years.
        const best = matched.flat().sort((a, b) => levelRank(b.level) - levelRank(a.level) || (b.years || 0) - (a.years || 0));
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          employeeCode: e.employeeCode,
          workEmail: e.workEmail,
          department: e.department?.name || null,
          designation: e.designation?.title || null,
          skills: e.skills.map(({ nameKey, ...s }) => ({ ...s, matched: matchedIds.has(s.id) })),
          score: best.length ? levelRank(best[0].level) * 100 + (best[0].years || 0) : 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return NextResponse.json({
      results: results.map(({ score, ...r }) => r),
      catalog,
      departments,
      totals: { employees: employees.length, withSkills: withSkills.length },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
