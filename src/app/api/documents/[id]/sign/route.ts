import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { signEmployeeDocument } from '@/lib/documents/engine';
import { adoptSignature, getAdoptedSignature, validateSignatureImage } from '@/lib/documents/signature';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { useAdopted, adopt, method } = body;

    const doc = await prisma.employeeDocument.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.status === 'SIGNED') {
      return NextResponse.json({ error: 'Document is already signed' }, { status: 400 });
    }

    // Strict Authorization: Only the assigned recipient employee can sign this offer letter
    // (A login without an employee profile, e.g. the company owner, cannot sign on anyone's behalf.)
    if (!user.employeeId || user.employeeId !== doc.employeeId) {
      return NextResponse.json(
        { error: 'Forbidden: Only the recipient employee can sign this offer letter' },
        { status: 403 }
      );
    }

    // Signature: the employee's adopted one ("Sign with adopted signature"), or a new one
    // drawn / typed / uploaded now — optionally adopted for next time ("Adopt and Sign").
    let signatureDataUrl: string;
    if (useAdopted) {
      const adopted = await getAdoptedSignature(user.employeeId);
      if (!adopted) {
        return NextResponse.json({ error: 'You have not adopted a signature yet. Please draw, type or upload one.' }, { status: 400 });
      }
      signatureDataUrl = adopted.signatureDataUrl;
    } else {
      const invalid = validateSignatureImage(body.signatureDataUrl);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
      signatureDataUrl = body.signatureDataUrl;
      if (adopt) await adoptSignature(user.tenantId, user.employeeId, signatureDataUrl, String(method || 'DRAW'));
    }

    const signerId = doc.employeeId;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const signedDoc = await signEmployeeDocument({
      tenantId: user.tenantId,
      documentId: id,
      signerEmployeeId: signerId,
      signatureDataUrl,
      ipAddress: clientIp,
      actor: user,
    });

    return NextResponse.json({ success: true, document: signedDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
