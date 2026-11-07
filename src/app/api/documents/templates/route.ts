import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const templates = await prisma.documentTemplate.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'documents:manage')) {
      return forbidden('Only HR or the company owner can create document templates.');
    }

    const body = await req.json();
    const template = await prisma.documentTemplate.create({
      data: {
        tenantId: user.tenantId,
        title: body.title,
        code: body.code,
        contentHtml: body.contentHtml,
        version: 1,
      },
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
