import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { AuthUser } from '@/lib/types';
import {
  generateTempPassword,
  ASSIGNABLE_LOGIN_ROLES,
  PRIVILEGED_LOGIN_ROLES,
} from '@/lib/passwords';

/**
 * Employee login (portal access) management.
 *  POST  /api/employees/:id/login   { role }                          -> create login, returns one-time temp password
 *  PATCH /api/employees/:id/login   { action: 'RESET_PASSWORD' }      -> new temp password
 *                                   { action: 'DISABLE' | 'ENABLE' }  -> block / unblock sign-in
 *                                   { action: 'CHANGE_ROLE', role }   -> replace the login's role
 */

function canManageLogins(user: AuthUser): boolean {
  return ['PLATFORM_SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN'].some((r) => user.roles.includes(r as any));
}

function canGrantRole(user: AuthUser, role: string): string | null {
  if (!(ASSIGNABLE_LOGIN_ROLES as readonly string[]).includes(role)) {
    return 'Invalid role.';
  }
  const isTopAdmin = user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('COMPANY_ADMIN');
  if (PRIVILEGED_LOGIN_ROLES.includes(role) && !isTopAdmin) {
    return 'Only a Company Admin can grant HR Admin or Company Admin access.';
  }
  return null;
}

async function loadEmployee(tenantId: string, id: string) {
  return prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      user: {
        include: { userRoles: { include: { role: true } } },
      },
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageLogins(user)) {
      return NextResponse.json({ error: 'Forbidden: only administrators can create employee logins.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const roleName: string = body.role || 'EMPLOYEE';

    const roleError = canGrantRole(user, roleName);
    if (roleError) return NextResponse.json({ error: roleError }, { status: 400 });

    const employee = await loadEmployee(user.tenantId, id);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (employee.user) {
      return NextResponse.json({ error: 'This employee already has a login. Use "Reset password" instead.' }, { status: 409 });
    }

    const email = (employee.workEmail || '').toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'Employee has no work email.' }, { status: 400 });

    const existing = await prisma.user.findFirst({ where: { tenantId: user.tenantId, email } });
    if (existing) {
      return NextResponse.json({ error: `A login with the email ${email} already exists.` }, { status: 409 });
    }

    const role = await prisma.role.findFirst({ where: { tenantId: user.tenantId, name: roleName } });
    if (!role) return NextResponse.json({ error: `Role ${roleName} is not configured.` }, { status: 500 });

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: user.tenantId,
          email,
          phone: employee.mobilePhone || null,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      });
      await tx.userRole.create({ data: { userId: newUser.id, roleId: role.id } });
      await tx.employee.update({ where: { id: employee.id }, data: { userId: newUser.id } });
      return newUser;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'CREATE_LOGIN',
      entityType: 'USER',
      entityId: created.id,
      afterState: { employeeId: employee.id, email, role: roleName },
    });

    return NextResponse.json({
      success: true,
      login: { email, role: roleName, status: 'ACTIVE' },
      tempPassword,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageLogins(user)) {
      return NextResponse.json({ error: 'Forbidden: only administrators can manage employee logins.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

    const employee = await loadEmployee(user.tenantId, id);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const target = employee.user;
    if (!target) return NextResponse.json({ error: 'This employee has no login yet.' }, { status: 404 });

    if (target.id === user.userId) {
      return NextResponse.json({ error: 'You cannot change your own login here. Use "Change password" instead.' }, { status: 400 });
    }
    const targetRoles = target.userRoles.map((ur) => ur.role.name);
    if (targetRoles.includes('PLATFORM_SUPER_ADMIN')) {
      return NextResponse.json({ error: 'The super admin account cannot be changed here.' }, { status: 403 });
    }
    const isTopAdmin = user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('COMPANY_ADMIN');
    if (!isTopAdmin && targetRoles.some((r) => PRIVILEGED_LOGIN_ROLES.includes(r))) {
      return NextResponse.json({ error: 'Only a Company Admin can manage HR Admin or Company Admin logins.' }, { status: 403 });
    }

    let tempPassword: string | undefined;
    let auditAction: string;
    const afterState: Record<string, any> = { employeeId: employee.id, email: target.email };

    if (action === 'RESET_PASSWORD') {
      tempPassword = generateTempPassword();
      await prisma.user.update({
        where: { id: target.id },
        data: {
          passwordHash: await hashPassword(tempPassword),
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      auditAction = 'RESET_LOGIN_PASSWORD';
    } else if (action === 'DISABLE') {
      await prisma.user.update({ where: { id: target.id }, data: { status: 'DEACTIVATED' } });
      auditAction = 'DISABLE_LOGIN';
    } else if (action === 'ENABLE') {
      await prisma.user.update({
        where: { id: target.id },
        data: { status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null },
      });
      auditAction = 'ENABLE_LOGIN';
    } else if (action === 'CHANGE_ROLE') {
      const roleName: string = body.role;
      const roleError = canGrantRole(user, roleName);
      if (roleError) return NextResponse.json({ error: roleError }, { status: 400 });
      const role = await prisma.role.findFirst({ where: { tenantId: user.tenantId, name: roleName } });
      if (!role) return NextResponse.json({ error: `Role ${roleName} is not configured.` }, { status: 500 });
      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId: target.id } }),
        prisma.userRole.create({ data: { userId: target.id, roleId: role.id } }),
      ]);
      afterState.previousRoles = targetRoles;
      afterState.role = roleName;
      auditAction = 'CHANGE_LOGIN_ROLE';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: auditAction,
      entityType: 'USER',
      entityId: target.id,
      afterState,
    });

    return NextResponse.json({ success: true, ...(tempPassword ? { tempPassword } : {}) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
