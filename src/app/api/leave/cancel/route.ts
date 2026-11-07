import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

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
            approverNotes: reason ? `Cancelled by employee/HR: ${reason}` : 'Cancelled by employee/HR',
          },
        });
      });
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
