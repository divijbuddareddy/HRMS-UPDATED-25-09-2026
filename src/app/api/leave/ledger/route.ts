import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { canViewEmployee, forbidden } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (!(await canViewEmployee(user, employeeId, 'leave:approve'))) {
      return forbidden('You can only view the leave ledger of yourself or your team.');
    }

    const transactions = await prisma.leaveLedger.findMany({
      where: {
        tenantId: user.tenantId,
        employeeId,
      },
      include: {
        leaveType: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
