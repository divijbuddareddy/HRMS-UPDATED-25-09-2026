import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { submitExitRequest } from '@/lib/exit/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  const requests = await prisma.exitRequest.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { employee: true, settlement: true },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ exitRequests: requests });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const { employeeId, requestedLwd, reason, reasonCategory } = body;
    const targetEmpId = employeeId || auth.user.employeeId;

    if (!targetEmpId || !requestedLwd || !reason) {
      return errorResponse('Missing required exit fields', 400, 'VALIDATION_ERROR');
    }

    const exitReq = await submitExitRequest({
      tenantId: auth.user.tenantId,
      employeeId: targetEmpId,
      requestedLwd: new Date(requestedLwd),
      reason,
      reasonCategory,
    });

    return jsonResponse(exitReq, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'VALIDATION_ERROR');
  }
}
