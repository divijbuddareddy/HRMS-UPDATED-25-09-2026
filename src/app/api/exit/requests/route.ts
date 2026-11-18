import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExitRequest } from '@/lib/exit/engine';
import { exitPermissions, isHrApprover } from '@/lib/exit/approval';
import { canActOnEmployee, canCompanyWide, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // HR / exit processors see all exits; managers see self + direct reports; employees only their own.
    const visibleIds =
      canCompanyWide(user, 'exit:process') || isHrApprover(user) ? null : await visibleEmployeeIds(user, 'team:view');

    const exits = await prisma.exitRequest.findMany({
      where: { tenantId: user.tenantId, ...employeeIdFilter(visibleIds) },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            joiningDate: true,
            noticePeriodDays: true,
            reportingManagerId: true,
            reportingManager: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      exits: exits.map((e) => ({ ...e, permissions: exitPermissions(user, e) })),
      me: user.employeeId || null,
      isHr: isHrApprover(user),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetEmployeeId = body.employeeId || user.employeeId;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }

    // Anyone may resign; initiating an exit for someone else is HR / exit processors only.
    const isSelf = !!user.employeeId && targetEmployeeId === user.employeeId;
    if (!isSelf && !(isHrApprover(user) || (await canActOnEmployee(user, targetEmployeeId, 'exit:process')))) {
      return forbidden('You can only submit your own resignation.');
    }

    const requestedLwd = body.requestedLwd ? new Date(body.requestedLwd) : new Date(Date.now() + 30 * 86400000);
    if (isNaN(requestedLwd.getTime())) return NextResponse.json({ error: 'Invalid last working day.' }, { status: 400 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedLwd < today) return NextResponse.json({ error: 'Last working day cannot be in the past.' }, { status: 400 });
    const reason = String(body.reason ?? '').trim();
    if (!reason) return NextResponse.json({ error: 'Please give a reason.' }, { status: 400 });

    const exitReq = await submitExitRequest({
      tenantId: user.tenantId,
      employeeId: targetEmployeeId,
      requestedLwd,
      reason: reason.slice(0, 2000),
      reasonCategory: body.reasonCategory || 'BETTER_OPPORTUNITY',
      initiatedByHr: isSelf ? undefined : { approverUserId: user.userId },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: isSelf ? 'SUBMIT_RESIGNATION' : 'INITIATE_EXIT',
      entityType: 'EXIT_REQUEST',
      entityId: exitReq.id,
      afterState: { employeeId: targetEmployeeId, status: exitReq.status, requestedLwd },
    });

    return NextResponse.json({ success: true, exitRequest: exitReq }, { status: 201 });
  } catch (error: any) {
    const known = /already an open resignation|Employee not found/.test(error.message);
    return NextResponse.json({ error: error.message }, { status: known ? 400 : 500 });
  }
}
