import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processExpenseClaimApproval } from '@/lib/expenses/engine';
import { can, canActOnEmployee, forbidden } from '@/lib/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { stage, decision, notes } = body;
    const effectiveStage: 'MANAGER' | 'FINANCE' = stage === 'FINANCE' ? 'FINANCE' : 'MANAGER';
    const effectiveDecision: 'APPROVED' | 'REJECTED' = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    if (stage && !['MANAGER', 'FINANCE'].includes(stage)) {
      return NextResponse.json({ error: 'stage must be MANAGER or FINANCE' }, { status: 400 });
    }
    if (decision && !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be APPROVED or REJECTED' }, { status: 400 });
    }

    const claim = await prisma.expenseClaim.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, employeeId: true },
    });
    if (!claim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 });
    }
    if (user.employeeId && claim.employeeId === user.employeeId) {
      return forbidden('You cannot approve or reject your own expense claim.');
    }

    if (effectiveStage === 'FINANCE') {
      // Final approval / payout: FINANCE or company owner only.
      if (!can(user, 'expense:final-approve')) {
        return forbidden('Only Finance or the company owner can give final approval to expense claims.');
      }
    } else {
      // First-level approval: manager for direct reports; FINANCE / owner company-wide.
      if (!can(user, 'expense:approve')) {
        return forbidden('You are not allowed to approve expense claims.');
      }
      if (!(await canActOnEmployee(user, claim.employeeId, 'expense:approve'))) {
        return forbidden('You can only approve expense claims of your direct reports.');
      }
    }

    const result = await processExpenseClaimApproval({
      tenantId: user.tenantId,
      claimId: id,
      stage: effectiveStage,
      decision: effectiveDecision,
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, claim: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
