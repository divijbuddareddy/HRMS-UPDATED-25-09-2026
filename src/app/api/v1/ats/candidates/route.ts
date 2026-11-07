import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { applyCandidate } from '@/lib/ats/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const candidates = await prisma.candidate.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { jobRequisition: true, interviews: true, offer: true },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ candidates });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const candidate = await applyCandidate({
      ...body,
      tenantId: auth.user.tenantId,
    });
    return jsonResponse(candidate, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'VALIDATION_ERROR');
  }
}
