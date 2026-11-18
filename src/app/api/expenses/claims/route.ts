import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExpenseClaim } from '@/lib/expenses/engine';
import { employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';
import { MAX_UPLOAD_BYTES, cleanFileName, deleteUpload, saveUpload, sniffFileType } from '@/lib/uploads';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      where.employeeId = user.employeeId || '__none__';
    } else {
      // Self for employees, self + direct reports for managers, everyone for FINANCE / owner.
      Object.assign(where, employeeIdFilter(await visibleEmployeeIds(user, 'expense:approve')));
    }

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    // JSON, or multipart form data when a receipt file is attached
    let body: any;
    let receiptFile: File | null = null;
    if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await req.formData();
      body = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
      const f = form.get('receipt');
      if (f && typeof f !== 'string' && f.size > 0) receiptFile = f;
    } else {
      body = await req.json();
    }
    // Claims can only be submitted for yourself.
    if (body.employeeId && body.employeeId !== user.employeeId) {
      return forbidden('You can only submit expense claims for yourself.');
    }
    if (!body.expenseCategoryId) {
      return NextResponse.json({ error: 'expenseCategoryId is required' }, { status: 400 });
    }
    const category = await prisma.expenseCategory.findFirst({
      where: { id: body.expenseCategoryId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: 'Expense category not found' }, { status: 400 });
    }

    const amount = parseFloat(body.amount);
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
    }
    const claimDate = new Date(body.claimDate);
    if (!body.claimDate || isNaN(claimDate.getTime())) {
      return NextResponse.json({ error: 'Enter a valid expense date.' }, { status: 400 });
    }
    if (claimDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Expense date cannot be in the future.' }, { status: 400 });
    }
    if (!String(body.description ?? '').trim()) {
      return NextResponse.json({ error: 'Describe what the expense was for.' }, { status: 400 });
    }

    // Receipt file: PDF / JPG / PNG up to 5 MB, stored privately like other employee files
    let receiptUpload: { id: string; storageKey: string } | null = null;
    if (receiptFile) {
      if (receiptFile.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'Receipt is too large. Maximum size is 5 MB.' }, { status: 400 });
      }
      const buf = Buffer.from(await receiptFile.arrayBuffer());
      const kind = sniffFileType(buf);
      if (!kind) return NextResponse.json({ error: 'Receipt must be a PDF, JPG or PNG file.' }, { status: 400 });
      const { storageKey, checksum } = await saveUpload(user.tenantId, user.employeeId, buf, kind.ext);
      const up = await prisma.employeeUpload.create({
        data: {
          tenantId: user.tenantId,
          employeeId: user.employeeId,
          docType: 'RECEIPT',
          title: 'Expense receipt',
          fileName: cleanFileName(receiptFile.name, kind.ext),
          mimeType: kind.mime,
          sizeBytes: buf.length,
          storageKey,
          checksum,
          status: 'ATTACHED',
          uploadedById: user.userId,
        },
        select: { id: true, storageKey: true },
      });
      receiptUpload = up;
    }

    let claim;
    try {
      claim = await submitExpenseClaim({
        tenantId: user.tenantId,
        employeeId: user.employeeId,
        expenseCategoryId: body.expenseCategoryId,
        claimDate,
        amount,
        description: String(body.description).trim().slice(0, 1000),
        receiptUrl: receiptUpload ? `/api/employee-documents/${receiptUpload.id}` : undefined,
        costCenter: body.costCenter,
        paymentMethod: body.paymentMethod,
      });
    } catch (err) {
      // Claim refused (e.g. over the category limit): don't keep an orphaned receipt
      if (receiptUpload) {
        await prisma.employeeUpload.delete({ where: { id: receiptUpload.id } }).catch(() => undefined);
        await deleteUpload(receiptUpload.storageKey);
      }
      throw err;
    }

    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
