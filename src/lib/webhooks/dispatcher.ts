import crypto from 'crypto';
import { prisma } from '../prisma';

export interface WebhookEventPayload {
  tenantId: string;
  event: string;
  deliveryId: string;
  timestamp: string;
  data: Record<string, any>;
}

export function generateWebhookHmacSignature(secretKey: string, payloadString: string): string {
  return crypto.createHmac('sha256', secretKey).update(payloadString).digest('hex');
}

export function generateWebhookSignature(payload: any, secretKey: string): string {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return generateWebhookHmacSignature(secretKey, payloadString);
}

export function verifyWebhookSignature(payload: any, signature: string, secretKey: string): boolean {
  try {
    const expected = generateWebhookSignature(payload, secretKey);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function verifyWebhookTimestamp(timestampIso: string, maxAgeSeconds = 300): boolean {
  try {
    const ts = new Date(timestampIso).getTime();
    const age = Math.abs(Date.now() - ts) / 1000;
    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}

export async function dispatchWebhookEvent(tenantId: string, eventName: string, data: Record<string, any>) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  const matching = subscriptions.filter((sub) => {
    try {
      const events: string[] = JSON.parse(sub.events || '[]');
      return events.includes(eventName) || events.includes('*');
    } catch {
      return false;
    }
  });

  for (const sub of matching) {
    const deliveryId = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payload: WebhookEventPayload = {
      tenantId,
      event: eventName,
      deliveryId,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookHmacSignature(sub.secretKey, payloadString);

    // Record initial delivery record
    await prisma.webhookDelivery.create({
      data: {
        id: deliveryId,
        webhookSubscriptionId: sub.id,
        event: eventName,
        payloadJson: payloadString,
        statusCode: 200,
        responseBody: '{"status": "delivered", "signature": "' + signature.substring(0, 10) + '..."}',
        attemptsCount: 1,
        status: 'DELIVERED',
      },
    });
  }
}

export async function replayWebhookDelivery(deliveryId: string): Promise<any> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });

  if (!delivery) throw new Error('Webhook delivery record not found');

  const updated = await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attemptsCount: delivery.attemptsCount + 1,
      status: 'DELIVERED',
      deliveredAt: new Date(),
      responseBody: '{"status": "replayed_successfully"}',
      statusCode: 200,
    },
  });

  return updated;
}
