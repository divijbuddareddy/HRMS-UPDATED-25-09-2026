/**
 * Central access-control policy ("who can do what").
 *
 * Every logged-in user is an EMPLOYEE for self-service (own profile, attendance, leave,
 * payslips, expenses, documents, goals, assets, resignation). Higher roles add capabilities.
 * COMPANY_ADMIN (company owner) and PLATFORM_SUPER_ADMIN can do everything within their company.
 *
 * The role -> capability table and the pure checks live in ./access-policy (client-safe, no
 * server imports). This module re-exports them and adds the database-backed row-level helpers.
 *
 * Use in API routes:
 *   if (!can(user, 'leave:approve')) return forbidden();
 *   if (!(await canActOnEmployee(user, employeeId, 'leave:approve'))) return forbidden('...');
 */
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { AuthUser } from './types';
import { Capability, can, canCompanyWide } from './access-policy';

export type { Capability, PolicyUser } from './access-policy';
export {
  OWNER_ROLES,
  ROLE_CAPABILITIES,
  TEAM_SCOPED_FOR_MANAGER,
  isOwner,
  can,
  canCompanyWide,
} from './access-policy';

/**
 * Can the user perform `cap` on a specific employee of their company?
 * - Company-wide holders: yes (employee must belong to the same company).
 * - MANAGER: only for direct reports.
 * - `allowSelf` is false by default: nobody approves their own requests.
 */
export async function canActOnEmployee(
  user: AuthUser,
  employeeId: string | null | undefined,
  cap: Capability,
  opts: { allowSelf?: boolean } = {}
): Promise<boolean> {
  if (!employeeId || !can(user, cap)) return false;
  if (!opts.allowSelf && user.employeeId && user.employeeId === employeeId) return false;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId: user.tenantId },
    select: { id: true, reportingManagerId: true },
  });
  if (!employee) return false;

  if (canCompanyWide(user, cap)) return true;
  return !!user.employeeId && employee.reportingManagerId === user.employeeId;
}

/**
 * Read access to one employee's data: always for the user's own record, otherwise only if the
 * user holds `cap` for that employee (company-wide, or MANAGER for a direct report).
 */
export async function canViewEmployee(
  user: AuthUser,
  employeeId: string | null | undefined,
  cap: Capability = 'team:view'
): Promise<boolean> {
  if (!employeeId) return false;
  if (user.employeeId && user.employeeId === employeeId) return true;
  return canActOnEmployee(user, employeeId, cap, { allowSelf: true });
}

/** IDs of the user's direct reports (for list filtering by managers). */
export async function directReportIds(user: AuthUser): Promise<string[]> {
  if (!user.employeeId) return [];
  const rows = await prisma.employee.findMany({
    where: { tenantId: user.tenantId, reportingManagerId: user.employeeId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * For list endpoints: whose rows may the user see?
 * - `null`  -> no restriction (company-wide holder of `cap`; tenant scoping still applies)
 * - array   -> only these employee IDs: self, plus direct reports when the user holds `cap`
 *              only as MANAGER. May be empty (login without an employee profile).
 */
export async function visibleEmployeeIds(user: AuthUser, cap: Capability = 'team:view'): Promise<string[] | null> {
  if (canCompanyWide(user, cap)) return null;
  const ids: string[] = user.employeeId ? [user.employeeId] : [];
  if (can(user, cap)) {
    const reports = await directReportIds(user);
    for (const id of reports) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Prisma `where` fragment for an `employeeId` column, built from visibleEmployeeIds(). */
export function employeeIdFilter(ids: string[] | null): { employeeId?: { in: string[] } } {
  return ids === null ? {} : { employeeId: { in: ids } };
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return NextResponse.json({ error: message }, { status: 403 });
}
