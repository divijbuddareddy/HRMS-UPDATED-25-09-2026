import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { isOwner } from '../access-policy';

/** Statuses where the resignation is still waiting for a decision. */
export const PENDING_STATUSES = ['PENDING_MANAGER', 'PENDING_HR', 'INITIATED'];
/** Statuses that count as an open exit (blocks a second resignation). */
export const OPEN_STATUSES = [...PENDING_STATUSES, 'APPROVED', 'CLEARANCE_IN_PROGRESS'];

/** HR approver: HR Admin, HR Executive or the company owner. */
export function isHrApprover(user: AuthUser) {
  return isOwner(user) || user.roles.includes('HR_ADMIN' as any) || user.roles.includes('HR_EXECUTIVE' as any);
}

type ExitLike = { status: string; employeeId: string; managerApproval: string; employee?: { reportingManagerId: string | null } | null };

/** Which stage is the request waiting for right now? (legacy INITIATED rows are mapped too) */
export function waitingStage(e: ExitLike): 'MANAGER' | 'HR' | null {
  if (e.status === 'PENDING_MANAGER') return 'MANAGER';
  if (e.status === 'PENDING_HR') return 'HR';
  if (e.status === 'INITIATED') {
    return e.managerApproval === 'PENDING' && e.employee?.reportingManagerId ? 'MANAGER' : 'HR';
  }
  return null;
}

/** What the logged-in user may do with this exit request (used by the API and shown by the page). */
export function exitPermissions(user: AuthUser, e: ExitLike) {
  const isSelf = !!user.employeeId && user.employeeId === e.employeeId;
  const stage = waitingStage(e);
  const isTheirManager = !!user.employeeId && e.employee?.reportingManagerId === user.employeeId;
  return {
    canManagerDecide: stage === 'MANAGER' && isTheirManager && !isSelf,
    canHrDecide: stage === 'HR' && isHrApprover(user) && !isSelf,
    // The employee can withdraw while it is still pending; HR / owner can cancel any open exit.
    canWithdraw: (isSelf && PENDING_STATUSES.includes(e.status)) || (!isSelf && isHrApprover(user) && OPEN_STATUSES.includes(e.status)),
    canSettle: e.status === 'APPROVED' || e.status === 'CLEARANCE_IN_PROGRESS',
  };
}

/**
 * Starting point for a new resignation: goes to the reporting manager first when the employee has
 * an active one, otherwise straight to HR.
 */
export async function initialApprovalState(tenantId: string, employeeId: string) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { reportingManager: { select: { id: true, status: true } } },
  });
  const mgr = emp?.reportingManager;
  const hasManager = !!mgr && !['EXITED', 'ARCHIVED'].includes(mgr.status);
  return hasManager
    ? { status: 'PENDING_MANAGER', managerApproval: 'PENDING' }
    : { status: 'PENDING_HR', managerApproval: 'NOT_REQUIRED' };
}
