import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAsset } from '@/lib/assets/engine';
import { can, forbidden } from '@/lib/access';
import { assetTagAllocator, normaliseCategory, parseAssetDate } from '@/lib/assets/tags';

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
          include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
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

    const body = await req.json().catch(() => ({}));
    const assetName = String(body.assetName ?? '').trim();
    if (!assetName) return NextResponse.json({ error: 'Asset name is required.' }, { status: 400 });
    const category = normaliseCategory(String(body.category ?? ''));
    if (!category) return NextResponse.json({ error: 'Choose a valid category.' }, { status: 400 });
    const purchaseDate = parseAssetDate(String(body.purchaseDate ?? ''));
    const warrantyExpiry = parseAssetDate(String(body.warrantyExpiry ?? ''));
    if (purchaseDate === undefined || warrantyExpiry === undefined) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    }
    const cost = body.purchaseCost !== undefined && body.purchaseCost !== '' ? parseFloat(body.purchaseCost) : undefined;
    if (cost !== undefined && (!isFinite(cost) || cost < 0)) {
      return NextResponse.json({ error: 'Invalid purchase cost.' }, { status: 400 });
    }
    const serial = String(body.serialNumber ?? '').trim();
    if (serial) {
      const same = await prisma.asset.findFirst({ where: { tenantId: user.tenantId, serialNumber: serial }, select: { assetTag: true } });
      if (same) return NextResponse.json({ error: `Serial number ${serial} is already recorded as ${same.assetTag}.` }, { status: 409 });
    }
    let assetTag = String(body.assetTag ?? '').trim().toUpperCase();
    if (assetTag) {
      const dup = await prisma.asset.findFirst({ where: { tenantId: user.tenantId, assetTag }, select: { id: true } });
      if (dup) return NextResponse.json({ error: `Asset tag ${assetTag} already exists.` }, { status: 409 });
    } else {
      assetTag = (await assetTagAllocator(user.tenantId))();
    }

    const asset = await createAsset({
      tenantId: user.tenantId,
      assetName: assetName.slice(0, 200),
      assetTag,
      serialNumber: String(body.serialNumber ?? '').trim().slice(0, 100) || undefined,
      category: category as any,
      purchaseDate: purchaseDate || undefined,
      warrantyExpiry: warrantyExpiry || undefined,
      purchaseCost: cost,
      branchLocationId: body.branchLocationId || undefined,
      actor: user,
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
