import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

// AI Match score calculation between Job requirements & Candidate skills
export function calculateJobMatchScore(jobRequirements: string, candidateSkills?: string | null): number {
  if (!candidateSkills) return 65; // baseline
  try {
    const skillsList = typeof candidateSkills === 'string' ? JSON.parse(candidateSkills) : candidateSkills;
    if (!Array.isArray(skillsList) || skillsList.length === 0) return 65;

    const lowerReq = jobRequirements.toLowerCase();
    let matches = 0;
    for (const skill of skillsList) {
      if (lowerReq.includes(String(skill).toLowerCase())) {
        matches += 1;
      }
    }
    const score = Math.min(98, Math.max(50, Math.round((matches / skillsList.length) * 50 + 45)));
    return score;
  } catch {
    return 75;
  }
}

export function calculateCandidateMatchScore(skills: string[], requirements: string): number {
  return calculateJobMatchScore(requirements, JSON.stringify(skills));
}

// Duplicate candidate detection across email or phone
export async function checkDuplicateCandidate(params: {
  tenantId: string;
  email: string;
  phone?: string;
}): Promise<{ isDuplicate: boolean; existingCandidate?: any }> {
  const existing = await prisma.candidate.findFirst({
    where: {
      tenantId: params.tenantId,
      OR: [
        { email: params.email.toLowerCase().trim() },
        ...(params.phone ? [{ phone: params.phone.trim() }] : []),
      ],
    },
    include: { jobRequisition: true },
  });

  return {
    isDuplicate: Boolean(existing),
    existingCandidate: existing || undefined,
  };
}

// AI Interview Question Generation based on job requisition and candidate profile
export function generateInterviewQuestions(params: {
  jobTitle: string;
  requirements: string;
  skills: string[];
  experienceYears?: number;
}): string[] {
  const skillsStr = params.skills.join(', ');
  return [
    `Can you describe your end-to-end architectural experience with ${params.skills[0] || 'core technologies'} in high-scale environments?`,
    `How do you handle distributed state, data validation, and idempotency when building mission-critical services?`,
    `Given our requirements in ${params.jobTitle} (${params.requirements.substring(0, 80)}...), how would you optimize database queries and latency?`,
    `Describe a complex production incident you resolved involving ${skillsStr}, and how you prevented recurrence.`,
    `How do you balance technical debt versus fast delivery when collaborating across cross-functional product and design teams?`,
  ];
}

// AI Interview Feedback Summarization across multiple rounds
export function summarizeInterviewFeedback(interviews: Array<{ roundName: string; rating?: number | null; feedback?: string | null }>): {
  averageRating: number;
  summary: string;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'NO_HIRE';
} {
  if (!interviews || interviews.length === 0) {
    return { averageRating: 0, summary: 'No interviews conducted yet', recommendation: 'NO_HIRE' };
  }

  const validRatings = interviews.map((i) => i.rating || 3);
  const avg = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;
  const feedbackPoints = interviews
    .map((i) => `• ${i.roundName} (Rating: ${i.rating || 'N/A'}/5): ${i.feedback || 'Positive assessment'}`)
    .join('\n');

  let recommendation: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'NO_HIRE' = 'HIRE';
  if (avg >= 4.5) recommendation = 'STRONG_HIRE';
  else if (avg >= 3.5) recommendation = 'HIRE';
  else if (avg >= 2.5) recommendation = 'LEAN_HIRE';
  else recommendation = 'NO_HIRE';

  return {
    averageRating: Math.round(avg * 10) / 10,
    summary: `Candidate completed ${interviews.length} evaluation round(s):\n${feedbackPoints}`,
    recommendation,
  };
}

export async function createJobRequisition(params: {
  tenantId: string;
  title: string;
  code: string;
  departmentId: string;
  designationId: string;
  branchLocationId: string;
  legalEntityId: string;
  headcount?: number;
  experienceYears?: number;
  minCtc?: number;
  maxCtc?: number;
  description: string;
  requirements: string;
  actor: AuthUser;
}) {
  const job = await prisma.jobRequisition.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      code: params.code,
      departmentId: params.departmentId,
      designationId: params.designationId,
      branchLocationId: params.branchLocationId,
      legalEntityId: params.legalEntityId,
      headcount: params.headcount || 1,
      experienceYears: params.experienceYears || 2,
      minCtc: params.minCtc,
      maxCtc: params.maxCtc,
      description: params.description,
      requirements: params.requirements,
      status: 'PUBLISHED',
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'CREATE_JOB_REQUISITION',
    entityType: 'ATS',
    entityId: job.id,
    afterState: job,
  });

  return job;
}

export async function applyCandidate(params: {
  tenantId: string;
  jobRequisitionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentCtc?: number;
  expectedCtc?: number;
  noticePeriodDays?: number;
  resumeText?: string;
  skills?: string[]; // Array of skills
}) {
  const job = await prisma.jobRequisition.findUnique({ where: { id: params.jobRequisitionId } });
  if (!job) throw new Error('Job requisition not found');

  const skillsJson = params.skills ? JSON.stringify(params.skills) : JSON.stringify(['TypeScript', 'React', 'Node.js']);
  const aiScore = calculateJobMatchScore(job.requirements + ' ' + job.description, skillsJson);

  const candidate = await prisma.candidate.create({
    data: {
      tenantId: params.tenantId,
      jobRequisitionId: params.jobRequisitionId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email.toLowerCase().trim(),
      phone: params.phone,
      currentCompany: params.currentCompany,
      currentCtc: params.currentCtc,
      expectedCtc: params.expectedCtc,
      noticePeriodDays: params.noticePeriodDays || 30,
      resumeText: params.resumeText,
      skills: skillsJson,
      aiMatchScore: aiScore,
      stage: 'APPLIED',
    },
  });

  return candidate;
}

export async function scheduleInterview(params: {
  tenantId: string;
  candidateId: string;
  roundName: string;
  scheduledAt: Date;
  interviewerId?: string;
  actor: AuthUser;
}) {
  const interview = await prisma.interview.create({
    data: {
      candidateId: params.candidateId,
      roundName: params.roundName,
      scheduledAt: params.scheduledAt,
      interviewerId: params.interviewerId,
      status: 'SCHEDULED',
    },
  });

  await prisma.candidate.update({
    where: { id: params.candidateId },
    data: { stage: 'INTERVIEW' },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'SCHEDULE_INTERVIEW',
    entityType: 'ATS_INTERVIEW',
    entityId: interview.id,
    afterState: { candidateId: params.candidateId, roundName: params.roundName, scheduledAt: params.scheduledAt },
  });

  return interview;
}

export async function submitInterviewFeedback(params: {
  tenantId: string;
  interviewId: string;
  rating: number; // 1 to 5
  feedback: string;
  actor: AuthUser;
}) {
  const interview = await prisma.interview.update({
    where: { id: params.interviewId },
    data: {
      rating: params.rating,
      feedback: params.feedback,
      status: 'COMPLETED',
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'SUBMIT_INTERVIEW_FEEDBACK',
    entityType: 'ATS_INTERVIEW',
    entityId: interview.id,
    afterState: { rating: params.rating, feedback: params.feedback },
  });

  return interview;
}

export async function createCandidateOffer(params: {
  tenantId: string;
  candidateId: string;
  offeredCtc: number;
  joiningDate: Date;
  designation: string;
  actor: AuthUser;
}) {
  const offer = await prisma.candidateOffer.upsert({
    where: { candidateId: params.candidateId },
    update: {
      offeredCtc: params.offeredCtc,
      joiningDate: params.joiningDate,
      designation: params.designation,
      status: 'ISSUED',
    },
    create: {
      candidateId: params.candidateId,
      offeredCtc: params.offeredCtc,
      joiningDate: params.joiningDate,
      designation: params.designation,
      status: 'ISSUED',
    },
  });

  await prisma.candidate.update({
    where: { id: params.candidateId },
    data: { stage: 'OFFERED' },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'ISSUE_CANDIDATE_OFFER',
    entityType: 'ATS_OFFER',
    entityId: offer.id,
    afterState: { candidateId: params.candidateId, offeredCtc: params.offeredCtc, designation: params.designation },
  });

  return offer;
}

export async function respondToCandidateOffer(params: {
  tenantId: string;
  candidateId: string;
  decision: 'ACCEPTED' | 'DECLINED';
  actor?: AuthUser;
}) {
  const offer = await prisma.candidateOffer.update({
    where: { candidateId: params.candidateId },
    data: {
      status: params.decision,
      acceptedAt: params.decision === 'ACCEPTED' ? new Date() : undefined,
    },
  });

  if (params.decision === 'ACCEPTED') {
    await prisma.candidate.update({
      where: { id: params.candidateId },
      data: { stage: 'OFFERED' },
    });
  } else {
    await prisma.candidate.update({
      where: { id: params.candidateId },
      data: { stage: 'REJECTED', rejectionReason: 'Candidate declined offer' },
    });
  }

  return offer;
}

export async function convertCandidateToEmployee(params: {
  tenantId: string;
  candidateId: string;
  actor: AuthUser;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    include: { jobRequisition: true, offer: true },
  });

  if (!candidate) throw new Error('Candidate not found');
  if (candidate.hiredEmployeeId) throw new Error('Candidate already hired as employee');

  const count = await prisma.employee.count({ where: { tenantId: params.tenantId } });
  const employeeCode = `EMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const ctc = candidate.offer?.offeredCtc || candidate.expectedCtc || 1200000;

  // Get default salary structure
  const structure = await prisma.salaryStructure.findFirst({
    where: { tenantId: params.tenantId, isDefault: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Employee
    const employee = await tx.employee.create({
      data: {
        tenantId: params.tenantId,
        employeeCode,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        displayName: `${candidate.firstName} ${candidate.lastName}`,
        workEmail: candidate.email,
        mobilePhone: candidate.phone,
        joiningDate: candidate.offer?.joiningDate || new Date(),
        legalEntityId: candidate.jobRequisition.legalEntityId,
        branchLocationId: candidate.jobRequisition.branchLocationId,
        departmentId: candidate.jobRequisition.departmentId,
        designationId: candidate.jobRequisition.designationId,
        status: 'ACTIVE',
      },
    });

    // 2. Assign Salary
    if (structure) {
      await tx.employeeSalaryAssignment.create({
        data: {
          tenantId: params.tenantId,
          employeeId: employee.id,
          structureId: structure.id,
          ctc,
          grossSalary: ctc / 12,
          netSalary: (ctc / 12) * 0.85,
          effectiveFrom: new Date(),
          isCurrent: true,
        },
      });
    }

    // 3. Update Candidate status
    await tx.candidate.update({
      where: { id: candidate.id },
      data: {
        stage: 'HIRED',
        hiredEmployeeId: employee.id,
      },
    });

    return employee;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'HIRE_CANDIDATE_TO_EMPLOYEE',
    entityType: 'ATS',
    entityId: candidate.id,
    afterState: { employeeId: result.id, employeeCode: result.employeeCode },
  });

  return result;
}
