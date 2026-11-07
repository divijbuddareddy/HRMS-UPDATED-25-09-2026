import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executePayrollCycleRun } from '@/lib/payroll/engine';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Finance / owner see every run and every employee's pay. Everyone else only sees
    // locked/published runs that contain their own payslip, and only their own line item.
    const isPayrollManager = can(user, 'payroll:manage');
    const selfId = user.employeeId || '__none__';

    const runs = await prisma.payrollRun.findMany({
      where: isPayrollManager
        ? { tenantId: user.tenantId }
        : { tenantId: user.tenantId, status: { in: ['LOCKED', 'PUBLISHED'] }, items: { some: { employeeId: selfId } } },
      include: {
        cycle: true,
        items: {
          where: isPayrollManager ? {} : { employeeId: selfId },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                department: true,
                designation: true,
              },
            },
            adjustments: true,
            payslip: true,
          },
        },
      },
      orderBy: [{ cycle: { year: 'desc' } }, { cycle: { month: 'desc' } }],
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'payroll:manage')) {
      return forbidden('Only Finance or the company owner can run payroll.');
    }

    const body = await req.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    const run = await executePayrollCycleRun({
      tenantId: user.tenantId,
      month: parseInt(month),
      year: parseInt(year),
      actor: user,
    });

    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
