import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { canSearchSkills, parseSkillInput } from '@/lib/skills';

async function loadOwnSkill(req: NextRequest, id: string) {
  const user = await getAuthenticatedUser(req);
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const skill = await prisma.employeeSkill.findFirst({ where: { id, tenantId: user.tenantId } });
  const allowed = !!skill && (skill.employeeId === user.employeeId || canSearchSkills(user));
  if (!skill || !allowed) return { res: NextResponse.json({ error: 'Skill not found' }, { status: 404 }) } as const;
  return { user, skill } as const;
}

/** Change level / years (and spelling) of a skill: { name, level, years? }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await loadOwnSkill(req, id);
    if ('res' in r) return r.res;
    const { user, skill } = r;

    const body = await req.json().catch(() => ({}));
    const parsed = parseSkillInput({ name: skill.name, level: skill.level, years: skill.years, ...body });
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (parsed.nameKey !== skill.nameKey) {
      const clash = await prisma.employeeSkill.findUnique({
        where: { employeeId_nameKey: { employeeId: skill.employeeId, nameKey: parsed.nameKey } },
      });
      if (clash) return NextResponse.json({ error: `"${clash.name}" is already in the list.` }, { status: 409 });
    }

    const updated = await prisma.employeeSkill.update({
      where: { id },
      data: parsed,
      select: { id: true, name: true, level: true, years: true, updatedAt: true },
    });
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_EMPLOYEE_SKILL',
      entityType: 'EMPLOYEE_SKILL',
      entityId: id,
      beforeState: { name: skill.name, level: skill.level, years: skill.years },
      afterState: { employeeId: skill.employeeId, name: updated.name, level: updated.level, years: updated.years },
    });
    return NextResponse.json({ success: true, skill: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await loadOwnSkill(req, id);
    if ('res' in r) return r.res;
    const { user, skill } = r;

    await prisma.employeeSkill.delete({ where: { id } });
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'REMOVE_EMPLOYEE_SKILL',
      entityType: 'EMPLOYEE_SKILL',
      entityId: id,
      beforeState: { employeeId: skill.employeeId, name: skill.name, level: skill.level, years: skill.years },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
