import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canActOnEmployee, forbidden } from '@/lib/access';
import { approveAndSettleExit } from '@/lib/exit/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const exitReq = await prisma.exitRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, employeeId: true },
    });
    if (!exitReq) {
      return NextResponse.json({ error: 'Exit request not found' }, { status: 404 });
    }
    // Capability check + no one may settle their own exit settlement.
    if (!(await canActOnEmployee(user, exitReq.employeeId, 'exit:settle'))) {
      return forbidden('Only Finance or the company owner can approve and pay full-and-final settlements.');
    }

    const settled = await approveAndSettleExit({
      tenantId: user.tenantId,
      exitRequestId: id,
      actor: user,
    });

    return NextResponse.json({ success: true, exitRequest: settled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
