import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

export function calculateWeightedPerformanceScore(
  goals: Array<{ weight: number; progressPercent: number }>
): number {
  if (!goals || goals.length === 0) return 0;
  return goals.reduce((acc, g) => acc + g.weight * (g.progressPercent / 100), 0);
}

export interface CalibrationGroupScore {
  employeeId: string;
  rawManagerRating: number;
  calibratedRating: number;
  percentileRank: number;
}

// Calculate normal distribution calibration across department/team appraisals
export function calibrateRatingsDistribution(
  appraisals: Array<{ employeeId: string; managerRating: number }>
): CalibrationGroupScore[] {
  if (appraisals.length === 0) return [];
  const sorted = [...appraisals].sort((a, b) => b.managerRating - a.managerRating);
  const total = sorted.length;

  return sorted.map((app, index) => {
    const percentile = Math.round(((total - index) / total) * 100);
    // Bell curve target: Top 20% = 4.5-5.0, Mid 70% = 3.0-4.4, Bottom 10% = 1.0-2.9
    let calibrated = app.managerRating;
    if (percentile > 80) calibrated = Math.min(5.0, Math.max(4.5, app.managerRating));
    else if (percentile < 15) calibrated = Math.min(2.9, app.managerRating);

    return {
      employeeId: app.employeeId,
      rawManagerRating: app.managerRating,
      calibratedRating: Math.round(calibrated * 10) / 10,
      percentileRank: percentile,
    };
  });
}

export async function createPerformanceCycle(params: {
  tenantId: string;
  title: string;
  cycleType: 'ANNUAL' | 'HALF_YEARLY' | 'QUARTERLY';
  startDate: Date;
  endDate: Date;
  actor: AuthUser;
}) {
  const cycle = await prisma.performanceCycle.create({
    data: {
      tenantId: params.tenantId,
      title: params.title,
      cycleType: params.cycleType,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'ACTIVE',
    },
  });

  return cycle;
}

export async function createPerformanceGoal(params: {
  tenantId: string;
  performanceCycleId: string;
  employeeId: string;
  title: string;
  description?: string;
  category: 'OKR' | 'KRA' | 'KPI';
  weight?: number;
  targetValue?: string;
}) {
  const goal = await prisma.performanceGoal.create({
    data: {
      performanceCycleId: params.performanceCycleId,
      employeeId: params.employeeId,
      title: params.title,
      description: params.description,
      category: params.category,
      weight: params.weight || 25,
      targetValue: params.targetValue,
      progressPercent: 0,
    },
  });

  return goal;
}

export async function submitSelfAppraisal(params: {
  tenantId: string;
  cycleId: string;
  employeeId: string;
  selfRating: number;
  selfReviewNotes: string;
  actor: AuthUser;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: { reportingManager: true },
  });
  if (!employee) throw new Error('Employee not found');

  const managerId = employee.reportingManagerId || employee.id;

  const appraisal = await prisma.performanceAppraisal.upsert({
    where: {
      performanceCycleId_employeeId: {
        performanceCycleId: params.cycleId,
        employeeId: params.employeeId,
      },
    },
    update: {
      selfRating: params.selfRating,
      selfReviewNotes: params.selfReviewNotes,
      status: 'MANAGER_REVIEW_PENDING',
    },
    create: {
      performanceCycleId: params.cycleId,
      employeeId: params.employeeId,
      managerId,
      selfRating: params.selfRating,
      selfReviewNotes: params.selfReviewNotes,
      status: 'MANAGER_REVIEW_PENDING',
    },
  });

  return appraisal;
}

export async function submitManagerAppraisal(params: {
  tenantId: string;
  cycleId: string;
  employeeId: string;
  managerRating: number;
  managerReviewNotes: string;
  finalRating?: number;
  promotionRecommend?: boolean;
  incrementPercent?: number;
  actor: AuthUser;
}) {
  const finalRating = params.finalRating || params.managerRating;

  const appraisal = await prisma.performanceAppraisal.update({
    where: {
      performanceCycleId_employeeId: {
        performanceCycleId: params.cycleId,
        employeeId: params.employeeId,
      },
    },
    data: {
      managerRating: params.managerRating,
      managerReviewNotes: params.managerReviewNotes,
      finalRating,
      promotionRecommend: params.promotionRecommend || false,
      incrementPercent: params.incrementPercent || 0,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'MANAGER',
    action: 'COMPLETE_PERFORMANCE_APPRAISAL',
    entityType: 'PERFORMANCE',
    entityId: appraisal.id,
    afterState: {
      employeeId: params.employeeId,
      finalRating,
      incrementPercent: params.incrementPercent,
      promotionRecommend: params.promotionRecommend,
    },
  });

  return appraisal;
}

export interface PerformanceImprovementPlan {
  employeeId: string;
  reason: string;
  durationDays: number;
  actionPlan: string;
  status: 'ACTIVE' | 'RESOLVED' | 'UNSUCCESSFUL';
  startDate: Date;
  reviewDate: Date;
}

export async function initiatePIP(params: {
  tenantId: string;
  employeeId: string;
  reason: string;
  durationDays?: number;
  actionPlan: string;
  actor: AuthUser;
}): Promise<PerformanceImprovementPlan> {
  const duration = params.durationDays || 60;
  const startDate = new Date();
  const reviewDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'HR_ADMIN',
    action: 'INITIATE_PERFORMANCE_IMPROVEMENT_PLAN',
    entityType: 'PERFORMANCE_PIP',
    entityId: params.employeeId,
    afterState: { employeeId: params.employeeId, reason: params.reason, durationDays: duration, reviewDate },
  });

  return {
    employeeId: params.employeeId,
    reason: params.reason,
    durationDays: duration,
    actionPlan: params.actionPlan,
    status: 'ACTIVE',
    startDate,
    reviewDate,
  };
}
