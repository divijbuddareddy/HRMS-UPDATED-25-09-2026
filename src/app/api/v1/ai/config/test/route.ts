import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { isAdmin } from '@/lib/rbac';
import { testAiProviderConnection, resolveTenantAiCredentials } from '@/lib/ai/config';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Administrator permission required to test AI provider connection' } },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed when testing existing saved config
    }

    let provider = body.provider;
    let apiKey = body.apiKey;
    let model = body.model;

    // If no API key provided in body, test existing configured tenant key
    if (!apiKey) {
      const existing = await resolveTenantAiCredentials(user.tenantId);
      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_CONFIGURED', message: 'No AI configuration found to test. Please provide an API key.' },
          },
          { status: 400 }
        );
      }
      provider = existing.provider;
      apiKey = existing.apiKey;
      model = existing.model;
    }

    const testResult = await testAiProviderConnection(provider, apiKey, model);

    // Audit the test event without exposing key
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0] || 'COMPANY_ADMIN',
      action: 'AI_PROVIDER_CONNECTION_TESTED',
      entityType: 'AI_CONFIG',
      afterState: {
        provider,
        model,
        result: testResult.status,
      },
    });

    return NextResponse.json({
      success: testResult.success,
      data: {
        message: testResult.message,
        status: testResult.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'TEST_FAILED', message: error.message || 'Failed to test connection' },
      },
      { status: 500 }
    );
  }
}
