import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { ensureDefaultStructure, setEmployeeSalary, syncAllSalaryHistories } from '@/lib/payroll/salaries';
import { parseAssetDate } from '@/lib/assets/tags';

/** Every (non-exited) employee with their salary in force today, any upcoming revision, and history. Payroll managers only. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'payroll:manage')) return forbidden('Only Finance or the company owner can see salaries.');

    await ensureDefaultStructure(user.tenantId);
    await syncAllSalaryHistories(user.tenantId);

    const [employees, structures] = await Promise.all([
      prisma.employee.findMany({
        where: { tenantId: user.tenantId, status: { notIn: ['EXITED', 'ARCHIVED', 'DRAFT'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          workEmail: true,
          joiningDate: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
          salaryAssignments: {
            orderBy: { effectiveFrom: 'desc' },
            select: { id: true, ctc: true, grossSalary: true, netSalary: true, effectiveFrom: true, effectiveTo: true, taxRegime: true, isCurrent: true, structure: { select: { name: true } } },
          },
        },
        orderBy: { firstName: 'asc' },
      }),
      prisma.salaryStructure.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true, name: true, isDefault: true } }),
    ]);

    const now = new Date();
    return NextResponse.json({
      structures,
      employees: employees.map(({ salaryAssignments, ...e }) => ({
        ...e,
        current: salaryAssignments.find((s) => s.isCurrent) || null,
        upcoming: (() => {
          const future = salaryAssignments.filter((s) => new Date(s.effectiveFrom) > now);
          return future.length ? future[future.length - 1] : null; // earliest upcoming (list is newest first)
        })(),
        history: salaryAssignments,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Set / revise one employee's salary. Body: { employeeId, annualCtc, effectiveFrom, taxRegime?, structureId? } */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'payroll:manage')) return forbidden('Only Finance or the company owner can set salaries.');

    const body = await req.json().catch(() => ({}));
    if (!body.employeeId) return NextResponse.json({ error: 'Choose an employee.' }, { status: 400 });
    if (user.employeeId && body.employeeId === user.employeeId) {
      return forbidden('You cannot set your own salary. Ask another payroll administrator.');
    }
    const ctc = parseFloat(String(body.annualCtc ?? '').replace(/[,\s₹]/g, ''));
    if (!isFinite(ctc) || ctc <= 0) return NextResponse.json({ error: 'Enter a valid annual CTC.' }, { status: 400 });
    if (ctc > 100000000) return NextResponse.json({ error: 'Annual CTC looks too large. Please check the amount.' }, { status: 400 });
    const effectiveFrom = parseAssetDate(String(body.effectiveFrom ?? ''));
    if (!effectiveFrom) return NextResponse.json({ error: 'Enter a valid “effective from” date.' }, { status: 400 });
    const taxRegime = String(body.taxRegime || 'NEW_REGIME').toUpperCase().startsWith('OLD') ? 'OLD_REGIME' : 'NEW_REGIME';

    const { assignment, replaced } = await setEmployeeSalary({
      tenantId: user.tenantId,
      employeeId: body.employeeId,
      annualCtc: ctc,
      effectiveFrom,
      taxRegime,
      structureId: body.structureId || undefined,
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: replaced ? 'CORRECT_SALARY' : 'SET_SALARY',
      entityType: 'SALARY_ASSIGNMENT',
      entityId: assignment.id,
      afterState: { employeeId: body.employeeId, ctc, effectiveFrom, taxRegime },
    });

    return NextResponse.json({ success: true, assignment, replaced });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
