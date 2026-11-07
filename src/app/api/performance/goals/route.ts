import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPerformanceGoal } from '@/lib/performance/engine';
import { canActOnEmployee, canViewEmployee, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;
    const cycleId = searchParams.get('cycleId');

    if (employeeId && !(await canViewEmployee(user, employeeId, 'performance:review'))) {
      return forbidden('You can only view goals of yourself or your team.');
    }
    const employeeScope = employeeId
      ? { employeeId }
      : employeeIdFilter(await visibleEmployeeIds(user, 'performance:review'));

    const goals = await prisma.performanceGoal.findMany({
      where: {
        cycle: { tenantId: user.tenantId },
        ...employeeScope,
        ...(cycleId ? { performanceCycleId: cycleId } : {}),
      },
      include: { cycle: true },
    });

    return NextResponse.json({ goals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const targetEmployeeId: string | undefined = body.employeeId || user.employeeId;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }
    // Own goals: always. Someone else's goals: manager (direct reports) / HR / owner.
    const isSelf = !!user.employeeId && targetEmployeeId === user.employeeId;
    if (!isSelf && !(await canActOnEmployee(user, targetEmployeeId, 'performance:review'))) {
      return forbidden('You can only set goals for yourself or your direct reports.');
    }
    if (!body.performanceCycleId) {
      return NextResponse.json({ error: 'performanceCycleId is required' }, { status: 400 });
    }
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: body.performanceCycleId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!cycle) {
      return NextResponse.json({ error: 'Performance cycle not found' }, { status: 400 });
    }

    const goal = await createPerformanceGoal({
      tenantId: user.tenantId,
      performanceCycleId: cycle.id,
      employeeId: targetEmployeeId,
      title: body.title,
      description: body.description,
      category: body.category || 'OKR',
      weight: body.weight ? parseFloat(body.weight) : 25,
      targetValue: body.targetValue,
    });

    return NextResponse.json({ success: true, goal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
