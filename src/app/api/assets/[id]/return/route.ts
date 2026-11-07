import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { returnAssetFromEmployee } from '@/lib/assets/engine';
import { can, forbidden } from '@/lib/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // assignment ID
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'assets:manage')) {
      return forbidden('Only HR or the company owner can record asset returns.');
    }

    const assignment = await prisma.assetAssignment.findFirst({
      where: { id, asset: { tenantId: user.tenantId } },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Asset assignment not found' }, { status: 404 });
    }

    const body = await req.json();
    const { condition, notes } = body;

    const result = await returnAssetFromEmployee({
      tenantId: user.tenantId,
      assignmentId: id,
      condition,
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
