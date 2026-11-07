import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { createAsset } from '@/lib/assets/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const assets = await prisma.asset.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { assignments: { include: { employee: true }, where: { returnedDate: null } } },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ assets });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const asset = await createAsset({
      ...body,
      tenantId: auth.user.tenantId,
      actor: auth.user,
    });
    return jsonResponse(asset, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'VALIDATION_ERROR');
  }
}
