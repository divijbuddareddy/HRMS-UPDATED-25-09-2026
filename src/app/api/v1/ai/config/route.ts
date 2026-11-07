import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { can } from '@/lib/access';
import {
  getTenantAiConfig,
  saveTenantAiConfig,
  deleteTenantAiConfig,
} from '@/lib/ai/config';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!can(user, 'integrations:manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Company owner permission required to view AI configuration' } },
        { status: 403 }
      );
    }

    const config = await getTenantAiConfig(user.tenantId);
    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch AI configuration' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!can(user, 'integrations:manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Company owner permission required to configure AI provider' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { provider, apiKey, model } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Provider and API Key are required' } },
        { status: 400 }
      );
    }

    const result = await saveTenantAiConfig({
      tenantId: user.tenantId,
      provider,
      apiKey,
      model,
      actor: user,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: error.message || 'Failed to save AI configuration' } },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!can(user, 'integrations:manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Company owner permission required to delete AI configuration' } },
        { status: 403 }
      );
    }

    const result = await deleteTenantAiConfig(user.tenantId, user);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete AI configuration' } },
      { status: 500 }
    );
  }
}
