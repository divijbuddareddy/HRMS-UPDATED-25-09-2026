import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { adoptSignature, getAdoptedSignature, validateSignatureImage } from '@/lib/documents/signature';

/** The logged-in employee's adopted signature (only ever their own). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ signature: null });
    const sig = await getAdoptedSignature(user.employeeId);
    return NextResponse.json({
      signature: sig ? { signatureDataUrl: sig.signatureDataUrl, method: sig.method, updatedAt: sig.updatedAt } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Adopt (or replace) your signature. Body: { signatureDataUrl, method } */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const invalid = validateSignatureImage(body.signatureDataUrl);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const sig = await adoptSignature(user.tenantId, user.employeeId, body.signatureDataUrl, String(body.method || 'DRAW'));
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'ADOPT_SIGNATURE',
      entityType: 'ADOPTED_SIGNATURE',
      entityId: sig.id,
      afterState: { method: sig.method },
    });
    return NextResponse.json({ success: true, signature: { signatureDataUrl: sig.signatureDataUrl, method: sig.method, updatedAt: sig.updatedAt } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Remove your adopted signature (documents already signed keep their signature). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ success: true });
    await prisma.adoptedSignature.deleteMany({ where: { employeeId: user.employeeId } });
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'REMOVE_ADOPTED_SIGNATURE',
      entityType: 'ADOPTED_SIGNATURE',
      entityId: user.employeeId,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
