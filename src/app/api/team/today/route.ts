import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, endOfDay } from 'date-fns';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * The logged-in manager's team: ONLY the employees HR has assigned to them as Reporting Manager,
 * with today's attendance and leave. Everyone else gets an empty team.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ team: [] });

    const dayStart = startOfDay(new Date());
    const dayEnd = endOfDay(new Date());

    const reports = await prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        reportingManagerId: user.employeeId,
        status: { notIn: ['EXITED', 'ARCHIVED'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        status: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
        dailyAttendance: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          select: { status: true, firstCheckIn: true, lastCheckOut: true, isLate: true, lateMinutes: true },
          take: 1,
        },
        leaveRequests: {
          where: { startDate: { lte: dayEnd }, endDate: { gte: dayStart }, status: { in: ['APPROVED', 'PENDING'] } },
          select: { status: true, isHalfDay: true, leaveType: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const ids = reports.map((r) => r.id);
    const [pendingLeave, pendingExpenses] = ids.length
      ? await Promise.all([
          prisma.leaveRequest.count({ where: { tenantId: user.tenantId, employeeId: { in: ids }, status: 'PENDING' } }),
          prisma.expenseClaim.count({ where: { tenantId: user.tenantId, employeeId: { in: ids }, status: 'SUBMITTED' } }),
        ])
      : [0, 0];

    const team = reports.map((r) => {
      const att = r.dailyAttendance[0];
      const leave = r.leaveRequests[0];
      let today: 'ON_LEAVE' | 'LEAVE_PENDING' | 'WORKING' | 'CLOCKED_OUT' | 'ABSENT' | 'NOT_CLOCKED_IN' = 'NOT_CLOCKED_IN';
      if (leave?.status === 'APPROVED') today = 'ON_LEAVE';
      else if (att?.lastCheckOut) today = 'CLOCKED_OUT';
      else if (att?.firstCheckIn) today = 'WORKING';
      else if (att?.status === 'ABSENT') today = 'ABSENT';
      else if (leave?.status === 'PENDING') today = 'LEAVE_PENDING';
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.replace(/\s+/g, ' ').trim(),
        code: r.employeeCode,
        designation: r.designation?.title || null,
        department: r.department?.name || null,
        today,
        firstCheckIn: att?.firstCheckIn || null,
        lastCheckOut: att?.lastCheckOut || null,
        isLate: !!att?.isLate,
        lateMinutes: att?.lateMinutes || 0,
        leaveType: leave?.leaveType?.name || null,
      };
    });

    return NextResponse.json({ team, pendingLeave, pendingExpenses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
