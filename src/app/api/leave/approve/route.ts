import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processLeaveApproval } from '@/lib/leave/engine';
import { can, canActOnEmployee, forbidden } from '@/lib/access';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'leave:approve')) {
      return forbidden('You are not allowed to approve or reject leave requests.');
    }

    const body = await req.json();
    const { leaveRequestId, decision, notes } = body;

    if (!leaveRequestId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'leaveRequestId and decision (APPROVED/REJECTED) are required' }, { status: 400 });
    }

    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id: leaveRequestId, tenantId: user.tenantId },
      select: { id: true, employeeId: true },
    });
    if (!leaveReq) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }
    if (user.employeeId && leaveReq.employeeId === user.employeeId) {
      return forbidden('You cannot approve or reject your own leave request.');
    }
    if (!(await canActOnEmployee(user, leaveReq.employeeId, 'leave:approve'))) {
      return forbidden('You can only approve leave requests of your direct reports.');
    }

    const updated = await processLeaveApproval({
      tenantId: user.tenantId,
      leaveRequestId,
      actor: user,
      decision,
      notes,
    });

    return NextResponse.json({ success: true, leaveRequest: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
