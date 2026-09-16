import { prisma } from '../prisma';

export interface SaaSPlanEntitlement {
  planName: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  displayName: string;
  priceInrMonthly: number;
  maxEmployees: number;
  maxStorageGb: number;
  maxApiKeys: number;
  maxMonthlyAiQueries: number;
  maxBranchLocations: number;
  allowedModules: string[];
  supportTier: 'COMMUNITY' | 'STANDARD_EMAIL' | 'DEDICATED_24_7';
  hasCustomRoles: boolean;
  hasWebhooks: boolean;
}

export const SAAS_PLANS: Record<string, SaaSPlanEntitlement> = {
  STARTER: {
    planName: 'STARTER',
    displayName: 'Starter Plan',
    priceInrMonthly: 4999,
    maxEmployees: 25,
    maxStorageGb: 5,
    maxApiKeys: 2,
    maxMonthlyAiQueries: 100,
    maxBranchLocations: 1,
    allowedModules: ['EMPLOYEE', 'ATTENDANCE', 'LEAVE', 'DOCUMENTS'],
    supportTier: 'STANDARD_EMAIL',
    hasCustomRoles: false,
    hasWebhooks: false,
  },
  GROWTH: {
    planName: 'GROWTH',
    displayName: 'Growth Business Plan',
    priceInrMonthly: 14999,
    maxEmployees: 100,
    maxStorageGb: 25,
    maxApiKeys: 10,
    maxMonthlyAiQueries: 1000,
    maxBranchLocations: 5,
    allowedModules: [
      'EMPLOYEE',
      'ATTENDANCE',
      'LEAVE',
      'PAYROLL',
      'DOCUMENTS',
      'ATS',
      'ONBOARDING',
      'EXPENSES',
      'ASSETS',
    ],
    supportTier: 'STANDARD_EMAIL',
    hasCustomRoles: true,
    hasWebhooks: true,
  },
  ENTERPRISE: {
    planName: 'ENTERPRISE',
    displayName: 'Enterprise Scale Plan',
    priceInrMonthly: 49999,
    maxEmployees: 10000,
    maxStorageGb: 500,
    maxApiKeys: 100,
    maxMonthlyAiQueries: 50000,
    maxBranchLocations: 100,
    allowedModules: [
      'EMPLOYEE',
      'ATTENDANCE',
      'LEAVE',
      'PAYROLL',
      'DOCUMENTS',
      'ATS',
      'ONBOARDING',
      'PERFORMANCE',
      'EXPENSES',
      'ASSETS',
      'EXIT',
      'AI',
      'WEBHOOKS',
      'REPORTS',
      'SUPER_ADMIN',
    ],
    supportTier: 'DEDICATED_24_7',
    hasCustomRoles: true,
    hasWebhooks: true,
  },
};

export async function checkTenantEntitlement(params: {
  tenantId: string;
  requiredModule?: string;
  checkEmployeeLimit?: boolean;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 1. Check status (ACTIVE, TRIAL, GRACE, SUSPENDED, ARCHIVED)
  if (tenant.status === 'SUSPENDED' || tenant.status === 'ARCHIVED') {
    throw new Error(`Tenant account is ${tenant.status.toLowerCase()}. Please contact support to reactivate.`);
  }

  if (tenant.status === 'TRIAL' && tenant.trialEndsAt && new Date() > new Date(tenant.trialEndsAt)) {
    throw new Error('Your 14-day free trial has expired. Please subscribe to an active plan to continue.');
  }

  const plan = SAAS_PLANS[tenant.plan.toUpperCase()] || SAAS_PLANS.ENTERPRISE;

  // 2. Check Module entitlement
  if (params.requiredModule && !plan.allowedModules.includes(params.requiredModule.toUpperCase())) {
    throw new Error(
      `Module '${params.requiredModule}' is not available on the ${plan.displayName}. Upgrade to unlock this capability.`
    );
  }

  // 3. Check Employee count limit
  if (params.checkEmployeeLimit) {
    const currentCount = await prisma.employee.count({
      where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'PROBATION', 'CONFIRMED', 'NOTICE'] } },
    });
    if (currentCount >= plan.maxEmployees) {
      throw new Error(
        `Employee limit reached (${currentCount}/${plan.maxEmployees}) for ${plan.displayName}. Please upgrade your plan.`
      );
    }
  }

  return { allowed: true, plan, tenant };
}
