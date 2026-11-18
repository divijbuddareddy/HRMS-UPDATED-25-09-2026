import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { setEmployeeSalary } from '@/lib/payroll/salaries';
import { parseAssetDate } from '@/lib/assets/tags';

const MAX_ROWS = 2000;
const norm = (h: string) => h.replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COLS: Record<string, string[]> = {
  employee: ['employeeemail', 'workemail', 'email', 'employeecode', 'empcode', 'employeeid', 'employee', 'code'],
  annual: ['annualctc', 'ctc', 'ctcannual', 'yearlyctc', 'annualsalary', 'salary'],
  monthly: ['monthlyctc', 'monthlysalary', 'monthlygross', 'monthly'],
  effective: ['effectivefrom', 'effectivedate', 'from', 'startdate', 'wef'],
  regime: ['taxregime', 'regime'],
};

/**
 * Bulk set salaries from CSV. Body: { csvContent }.
 * Columns: employeeEmail or employeeCode, annualCtc (or monthlyCtc), effectiveFrom (blank = 1st of this month), taxRegime (NEW/OLD).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'payroll:manage')) return forbidden('Only Finance or the company owner can upload salaries.');

    const { csvContent } = await req.json().catch(() => ({}));
    if (typeof csvContent !== 'string' || !csvContent.trim()) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }
    const parsed = Papa.parse<Record<string, string>>(csvContent.replace(/^﻿/, ''), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    const rows = parsed.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
    if (!rows.length) return NextResponse.json({ error: 'No data rows found. The first line must be the column headers.' }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Too many rows (${rows.length}). Max ${MAX_ROWS} per file.` }, { status: 400 });
    const headers = new Set((parsed.meta.fields || []).map(norm));
    const has = (k: string) => COLS[k].some((a) => headers.has(a));
    if (!has('employee') || (!has('annual') && !has('monthly'))) {
      return NextResponse.json(
        { error: `Required columns: employeeEmail (or employeeCode) and annualCtc (or monthlyCtc). Found: ${(parsed.meta.fields || []).join(', ')}` },
        { status: 400 },
      );
    }

    const employees = await prisma.employee.findMany({
      where: { tenantId: user.tenantId, status: { notIn: ['EXITED', 'ARCHIVED'] } },
      select: { id: true, workEmail: true, employeeCode: true },
    });
    const empBy = new Map<string, string>();
    employees.forEach((e) => {
      empBy.set(e.workEmail.toLowerCase(), e.id);
      empBy.set(e.employeeCode.toLowerCase(), e.id);
    });
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const errors: { row: number; message: string }[] = [];
    const seen = new Set<string>();
    let applied = 0;
    let corrected = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const r = new Map(Object.entries(rows[i]).map(([k, v]) => [norm(k), String(v ?? '').trim()]));
      const get = (k: string) => {
        for (const a of COLS[k]) if (r.get(a)) return r.get(a)!;
        return '';
      };
      const who = get('employee');
      const employeeId = who ? empBy.get(who.toLowerCase()) : undefined;
      if (!employeeId) {
        errors.push({ row: rowNum, message: who ? `Employee "${who}" not found (use work email or employee code)` : 'Employee is required' });
        continue;
      }
      if (user.employeeId && employeeId === user.employeeId) {
        errors.push({ row: rowNum, message: 'You cannot set your own salary' });
        continue;
      }
      const annualRaw = get('annual').replace(/[,\s₹]/g, '');
      const monthlyRaw = get('monthly').replace(/[,\s₹]/g, '');
      const ctc = annualRaw ? parseFloat(annualRaw) : monthlyRaw ? parseFloat(monthlyRaw) * 12 : NaN;
      if (!isFinite(ctc) || ctc <= 0 || ctc > 100000000) {
        errors.push({ row: rowNum, message: `Invalid salary "${get('annual') || get('monthly')}"` });
        continue;
      }
      const effRaw = get('effective');
      const effectiveFrom = effRaw ? parseAssetDate(effRaw) : firstOfMonth;
      if (!effectiveFrom) {
        errors.push({ row: rowNum, message: `Invalid date "${effRaw}" (use YYYY-MM-DD or DD/MM/YYYY)` });
        continue;
      }
      const key = `${employeeId}|${effectiveFrom.toDateString()}`;
      if (seen.has(key)) {
        errors.push({ row: rowNum, message: `Same employee and date appear twice in this file` });
        continue;
      }
      seen.add(key);
      const taxRegime = get('regime').toUpperCase().startsWith('OLD') ? 'OLD_REGIME' : 'NEW_REGIME';

      try {
        const { replaced } = await setEmployeeSalary({ tenantId: user.tenantId, employeeId, annualCtc: ctc, effectiveFrom, taxRegime });
        applied += 1;
        if (replaced) corrected += 1;
      } catch (e: any) {
        errors.push({ row: rowNum, message: e.message || 'Could not save' });
      }
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'BULK_IMPORT_SALARIES',
      entityType: 'SALARY_ASSIGNMENT',
      afterState: { totalRows: rows.length, applied, corrected, failed: errors.length },
    });

    return NextResponse.json({ success: true, totalProcessed: rows.length, appliedCount: applied, correctedCount: corrected, failedCount: errors.length, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
