/**
 * Idempotently assigns sensible default permissions to the system roles of every tenant.
 * PLATFORM_SUPER_ADMIN and COMPANY_ADMIN bypass permission checks and need no rows.
 *
 * Usage: npx tsx scripts/setup-role-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Grant = { key: string; scope: string; sensitive?: boolean };

const ALL = 'ENTIRE_TENANT';

const DEFAULT_ROLE_PERMISSIONS: Record<string, Grant[]> = {
  EMPLOYEE: [
    { key: 'employee:read', scope: 'OWN' },
    { key: 'attendance:punch', scope: 'OWN' },
    { key: 'attendance:read', scope: 'OWN' },
    { key: 'attendance:regularize', scope: 'OWN' },
    { key: 'leave:apply', scope: 'OWN' },
    { key: 'leave:read', scope: 'OWN' },
    { key: 'payslip:read', scope: 'OWN' },
  ],
  MANAGER: [
    { key: 'employee:read', scope: 'DIRECT_REPORTS' },
    { key: 'attendance:punch', scope: 'OWN' },
    { key: 'attendance:read', scope: 'DIRECT_REPORTS' },
    { key: 'attendance:regularize', scope: 'OWN' },
    { key: 'attendance:approve', scope: 'DIRECT_REPORTS' },
    { key: 'leave:apply', scope: 'OWN' },
    { key: 'leave:read', scope: 'DIRECT_REPORTS' },
    { key: 'leave:approve', scope: 'DIRECT_REPORTS' },
    { key: 'payslip:read', scope: 'OWN' },
  ],
  HR_EXECUTIVE: [
    { key: 'employee:read', scope: ALL },
    { key: 'employee:write', scope: ALL },
    { key: 'identity:read', scope: ALL, sensitive: true },
    { key: 'attendance:punch', scope: 'OWN' },
    { key: 'attendance:read', scope: ALL },
    { key: 'attendance:manage', scope: ALL },
    { key: 'attendance:approve', scope: ALL },
    { key: 'leave:apply', scope: 'OWN' },
    { key: 'leave:read', scope: ALL },
    { key: 'leave:approve', scope: ALL },
    { key: 'payslip:read', scope: 'OWN' },
  ],
  HR_ADMIN: [
    { key: 'employee:read', scope: ALL },
    { key: 'employee:write', scope: ALL },
    { key: 'employee:delete', scope: ALL },
    { key: 'employee:import', scope: ALL },
    { key: 'identity:read', scope: ALL, sensitive: true },
    { key: 'bank:read', scope: ALL, sensitive: true },
    { key: 'salary:read', scope: ALL, sensitive: true },
    { key: 'attendance:punch', scope: 'OWN' },
    { key: 'attendance:read', scope: ALL },
    { key: 'attendance:manage', scope: ALL },
    { key: 'attendance:approve', scope: ALL },
    { key: 'leave:apply', scope: 'OWN' },
    { key: 'leave:read', scope: ALL },
    { key: 'leave:approve', scope: ALL },
    { key: 'leave:manage', scope: ALL },
    { key: 'payslip:read', scope: 'OWN' },
    { key: 'organization:manage', scope: ALL },
    { key: 'audit_log:read', scope: ALL },
  ],
  FINANCE: [
    { key: 'employee:read', scope: ALL },
    { key: 'bank:read', scope: ALL, sensitive: true },
    { key: 'salary:read', scope: ALL, sensitive: true },
    { key: 'salary:manage', scope: ALL, sensitive: true },
    { key: 'payroll:read', scope: ALL, sensitive: true },
    { key: 'payroll:run', scope: ALL, sensitive: true },
    { key: 'payroll:approve', scope: ALL, sensitive: true },
    { key: 'payroll:lock', scope: ALL, sensitive: true },
    { key: 'payroll:override', scope: ALL, sensitive: true },
    { key: 'payroll:publish', scope: ALL, sensitive: true },
    { key: 'payslip:read', scope: ALL, sensitive: true },
    { key: 'statutory:manage', scope: ALL },
    { key: 'attendance:punch', scope: 'OWN' },
    { key: 'leave:apply', scope: 'OWN' },
    { key: 'leave:read', scope: 'OWN' },
  ],
};

async function main() {
  const roles = await prisma.role.findMany({ where: { name: { in: Object.keys(DEFAULT_ROLE_PERMISSIONS) } } });
  let upserts = 0;
  for (const role of roles) {
    for (const g of DEFAULT_ROLE_PERMISSIONS[role.name] || []) {
      await prisma.permission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey: g.key } },
        update: { dataScope: g.scope, isSensitive: !!g.sensitive },
        create: { roleId: role.id, permissionKey: g.key, dataScope: g.scope, isSensitive: !!g.sensitive },
      });
      upserts++;
    }
  }
  console.log(`ROLE_PERMISSIONS_DONE roles=${roles.length} grants=${upserts}`);
}

main()
  .catch((e) => {
    console.error('ROLE_PERMISSIONS_FAILED', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
