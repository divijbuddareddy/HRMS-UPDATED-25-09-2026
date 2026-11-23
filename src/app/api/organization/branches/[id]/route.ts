import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { isValidCoordinate } from '@/lib/geo';

/**
 * Update an office / branch location used to check clock-in locations:
 * { name?, city?, latitude?, longitude?, geofenceRadiusMeters? }. latitude + longitude null clears them.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'org:manage')) return forbidden('Only HR Admin or the company owner can change office locations.');

    const branch = await prisma.branchLocation.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!branch) return NextResponse.json({ error: 'Office not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Office name cannot be empty.' }, { status: 400 });
      data.name = name.slice(0, 100);
    }
    if (body.city !== undefined) data.city = String(body.city).trim().slice(0, 100) || branch.city;

    if (body.latitude !== undefined || body.longitude !== undefined) {
      const clear = (body.latitude === null || body.latitude === '') && (body.longitude === null || body.longitude === '');
      if (clear) {
        data.latitude = null;
        data.longitude = null;
      } else if (!isValidCoordinate(body.latitude, body.longitude)) {
        return NextResponse.json(
          { error: 'Enter a valid latitude (-90 to 90) and longitude (-180 to 180), e.g. 12.97160, 77.59460.' },
          { status: 400 },
        );
      } else {
        data.latitude = parseFloat(body.latitude);
        data.longitude = parseFloat(body.longitude);
      }
    }

    if (body.geofenceRadiusMeters !== undefined) {
      const r = parseInt(body.geofenceRadiusMeters);
      if (!Number.isFinite(r) || r < 25 || r > 50000) {
        return NextResponse.json({ error: 'Office radius must be between 25 m and 50,000 m.' }, { status: 400 });
      }
      data.geofenceRadiusMeters = r;
    }

    const updated = await prisma.branchLocation.update({ where: { id }, data });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_BRANCH',
      entityType: 'BRANCH',
      entityId: id,
      beforeState: branch,
      afterState: updated,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
