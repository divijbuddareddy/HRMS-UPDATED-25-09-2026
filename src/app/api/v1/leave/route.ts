import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { validateAndApplyLeave, getEmployeeAllLeaveBalances } from '@/lib/leave/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') || auth.user.employeeId;

  if (employeeId) {
    const balances = await getEmployeeAllLeaveBalances(auth.user.tenantId, employeeId);
    return jsonResponse({ balances });
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { employee: true, leaveType: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return jsonResponse({ requests });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const { employeeId, leaveTypeId, startDate, endDate, reason, isHalfDay } = body;

    const targetEmpId = employeeId || auth.user.employeeId;
    if (!targetEmpId || !leaveTypeId || !startDate || !endDate || !reason) {
      return errorResponse('Missing required leave application fields', 400, 'VALIDATION_ERROR');
    }

    const leave = await validateAndApplyLeave({
      tenantId: auth.user.tenantId,
      employeeId: targetEmpId,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay: Boolean(isHalfDay),
      reason,
    });

    return jsonResponse(leave, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'LEAVE_VALIDATION_FAILED');
  }
}
