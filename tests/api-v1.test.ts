import crypto from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { authenticateV1Request } from '../src/lib/api/v1-auth';
import { NextRequest } from 'next/server';

describe('REST API /api/v1: Authentication, Pagination, Keys & Core Endpoints', () => {
  let tenantId: string;
  let rawApiKey: string;
  let adminUserId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'ai-automation-labs' } });
    if (!tenant) throw new Error('Tenant missing');
    tenantId = tenant.id;

    const user = await prisma.user.findFirst({ where: { tenantId } });
    if (!user) throw new Error('User missing');
    adminUserId = user.id;

    // Generate test API Key
    rawApiKey = `aial_live_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

    await prisma.apiKey.upsert({
      where: {
        tenantId_keyPrefix: {
          tenantId,
          keyPrefix: rawApiKey.substring(0, 14),
        },
      },
      update: { keyHash, isActive: true },
      create: {
        tenantId,
        createdByUserId: adminUserId,
        name: 'V1 Integration Test Key',
        keyPrefix: rawApiKey.substring(0, 14),
        keyHash,
        permissions: JSON.stringify(['*']),
        isActive: true,
      },
    });
  });

  it('should authenticate requests using valid X-API-Key header', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/employees', {
      headers: {
        'x-api-key': rawApiKey,
      },
    });

    const auth = await authenticateV1Request(req);
    expect(auth).not.toBeNull();
    expect(auth?.authMethod).toBe('API_KEY');
    expect(auth?.user.tenantId).toBe(tenantId);
  });

  it('should reject requests with invalid X-API-Key header', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/employees', {
      headers: {
        'x-api-key': 'aial_live_invalid_key_12345678',
      },
    });

    const auth = await authenticateV1Request(req);
    expect(auth).toBeNull();
  });
});
