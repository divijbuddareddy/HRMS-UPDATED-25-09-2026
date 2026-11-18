import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { exitPermissions } from '@/lib/exit/approval';

/**
 * Withdraw a resignation. The employee can withdraw while it is still waiting for approval;
 * HR / owner can cancel any open exit (also after approval). Body: { reason? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const exitReq = await prisma.exitRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { employee: { select: { reportingManagerId: true, status: true } } },
    });
    if (!exitReq) return NextResponse.json({ error: 'Resignation not found' }, { status: 404 });

    if (!exitPermissions(user, exitReq).canWithdraw) {
      const isSelf = user.employeeId === exitReq.employeeId;
      return forbidden(
        isSelf
          ? 'Your resignation is already approved. Please ask HR to cancel it.'
          : 'Only the employee (while pending) or HR can withdraw this resignation.',
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason ?? '').trim().slice(0, 1000);

    await prisma.$transaction(async (tx) => {
      await tx.exitRequest.update({
        where: { id: exitReq.id },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawReason: reason || null, withdrawnById: user.userId },
      });
      // If the notice period had started, the employee goes back to active
      if (exitReq.employee.status === 'NOTICE') {
        await tx.employee.update({ where: { id: exitReq.employeeId }, data: { status: 'ACTIVE' } });
      }
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: user.employeeId === exitReq.employeeId ? 'WITHDRAW_RESIGNATION' : 'CANCEL_EXIT',
      entityType: 'EXIT_REQUEST',
      entityId: exitReq.id,
      beforeState: { status: exitReq.status },
      afterState: { status: 'WITHDRAWN', reason },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
