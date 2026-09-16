import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId') || undefined;

  if (employeeId) {
    const payslips = await prisma.payslip.findMany({
      where: {
        tenantId: auth.user.tenantId,
        employeeId,
      },
      include: { payrollItem: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return jsonResponse({ payslips });
  }

  const runs = await prisma.payrollRun.findMany({
    where: { tenantId: auth.user.tenantId },
    include: { cycle: true },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ payrollRuns: runs });
}
