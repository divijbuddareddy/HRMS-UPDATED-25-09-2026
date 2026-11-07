import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { overridePayrollComponent } from '@/lib/payroll/engine';
import { can, forbidden } from '@/lib/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'payroll:manage')) {
      return forbidden('Only Finance or the company owner can override payroll components.');
    }

    const body = await req.json();
    const { payrollItemId, componentCode, newAmount, reason } = body;

    if (!payrollItemId || !componentCode || newAmount == null || !reason) {
      return NextResponse.json({ error: 'payrollItemId, componentCode, newAmount and reason are required' }, { status: 400 });
    }

    const item = await prisma.payrollItem.findFirst({
      where: { id: payrollItemId, payrollRunId: id, payrollRun: { tenantId: user.tenantId } },
      select: { id: true, employeeId: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'Payroll item not found' }, { status: 404 });
    }
    if (user.employeeId && item.employeeId === user.employeeId) {
      return forbidden('You cannot override components of your own payroll.');
    }

    const updatedItem = await overridePayrollComponent({
      tenantId: user.tenantId,
      payrollItemId,
      componentCode,
      newAmount: parseFloat(newAmount),
      reason,
      actor: user,
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
