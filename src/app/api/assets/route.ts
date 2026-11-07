import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAsset } from '@/lib/assets/engine';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Asset managers (HR / owner) see the whole inventory; everyone else only the assets
    // currently assigned to them, with only their own assignment rows.
    const isAssetManager = can(user, 'assets:manage');
    const selfId = user.employeeId || '__none__';

    const assets = await prisma.asset.findMany({
      where: isAssetManager
        ? { tenantId: user.tenantId }
        : { tenantId: user.tenantId, assignments: { some: { employeeId: selfId, returnedDate: null } } },
      include: {
        branchLocation: true,
        assignments: {
          where: isAssetManager ? {} : { employeeId: selfId },
          include: { employee: true },
          orderBy: { assignedDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only HR / owner can add asset inventory
    if (!can(user, 'assets:manage')) {
      return forbidden('Only HR or the company owner can add assets to the inventory.');
    }

    const body = await req.json();
    const asset = await createAsset({
      tenantId: user.tenantId,
      assetName: body.assetName,
      assetTag: body.assetTag,
      serialNumber: body.serialNumber,
      category: body.category || 'LAPTOP',
      purchaseCost: body.purchaseCost ? parseFloat(body.purchaseCost) : undefined,
      branchLocationId: body.branchLocationId,
      actor: user,
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
