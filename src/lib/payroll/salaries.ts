import { addDays, startOfDay } from 'date-fns';
import { prisma } from '../prisma';
import { calculateSalaryForEmployee } from './engine';

/** A company with no salary structure gets this standard Indian one (Basic 50% · HRA 40% of Basic · rest Special). */
export async function ensureDefaultStructure(tenantId: string) {
  const existing = await prisma.salaryStructure.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (existing) return existing;
  return prisma.salaryStructure.create({
    data: {
      tenantId,
      name: 'Standard Salary Structure',
      code: 'STANDARD',
      description: 'Basic 50% of CTC, HRA 40% of Basic, balance as Special Allowance; PF, ESI, PT and TDS as per law',
      isDefault: true,
      components: {
        create: [
          { name: 'Basic Salary', code: 'BASIC', componentType: 'EARNING', calculationType: 'PERCENTAGE', valueOrFormula: '0.50 * CTC', sortOrder: 1 },
          { name: 'House Rent Allowance', code: 'HRA', componentType: 'EARNING', calculationType: 'PERCENTAGE', valueOrFormula: '0.40 * BASIC', sortOrder: 2 },
          { name: 'Special Allowance', code: 'SPECIAL_ALLOWANCE', componentType: 'EARNING', calculationType: 'FORMULA', valueOrFormula: 'CTC - BASIC - HRA', sortOrder: 3 },
          { name: 'Provident Fund (Employee)', code: 'PF_EE', componentType: 'STATUTORY', calculationType: 'PERCENTAGE', valueOrFormula: '0.12 * BASIC', isStatutory: true, isPartOfGross: false, sortOrder: 10 },
          { name: 'ESI (Employee)', code: 'ESI_EE', componentType: 'STATUTORY', calculationType: 'PERCENTAGE', valueOrFormula: '0.0075 * GROSS', isStatutory: true, isPartOfGross: false, sortOrder: 11 },
          { name: 'Professional Tax', code: 'PT', componentType: 'STATUTORY', calculationType: 'FLAT', valueOrFormula: '200', isStatutory: true, isPartOfGross: false, sortOrder: 12 },
          { name: 'Income Tax (TDS)', code: 'TDS', componentType: 'STATUTORY', calculationType: 'FORMULA', valueOrFormula: 'SLAB', isStatutory: true, isPartOfGross: false, sortOrder: 13 },
        ],
      },
    },
  });
}

/** Estimated monthly gross / take-home for a CTC (shown in the Salaries list; payroll computes the real figure). */
export function estimateMonthly(annualCtc: number, state: string, taxRegime: string) {
  const r = calculateSalaryForEmployee({
    annualCtc,
    monthlyCtc: annualCtc / 12,
    state: state || 'KARNATAKA',
    taxRegime: taxRegime === 'OLD_REGIME' ? 'OLD' : 'NEW',
  });
  return { gross: Math.round(r.grossEarnings), net: Math.round(r.netPay) };
}

/**
 * Keeps an employee's salary history consistent: each revision ends the day before the next one starts,
 * and `isCurrent` marks the one in effect today (a future-dated revision becomes current on its date).
 */
export async function syncSalaryHistory(tenantId: string, employeeId: string, tx: any = prisma) {
  const rows = await tx.employeeSalaryAssignment.findMany({
    where: { tenantId, employeeId },
    orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
  });
  const today = startOfDay(new Date());
  let currentId: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const next = rows[i + 1];
    const effectiveTo = next ? addDays(startOfDay(next.effectiveFrom), -1) : null;
    if (startOfDay(rows[i].effectiveFrom) <= today) currentId = rows[i].id;
    const changedTo = String(rows[i].effectiveTo || '') !== String(effectiveTo || '');
    if (changedTo) await tx.employeeSalaryAssignment.update({ where: { id: rows[i].id }, data: { effectiveTo } });
  }
  for (const r of rows) {
    const should = r.id === currentId;
    if (r.isCurrent !== should) await tx.employeeSalaryAssignment.update({ where: { id: r.id }, data: { isCurrent: should } });
  }
}

/** Sync every employee of the company (cheap; run before payroll and when the salary list is opened). */
export async function syncAllSalaryHistories(tenantId: string) {
  const emps = await prisma.employeeSalaryAssignment.findMany({ where: { tenantId }, select: { employeeId: true }, distinct: ['employeeId'] });
  for (const e of emps) await syncSalaryHistory(tenantId, e.employeeId);
}

/**
 * Set or revise an employee's salary from a date. A revision on the same date as an existing one replaces it
 * (correction); otherwise it is added to the history.
 */
export async function setEmployeeSalary(params: {
  tenantId: string;
  employeeId: string;
  annualCtc: number;
  effectiveFrom: Date;
  taxRegime: 'NEW_REGIME' | 'OLD_REGIME';
  structureId?: string;
}) {
  const emp = await prisma.employee.findFirst({
    where: { id: params.employeeId, tenantId: params.tenantId },
    select: { id: true, branchLocation: { select: { state: true } } },
  });
  if (!emp) throw new Error('Employee not found');

  const structure = params.structureId
    ? await prisma.salaryStructure.findFirst({ where: { id: params.structureId, tenantId: params.tenantId } })
    : await ensureDefaultStructure(params.tenantId);
  if (!structure) throw new Error('Salary structure not found');

  const est = estimateMonthly(params.annualCtc, emp.branchLocation?.state || '', params.taxRegime);
  const effectiveFrom = startOfDay(params.effectiveFrom);

  return prisma.$transaction(async (tx) => {
    const sameDay = await tx.employeeSalaryAssignment.findFirst({
      where: { tenantId: params.tenantId, employeeId: params.employeeId, effectiveFrom },
    });
    const data = {
      structureId: structure.id,
      ctc: params.annualCtc,
      grossSalary: est.gross,
      netSalary: est.net,
      taxRegime: params.taxRegime,
    };
    const row = sameDay
      ? await tx.employeeSalaryAssignment.update({ where: { id: sameDay.id }, data })
      : await tx.employeeSalaryAssignment.create({
          data: { ...data, tenantId: params.tenantId, employeeId: params.employeeId, effectiveFrom, isCurrent: false },
        });
    await syncSalaryHistory(params.tenantId, params.employeeId, tx);
    return { assignment: row, replaced: !!sameDay };
  });
}

/** The salary in force for a payroll month: latest revision that started on/before the month's end. */
export async function salaryForPeriod(tenantId: string, employeeId: string, periodStart: Date, periodEnd: Date) {
  return prisma.employeeSalaryAssignment.findFirst({
    where: {
      tenantId,
      employeeId,
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      structure: { include: { components: { orderBy: { sortOrder: 'asc' } } } },
      employee: { include: { branchLocation: true, identity: true, bank: true } },
    },
  });
}
