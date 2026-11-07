import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'audit:view')) {
      return forbidden('Only HR Admin or the company owner can view the audit trail.');
    }

    const searchParams = req.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
