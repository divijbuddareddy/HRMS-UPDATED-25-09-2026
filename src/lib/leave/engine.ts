import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { differenceInDays, isWeekend, eachDayOfInterval, startOfDay, endOfDay, format, isSameDay } from 'date-fns';

export interface LeaveBalanceSummary {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  color: string;
  isPaid: boolean;
  totalAccrued: number;
  totalConsumed: number;
  currentBalance: number;
  annualQuota: number;
  maxCarryForward: number;
}

export async function calculateEmployeeLeaveBalance(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string
): Promise<number> {
  const transactions = await prisma.leaveLedger.findMany({
    where: {
      tenantId,
      employeeId,
      leaveTypeId,
    },
    orderBy: { transactionDate: 'asc' },
  });

  return transactions.reduce((acc, tx) => acc + tx.days, 0);
}

const round05 = (n: number) => Math.round(n * 2) / 2;

/**
 * Credits leave earned so far this year according to each paid leave type's policy:
 *  - MONTHLY: accrualRate at the start of each month
 *  - QUARTERLY: annualQuota / 4 at the start of each quarter (first quarter pro-rated for joiners)
 *  - ANNUAL / LUMP_SUM: annualQuota on 1 Jan (pro-rated by month for joiners)
 * Credits start from the joining date (or 1 Jan) and never exceed the annual quota in a year.
 * Each credit has a deterministic ledger id, so calling this repeatedly (or concurrently) is safe.
 */
export async function ensureLeaveAccruals(tenantId: string, employeeId: string, asOf: Date = new Date()) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { joiningDate: true },
  });
  if (!emp) return;

  const year = asOf.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const joined = startOfDay(emp.joiningDate);
  if (joined > asOf) return;
  const from = joined > yearStart ? joined : yearStart;
  const fromMonth = from.getMonth();
  const toMonth = asOf.getMonth();

  const types = await prisma.leaveType.findMany({
    where: { tenantId, isPaid: true },
    include: { policy: true },
  });

  for (const lt of types) {
    const p = lt.policy;
    if (!p || p.annualQuota <= 0) continue;

    const credits: { key: string; days: number; date: Date }[] = [];
    if (p.accrualFrequency === 'QUARTERLY') {
      for (let q = Math.floor(fromMonth / 3); q <= Math.floor(toMonth / 3); q++) {
        const isFirst = q === Math.floor(fromMonth / 3);
        const share = isFirst ? (3 - (fromMonth % 3)) / 3 : 1;
        credits.push({ key: `${year}-Q${q + 1}`, days: round05((p.annualQuota / 4) * share), date: new Date(year, q * 3, 1) });
      }
    } else if (p.accrualFrequency === 'ANNUAL' || p.accrualFrequency === 'LUMP_SUM') {
      credits.push({ key: `${year}-Y`, days: round05((p.annualQuota * (12 - fromMonth)) / 12), date: yearStart });
    } else {
      // MONTHLY (default)
      if (p.accrualRate <= 0) continue;
      for (let m = fromMonth; m <= toMonth; m++) {
        credits.push({ key: `${year}-M${String(m + 1).padStart(2, '0')}`, days: p.accrualRate, date: new Date(year, m, 1) });
      }
    }

    const ledger = await prisma.leaveLedger.findMany({
      where: { tenantId, employeeId, leaveTypeId: lt.id },
      select: { id: true, days: true, transactionType: true, referenceId: true },
    });
    const have = new Set(ledger.map((l) => l.id));
    let balance = ledger.reduce((a, l) => a + l.days, 0);
    let accruedThisYear = ledger
      .filter((l) => l.transactionType === 'ACCRUAL' && l.referenceId?.startsWith(`${year}-`))
      .reduce((a, l) => a + l.days, 0);

    for (const c of credits) {
      const id = `accrual:${lt.id}:${employeeId}:${c.key}`;
      if (have.has(id)) continue;
      const amount = Math.min(c.days, p.annualQuota - accruedThisYear);
      if (amount <= 0) break;
      try {
        await prisma.leaveLedger.create({
          data: {
            id,
            tenantId,
            employeeId,
            leaveTypeId: lt.id,
            transactionType: 'ACCRUAL',
            days: amount,
            balanceAfter: balance + amount,
            referenceType: 'MONTHLY_ACCRUAL',
            referenceId: c.key,
            reason: `${lt.code} credit for ${c.key}`,
            transactionDate: c.date < joined ? joined : c.date,
          },
        });
        balance += amount;
        accruedThisYear += amount;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // already credited by a concurrent request
      }
    }
  }
}

export async function getEmployeeAllLeaveBalances(
  tenantId: string,
  employeeId: string
): Promise<LeaveBalanceSummary[]> {
  await ensureLeaveAccruals(tenantId, employeeId);
  const leaveTypes = await prisma.leaveType.findMany({
    where: { tenantId },
    include: { policy: true },
  });

  const balances: LeaveBalanceSummary[] = [];

  for (const lt of leaveTypes) {
    const transactions = await prisma.leaveLedger.findMany({
      where: {
        tenantId,
        employeeId,
        leaveTypeId: lt.id,
      },
    });

    let totalAccrued = 0;
    let totalConsumed = 0;
    let currentBalance = 0;

    for (const tx of transactions) {
      currentBalance += tx.days;
      if (['OPENING', 'ACCRUAL', 'ADJUSTMENT', 'CREDIT'].includes(tx.transactionType) && tx.days > 0 && tx.referenceType !== 'LEAVE_CANCELLATION') {
        totalAccrued += tx.days;
      } else if (tx.transactionType === 'CONSUMPTION') {
        totalConsumed += Math.abs(tx.days);
      } else if (tx.referenceType === 'LEAVE_CANCELLATION') {
        totalConsumed -= Math.abs(tx.days); // cancelled leave is no longer "consumed"
      }
    }

    balances.push({
      leaveTypeId: lt.id,
      leaveTypeCode: lt.code,
      leaveTypeName: lt.name,
      color: lt.color,
      isPaid: lt.isPaid,
      totalAccrued,
      totalConsumed,
      currentBalance,
      annualQuota: lt.policy?.annualQuota || 18,
      maxCarryForward: lt.policy?.maxCarryForward || 45,
    });
  }

  return balances;
}

export interface ValidateAndApplyLeaveParams {
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  isHalfDay?: boolean;
  halfDaySession?: 'FIRST_HALF' | 'SECOND_HALF';
  reason: string;
  attachmentUrl?: string;
  approverId?: string;
  backupApproverId?: string;
}

export async function validateAndApplyLeave(params: ValidateAndApplyLeaveParams) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: { reportingManager: true },
  });
  if (!employee) throw new Error('Employee not found');

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: params.leaveTypeId },
    include: { policy: true },
  });
  if (!leaveType) throw new Error('Leave type not found');

  const policy = leaveType.policy;
  const daysInterval = eachDayOfInterval({ start: params.startDate, end: params.endDate });

  // Calculate requested days
  let requestedDays = 0;
  if (params.isHalfDay) {
    if (!policy?.allowHalfDay) {
      throw new Error('Half-day leaves are not allowed for this leave type');
    }
    requestedDays = 0.5;
  } else {
    // Weekends are never debited (sandwich rule is not used by this company).
    requestedDays = daysInterval.filter((d) => !isWeekend(d)).length;
  }

  if (requestedDays <= 0) {
    throw new Error('Invalid leave duration');
  }

  // Consecutive days check
  if (policy?.maxConsecutiveDays && requestedDays > policy.maxConsecutiveDays) {
    throw new Error(`Maximum consecutive days allowed is ${policy.maxConsecutiveDays}`);
  }

  // Check current balance (crediting anything earned so far first)
  await ensureLeaveAccruals(params.tenantId, params.employeeId);
  const currentBalance = await calculateEmployeeLeaveBalance(
    params.tenantId,
    params.employeeId,
    params.leaveTypeId
  );

  // Days already requested but not yet approved also count, so pending requests can't over-book.
  const pendingAgg = await prisma.leaveRequest.aggregate({
    where: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      status: 'PENDING',
    },
    _sum: { totalDays: true },
  });
  const pendingDays = pendingAgg._sum.totalDays || 0;

  const maxNeg = policy?.maxNegativeBalance || 0;
  if (currentBalance - pendingDays - requestedDays < -maxNeg) {
    const available = currentBalance - pendingDays;
    throw new Error(
      `Not enough leave balance. Available: ${available} day(s)` +
        (pendingDays ? ` (after ${pendingDays} day(s) pending approval)` : '') +
        `, requested: ${requestedDays} day(s)` +
        (maxNeg ? `, allowed below zero: ${maxNeg}` : '') +
        '.'
    );
  }

  // Check overlapping requests with normalized dates
  const reqStart = startOfDay(params.startDate);
  const reqEnd = endOfDay(params.endDate);

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: reqEnd },
      endDate: { gte: reqStart },
    },
    include: { leaveType: true },
  });

  if (overlapping) {
    // Check if both are half-days on the same day with complementary sessions (e.g. First Half + Second Half)
    const isSameDayReq = isSameDay(params.startDate, params.endDate) && isSameDay(overlapping.startDate, overlapping.endDate);
    const isComplementary =
      isSameDayReq &&
      params.isHalfDay &&
      overlapping.isHalfDay &&
      params.halfDaySession &&
      overlapping.halfDaySession &&
      params.halfDaySession !== overlapping.halfDaySession;

    if (!isComplementary) {
      const fromStr = format(overlapping.startDate, 'dd MMM yyyy');
      const toStr = format(overlapping.endDate, 'dd MMM yyyy');
      const statusText = overlapping.status === 'APPROVED' ? 'an approved' : 'a pending';
      const rangeText = fromStr === toStr ? fromStr : `${fromStr} to ${toStr}`;
      throw new Error(
        `You already have ${statusText} ${overlapping.leaveType?.name || 'leave'} request for ${rangeText}. Please choose different dates or withdraw the conflicting request.`
      );
    }
  }

  // Determine primary & backup approvers
  const approverId = params.approverId || employee.reportingManagerId || undefined;
  const backupApproverId = params.backupApproverId || undefined;

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      startDate: params.startDate,
      endDate: params.endDate,
      totalDays: requestedDays,
      isHalfDay: params.isHalfDay || false,
      halfDaySession: params.halfDaySession,
      reason: params.reason,
      attachmentUrl: params.attachmentUrl,
      status: 'PENDING',
      approverId,
      backupApproverId,
    },
  });

  return leaveRequest;
}

export async function processLeaveApproval(params: {
  tenantId: string;
  leaveRequestId: string;
  actor: AuthUser;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
}) {
  const req = await prisma.leaveRequest.findUnique({
    where: { id: params.leaveRequestId },
    include: { leaveType: true, employee: true },
  });

  if (!req) throw new Error('Leave request not found');
  if (req.status !== 'PENDING') throw new Error(`Leave request is already ${req.status}`);

  if (params.decision === 'REJECTED') {
    const updated = await prisma.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approverNotes: params.notes,
      },
    });

    await createAuditLog({
      tenantId: params.tenantId,
      actorId: params.actor.userId,
      actorRole: params.actor.roles[0] || 'APPROVER',
      action: 'LEAVE_REJECTED',
      entityType: 'LEAVE_REQUEST',
      entityId: req.id,
      beforeState: { status: req.status },
      afterState: { status: 'REJECTED', notes: params.notes },
    });

    return updated;
  }

  // If APPROVED:
  // 1. Transactionally update leave request & create CONSUMPTION in LeaveLedger
  const currentBalance = await calculateEmployeeLeaveBalance(params.tenantId, req.employeeId, req.leaveTypeId);
  const newBalance = currentBalance - req.totalDays;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: req.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approverNotes: params.notes,
      },
    });

    await tx.leaveLedger.create({
      data: {
        tenantId: params.tenantId,
        employeeId: req.employeeId,
        leaveTypeId: req.leaveTypeId,
        transactionType: 'CONSUMPTION',
        days: -req.totalDays,
        balanceAfter: newBalance,
        referenceType: 'LEAVE_REQUEST',
        referenceId: req.id,
        reason: `Leave approved: ${req.reason}`,
        transactionDate: new Date(),
      },
    });

    // 2. Mark daily attendance records for interval
    const daysInterval = eachDayOfInterval({ start: req.startDate, end: req.endDate });
    for (const d of daysInterval) {
      const dayStart = startOfDay(d);
      const isPaid = req.leaveType.isPaid;
      await tx.dailyAttendanceRecord.upsert({
        where: {
          tenantId_employeeId_date: {
            tenantId: params.tenantId,
            employeeId: req.employeeId,
            date: dayStart,
          },
        },
        update: {
          status: req.isHalfDay ? 'HALF_DAY' : (isPaid ? 'PRESENT' : 'LOP'),
          notes: `Leave (${req.leaveType.code}) Approved`,
        },
        create: {
          tenantId: params.tenantId,
          employeeId: req.employeeId,
          date: dayStart,
          status: req.isHalfDay ? 'HALF_DAY' : (isPaid ? 'PRESENT' : 'LOP'),
          notes: `Leave (${req.leaveType.code}) Approved`,
        },
      });
    }

    return updated;
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'APPROVER',
    action: 'LEAVE_APPROVED',
    entityType: 'LEAVE_REQUEST',
    entityId: req.id,
    beforeState: { status: req.status, balanceBefore: currentBalance },
    afterState: { status: 'APPROVED', daysDebited: req.totalDays, balanceAfter: newBalance },
  });

  return result;
}

export async function addLeaveLedgerTransaction(params: {
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  transactionType: 'OPENING' | 'ACCRUAL' | 'CONSUMPTION' | 'REVERSAL' | 'ADJUSTMENT' | 'EXPIRY' | 'ENCASHMENT';
  days: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const currentBalance = await calculateEmployeeLeaveBalance(
    params.tenantId,
    params.employeeId,
    params.leaveTypeId
  );

  const balanceAfter = currentBalance + params.days;

  return prisma.leaveLedger.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      transactionType: params.transactionType,
      days: params.days,
      balanceAfter,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reason: params.reason,
      transactionDate: new Date(),
    },
  });
}
