import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { filterSensitiveEmployeeData } from '../rbac';

export interface ReportFilterParams {
  tenantId: string;
  reportType:
    | 'EMPLOYEE_MASTER'
    | 'ATTENDANCE_SUMMARY'
    | 'LEAVE_LEDGER'
    | 'PAYROLL_STATUTORY'
    | 'ATS_PIPELINE'
    | 'PERFORMANCE_APPRAISALS'
    | 'EXPENSE_CLAIMS'
    | 'ASSET_INVENTORY';
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  branchLocationId?: string;
  actor: AuthUser;
}

export interface ReportResult {
  reportType: string;
  generatedAt: Date;
  totalRecords: number;
  columns: string[];
  rows: Array<Record<string, any>>;
  csvContent: string;
}

export function generateCsvFromRows(columns: string[], rows: Array<Record<string, any>>): string {
  const header = columns.join(',');
  const rowStrings = rows.map((r) =>
    columns
      .map((col) => {
        const val = r[col] ?? '';
        const clean = String(val).replace(/"/g, '""');
        return `"${clean}"`;
      })
      .join(',')
  );
  return [header, ...rowStrings].join('\n');
}

export async function generateHrmsReport(params: ReportFilterParams): Promise<ReportResult> {
  const { tenantId, reportType, actor } = params;

  let columns: string[] = [];
  let rows: Array<Record<string, any>> = [];

  switch (reportType) {
    case 'EMPLOYEE_MASTER': {
      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          ...(params.departmentId ? { departmentId: params.departmentId } : {}),
          ...(params.branchLocationId ? { branchLocationId: params.branchLocationId } : {}),
        },
        include: {
          department: true,
          designation: true,
          branchLocation: true,
          identity: true,
          bank: true,
          salaryAssignments: { where: { isCurrent: true } },
        },
      });

      columns = [
        'Employee Code',
        'Name',
        'Work Email',
        'Department',
        'Designation',
        'Branch Location',
        'Joining Date',
        'Status',
        'PAN Number',
        'Aadhaar Number',
        'Bank Account',
        'Annual CTC (INR)',
      ];

      rows = employees.map((e) => {
        const sensitive = filterSensitiveEmployeeData(
          {
            panNumber: e.identity?.panNumber,
            aadhaarNumber: e.identity?.aadhaarNumber,
            bankAccountNumber: e.bank?.accountNumber,
            ctc: e.salaryAssignments[0]?.ctc,
          },
          actor,
          false
        );

        return {
          'Employee Code': e.employeeCode,
          Name: e.displayName || `${e.firstName} ${e.lastName}`,
          'Work Email': e.workEmail,
          Department: e.department?.name || '',
          Designation: e.designation?.title || '',
          'Branch Location': e.branchLocation?.city || '',
          'Joining Date': new Date(e.joiningDate).toISOString().split('T')[0],
          Status: e.status,
          'PAN Number': sensitive.panNumber || 'N/A',
          'Aadhaar Number': sensitive.aadhaarNumber || 'N/A',
          'Bank Account': sensitive.bankAccountNumber || 'N/A',
          'Annual CTC (INR)': sensitive.ctc || 'N/A',
        };
      });
      break;
    }

    case 'ATTENDANCE_SUMMARY': {
      const records = await prisma.dailyAttendanceRecord.findMany({
        where: {
          tenantId,
          ...(params.startDate && params.endDate
            ? { date: { gte: new Date(params.startDate), lte: new Date(params.endDate) } }
            : {}),
        },
        include: { employee: true },
        take: 500,
      });

      columns = [
        'Date',
        'Employee Code',
        'Employee Name',
        'Status',
        'Worked Minutes',
        'Late Minutes',
        'Overtime Minutes',
        'Is Regularized',
      ];

      rows = records.map((r) => ({
        Date: new Date(r.date).toISOString().split('T')[0],
        'Employee Code': r.employee.employeeCode,
        'Employee Name': r.employee.displayName,
        Status: r.status,
        'Worked Minutes': r.totalWorkedMinutes,
        'Late Minutes': r.lateMinutes,
        'Overtime Minutes': r.overtimeMinutes,
        'Is Regularized': r.isRegularized ? 'Yes' : 'No',
      }));
      break;
    }

    case 'LEAVE_LEDGER': {
      const transactions = await prisma.leaveLedger.findMany({
        where: { tenantId },
        include: { employee: true, leaveType: true },
        orderBy: { transactionDate: 'desc' },
        take: 500,
      });

      columns = [
        'Date',
        'Employee Code',
        'Employee Name',
        'Leave Type',
        'Transaction Type',
        'Days Credited/Debited',
        'Balance After',
        'Reason',
      ];

      rows = transactions.map((t) => ({
        Date: new Date(t.transactionDate).toISOString().split('T')[0],
        'Employee Code': t.employee.employeeCode,
        'Employee Name': t.employee.displayName,
        'Leave Type': t.leaveType.name,
        'Transaction Type': t.transactionType,
        'Days Credited/Debited': t.days,
        'Balance After': t.balanceAfter,
        Reason: t.reason || '',
      }));
      break;
    }

    case 'PAYROLL_STATUTORY': {
      const items = await prisma.payrollItem.findMany({
        where: { payrollRun: { tenantId } },
        include: { employee: true, payrollRun: { include: { cycle: true } } },
        take: 500,
      });

      columns = [
        'Payroll Month/Year',
        'Employee Code',
        'Employee Name',
        'Gross Earnings',
        'EPF Employee',
        'ESI Employee',
        'Professional Tax',
        'TDS Income Tax',
        'Total Deductions',
        'Net Salary',
        'Employer Cost',
      ];

      rows = items.map((i) => {
        const deductions = JSON.parse(i.deductionsBreakdown || '{}');
        return {
          'Payroll Month/Year': `${i.payrollRun.cycle.month}/${i.payrollRun.cycle.year}`,
          'Employee Code': i.employee.employeeCode,
          'Employee Name': i.employee.displayName,
          'Gross Earnings': i.grossEarnings,
          'EPF Employee': deductions['PF_EE'] || 0,
          'ESI Employee': deductions['ESI_EE'] || 0,
          'Professional Tax': deductions['PT'] || 0,
          'TDS Income Tax': deductions['TDS'] || 0,
          'Total Deductions': i.totalDeductions,
          'Net Salary': i.netSalary,
          'Employer Cost': i.employerCost,
        };
      });
      break;
    }

    case 'ATS_PIPELINE': {
      const candidates = await prisma.candidate.findMany({
        where: { tenantId },
        include: { jobRequisition: true },
      });

      columns = [
        'Candidate Name',
        'Email',
        'Job Requisition',
        'Stage',
        'AI Match Score',
        'Expected CTC',
        'Notice Period (Days)',
      ];

      rows = candidates.map((c) => ({
        'Candidate Name': `${c.firstName} ${c.lastName}`,
        Email: c.email,
        'Job Requisition': c.jobRequisition?.title || '',
        Stage: c.stage,
        'AI Match Score': c.aiMatchScore ? `${c.aiMatchScore}%` : 'N/A',
        'Expected CTC': c.expectedCtc || 'N/A',
        'Notice Period (Days)': c.noticePeriodDays,
      }));
      break;
    }

    case 'EXPENSE_CLAIMS': {
      const claims = await prisma.expenseClaim.findMany({
        where: { tenantId },
        include: { employee: true, category: true },
      });

      columns = [
        'Claim Date',
        'Employee Name',
        'Category',
        'Amount (INR)',
        'Status',
        'Payment Method',
        'Cost Center',
        'Description',
      ];

      rows = claims.map((cl) => ({
        'Claim Date': new Date(cl.claimDate).toISOString().split('T')[0],
        'Employee Name': cl.employee.displayName,
        Category: cl.category.name,
        'Amount (INR)': cl.amount,
        Status: cl.status,
        'Payment Method': cl.paymentMethod,
        'Cost Center': cl.costCenter || 'ENGINEERING_OPS',
        Description: cl.description,
      }));
      break;
    }

    case 'ASSET_INVENTORY': {
      const assets = await prisma.asset.findMany({
        where: { tenantId },
        include: { assignments: { include: { employee: true }, where: { returnedDate: null } } },
      });

      columns = [
        'Asset Tag',
        'Asset Name',
        'Category',
        'Serial Number',
        'Status',
        'Assigned To',
        'Purchase Cost',
      ];

      rows = assets.map((a) => ({
        'Asset Tag': a.assetTag,
        'Asset Name': a.assetName,
        Category: a.category,
        'Serial Number': a.serialNumber || 'N/A',
        Status: a.status,
        'Assigned To': a.assignments[0]?.employee?.displayName || 'Unassigned',
        'Purchase Cost': a.purchaseCost || 0,
      }));
      break;
    }

    case 'PERFORMANCE_APPRAISALS': {
      const appraisals = await prisma.performanceAppraisal.findMany({
        where: { cycle: { tenantId } },
        include: { employee: true, manager: true, cycle: true },
      });

      columns = [
        'Cycle Title',
        'Employee Name',
        'Manager Name',
        'Self Rating',
        'Manager Rating',
        'Final Rating',
        'Promotion Recommended',
        'Increment %',
        'Status',
      ];

      rows = appraisals.map((ap) => ({
        'Cycle Title': ap.cycle.title,
        'Employee Name': ap.employee.displayName,
        'Manager Name': ap.manager?.displayName || 'N/A',
        'Self Rating': ap.selfRating || 'N/A',
        'Manager Rating': ap.managerRating || 'N/A',
        'Final Rating': ap.finalRating || 'N/A',
        'Promotion Recommended': ap.promotionRecommend ? 'Yes' : 'No',
        'Increment %': `${ap.incrementPercent}%`,
        Status: ap.status,
      }));
      break;
    }
  }

  const csvContent = generateCsvFromRows(columns, rows);

  // Log report export in audit trail
  await createAuditLog({
    tenantId,
    actorId: actor.userId,
    actorRole: actor.roles[0] || 'ADMIN',
    action: `GENERATE_REPORT_${reportType}`,
    entityType: 'REPORT_EXPORT',
    afterState: { reportType, recordsCount: rows.length },
  });

  return {
    reportType,
    generatedAt: new Date(),
    totalRecords: rows.length,
    columns,
    rows,
    csvContent,
  };
}
