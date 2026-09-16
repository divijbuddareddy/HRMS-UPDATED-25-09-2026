import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { SAAS_PLANS } from './plans';

export interface SubscriptionDetails {
  tenantId: string;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED';
  trialEndsAt?: Date | null;
  paymentMethodToken?: string;
  billingEmail: string;
  activeEmployeeCount: number;
  maxAllowedEmployees: number;
}

export async function updateTenantSubscription(params: {
  tenantId: string;
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  paymentMethodToken?: string;
  actor: AuthUser;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
  if (!tenant) throw new Error('Tenant not found');

  const prevPlan = tenant.plan;
  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      plan: params.plan,
      status: 'ACTIVE',
      trialEndsAt: null,
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'SUPER_ADMIN',
    action: 'SUBSCRIPTION_PLAN_CHANGED',
    entityType: 'SAAS_SUBSCRIPTION',
    entityId: tenant.id,
    beforeState: { plan: prevPlan, status: tenant.status },
    afterState: { plan: params.plan, status: 'ACTIVE', paymentMethodToken: params.paymentMethodToken ? '••••••••tok' : undefined },
  });

  return updated;
}

export async function setTenantStatus(params: {
  tenantId: string;
  status: 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'TRIAL';
  actor: AuthUser;
  reason?: string;
}) {
  const tenant = await prisma.tenant.update({
    where: { id: params.tenantId },
    data: { status: params.status },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'SUPER_ADMIN',
    action: `TENANT_STATUS_${params.status}`,
    entityType: 'TENANT',
    entityId: tenant.id,
    afterState: { status: params.status, reason: params.reason },
  });

  return tenant;
}
