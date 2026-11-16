import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';

const ACCRUAL_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'LUMP_SUM'];

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Edit a leave type and its policy. HR Admin or company owner (leave:configure). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'leave:configure')) return forbidden('Only HR Admin or the company owner can edit leave policies.');

    const existing = await prisma.leaveType.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { policy: true },
    });
    if (!existing) return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : existing.name;
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : existing.code;
    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    if (code !== existing.code) {
      const clash = await prisma.leaveType.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code } },
      });
      if (clash) {
        return NextResponse.json({ error: `Leave type with code '${code}' already exists.` }, { status: 400 });
      }
    }

    const p = existing.policy;
    const accrualFrequency = ACCRUAL_FREQUENCIES.includes(body.accrualFrequency)
      ? body.accrualFrequency
      : p?.accrualFrequency ?? 'MONTHLY';
    const policyData = {
      accrualFrequency,
      accrualRate: num(body.accrualRate, p?.accrualRate ?? 1.5),
      annualQuota: num(body.annualQuota, p?.annualQuota ?? 18),
      maxCarryForward: num(body.maxCarryForward, p?.maxCarryForward ?? 45),
      allowHalfDay: body.allowHalfDay !== undefined ? Boolean(body.allowHalfDay) : p?.allowHalfDay ?? true,
      isSandwichRuleEnabled:
        body.isSandwichRuleEnabled !== undefined ? Boolean(body.isSandwichRuleEnabled) : p?.isSandwichRuleEnabled ?? false,
      allowProbationApplication:
        body.allowProbationApplication !== undefined
          ? Boolean(body.allowProbationApplication)
          : p?.allowProbationApplication ?? true,
      minNoticeDays: Math.round(num(body.minNoticeDays, p?.minNoticeDays ?? 0)),
      maxConsecutiveDays: Math.round(num(body.maxConsecutiveDays, p?.maxConsecutiveDays ?? 15)),
      documentationRequiredAboveDays: Math.round(
        num(body.documentationRequiredAboveDays, p?.documentationRequiredAboveDays ?? 3)
      ),
    };

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        name,
        code,
        description:
          body.description !== undefined ? (String(body.description).trim() || null) : existing.description,
        isPaid: body.isPaid !== undefined ? Boolean(body.isPaid) : existing.isPaid,
        color: typeof body.color === 'string' && body.color ? body.color : existing.color,
        policy: {
          upsert: {
            create: { tenantId: user.tenantId, ...policyData },
            update: policyData,
          },
        },
      },
      include: { policy: true },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0] || 'HR_ADMIN',
      action: 'UPDATE_LEAVE_TYPE',
      entityType: 'LEAVE',
      entityId: id,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ message: 'Leave policy updated', leaveType: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Delete a leave type and its policy. HR Admin or company owner (leave:configure).
 * Refused when leave requests or ledger entries reference it, because deleting would cascade
 * and erase employees' leave history and balances.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'leave:configure')) return forbidden('Only HR Admin or the company owner can delete leave policies.');

    const existing = await prisma.leaveType.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { policy: true, _count: { select: { requests: true, ledger: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });

    const { requests, ledger } = existing._count;
    if (requests > 0 || ledger > 0) {
      return NextResponse.json(
        {
          error:
            `'${existing.name}' cannot be deleted because it is already in use ` +
            `(${requests} leave request(s), ${ledger} balance/ledger entr${ledger === 1 ? 'y' : 'ies'}). ` +
            `Deleting it would erase employees' leave history. Edit the policy instead (e.g. set the quota to 0).`,
        },
        { status: 409 }
      );
    }

    await prisma.leaveType.delete({ where: { id } });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0] || 'HR_ADMIN',
      action: 'DELETE_LEAVE_TYPE',
      entityType: 'LEAVE',
      entityId: id,
      beforeState: existing,
    });

    return NextResponse.json({ message: 'Leave type deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
