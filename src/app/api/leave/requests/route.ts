import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateAndApplyLeave } from '@/lib/leave/engine';
import { employeeIdFilter, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      // No employee profile -> no own requests (never fall back to "everyone").
      where.employeeId = user.employeeId || '__none__';
    } else {
      // Self for employees, self + direct reports for managers, everyone for company-wide approvers.
      Object.assign(where, employeeIdFilter(await visibleEmployeeIds(user, 'leave:approve')));
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, department: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    const body = await req.json();
    const { leaveTypeId, startDate, endDate, isHalfDay, halfDaySession, reason, attachmentUrl } = body;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'Missing required leave request fields' }, { status: 400 });
    }

    const leaveRequest = await validateAndApplyLeave({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay: Boolean(isHalfDay),
      halfDaySession,
      reason,
      attachmentUrl,
    });

    return NextResponse.json({ success: true, leaveRequest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
