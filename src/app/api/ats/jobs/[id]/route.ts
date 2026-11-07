import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isRecruiter = can(user, 'recruitment:manage');
    const job = await prisma.jobRequisition.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        branchLocation: true,
        candidates: isRecruiter,
      },
    });

    // Non-recruiters may only see published openings, without candidates.
    if (!job || job.tenantId !== user.tenantId || (!isRecruiter && job.status !== 'PUBLISHED')) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only recruiters (HR) / owner can edit job openings
    if (!can(user, 'recruitment:manage')) {
      return forbidden('Only HR or the company owner can edit job openings.');
    }

    const existing = await prisma.jobRequisition.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Job opening not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await prisma.jobRequisition.update({
      where: { id },
      data: {
        title: body.title ?? existing.title,
        status: body.status ?? existing.status,
        headcount: body.headcount ? parseInt(body.headcount) : existing.headcount,
        experienceYears: body.experienceYears ? parseInt(body.experienceYears) : existing.experienceYears,
        minCtc: body.minCtc ? parseFloat(body.minCtc) : existing.minCtc,
        maxCtc: body.maxCtc ? parseFloat(body.maxCtc) : existing.maxCtc,
        description: body.description ?? existing.description,
        requirements: body.requirements ?? existing.requirements,
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_JOB_REQUISITION',
      entityType: 'ATS',
      entityId: id,
      beforeState: existing,
      afterState: updated,
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only recruiters (HR) / owner can delete job openings
    if (!can(user, 'recruitment:manage')) {
      return forbidden('Only HR or the company owner can delete job openings.');
    }

    const existing = await prisma.jobRequisition.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Job opening not found' }, { status: 404 });
    }

    await prisma.jobRequisition.delete({ where: { id } });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_JOB_REQUISITION',
      entityType: 'ATS',
      entityId: id,
      beforeState: existing,
    });

    return NextResponse.json({
      success: true,
      message: `Job Opening ${existing.code} (${existing.title}) deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
