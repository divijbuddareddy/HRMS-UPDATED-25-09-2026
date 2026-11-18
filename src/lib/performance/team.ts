import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { visibleEmployeeIds } from '../access';

/**
 * The cycle new goals go into: the newest ACTIVE cycle, or a "Goals <year>" cycle
 * (1 Jan – 31 Dec) created on first use so HR doesn't have to set one up first.
 */
export async function getOrCreateCurrentCycle(tenantId: string) {
  const active = await prisma.performanceCycle.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (active) return active;
  const year = new Date().getFullYear();
  return prisma.performanceCycle.create({
    data: {
      tenantId,
      title: `Goals ${year}`,
      cycleType: 'ANNUAL',
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31, 23, 59, 59),
      status: 'ACTIVE',
    },
  });
}

/**
 * Employees this user can assign goals / share documents with:
 * everyone for HR / owner, direct reports for managers. Never includes the user themself.
 */
export async function assignableEmployees(user: AuthUser) {
  const ids = await visibleEmployeeIds(user, 'performance:review');
  return prisma.employee.findMany({
    where: {
      tenantId: user.tenantId,
      status: { notIn: ['EXITED', 'ARCHIVED'] },
      ...(ids === null ? {} : { id: { in: ids } }),
      ...(user.employeeId ? { NOT: { id: user.employeeId } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, workEmail: true },
    orderBy: { firstName: 'asc' },
  });
}
