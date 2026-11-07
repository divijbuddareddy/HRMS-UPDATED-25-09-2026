import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { deliveries: { take: 10, orderBy: { deliveredAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ subscriptions });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { targetUrl, events } = body;

    if (!targetUrl || !events) {
      return errorResponse('Missing required fields: targetUrl, events', 400, 'VALIDATION_ERROR');
    }

    const secretKey = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const subscription = await prisma.webhookSubscription.create({
      data: {
        tenantId: auth.user.tenantId,
        targetUrl,
        secretKey,
        events: Array.isArray(events) ? JSON.stringify(events) : JSON.stringify([events]),
        isActive: true,
      },
    });

    return jsonResponse(subscription, 201);
  } catch (e: any) {
    return errorResponse(e.message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
