/**
 * Client-safe access-control policy: the role -> capability table and pure checks.
 *
 * This module must not import anything server-only (prisma, next/server, ...) so that it can be
 * used from client components (e.g. the Sidebar). Server code should import from `./access`,
 * which re-exports everything here and adds the row-level (database-backed) helpers.
 */

export type Capability =
  | 'team:view' // see records of direct reports
  | 'employees:manage' // view/create/edit all employee records
  | 'logins:manage' // create/reset/disable employee logins
  | 'org:manage' // legal entities, branches, departments, designations
  | 'attendance:manage' // view/fix attendance for everyone
  | 'attendance:approve' // approve regularization requests
  | 'leave:approve' // approve/reject leave requests
  | 'leave:configure' // leave types & policies
  | 'expense:approve' // approve expense claims (manager level)
  | 'expense:final-approve' // final approval / payout of expense claims
  | 'expense:configure' // expense categories
  | 'performance:review' // review goals / appraisals of others
  | 'performance:manage' // create performance cycles
  | 'onboarding:manage' // onboarding templates, instances, items of others
  | 'recruitment:manage' // jobs & candidates
  | 'documents:manage' // document templates, issuing documents to others
  | 'assets:manage' // create/assign/return assets
  | 'exit:process' // initiate exits for others, calculate F&F
  | 'exit:settle' // approve & pay full-and-final settlement
  | 'payroll:manage' // payroll runs, structures, statutory rules
  | 'reports:view' // company-wide reports
  | 'audit:view' // audit trail
  | 'integrations:manage'; // webhooks, API keys, AI provider config

/** Minimal user shape needed for role checks (satisfied by AuthUser and by the client-side user). */
export interface PolicyUser {
  roles?: readonly string[] | null;
}

/** Roles with unrestricted access inside their own company. */
export const OWNER_ROLES = ['PLATFORM_SUPER_ADMIN', 'COMPANY_ADMIN'];

/**
 * Capabilities per role. Capabilities marked as team-scoped for MANAGER are additionally
 * restricted to the manager's direct reports by canActOnEmployee().
 */
export const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  EMPLOYEE: [],
  MANAGER: ['team:view', 'attendance:approve', 'leave:approve', 'expense:approve', 'performance:review'],
  HR_EXECUTIVE: [
    'team:view',
    'employees:manage',
    'attendance:manage',
    'attendance:approve',
    'leave:approve',
    'performance:review',
    'onboarding:manage',
    'recruitment:manage',
    'documents:manage',
    'assets:manage',
  ],
  HR_ADMIN: [
    'team:view',
    'employees:manage',
    'logins:manage',
    'org:manage',
    'attendance:manage',
    'attendance:approve',
    'leave:approve',
    'leave:configure',
    'expense:configure',
    'performance:review',
    'performance:manage',
    'onboarding:manage',
    'recruitment:manage',
    'documents:manage',
    'assets:manage',
    'exit:process',
    'reports:view',
    'audit:view',
  ],
  FINANCE: [
    'payroll:manage',
    'expense:approve',
    'expense:final-approve',
    'expense:configure',
    'exit:process',
    'exit:settle',
    'reports:view',
  ],
};

/**
 * Capabilities that MANAGER holds only for direct reports. For other roles holding the same
 * capability it applies company-wide.
 */
export const TEAM_SCOPED_FOR_MANAGER: Capability[] = [
  'team:view',
  'attendance:approve',
  'leave:approve',
  'expense:approve',
  'performance:review',
];

export function isOwner(user: PolicyUser | null | undefined): boolean {
  return !!user?.roles?.some((r) => OWNER_ROLES.includes(r));
}

/** Does the user hold this capability for at least some employees? */
export function can(user: PolicyUser | null | undefined, cap: Capability): boolean {
  if (!user || !user.roles) return false;
  if (isOwner(user)) return true;
  return user.roles.some((r) => (ROLE_CAPABILITIES[r] || []).includes(cap));
}

/** Does the user hold this capability company-wide (not only for their team)? */
export function canCompanyWide(user: PolicyUser | null | undefined, cap: Capability): boolean {
  if (!user || !user.roles) return false;
  if (isOwner(user)) return true;
  return user.roles.some(
    (r) => (ROLE_CAPABILITIES[r] || []).includes(cap) && !(r === 'MANAGER' && TEAM_SCOPED_FOR_MANAGER.includes(cap))
  );
}
