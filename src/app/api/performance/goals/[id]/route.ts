import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canActOnEmployee, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';

async function loadGoal(id: string, tenantId: string) {
  return prisma.performanceGoal.findFirst({ where: { id, cycle: { tenantId } } });
}

/** Update progress: the employee on their own goal, or their manager / HR. Body: { progressPercent, actualValue? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const goal = await loadGoal(id, user.tenantId);
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const isSelf = !!user.employeeId && goal.employeeId === user.employeeId;
    if (!isSelf && !(await canActOnEmployee(user, goal.employeeId, 'performance:review'))) {
      return forbidden('You can only update your own goals or your team’s goals.');
    }

    const body = await req.json().catch(() => ({}));
    const progress = Math.round(Number(body.progressPercent));
    if (!isFinite(progress) || progress < 0 || progress > 100) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100.' }, { status: 400 });
    }

    const updated = await prisma.performanceGoal.update({
      where: { id: goal.id },
      data: {
        progressPercent: progress,
        ...(body.actualValue !== undefined ? { actualValue: String(body.actualValue).trim().slice(0, 200) || null } : {}),
      },
    });
    return NextResponse.json({ success: true, goal: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Remove a goal: manager (direct reports) / HR / owner. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const goal = await loadGoal(id, user.tenantId);
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    if (!(await canActOnEmployee(user, goal.employeeId, 'performance:review'))) {
      return forbidden('Only the employee’s manager or HR can remove a goal.');
    }

    await prisma.performanceGoal.delete({ where: { id: goal.id } });
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_PERFORMANCE_GOAL',
      entityType: 'PERFORMANCE_GOAL',
      entityId: goal.id,
      beforeState: { employeeId: goal.employeeId, title: goal.title },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
