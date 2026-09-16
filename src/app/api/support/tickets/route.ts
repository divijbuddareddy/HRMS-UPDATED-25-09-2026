import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.roles.includes('PLATFORM_SUPER_ADMIN') || user.roles.includes('PLATFORM_SUPPORT_ADMIN');
    const isCompanyAdmin = user.roles.includes('COMPANY_ADMIN') || user.roles.includes('HR_ADMIN');

    let tickets;
    if (isPlatformAdmin) {
      tickets = await prisma.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } else if (isCompanyAdmin) {
      tickets = await prisma.supportTicket.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      tickets = await prisma.supportTicket.findMany({
        where: { tenantId: user.tenantId, userId: user.userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ tickets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { subject, description, category, priority } = body;

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    const ticketCount = await prisma.supportTicket.count({ where: { tenantId: user.tenantId } });
    const ticketCode = `TCK-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(4, '0')}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        ticketCode,
        subject,
        description,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'SUPPORT_TICKET_CREATED',
      entityType: 'SUPPORT_TICKET',
      entityId: ticket.id,
      afterState: { ticketCode, subject, category, priority },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
