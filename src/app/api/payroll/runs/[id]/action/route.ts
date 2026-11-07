import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { lockAndPublishPayrollRun } from '@/lib/payroll/engine';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body; // 'APPROVE' | 'LOCK' | 'PUBLISH'

    if (!['APPROVE', 'LOCK', 'PUBLISH'].includes(action)) {
      return NextResponse.json({ error: 'Action must be APPROVE, LOCK, or PUBLISH' }, { status: 400 });
    }

    // Approving, locking and publishing payroll is a Finance (or owner) action.
    if (!can(user, 'payroll:manage')) {
      return forbidden('Only Finance or the company owner can approve, lock or publish payroll.');
    }

    const run = await prisma.payrollRun.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    const updated = await lockAndPublishPayrollRun({
      tenantId: user.tenantId,
      payrollRunId: id,
      actor: user,
      action,
    });

    return NextResponse.json({ success: true, run: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
