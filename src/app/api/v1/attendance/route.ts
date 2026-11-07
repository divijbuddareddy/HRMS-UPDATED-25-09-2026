import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { recordRawAttendancePunch } from '@/lib/attendance/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));

  const where = {
    tenantId: auth.user.tenantId,
    ...(employeeId ? { employeeId } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.dailyAttendanceRecord.count({ where }),
    prisma.dailyAttendanceRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { employee: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  return jsonResponse({
    records,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { employeeId, punchType, deviceType, latitude, longitude, ipAddress } = body;

    if (!employeeId || !punchType) {
      return errorResponse('Missing required punch fields', 400, 'VALIDATION_ERROR');
    }

    const punch = await recordRawAttendancePunch({
      tenantId: auth.user.tenantId,
      employeeId,
      punchType,
      deviceType: deviceType || 'WEB',
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      ipAddress,
    });

    return jsonResponse(punch, 201);
  } catch (e: any) {
    return errorResponse(e.message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
