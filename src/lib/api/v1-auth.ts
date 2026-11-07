import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { getAuthenticatedUser } from '../auth';
import { AuthUser, DataScope } from '../types';
import { can } from '../access';

export interface V1AuthContext {
  user: AuthUser;
  authMethod: 'API_KEY' | 'BEARER_JWT';
  apiKeyName?: string;
}

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: 'v1',
      },
    },
    { status }
  );
}

export function errorResponse(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: any) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: 'v1',
      },
    },
    { status: statusCode }
  );
}

export async function authenticateV1Request(req: NextRequest): Promise<V1AuthContext | null> {
  // 1. Check X-API-Key header
  const apiKeyHeader = req.headers.get('x-api-key');
  if (apiKeyHeader) {
    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
      },
      include: {
        tenant: true,
        createdByUser: true,
      },
    });

    if (!apiKey) return null;

    // Check expiration
    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      return null;
    }

    // Update lastUsedAt asynchronously
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    let allowedPerms: any[] = [];
    try {
      const parsed = JSON.parse(apiKey.permissions || '[]');
      allowedPerms = parsed.map((key: string) => ({
        permissionKey: key,
        dataScope: 'ENTIRE_TENANT' as DataScope,
        isSensitive: true,
      }));
    } catch {
      allowedPerms = [{ permissionKey: '*', dataScope: 'ENTIRE_TENANT' as DataScope, isSensitive: true }];
    }

    const authUser: AuthUser = {
      userId: apiKey.createdByUserId,
      tenantId: apiKey.tenantId,
      email: apiKey.createdByUser.email,
      roles: ['COMPANY_ADMIN'],
      permissions: allowedPerms,
    };

    return {
      user: authUser,
      authMethod: 'API_KEY',
      apiKeyName: apiKey.name,
    };
  }

  // 2. Check Bearer JWT Token
  const jwtUser = await getAuthenticatedUser(req);
  if (jwtUser) {
    return {
      user: jwtUser,
      authMethod: 'BEARER_JWT',
    };
  }

  return null;
}

/**
 * The /api/v1 data endpoints are the machine-integration API. They are open to API-key callers
 * (an API key acts as the company owner, see above) and to signed-in users holding
 * `integrations:manage` (company owner). Regular users must use the role-checked /api routes,
 * otherwise a plain employee's session token could read or write company-wide data here.
 * Returns a 403 response to send back, or null when access is allowed.
 */
export function requireIntegrationAccess(auth: V1AuthContext): NextResponse | null {
  if (auth.authMethod === 'API_KEY') return null;
  if (can(auth.user, 'integrations:manage')) return null;
  return errorResponse(
    'Forbidden: the v1 integration API requires an API key or company-owner access. Use the regular app APIs instead.',
    403,
    'FORBIDDEN'
  );
}
