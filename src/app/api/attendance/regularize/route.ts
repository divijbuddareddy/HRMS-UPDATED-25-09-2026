import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { requestAttendanceRegularization, approveAttendanceRegularization } from '@/lib/attendance/engine';
import { prisma } from '@/lib/prisma';
import { can, canActOnEmployee, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      where.employeeId = user.employeeId || '__none__';
    } else {
      // Self for employees, self + direct reports for managers, everyone for HR / owner.
      Object.assign(where, employeeIdFilter(await visibleEmployeeIds(user, 'attendance:approve')));
    }

    const requests = await prisma.attendanceRegularization.findMany({
      where,
      include: {
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
    const { requestedDate, proposedCheckIn, proposedCheckOut, reason, attachmentUrl } = body;

    if (!requestedDate || !proposedCheckIn || !proposedCheckOut || !reason) {
      return NextResponse.json({ error: 'Missing required regularization details' }, { status: 400 });
    }

    const regularization = await requestAttendanceRegularization({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      requestedDate: new Date(requestedDate),
      proposedCheckIn: new Date(proposedCheckIn),
      proposedCheckOut: new Date(proposedCheckOut),
      reason,
      attachmentUrl,
    });

    return NextResponse.json({ success: true, regularization }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { regularizationId, decision, notes } = body;

    if (!regularizationId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'regularizationId and decision (APPROVED/REJECTED) are required' }, { status: 400 });
    }

    if (!can(user, 'attendance:approve')) {
      return forbidden('You are not allowed to approve attendance regularization requests.');
    }
    const reg = await prisma.attendanceRegularization.findFirst({
      where: { id: regularizationId, tenantId: user.tenantId },
      select: { id: true, employeeId: true },
    });
    if (!reg) {
      return NextResponse.json({ error: 'Regularization request not found' }, { status: 404 });
    }
    if (user.employeeId && reg.employeeId === user.employeeId) {
      return forbidden('You cannot approve your own attendance regularization request.');
    }
    if (!(await canActOnEmployee(user, reg.employeeId, 'attendance:approve'))) {
      return forbidden('You can only approve regularization requests of your direct reports.');
    }

    const result = await approveAttendanceRegularization({
      tenantId: user.tenantId,
      regularizationId,
      actor: user,
      status: decision,
      notes,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
