import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const leaveTypes = await prisma.leaveType.findMany({
      where: { tenantId: user.tenantId },
      include: { policy: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ leaveTypes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Only HR or Company Admin can create leave types' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      code,
      description,
      isPaid = true,
      color = '#3b82f6',
      annualQuota = 18,
      accrualFrequency = 'MONTHLY',
      accrualRate = 1.5,
      maxCarryForward = 45,
      allowHalfDay = true,
      isSandwichRuleEnabled = false,
      allowProbationApplication = true,
      minNoticeDays = 0,
      maxConsecutiveDays = 15,
      documentationRequiredAboveDays = 3,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check if code already exists for this tenant
    const existing = await prisma.leaveType.findUnique({
      where: {
        tenantId_code: {
          tenantId: user.tenantId,
          code: normalizedCode,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: `Leave type with code '${normalizedCode}' already exists.` }, { status: 400 });
    }

    const newLeaveType = await prisma.leaveType.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        code: normalizedCode,
        description: description?.trim() || null,
        isPaid: Boolean(isPaid),
        color,
        policy: {
          create: {
            tenantId: user.tenantId,
            accrualFrequency,
            accrualRate: Number(accrualRate) || 1.5,
            annualQuota: Number(annualQuota) || 18,
            maxCarryForward: Number(maxCarryForward) || 45,
            allowHalfDay: Boolean(allowHalfDay),
            isSandwichRuleEnabled: Boolean(isSandwichRuleEnabled),
            allowProbationApplication: Boolean(allowProbationApplication),
            minNoticeDays: Number(minNoticeDays) || 0,
            maxConsecutiveDays: Number(maxConsecutiveDays) || 15,
            documentationRequiredAboveDays: Number(documentationRequiredAboveDays) || 3,
          },
        },
      },
      include: { policy: true },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0] || 'HR_ADMIN',
      action: 'CREATE_LEAVE_TYPE',
      entityType: 'LEAVE',
      entityId: newLeaveType.id,
      afterState: newLeaveType,
    });

    return NextResponse.json({
      message: 'Leave type and policy created successfully',
      leaveType: newLeaveType,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

