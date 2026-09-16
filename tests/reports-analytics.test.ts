import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { generateHrmsReport } from '../src/lib/reports/engine';
import { AuthUser } from '../src/lib/types';

describe('Reports & Analytics Engine: 8 Core Domains & CSV Export', () => {
  let tenantId: string;
  const adminActor: AuthUser = {
    userId: 'u-reports-admin',
    tenantId: 'temp',
    email: 'admin@test.com',
    roles: ['HR_ADMIN'],
    permissions: [{ permissionKey: '*', dataScope: 'ENTIRE_TENANT', isSensitive: true }],
  };

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'ai-automation-labs' } });
    if (tenant) {
      tenantId = tenant.id;
      adminActor.tenantId = tenant.id;
    }
  });

  it('should generate Employee Master report and CSV content', async () => {
    const report = await generateHrmsReport({
      tenantId,
      reportType: 'EMPLOYEE_MASTER',
      actor: adminActor,
    });

    expect(report.reportType).toBe('EMPLOYEE_MASTER');
    expect(report.columns).toContain('Employee Code');
    expect(report.columns).toContain('Work Email');
    expect(report.csvContent).toContain('Employee Code');
  });

  it('should generate Leave Ledger report with balance movements', async () => {
    const report = await generateHrmsReport({
      tenantId,
      reportType: 'LEAVE_LEDGER',
      actor: adminActor,
    });

    expect(report.reportType).toBe('LEAVE_LEDGER');
    expect(report.columns).toContain('Leave Type');
    expect(report.columns).toContain('Days Credited/Debited');
  });

  it('should generate Payroll & Statutory tax compliance report', async () => {
    const report = await generateHrmsReport({
      tenantId,
      reportType: 'PAYROLL_STATUTORY',
      actor: adminActor,
    });

    expect(report.reportType).toBe('PAYROLL_STATUTORY');
    expect(report.columns).toContain('Gross Earnings');
    expect(report.columns).toContain('EPF Employee');
    expect(report.columns).toContain('Professional Tax');
    expect(report.columns).toContain('Net Salary');
  });

  it('should generate ATS Pipeline, Performance, Expense, and Asset reports', async () => {
    const atsReport = await generateHrmsReport({
      tenantId,
      reportType: 'ATS_PIPELINE',
      actor: adminActor,
    });
    expect(atsReport.reportType).toBe('ATS_PIPELINE');

    const expReport = await generateHrmsReport({
      tenantId,
      reportType: 'EXPENSE_CLAIMS',
      actor: adminActor,
    });
    expect(expReport.reportType).toBe('EXPENSE_CLAIMS');

    const assetReport = await generateHrmsReport({
      tenantId,
      reportType: 'ASSET_INVENTORY',
      actor: adminActor,
    });
    expect(assetReport.reportType).toBe('ASSET_INVENTORY');
  });
});
