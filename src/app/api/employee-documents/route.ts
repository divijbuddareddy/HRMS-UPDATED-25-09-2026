import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import {
  DOC_TYPES,
  MAX_UPLOAD_BYTES,
  canAccessEmployeeDocs,
  canReviewDocuments,
  cleanFileName,
  deleteUpload,
  isDocType,
  saveUpload,
  sniffFileType,
} from '@/lib/uploads';

const uploadSelect = {
  id: true,
  employeeId: true,
  docType: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
} as const;

/**
 * GET ?employeeId=...  -> that employee's documents (self or HR / owner)
 * GET (no id), HR      -> every employee with their documents (review overview)
 * GET (no id), others  -> own documents
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requested = req.nextUrl.searchParams.get('employeeId');
    const reviewer = canReviewDocuments(user);

    if (!requested && reviewer) {
      const employees = await prisma.employee.findMany({
        where: { tenantId: user.tenantId, status: { notIn: ['EXITED', 'ARCHIVED'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          workEmail: true,
          joiningDate: true,
          department: { select: { name: true } },
          uploads: { where: { docType: { notIn: ['PERFORMANCE', 'RECEIPT'] } }, select: uploadSelect, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { firstName: 'asc' },
      });
      return NextResponse.json({ docTypes: DOC_TYPES, reviewer, employees });
    }

    const employeeId = requested || user.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }
    if (!canAccessEmployeeDocs(user, employeeId)) {
      return forbidden('You can only view your own documents.');
    }

    const [employee, uploads] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, tenantId: user.tenantId },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      }),
      prisma.employeeUpload.findMany({
        where: { tenantId: user.tenantId, employeeId, docType: { notIn: ['PERFORMANCE', 'RECEIPT'] } },
        select: uploadSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    return NextResponse.json({ docTypes: DOC_TYPES, reviewer, employee, uploads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Upload a document (multipart form: file, docType, optional employeeId for HR). */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Send the file as multipart form data.' }, { status: 400 });

    const file = form.get('file');
    const docType = form.get('docType');
    const employeeId = (form.get('employeeId') as string | null) || user.employeeId;

    if (!employeeId) {
      return NextResponse.json({ error: 'Your login is not linked to an employee profile.' }, { status: 400 });
    }
    if (!canAccessEmployeeDocs(user, employeeId)) {
      return forbidden('You can only upload your own documents.');
    }
    if (!isDocType(docType)) {
      return NextResponse.json({ error: 'Choose a valid document type.' }, { status: 400 });
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
    }
    if (file.size === 0) return NextResponse.json({ error: 'The file is empty.' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 5 MB.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffFileType(buf);
    if (!kind) {
      return NextResponse.json({ error: 'Only PDF, JPG or PNG files are allowed.' }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const reviewer = canReviewDocuments(user);

    // One current file per required type: a new upload replaces the previous one.
    // Once HR has verified it, only HR can replace it.
    const previous =
      docType === 'OTHER'
        ? []
        : await prisma.employeeUpload.findMany({ where: { tenantId: user.tenantId, employeeId, docType } });
    if (!reviewer && previous.some((p) => p.status === 'VERIFIED')) {
      return NextResponse.json(
        { error: 'This document is already verified by HR. Ask HR if it needs to be changed.' },
        { status: 409 },
      );
    }

    const { storageKey, checksum } = await saveUpload(user.tenantId, employeeId, buf, kind.ext);
    const created = await prisma.employeeUpload.create({
      data: {
        tenantId: user.tenantId,
        employeeId,
        docType,
        fileName: cleanFileName(file.name, kind.ext),
        mimeType: kind.mime,
        sizeBytes: buf.length,
        storageKey,
        checksum,
        status: 'SUBMITTED',
        uploadedById: user.userId,
      },
      select: uploadSelect,
    });

    if (previous.length) {
      await prisma.employeeUpload.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
      await Promise.all(previous.map((p) => deleteUpload(p.storageKey)));
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPLOAD_EMPLOYEE_DOCUMENT',
      entityType: 'EMPLOYEE_UPLOAD',
      entityId: created.id,
      afterState: { employeeId, docType, fileName: created.fileName, sizeBytes: created.sizeBytes, replaced: previous.length },
    });

    return NextResponse.json({ success: true, upload: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
