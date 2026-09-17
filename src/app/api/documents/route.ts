import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEmployeeDocument } from '@/lib/documents/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    const isHR = user.roles.some((r) =>
      ['PLATFORM_SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE'].includes(r)
    );

    const where: any = {
      tenantId: user.tenantId,
    };

    if (isHR) {
      if (employeeId) where.employeeId = employeeId;
    } else {
      // Employees strictly only see their own documents
      where.employeeId = user.employeeId || 'none';
    }

    const documents = await prisma.employeeDocument.findMany({
      where,
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branchLocation: true,
            legalEntity: true,
          },
        },
        template: true,
        signature: {
          include: {
            signer: {
              include: {
                department: true,
                designation: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { employeeId, templateCode, title, contentHtml, documentPdfUrl, customData } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const document = await generateEmployeeDocument({
      tenantId: user.tenantId,
      employeeId,
      templateCode: templateCode || 'OFFER_LETTER',
      title,
      contentHtml,
      documentPdfUrl,
      customData,
      actor: user,
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

