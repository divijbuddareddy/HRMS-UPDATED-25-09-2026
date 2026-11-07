import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_STATUTORY_CONFIG } from '../payroll/engine';

type Db = PrismaClient | Prisma.TransactionClient;
type Grant = { key: string; scope: string; sensitive?: boolean };

const ALL = 'ENTIRE_TENANT';

/** Roles created for every company. PLATFORM_SUPER_ADMIN exists only in the platform owner's tenant. */
export const COMPANY_ROLE_NAMES = ['COMPANY_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE', 'FINANCE', 'MANAGER', 'EMPLOYEE'];

/** Default permissions per role. PLATFORM_SUPER_ADMIN and COMPANY_ADMIN bypass permission checks. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Grant[]> = {
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

/** Idempotently upserts the default permission rows for the given roles. Returns number of grants applied. */
export async function applyDefaultRolePermissions(db: Db, roles: { id: string; name: string }[]): Promise<number> {
  let count = 0;
  for (const role of roles) {
    for (const g of DEFAULT_ROLE_PERMISSIONS[role.name] || []) {
      await db.permission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey: g.key } },
        update: { dataScope: g.scope, isSensitive: !!g.sensitive },
        create: { roleId: role.id, permissionKey: g.key, dataScope: g.scope, isSensitive: !!g.sensitive },
      });
      count++;
    }
  }
  return count;
}

/**
 * Creates the standard configuration every company needs: roles + permissions, Indian statutory
 * rules (EPF, Professional Tax), a default shift, leave types/policies and a default salary structure.
 * Idempotent. Creates no employees or demo data.
 */
export async function provisionCompanyDefaults(db: Db, tenantId: string) {
  const roleMap = new Map<string, { id: string; name: string }>();
  for (const name of COMPANY_ROLE_NAMES) {
    const role = await db.role.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, description: `System ${name} Role`, isSystem: true },
    });
    roleMap.set(name, role);
  }
  await applyDefaultRolePermissions(db, [...roleMap.values()]);

  const statutory = [
    { ruleFamily: 'EPF', jurisdiction: 'INDIA', config: DEFAULT_STATUTORY_CONFIG.epf },
    { ruleFamily: 'PROFESSIONAL_TAX', jurisdiction: 'KARNATAKA', config: DEFAULT_STATUTORY_CONFIG.pt },
  ];
  for (const s of statutory) {
    await db.statutoryRuleSet.upsert({
      where: {
        tenantId_ruleFamily_jurisdiction_version: { tenantId, ruleFamily: s.ruleFamily, jurisdiction: s.jurisdiction, version: 1 },
      },
      update: {},
      create: {
        tenantId,
        ruleFamily: s.ruleFamily,
        jurisdiction: s.jurisdiction,
        effectiveFrom: new Date('2026-04-01'),
        rulesConfig: JSON.stringify(s.config),
        version: 1,
        isActive: true,
        approvedBy: 'SYSTEM_ADMIN',
        approvedAt: new Date(),
      },
    });
  }

  await db.shiftPolicy.upsert({
    where: { tenantId_code: { tenantId, code: 'STD_0930_1830' } },
    update: {},
    create: {
      tenantId,
      name: 'Standard General Shift (09:30 - 18:30)',
      code: 'STD_0930_1830',
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480,
      isDefault: true,
    },
  });

  const leaveConfigs = [
    { name: 'Casual Leave', code: 'CL', isPaid: true, color: '#3b82f6', quota: 12, maxNeg: 0, sandwich: false },
    { name: 'Sick Leave', code: 'SL', isPaid: true, color: '#ef4444', quota: 12, maxNeg: 2, sandwich: false },
    { name: 'Earned Leave', code: 'EL', isPaid: true, color: '#10b981', quota: 18, maxNeg: 0, sandwich: true },
    { name: 'Loss of Pay', code: 'LOP', isPaid: false, color: '#6b7280', quota: 0, maxNeg: 99, sandwich: false },
  ];
  for (const lc of leaveConfigs) {
    const lt = await db.leaveType.upsert({
      where: { tenantId_code: { tenantId, code: lc.code } },
      update: {},
      create: { tenantId, name: lc.name, code: lc.code, isPaid: lc.isPaid, color: lc.color },
    });
    await db.leavePolicy.upsert({
      where: { leaveTypeId: lt.id },
      update: {},
      create: {
        tenantId,
        leaveTypeId: lt.id,
        annualQuota: lc.quota,
        accrualRate: lc.quota / 12,
        accrualFrequency: 'MONTHLY',
        maxCarryForward: 45,
        maxNegativeBalance: lc.maxNeg,
        allowHalfDay: true,
        isSandwichRuleEnabled: lc.sandwich,
      },
    });
  }

  const existingStructure = await db.salaryStructure.findUnique({ where: { tenantId_code: { tenantId, code: 'STD_TECH_CTC' } } });
  if (!existingStructure) {
    await db.salaryStructure.create({
      data: {
        tenantId,
        name: 'Standard Tech CTC Structure',
        code: 'STD_TECH_CTC',
        description: 'Standard 50% Basic, 40% HRA, Special Allowance, EPF, ESI, PT',
        isDefault: true,
        isActive: true,
        components: {
          create: [
            { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.50 * CTC', sortOrder: 1 },
            { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: '0.40 * BASIC', sortOrder: 2 },
            { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA', sortOrder: 3 },
            { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC', isStatutory: true, sortOrder: 4 },
            { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FLAT', valueOrFormula: '200', isStatutory: true, sortOrder: 5 },
            { name: 'Provident Fund (Employer)', code: 'PF_ER', componentType: 'EMPLOYER_CONTRIBUTION', calculationType: 'FORMULA', valueOrFormula: '0.12 * BASIC', isStatutory: true, sortOrder: 6 },
          ],
        },
      },
    });
  }

  return roleMap;
}
