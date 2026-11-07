import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assignAssetToEmployee } from '@/lib/assets/engine';
import { can, canActOnEmployee, forbidden } from '@/lib/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'assets:manage')) {
      return forbidden('Only HR or the company owner can assign assets.');
    }

    const body = await req.json();
    const { employeeId, condition, notes } = body;

    const asset = await prisma.asset.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (!(await canActOnEmployee(user, employeeId, 'assets:manage', { allowSelf: true }))) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const assignment = await assignAssetToEmployee({
      tenantId: user.tenantId,
      assetId: id,
      employeeId,
      condition,
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
