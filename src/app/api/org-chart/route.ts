import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Organization chart for the user's company. Visible to every logged-in employee, so it only
 * returns directory fields (name, designation, department, location, manager) — no contact or
 * personal data. Built live from the employee table, so new joiners appear automatically.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [employees, tenant] = await Promise.all([
      prisma.employee.findMany({
        where: { tenantId: user.tenantId, status: { notIn: ['EXITED', 'ARCHIVED', 'DRAFT'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          reportingManagerId: true,
          status: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
          branchLocation: { select: { name: true } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    ]);

    return NextResponse.json({
      companyName: tenant?.name || '',
      me: user.employeeId || null,
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.replace(/\s+/g, ' ').trim(),
        code: e.employeeCode,
        managerId: e.reportingManagerId,
        status: e.status,
        designation: e.designation?.title || null,
        department: e.department?.name || null,
        location: e.branchLocation?.name || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
