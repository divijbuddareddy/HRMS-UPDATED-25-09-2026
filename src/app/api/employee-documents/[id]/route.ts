import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, canActOnEmployee, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { canAccessEmployeeDocs, canReviewDocuments, readUpload } from '@/lib/uploads';

/** View / download the file (?download=1 forces a download). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const doc = await prisma.employeeUpload.findFirst({ where: { id, tenantId: user.tenantId } });
    // Employee + HR can open everything; a manager can also open performance documents of their reports.
    const allowed =
      !!doc &&
      (canAccessEmployeeDocs(user, doc.employeeId) ||
        (doc.docType === 'PERFORMANCE' && (await canActOnEmployee(user, doc.employeeId, 'performance:review'))) ||
        (doc.docType === 'RECEIPT' &&
          (can(user, 'expense:final-approve') || (await canActOnEmployee(user, doc.employeeId, 'expense:approve')))));
    if (!doc || !allowed) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const data = await readUpload(doc.storageKey).catch(() => null);
    if (!data) return NextResponse.json({ error: 'File is missing on the server.' }, { status: 410 });

    const disposition = req.nextUrl.searchParams.get('download') ? 'attachment' : 'inline';
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(data.length),
        'Content-Disposition': `${disposition}; filename="${doc.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** HR / owner: verify or reject a document. Body: { action: 'VERIFY' | 'REJECT', note? } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canReviewDocuments(user)) return forbidden('Only HR or the company owner can review documents.');

    const { action, note } = await req.json().catch(() => ({}));
    if (action !== 'VERIFY' && action !== 'REJECT') {
      return NextResponse.json({ error: 'action must be VERIFY or REJECT' }, { status: 400 });
    }
    const reviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    if (action === 'REJECT' && !reviewNote) {
      return NextResponse.json({ error: 'Please give a reason so the employee knows what to fix.' }, { status: 400 });
    }

    const doc = await prisma.employeeUpload.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (doc.docType === 'PERFORMANCE' || doc.docType === 'RECEIPT') {
      return NextResponse.json({ error: 'Only onboarding documents are verified here.' }, { status: 400 });
    }
    if (user.employeeId && doc.employeeId === user.employeeId) {
      return forbidden('You cannot verify your own documents.');
    }

    const updated = await prisma.employeeUpload.update({
      where: { id: doc.id },
      data: {
        status: action === 'VERIFY' ? 'VERIFIED' : 'REJECTED',
        reviewNote: reviewNote || null,
        reviewedById: user.userId,
        reviewedAt: new Date(),
      },
      select: { id: true, status: true, reviewNote: true, reviewedAt: true },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: action === 'VERIFY' ? 'VERIFY_EMPLOYEE_DOCUMENT' : 'REJECT_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_UPLOAD',
      entityId: doc.id,
      beforeState: { status: doc.status },
      afterState: { status: updated.status, note: reviewNote },
    });

    return NextResponse.json({ success: true, upload: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
