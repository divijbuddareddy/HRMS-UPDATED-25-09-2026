import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { MAX_SKILLS_PER_EMPLOYEE, canManageSkills, canSearchSkills, parseSkillInput } from '@/lib/skills';

const skillSelect = { id: true, name: true, level: true, years: true, updatedAt: true } as const;

function resolveEmployeeId(user: { employeeId?: string }, requested: string | null | undefined, hr: boolean) {
  if (requested && requested !== user.employeeId) return hr ? requested : 'FORBIDDEN';
  return user.employeeId || null;
}

/**
 * GET                 -> my skills + company skill names (for autocomplete)
 * GET ?employeeId=... -> that employee's skills (HR / owner / manager, read-only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hr = canSearchSkills(user);
    const employeeId = resolveEmployeeId(user, req.nextUrl.searchParams.get('employeeId'), hr);
    if (employeeId === 'FORBIDDEN') return forbidden('You can only view your own skills.');
    if (!employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }

    const [skills, names] = await Promise.all([
      prisma.employeeSkill.findMany({
        where: { tenantId: user.tenantId, employeeId },
        select: skillSelect,
        orderBy: { name: 'asc' },
      }),
      // Only skill names (never who has them) so employees spell skills the same way.
      prisma.employeeSkill.findMany({
        where: { tenantId: user.tenantId },
        select: { name: true, nameKey: true },
        distinct: ['nameKey'],
        orderBy: { nameKey: 'asc' },
        take: 500,
      }),
    ]);
    return NextResponse.json({ skills, suggestions: names.map((n) => n.name) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Add a skill: { name, level, years?, employeeId? (HR only) }. Re-adding an existing skill updates it. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const hr = canManageSkills(user);
    const employeeId = resolveEmployeeId(user, body?.employeeId, hr);
    if (employeeId === 'FORBIDDEN') return forbidden('You can only add your own skills.');
    if (!employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }

    const parsed = parseSkillInput(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const existing = await prisma.employeeSkill.findUnique({
      where: { employeeId_nameKey: { employeeId, nameKey: parsed.nameKey } },
    });
    if (!existing) {
      const count = await prisma.employeeSkill.count({ where: { employeeId } });
      if (count >= MAX_SKILLS_PER_EMPLOYEE) {
        return NextResponse.json({ error: `You can add up to ${MAX_SKILLS_PER_EMPLOYEE} skills.` }, { status: 400 });
      }
    }

    const skill = existing
      ? await prisma.employeeSkill.update({
          where: { id: existing.id },
          // Re-adding keeps the original spelling ("react" won't overwrite "React"); renames go through PATCH.
          data: { level: parsed.level, years: parsed.years },
          select: skillSelect,
        })
      : await prisma.employeeSkill.create({
          data: { tenantId: user.tenantId, employeeId, ...parsed },
          select: skillSelect,
        });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: existing ? 'UPDATE_EMPLOYEE_SKILL' : 'ADD_EMPLOYEE_SKILL',
      entityType: 'EMPLOYEE_SKILL',
      entityId: skill.id,
      beforeState: existing ? { name: existing.name, level: existing.level, years: existing.years } : undefined,
      afterState: { employeeId, name: skill.name, level: skill.level, years: skill.years },
    });

    return NextResponse.json({ success: true, skill, updated: !!existing }, { status: existing ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Submit the whole skill list at once: { skills: [{ id?, name, level, years? }], employeeId? (HR only) }.
 * Rows with an id of an existing skill keep it (renames allowed); rows left out are removed.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const employeeId = resolveEmployeeId(user, body?.employeeId, canManageSkills(user));
    if (employeeId === 'FORBIDDEN') return forbidden('You can only submit your own skills.');
    if (!employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }
    if (!Array.isArray(body?.skills)) {
      return NextResponse.json({ error: 'Send the list of skills.' }, { status: 400 });
    }
    if (body.skills.length > MAX_SKILLS_PER_EMPLOYEE) {
      return NextResponse.json({ error: `You can add up to ${MAX_SKILLS_PER_EMPLOYEE} skills.` }, { status: 400 });
    }

    const rows: { id?: string; name: string; nameKey: string; level: string; years: number | null }[] = [];
    const seen = new Map<string, string>();
    for (const [i, raw] of (body.skills as any[]).entries()) {
      const parsed = parseSkillInput(raw);
      if ('error' in parsed) {
        return NextResponse.json({ error: `Skill ${i + 1}: ${parsed.error}`, index: i }, { status: 400 });
      }
      if (seen.has(parsed.nameKey)) {
        return NextResponse.json(
          { error: `"${parsed.name}" is listed twice. Remove one of them.`, index: i },
          { status: 400 },
        );
      }
      seen.set(parsed.nameKey, parsed.name);
      rows.push({ id: typeof raw?.id === 'string' ? raw.id : undefined, ...parsed });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const before = await prisma.employeeSkill.findMany({ where: { tenantId: user.tenantId, employeeId } });
    const beforeById = new Map(before.map((s) => [s.id, s]));

    // Replace the list in one transaction; existing rows keep their id and creation date.
    const usedIds = new Set<string>();
    await prisma.$transaction([
      prisma.employeeSkill.deleteMany({ where: { tenantId: user.tenantId, employeeId } }),
      ...rows.map((r) => {
        const prev = r.id && !usedIds.has(r.id) ? beforeById.get(r.id) : undefined;
        if (prev) usedIds.add(prev.id);
        return prisma.employeeSkill.create({
          data: {
            ...(prev ? { id: prev.id, createdAt: prev.createdAt } : {}),
            tenantId: user.tenantId,
            employeeId,
            name: r.name,
            nameKey: r.nameKey,
            level: r.level,
            years: r.years,
          },
        });
      }),
    ]);

    const skills = await prisma.employeeSkill.findMany({
      where: { tenantId: user.tenantId, employeeId },
      select: skillSelect,
      orderBy: { name: 'asc' },
    });

    const summary = (list: { name: string; level: string; years: number | null }[]) =>
      list.map((s) => `${s.name} (${s.level}${s.years != null ? `, ${s.years}y` : ''})`);
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'SUBMIT_EMPLOYEE_SKILLS',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      beforeState: { skills: summary(before) },
      afterState: { skills: summary(skills) },
    });

    return NextResponse.json({ success: true, skills });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
