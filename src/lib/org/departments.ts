import { prisma } from '../prisma';

/**
 * Standard departments every company gets. `match` recognises an existing department that already
 * covers it (e.g. "IT / Development" counts as IT), so nothing is duplicated.
 */
export const STANDARD_DEPARTMENTS: { code: string; name: string; match: RegExp }[] = [
  { code: 'SALES', name: 'Sales', match: /\bsales\b|business development/i },
  { code: 'MARKETING', name: 'Marketing', match: /marketing/i },
  { code: 'FINANCE', name: 'Finance & Accounts', match: /financ|account/i },
  { code: 'IT', name: 'IT', match: /^it\b|\bit\b|information technology|\btech/i },
  { code: 'ENGINEERING', name: 'Engineering & Development', match: /engineer|software|(?<!business )develop/i },
  { code: 'HR', name: 'Human Resources', match: /human resource|^hr\b|\bhr\b|people/i },
  { code: 'OPERATIONS', name: 'Operations', match: /operation/i },
  { code: 'ADMIN', name: 'Administration', match: /^admin|administration/i },
  { code: 'SUPPORT', name: 'Customer Support', match: /support|customer (service|success)/i },
  { code: 'PRODUCT', name: 'Product Management', match: /product/i },
  { code: 'DESIGN', name: 'Design', match: /design|creative|\bui\b|\bux\b/i },
  { code: 'LEGAL', name: 'Legal & Compliance', match: /legal|compliance/i },
  { code: 'PROCUREMENT', name: 'Procurement & Purchase', match: /procure|purchas/i },
  { code: 'MANAGEMENT', name: 'Management', match: /management$|leadership|executive|director/i },
];

/** Adds any standard department the company does not have yet. Safe to call on every request. */
export async function ensureStandardDepartments(tenantId: string) {
  const existing = await prisma.department.findMany({ where: { tenantId }, select: { name: true, code: true } });
  const codes = new Set(existing.map((d) => d.code.toUpperCase()));
  for (const std of STANDARD_DEPARTMENTS) {
    if (codes.has(std.code)) continue;
    // "IT / Development" covers both IT and Engineering; "Product Management" must not satisfy "Management" etc.
    const covered = existing.some((d) => std.match.test(d.name) && !(std.code === 'MANAGEMENT' && /product/i.test(d.name)));
    if (covered) continue;
    try {
      await prisma.department.create({ data: { tenantId, code: std.code, name: std.name } });
      codes.add(std.code);
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // created concurrently
    }
  }
}

/**
 * Reporting manager an employee should get from their department: the department head,
 * unless the employee *is* the head (or the head has left).
 */
export async function departmentHeadFor(tenantId: string, departmentId: string, employeeId?: string) {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, tenantId }, select: { headEmployeeId: true } });
  if (!dept?.headEmployeeId || dept.headEmployeeId === employeeId) return null;
  const head = await prisma.employee.findFirst({
    where: { id: dept.headEmployeeId, tenantId, status: { notIn: ['EXITED', 'ARCHIVED'] } },
    select: { id: true },
  });
  return head?.id || null;
}
