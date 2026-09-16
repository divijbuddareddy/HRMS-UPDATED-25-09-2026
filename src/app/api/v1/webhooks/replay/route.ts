import { NextRequest } from 'next/server';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { replayWebhookDelivery } from '@/lib/webhooks/dispatcher';

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const { deliveryId } = body;

    if (!deliveryId) {
      return errorResponse('Missing deliveryId', 400, 'VALIDATION_ERROR');
    }

    const replayed = await replayWebhookDelivery(deliveryId);
    return jsonResponse({ success: true, replayed });
  } catch (e: any) {
    return errorResponse(e.message, 500, 'WEBHOOK_REPLAY_FAILED');
  }
}
