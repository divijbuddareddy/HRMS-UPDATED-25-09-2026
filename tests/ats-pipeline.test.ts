import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { calculateCandidateMatchScore } from '../src/lib/ats/engine';

const prisma = new PrismaClient();

describe('ATS Recruitment Pipeline Engine', () => {
  let tenantId: string;
  let jobReqId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const job = await prisma.jobRequisition.findFirst({ where: { tenantId, code: 'JOB-ENG-001' } });
    jobReqId = job!.id;
  });

  it('should calculate accurate AI match score based on candidate skills vs job requirements', () => {
    const candidateSkills = ['TypeScript', 'Node.js', 'PyTorch', 'Distributed Systems', 'PostgreSQL'];
    const jobRequirements = 'TypeScript, Node.js, PyTorch, Distributed Systems, PostgreSQL, Docker';

    const matchScore = calculateCandidateMatchScore(candidateSkills, jobRequirements);
    expect(matchScore).toBeGreaterThanOrEqual(80);
    expect(matchScore).toBeLessThanOrEqual(100);
  });

  it('should query candidate pipeline in stage progression', async () => {
    const candidates = await prisma.candidate.findMany({
      where: { tenantId, jobRequisitionId: jobReqId },
      include: { jobRequisition: true },
    });

    expect(candidates.length).toBeGreaterThan(0);
    const candidate = candidates.find((c) => c.firstName === 'Kavita');
    expect(candidate).toBeDefined();
    expect(candidate?.firstName).toBe('Kavita');
    expect(candidate?.aiMatchScore).toBe(94);
  });

  it('should enforce unique candidate email constraint per job requisition within tenant', async () => {
    await expect(
      prisma.candidate.create({
        data: {
          tenantId,
          jobRequisitionId: jobReqId,
          firstName: 'Duplicate',
          lastName: 'Candidate',
          email: 'kavita.k@example.com',
          stage: 'APPLIED',
        },
      })
    ).rejects.toThrow();
  });

  it('should create candidate and dispatch automated confirmation email when applying', async () => {
    const randomSuffix = Date.now().toString(36);
    const testEmail = `applicant.${randomSuffix}@example.com`;

    const { applyCandidate } = await import('../src/lib/ats/engine');
    const newCandidate = await applyCandidate({
      tenantId,
      jobRequisitionId: jobReqId,
      firstName: 'Rohan',
      lastName: 'Verma',
      email: testEmail,
      phone: '+91 9988776655',
      skills: ['TypeScript', 'React', 'Node.js'],
      resumeText: 'Full Stack Engineer with 4 years experience in Next.js and Prisma.',
    });

    expect(newCandidate.id).toBeDefined();
    expect(newCandidate.stage).toBe('APPLIED');
    expect(newCandidate.email).toBe(testEmail);

    // Verify audit log for email dispatch was recorded
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        entityId: newCandidate.id,
        action: 'CANDIDATE_APPLICATION_EMAIL_SENT',
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorRole).toBe('SYSTEM');
  });

  it('should sign candidate offer letter and automatically add them to the Employees tab', async () => {
    const randomSuffix = Date.now().toString(36);
    const testEmail = `offer.candidate.${randomSuffix}@example.com`;

    const { applyCandidate, convertCandidateToEmployee } = await import('../src/lib/ats/engine');
    const candidate = await applyCandidate({
      tenantId,
      jobRequisitionId: jobReqId,
      firstName: 'Vikram',
      lastName: 'Mehra',
      email: testEmail,
      phone: '+91 9123456780',
      skills: ['React', 'Node.js', 'PostgreSQL'],
    });

    // Create candidate offer
    await prisma.candidateOffer.create({
      data: {
        candidateId: candidate.id,
        offeredCtc: 2400000,
        joiningDate: new Date(),
        designation: 'Senior Software Engineer',
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // Convert upon offer acceptance/signing
    const employee = await convertCandidateToEmployee({
      tenantId,
      candidateId: candidate.id,
      actor: {
        userId: 'system-user',
        email: 'admin@ai-automation-labs.com',
        tenantId,
        roles: ['HR_ADMIN'],
        permissions: [
          { permissionKey: 'employee:manage', dataScope: 'ENTIRE_TENANT', isSensitive: false },
          { permissionKey: 'ats:manage', dataScope: 'ENTIRE_TENANT', isSensitive: false },
        ],
      },
    });

    expect(employee.id).toBeDefined();
    expect(employee.status).toBe('ACTIVE');
    expect(employee.firstName).toBe('Vikram');

    // Verify employee is in the active employees query (Employees Tab)
    const activeInDir = await prisma.employee.findFirst({
      where: { id: employee.id, status: 'ACTIVE' },
    });
    expect(activeInDir).toBeDefined();
    expect(activeInDir?.employeeCode).toBe(employee.employeeCode);
  });
});
