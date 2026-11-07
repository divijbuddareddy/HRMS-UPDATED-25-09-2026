/**
 * Idempotently assigns the default permissions (src/lib/tenants/defaults.ts) to the system roles of every tenant.
 * PLATFORM_SUPER_ADMIN and COMPANY_ADMIN bypass permission checks and need no rows.
 *
 * Usage: npx tsx scripts/setup-role-permissions.ts
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, applyDefaultRolePermissions } from '../src/lib/tenants/defaults';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({ where: { name: { in: Object.keys(DEFAULT_ROLE_PERMISSIONS) } } });
  const grants = await applyDefaultRolePermissions(prisma, roles);
  console.log(`ROLE_PERMISSIONS_DONE roles=${roles.length} grants=${grants}`);
}

main()
  .catch((e) => {
    console.error('ROLE_PERMISSIONS_FAILED', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
