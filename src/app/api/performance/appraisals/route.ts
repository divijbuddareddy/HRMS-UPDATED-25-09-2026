import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitSelfAppraisal, submitManagerAppraisal } from '@/lib/performance/engine';
import { canActOnEmployee, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const cycleId = searchParams.get('cycleId');

    // Self for employees, self + direct reports for managers, everyone for HR / owner.
    const scope = employeeIdFilter(await visibleEmployeeIds(user, 'performance:review'));

    const appraisals = await prisma.performanceAppraisal.findMany({
      where: {
        cycle: { tenantId: user.tenantId },
        ...scope,
        ...(cycleId ? { performanceCycleId: cycleId } : {}),
      },
      include: {
        employee: true,
        manager: true,
        cycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ appraisals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, cycleId, employeeId, selfRating, selfReviewNotes, managerRating, managerReviewNotes, promotionRecommend, incrementPercent } = body;

    if (!cycleId) {
      return NextResponse.json({ error: 'cycleId is required' }, { status: 400 });
    }
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!cycle) {
      return NextResponse.json({ error: 'Performance cycle not found' }, { status: 400 });
    }

    let result: any;
    if (action === 'SELF_REVIEW') {
      // A self-appraisal can only be written by the employee themself.
      if (!user.employeeId) {
        return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
      }
      if (employeeId && employeeId !== user.employeeId) {
        return forbidden('You can only submit your own self-appraisal.');
      }
      result = await submitSelfAppraisal({
        tenantId: user.tenantId,
        cycleId,
        employeeId: user.employeeId,
        selfRating: parseFloat(selfRating),
        selfReviewNotes,
        actor: user,
      });
    } else if (action === 'MANAGER_REVIEW') {
      // Reviewer: manager of the employee, HR or owner. Never your own appraisal.
      if (!(await canActOnEmployee(user, employeeId, 'performance:review'))) {
        return forbidden('You can only review appraisals of your direct reports.');
      }
      result = await submitManagerAppraisal({
        tenantId: user.tenantId,
        cycleId,
        employeeId,
        managerRating: parseFloat(managerRating),
        managerReviewNotes,
        promotionRecommend,
        incrementPercent: incrementPercent ? parseFloat(incrementPercent) : 0,
        actor: user,
      });
    } else {
      return NextResponse.json({ error: 'Invalid appraisal action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, appraisal: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
