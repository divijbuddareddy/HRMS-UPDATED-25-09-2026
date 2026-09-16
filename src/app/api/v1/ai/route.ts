import { NextRequest } from 'next/server';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { processAiCopilotQuery, executeAiConfirmedMutation } from '@/lib/ai/gateway';

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const { query, confirmationToken } = body;

    // Handle human confirmation of AI mutation
    if (confirmationToken) {
      const result = await executeAiConfirmedMutation(confirmationToken, auth.user);
      return jsonResponse(result);
    }

    if (!query) {
      return errorResponse('Missing query parameter', 400, 'VALIDATION_ERROR');
    }

    const response = await processAiCopilotQuery({
      tenantId: auth.user.tenantId,
      query,
      actor: auth.user,
    });

    return jsonResponse(response);
  } catch (e: any) {
    return errorResponse(e.message, 500, 'AI_GATEWAY_ERROR');
  }
}
