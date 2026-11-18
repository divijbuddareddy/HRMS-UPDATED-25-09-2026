import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { exitPermissions } from '@/lib/exit/approval';

/**
 * Approve / reject a resignation. Body: { stage: 'MANAGER' | 'HR', decision: 'APPROVED' | 'REJECTED', note?, approvedLwd? }
 * Manager step: only the employee's reporting manager. HR step: HR Admin / HR Executive / owner.
 * HR approval is final: sets the last working day and starts the notice period.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const stage = body.stage === 'HR' ? 'HR' : body.stage === 'MANAGER' ? 'MANAGER' : null;
    const decision = body.decision === 'APPROVED' ? 'APPROVED' : body.decision === 'REJECTED' ? 'REJECTED' : null;
    if (!stage || !decision) {
      return NextResponse.json({ error: 'stage (MANAGER/HR) and decision (APPROVED/REJECTED) are required' }, { status: 400 });
    }
    const note = String(body.note ?? '').trim().slice(0, 1000);
    if (decision === 'REJECTED' && !note) {
      return NextResponse.json({ error: 'Please give a reason for rejecting.' }, { status: 400 });
    }

    const exitReq = await prisma.exitRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { employee: { select: { reportingManagerId: true } } },
    });
    if (!exitReq) return NextResponse.json({ error: 'Resignation not found' }, { status: 404 });

    const perms = exitPermissions(user, exitReq);
    const now = new Date();
    let data: any;

    if (stage === 'MANAGER') {
      if (!perms.canManagerDecide) {
        return forbidden('Only the employee’s reporting manager can give the manager approval, and only while it is waiting for them.');
      }
      data =
        decision === 'APPROVED'
          ? { status: 'PENDING_HR', managerApproval: 'APPROVED', managerApproverId: user.userId, managerDecidedAt: now, managerNote: note || null }
          : { status: 'REJECTED', managerApproval: 'REJECTED', managerApproverId: user.userId, managerDecidedAt: now, managerNote: note };
    } else {
      if (!perms.canHrDecide) {
        return forbidden('Only HR or the company owner can give the HR approval, after the manager has approved.');
      }
      let approvedLwd = exitReq.approvedLwd;
      if (decision === 'APPROVED' && body.approvedLwd) {
        const d = new Date(body.approvedLwd);
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid last working day.' }, { status: 400 });
        approvedLwd = d;
      }
      data =
        decision === 'APPROVED'
          ? { status: 'APPROVED', hrApproval: 'APPROVED', hrApproverId: user.userId, hrDecidedAt: now, hrNote: note || null, approvedLwd }
          : { status: 'REJECTED', hrApproval: 'REJECTED', hrApproverId: user.userId, hrDecidedAt: now, hrNote: note };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.exitRequest.update({ where: { id: exitReq.id }, data });
      // Final approval starts the notice period
      if (u.status === 'APPROVED') {
        await tx.employee.update({ where: { id: exitReq.employeeId }, data: { status: 'NOTICE' } });
      }
      return u;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: `RESIGNATION_${stage}_${decision}`,
      entityType: 'EXIT_REQUEST',
      entityId: exitReq.id,
      beforeState: { status: exitReq.status },
      afterState: { status: updated.status, note },
    });

    return NextResponse.json({ success: true, exitRequest: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
