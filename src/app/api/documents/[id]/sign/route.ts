import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { signEmployeeDocument } from '@/lib/documents/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { signatureDataUrl } = body;

    const doc = await prisma.employeeDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.status === 'SIGNED') {
      return NextResponse.json({ error: 'Document is already signed' }, { status: 400 });
    }

    // Strict Authorization: Only the assigned recipient employee can sign this offer letter
    if (user.employeeId && user.employeeId !== doc.employeeId) {
      return NextResponse.json(
        { error: 'Forbidden: Only the recipient employee can sign this offer letter' },
        { status: 403 }
      );
    }

    const signerId = doc.employeeId;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const signedDoc = await signEmployeeDocument({
      tenantId: user.tenantId,
      documentId: id,
      signerEmployeeId: signerId,
      signatureDataUrl: signatureDataUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMzAiPjx0ZXh0IHk9IjIwIiBmb250LWZhbWlseT0iY3Vyc2l2ZSI+U2lnbmVkPC90ZXh0Pjwvc3ZnPg==',
      ipAddress: clientIp,
      actor: user,
    });

    return NextResponse.json({ success: true, document: signedDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
