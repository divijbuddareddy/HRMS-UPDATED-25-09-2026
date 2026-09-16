import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { isAdmin } from '@/lib/rbac';
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

    if (!isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Administrator permission required to view AI configuration' } },
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

    if (!isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Administrator permission required to configure AI provider' } },
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

    if (!isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Administrator permission required to delete AI configuration' } },
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
