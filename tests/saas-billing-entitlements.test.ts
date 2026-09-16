import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { checkTenantEntitlement, SAAS_PLANS } from '../src/lib/saas/plans';
import { updateTenantSubscription, setTenantStatus } from '../src/lib/saas/billing';
import { AuthUser } from '../src/lib/types';

describe('SaaS Billing, Plan Entitlements & Subscription Lifecycle', () => {
  let tenantId: string;
  const adminActor: AuthUser = {
    userId: 'u-super-admin',
    tenantId: 'temp',
    email: 'superadmin@platform.com',
    roles: ['PLATFORM_SUPER_ADMIN'],
    permissions: [],
  };

  beforeAll(async () => {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'saas-entitlement-test' },
      update: { plan: 'STARTER', status: 'ACTIVE' },
      create: {
        name: 'SaaS Entitlement Test Corp',
        slug: 'saas-entitlement-test',
        plan: 'STARTER',
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;
    adminActor.tenantId = tenant.id;
  });

  it('should enforce Starter plan limitations and disallow Enterprise modules', async () => {
    // Starter plan does NOT include PERFORMANCE or EXIT modules
    await expect(
      checkTenantEntitlement({
        tenantId,
        requiredModule: 'PERFORMANCE',
      })
    ).rejects.toThrow(/not available on the Starter Plan/);
  });

  it('should allow Starter plan modules (EMPLOYEE, ATTENDANCE, LEAVE, DOCUMENTS)', async () => {
    const res = await checkTenantEntitlement({
      tenantId,
      requiredModule: 'EMPLOYEE',
    });
    expect(res.allowed).toBe(true);
    expect(res.plan.planName).toBe('STARTER');
  });

  it('should upgrade tenant subscription to ENTERPRISE and unlock full module suite', async () => {
    const updated = await updateTenantSubscription({
      tenantId,
      plan: 'ENTERPRISE',
      paymentMethodToken: 'tok_visa_enterprise_9988',
      actor: adminActor,
    });

    expect(updated.plan).toBe('ENTERPRISE');

    const res = await checkTenantEntitlement({
      tenantId,
      requiredModule: 'PERFORMANCE',
    });
    expect(res.allowed).toBe(true);
    expect(res.plan.planName).toBe('ENTERPRISE');
  });

  it('should block operations when tenant account is SUSPENDED', async () => {
    await setTenantStatus({
      tenantId,
      status: 'SUSPENDED',
      actor: adminActor,
      reason: 'Billing delinquency test',
    });

    await expect(
      checkTenantEntitlement({
        tenantId,
        requiredModule: 'EMPLOYEE',
      })
    ).rejects.toThrow(/Tenant account is suspended/);

    // Reactivate for subsequent tests
    await setTenantStatus({
      tenantId,
      status: 'ACTIVE',
      actor: adminActor,
      reason: 'Payment cleared',
    });
  });
});
