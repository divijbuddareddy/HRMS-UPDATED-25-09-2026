import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExitRequest } from '@/lib/exit/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const exits = await prisma.exitRequest.findMany({
      where: { tenantId: user.tenantId },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
          },
        },
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ exits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const targetEmployeeId = body.employeeId || user.employeeId;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Employee ID is required to submit exit/resignation' }, { status: 400 });
    }

    const exitReq = await submitExitRequest({
      tenantId: user.tenantId,
      employeeId: targetEmployeeId,
      requestedLwd: body.requestedLwd ? new Date(body.requestedLwd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      reason: body.reason || 'Resignation submitted',
      reasonCategory: body.reasonCategory || 'BETTER_OPPORTUNITY',
    });

    return NextResponse.json({ success: true, exitRequest: exitReq }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
