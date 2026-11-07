import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { createJobRequisition } from '@/lib/ats/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const jobs = await prisma.jobRequisition.findMany({
    where: { tenantId: auth.user.tenantId },
    include: {
      department: true,
      designation: true,
      branchLocation: true,
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ jobs });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const job = await createJobRequisition({
      ...body,
      tenantId: auth.user.tenantId,
      actor: auth.user,
    });
    return jsonResponse(job, 201);
  } catch (e: any) {
    return errorResponse(e.message, 400, 'VALIDATION_ERROR');
  }
}
