import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { submitExpenseClaim } from '@/lib/expenses/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  const claims = await prisma.expenseClaim.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { employee: true, category: true },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ claims });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const claim = await submitExpenseClaim({
      ...body,
      tenantId: auth.user.tenantId,
      claimDate: new Date(body.claimDate || new Date()),
    });
    return jsonResponse(claim, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'VALIDATION_ERROR');
  }
}
