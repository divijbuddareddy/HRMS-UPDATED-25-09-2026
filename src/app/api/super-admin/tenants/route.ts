import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isPlatformSuperAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { generateTempPassword } from '@/lib/passwords';
import { provisionCompanyDefaults } from '@/lib/tenants/defaults';

const PLANS = ['STANDARD', 'GROWTH', 'ENTERPRISE'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isPlatformSuperAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: { select: { employees: true, users: true, payrollRuns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tenants, currentTenantId: user.tenantId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Create a new company (tenant) with standard configuration and its first Company Admin login. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isPlatformSuperAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const slug = String(body.slug || '').trim().toLowerCase();
    const plan = String(body.plan || 'STANDARD').toUpperCase();
    const domain = body.domain ? String(body.domain).trim().toLowerCase() : null;
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase();

    if (!name) return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: 'Company ID must be 3–40 characters: lowercase letters, numbers and hyphens (e.g. acme-corp).' },
        { status: 400 }
      );
    }
    if (!PLANS.includes(plan)) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
    if (!EMAIL_RE.test(adminEmail)) return NextResponse.json({ error: 'A valid admin email is required.' }, { status: 400 });

    if (await prisma.tenant.findUnique({ where: { slug } })) {
      return NextResponse.json({ error: `The company ID "${slug}" is already taken.` }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const tenant = await prisma.$transaction(
      async (tx) => {
        const t = await tx.tenant.create({
          data: {
            name,
            slug,
            domain,
            plan,
            status: 'ACTIVE',
            settings: JSON.stringify({ currency: 'INR', country: 'India', timezone: 'Asia/Kolkata' }),
          },
        });
        const roles = await provisionCompanyDefaults(tx, t.id);
        const admin = await tx.user.create({
          data: { tenantId: t.id, email: adminEmail, passwordHash, status: 'ACTIVE', mustChangePassword: true },
        });
        await tx.userRole.create({ data: { userId: admin.id, roleId: roles.get('COMPANY_ADMIN')!.id } });
        return t;
      },
      { timeout: 30000 }
    );

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: 'PLATFORM_SUPER_ADMIN',
      action: 'CREATE_TENANT',
      entityType: 'TENANT',
      entityId: tenant.id,
      afterState: { name, slug, plan, adminEmail },
    });

    return NextResponse.json({ success: true, tenant, admin: { email: adminEmail }, tempPassword }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Suspend or re-activate a company. Users of a suspended company cannot sign in. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isPlatformSuperAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { tenantId, status } = await req.json().catch(() => ({}));
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return NextResponse.json({ error: 'Status must be ACTIVE or SUSPENDED.' }, { status: 400 });
    }
    if (tenantId === user.tenantId) {
      return NextResponse.json({ error: 'You cannot suspend your own company.' }, { status: 400 });
    }

    const before = await prisma.tenant.findUnique({ where: { id: String(tenantId || '') } });
    if (!before) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

    const tenant = await prisma.tenant.update({ where: { id: before.id }, data: { status } });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: 'PLATFORM_SUPER_ADMIN',
      action: status === 'SUSPENDED' ? 'SUSPEND_TENANT' : 'ACTIVATE_TENANT',
      entityType: 'TENANT',
      entityId: tenant.id,
      beforeState: { status: before.status },
      afterState: { status },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
