import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { processDailyAttendanceRecord } from '@/lib/attendance/engine';
import { eachDayOfInterval, startOfDay } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { leaveRequestId, reason } = body;

    if (!leaveRequestId) {
      return NextResponse.json({ error: 'leaveRequestId is required' }, { status: 400 });
    }

    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, tenantId: user.tenantId },
      include: { employee: true, leaveType: true },
    });

    if (!leaveReq) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const isOwner = user.employeeId === leaveReq.employeeId;
    const isHR = user.roles.some((r) =>
      ['PLATFORM_SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN'].includes(r)
    );

    if (!isOwner && !isHR) {
      return NextResponse.json({ error: 'Forbidden: You can only cancel your own leave request' }, { status: 403 });
    }

    if (leaveReq.status === 'CANCELLED' || leaveReq.status === 'REJECTED') {
      return NextResponse.json({ error: `Leave request is already ${leaveReq.status.toLowerCase()}` }, { status: 400 });
    }

    // Employees may cancel approved leave only before it starts; HR / owner can cancel any time.
    if (leaveReq.status === 'APPROVED' && !isHR && startOfDay(leaveReq.startDate) <= startOfDay(new Date())) {
      return NextResponse.json(
        { error: 'This leave has already started. Please ask HR to cancel it.' },
        { status: 400 },
      );
    }

    // If leave was approved, we must credit the debited days back to the ledger
    if (leaveReq.status === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        const lastLedger = await tx.leaveLedger.findFirst({
          where: {
            tenantId: leaveReq.tenantId,
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
          },
          orderBy: { transactionDate: 'desc' },
        });

        const currentBal = lastLedger ? lastLedger.balanceAfter : 0;
        const newBal = currentBal + leaveReq.totalDays;

        await tx.leaveLedger.create({
          data: {
            tenantId: leaveReq.tenantId,
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            transactionType: 'CREDIT',
            days: leaveReq.totalDays,
            balanceAfter: newBal,
            referenceType: 'LEAVE_CANCELLATION',
            referenceId: leaveReq.id,
            reason: reason || 'Cancelled approved leave request',
            transactionDate: new Date(),
          },
        });

        await tx.leaveRequest.update({
          where: { id: leaveReq.id },
          data: {
            status: 'CANCELLED',
            approverNotes: `Cancelled after approval by ${isOwner ? 'employee' : 'HR'}${reason ? `: ${reason}` : ''}`,
          },
        });

        // Remove the attendance entries the approval wrote (non-regularized "Leave (...)" days)
        await tx.dailyAttendanceRecord.deleteMany({
          where: {
            tenantId: leaveReq.tenantId,
            employeeId: leaveReq.employeeId,
            date: { gte: startOfDay(leaveReq.startDate), lte: startOfDay(leaveReq.endDate) },
            isRegularized: false,
            notes: { startsWith: 'Leave (' },
          },
        });
      });

      // Past days fall back to normal attendance: punches => present, otherwise absent / week-off.
      const today = startOfDay(new Date());
      for (const d of eachDayOfInterval({ start: leaveReq.startDate, end: leaveReq.endDate })) {
        const day = startOfDay(d);
        if (day < today) {
          await processDailyAttendanceRecord(leaveReq.tenantId, leaveReq.employeeId, d);
        } else if (day.getTime() === today.getTime()) {
          // Today: only rebuild if they've already punched; otherwise the normal flow handles it.
          const punchedToday = await prisma.rawAttendancePunch.count({
            where: { tenantId: leaveReq.tenantId, employeeId: leaveReq.employeeId, punchTimestamp: { gte: today } },
          });
          if (punchedToday > 0) await processDailyAttendanceRecord(leaveReq.tenantId, leaveReq.employeeId, d);
        }
      }
    } else {
      // Pending request: simply mark as CANCELLED
      await prisma.leaveRequest.update({
        where: { id: leaveReq.id },
        data: {
          status: 'CANCELLED',
          approverNotes: reason ? `Cancelled by employee: ${reason}` : 'Cancelled by employee',
        },
      });
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0] || 'EMPLOYEE',
      action: 'CANCEL_LEAVE_REQUEST',
      entityType: 'LEAVE_REQUEST',
      entityId: leaveReq.id,
      afterState: { id: leaveReq.id, status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, message: 'Leave request successfully cancelled' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
