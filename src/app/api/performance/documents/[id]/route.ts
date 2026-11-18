import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canActOnEmployee, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { deleteUpload } from '@/lib/uploads';

/** Remove a shared performance document: the employee's manager / HR / owner. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const doc = await prisma.employeeUpload.findFirst({ where: { id, tenantId: user.tenantId, docType: 'PERFORMANCE' } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (!(await canActOnEmployee(user, doc.employeeId, 'performance:review'))) {
      return forbidden('Only the employee’s manager or HR can remove this document.');
    }

    await prisma.employeeUpload.delete({ where: { id: doc.id } });
    await deleteUpload(doc.storageKey);
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_PERFORMANCE_DOCUMENT',
      entityType: 'EMPLOYEE_UPLOAD',
      entityId: doc.id,
      beforeState: { employeeId: doc.employeeId, title: doc.title, fileName: doc.fileName },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
