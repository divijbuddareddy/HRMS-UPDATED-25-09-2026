import { NextRequest } from 'next/server';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { replayWebhookDelivery } from '@/lib/webhooks/dispatcher';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { deliveryId } = body;

    if (!deliveryId) {
      return errorResponse('Missing deliveryId', 400, 'VALIDATION_ERROR');
    }

    // The delivery must belong to one of the caller's own webhook subscriptions.
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, subscription: { tenantId: auth.user.tenantId } },
      select: { id: true },
    });
    if (!delivery) {
      return errorResponse('Webhook delivery not found', 404, 'NOT_FOUND');
    }

    const replayed = await replayWebhookDelivery(deliveryId);
    return jsonResponse({ success: true, replayed });
  } catch (e: any) {
    return errorResponse(e.message, 500, 'WEBHOOK_REPLAY_FAILED');
  }
}
