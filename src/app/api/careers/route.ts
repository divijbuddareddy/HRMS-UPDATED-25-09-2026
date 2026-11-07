import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyCandidate } from '@/lib/ats/engine';

// Public API for Careers Portal: List published jobs and allow public job application
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get('tenant') || 'ai-automation-labs';

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const jobs = await prisma.jobRequisition.findMany({
    where: {
      tenantId: tenant.id,
      status: 'PUBLISHED',
    },
    include: {
      department: true,
      designation: true,
      branchLocation: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    tenant: { name: tenant.name, slug: tenant.slug },
    jobs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobRequisitionId, firstName, lastName, email, phone, currentCompany, expectedCtc, skills, resumeText, resumeFileName, resumeDataUrl } = body;

    if (!jobRequisitionId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required application fields' }, { status: 400 });
    }

    const job = await prisma.jobRequisition.findUnique({ where: { id: jobRequisitionId } });
    // Public applications are only accepted for published openings.
    if (!job || job.status !== 'PUBLISHED') return NextResponse.json({ error: 'Job requisition not found' }, { status: 404 });

    // Format resumeText to include attached file metadata if uploaded
    let combinedResumeText = resumeText || '';
    if (resumeFileName) {
      combinedResumeText = `[Attached File: ${resumeFileName}]\n${combinedResumeText}`;
    }

    const candidate = await applyCandidate({
      tenantId: job.tenantId,
      jobRequisitionId,
      firstName,
      lastName,
      email,
      phone,
      currentCompany,
      expectedCtc: expectedCtc ? parseFloat(expectedCtc) : undefined,
      skills: Array.isArray(skills) ? skills : (skills ? String(skills).split(',').map((s) => s.trim()) : []),
      resumeText: combinedResumeText,
      resumeFileName,
      resumeDataUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully! Our talent acquisition team will review your profile.',
      candidate: {
        id: candidate.id,
        aiMatchScore: candidate.aiMatchScore,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
