import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, canActOnEmployee, canViewEmployee, forbidden, visibleEmployeeIds } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { MAX_UPLOAD_BYTES, cleanFileName, saveUpload, sniffPerformanceFile } from '@/lib/uploads';
import { assignableEmployees } from '@/lib/performance/team';

const select = {
  id: true,
  employeeId: true,
  title: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedById: true,
  createdAt: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
} as const;

/**
 * GET                 -> own performance documents
 * GET ?scope=team     -> documents of everyone the user may review, plus the employee picker list
 * GET ?employeeId=... -> one employee's documents
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    if (sp.get('scope') === 'team') {
      if (!can(user, 'performance:review')) return forbidden('Only managers, HR or the owner can see team documents.');
      const ids = await visibleEmployeeIds(user, 'performance:review');
      const [documents, employees] = await Promise.all([
        prisma.employeeUpload.findMany({
          where: {
            tenantId: user.tenantId,
            docType: 'PERFORMANCE',
            ...(ids === null ? {} : { employeeId: { in: ids } }),
            ...(user.employeeId ? { NOT: { employeeId: user.employeeId } } : {}),
          },
          select,
          orderBy: { createdAt: 'desc' },
        }),
        assignableEmployees(user),
      ]);
      return NextResponse.json({ documents, employees });
    }

    const employeeId = sp.get('employeeId') || user.employeeId;
    if (!employeeId) return NextResponse.json({ documents: [] });
    if (!(await canViewEmployee(user, employeeId, 'performance:review'))) {
      return forbidden('You can only view your own documents or your team’s.');
    }
    const documents = await prisma.employeeUpload.findMany({
      where: { tenantId: user.tenantId, employeeId, docType: 'PERFORMANCE' },
      select,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Share a document with an employee (multipart: file, employeeId, title). Manager (reports) / HR / owner. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Send the file as multipart form data.' }, { status: 400 });
    const file = form.get('file');
    const employeeId = String(form.get('employeeId') || '');
    const title = String(form.get('title') || '').trim().slice(0, 150);

    if (!employeeId) return NextResponse.json({ error: 'Choose an employee.' }, { status: 400 });
    if (!(await canActOnEmployee(user, employeeId, 'performance:review'))) {
      return forbidden('You can only share documents with your direct reports (HR / owner: anyone).');
    }
    if (!title) return NextResponse.json({ error: 'Give the document a title.' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'The file is empty.' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 5 MB.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffPerformanceFile(buf, file.name);
    if (!kind) {
      return NextResponse.json({ error: 'Allowed files: PDF, JPG, PNG, Excel (.xlsx), Word (.docx), PowerPoint (.pptx).' }, { status: 400 });
    }

    const { storageKey, checksum } = await saveUpload(user.tenantId, employeeId, buf, kind.ext);
    const created = await prisma.employeeUpload.create({
      data: {
        tenantId: user.tenantId,
        employeeId,
        docType: 'PERFORMANCE',
        title,
        fileName: cleanFileName(file.name, kind.ext),
        mimeType: kind.mime,
        sizeBytes: buf.length,
        storageKey,
        checksum,
        status: 'SHARED',
        uploadedById: user.userId,
      },
      select,
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'SHARE_PERFORMANCE_DOCUMENT',
      entityType: 'EMPLOYEE_UPLOAD',
      entityId: created.id,
      afterState: { employeeId, title, fileName: created.fileName },
    });

    return NextResponse.json({ success: true, document: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
