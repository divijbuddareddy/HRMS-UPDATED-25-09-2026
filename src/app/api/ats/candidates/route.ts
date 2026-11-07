import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyCandidate } from '@/lib/ats/engine';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'recruitment:manage')) {
      return forbidden('Only HR or the company owner can view candidates.');
    }

    const searchParams = req.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    const candidates = await prisma.candidate.findMany({
      where: {
        tenantId: user.tenantId,
        ...(jobId ? { jobRequisitionId: jobId } : {}),
      },
      include: {
        jobRequisition: true,
        interviews: true,
        offer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ candidates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'recruitment:manage')) {
      return forbidden('Only HR or the company owner can add candidates.');
    }

    const body = await req.json();
    if (!body.jobRequisitionId) {
      return NextResponse.json({ error: 'jobRequisitionId is required' }, { status: 400 });
    }
    const job = await prisma.jobRequisition.findFirst({
      where: { id: body.jobRequisitionId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 404 });
    }

    let resumeText = body.resumeText || '';
    if (body.resumeFileName) {
      resumeText = `[Attached File: ${body.resumeFileName}]\n${resumeText}`;
    }

    const candidate = await applyCandidate({
      tenantId: user.tenantId,
      jobRequisitionId: body.jobRequisitionId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      currentCompany: body.currentCompany,
      currentCtc: body.currentCtc ? parseFloat(body.currentCtc) : undefined,
      expectedCtc: body.expectedCtc ? parseFloat(body.expectedCtc) : undefined,
      noticePeriodDays: body.noticePeriodDays ? parseInt(body.noticePeriodDays) : 30,
      resumeText,
      resumeFileName: body.resumeFileName,
      resumeDataUrl: body.resumeDataUrl,
      skills: body.skills,
    });

    return NextResponse.json({ success: true, candidate }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
