import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPerformanceGoal } from '@/lib/performance/engine';
import { getOrCreateCurrentCycle } from '@/lib/performance/team';
import { canActOnEmployee, canViewEmployee, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

const CATEGORIES = ['OKR', 'KRA', 'KPI'] as const;

/**
 * GET                 -> own goals (or, with no employee profile, everyone visible)
 * GET ?scope=team     -> goals of everyone the user may review (HR: all, manager: self + reports)
 * GET ?employeeId=... -> one employee's goals
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const team = searchParams.get('scope') === 'team';
    const employeeId = team ? null : searchParams.get('employeeId') || user.employeeId;
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
      include: {
        cycle: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
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
      return NextResponse.json({ error: 'Choose an employee.' }, { status: 400 });
    }
    // Own goals: always. Someone else's goals: manager (direct reports) / HR / owner.
    const isSelf = !!user.employeeId && targetEmployeeId === user.employeeId;
    if (!isSelf && !(await canActOnEmployee(user, targetEmployeeId, 'performance:review'))) {
      return forbidden('You can only set goals for yourself or your direct reports.');
    }

    const title = String(body.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'Goal title is required.' }, { status: 400 });
    const weight = body.weight !== undefined && body.weight !== '' ? parseFloat(body.weight) : 25;
    if (!isFinite(weight) || weight <= 0 || weight > 100) {
      return NextResponse.json({ error: 'Weight must be between 1 and 100.' }, { status: 400 });
    }

    let cycleId: string;
    if (body.performanceCycleId) {
      const cycle = await prisma.performanceCycle.findFirst({
        where: { id: body.performanceCycleId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!cycle) return NextResponse.json({ error: 'Performance cycle not found' }, { status: 400 });
      cycleId = cycle.id;
    } else {
      cycleId = (await getOrCreateCurrentCycle(user.tenantId)).id;
    }

    const category = CATEGORIES.includes(String(body.category).toUpperCase() as any)
      ? (String(body.category).toUpperCase() as (typeof CATEGORIES)[number])
      : 'OKR';

    const goal = await createPerformanceGoal({
      tenantId: user.tenantId,
      performanceCycleId: cycleId,
      employeeId: targetEmployeeId,
      title: title.slice(0, 200),
      description: body.description ? String(body.description).trim().slice(0, 2000) : undefined,
      category,
      weight,
      targetValue: body.targetValue ? String(body.targetValue).trim().slice(0, 200) : undefined,
    });

    return NextResponse.json({ success: true, goal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
