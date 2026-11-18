import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { assignableEmployees, getOrCreateCurrentCycle } from '@/lib/performance/team';

const MAX_ROWS = 1000;
const norm = (h: string) => h.replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COLS: Record<string, string[]> = {
  employee: ['employeeemail', 'workemail', 'email', 'employeecode', 'empcode', 'employee', 'code'],
  title: ['title', 'goal', 'goaltitle', 'objective', 'okr'],
  description: ['description', 'details', 'keyresult', 'keyresults'],
  category: ['category', 'type'],
  weight: ['weight', 'weightage', 'weightpercent'],
  target: ['target', 'targetvalue', 'measure', 'metric'],
};

/**
 * Bulk-assign goals from CSV. Body: { csvContent }.
 * Columns: employee (work email or employee code), title, description, category (OKR/KRA/KPI), weight, target.
 * HR / owner: any employee. Manager: direct reports only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'performance:review')) {
      return forbidden('Only managers, HR or the company owner can assign goals.');
    }

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
    if (!rows.length) return NextResponse.json({ error: 'No data rows found.' }, { status: 400 });
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows (${rows.length}). Max ${MAX_ROWS} per file.` }, { status: 400 });
    }
    const headers = new Set((parsed.meta.fields || []).map(norm));
    const missing = ['employee', 'title'].filter((k) => !COLS[k].some((a) => headers.has(a)));
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing column(s): ${missing.map((m) => (m === 'employee' ? 'employeeEmail (or employeeCode)' : m)).join(', ')}` },
        { status: 400 },
      );
    }

    // Who this user may assign to, keyed by email and code
    const allowed = await assignableEmployees(user);
    const byKey = new Map<string, string>();
    for (const e of allowed) {
      byKey.set(e.workEmail.toLowerCase(), e.id);
      byKey.set(e.employeeCode.toLowerCase(), e.id);
    }

    const cycle = await getOrCreateCurrentCycle(user.tenantId);
    const errors: { row: number; message: string }[] = [];
    const toCreate: any[] = [];

    rows.forEach((raw, i) => {
      const rowNum = i + 2;
      const r = new Map(Object.entries(raw).map(([k, v]) => [norm(k), String(v ?? '').trim()]));
      const get = (k: string) => {
        for (const a of COLS[k]) if (r.get(a)) return r.get(a)!;
        return '';
      };
      const who = get('employee').toLowerCase();
      const title = get('title');
      if (!who || !title) return errors.push({ row: rowNum, message: 'Employee and title are required' });
      const employeeId = byKey.get(who);
      if (!employeeId) {
        return errors.push({ row: rowNum, message: `"${get('employee')}" is not an employee you can assign goals to` });
      }
      const weightRaw = get('weight').replace('%', '');
      const weight = weightRaw ? parseFloat(weightRaw) : 25;
      if (!isFinite(weight) || weight <= 0 || weight > 100) {
        return errors.push({ row: rowNum, message: `Invalid weight "${get('weight')}" (use 1–100)` });
      }
      const cat = get('category').toUpperCase();
      toCreate.push({
        performanceCycleId: cycle.id,
        employeeId,
        title: title.slice(0, 200),
        description: get('description').slice(0, 2000) || null,
        category: ['OKR', 'KRA', 'KPI'].includes(cat) ? cat : 'OKR',
        weight,
        targetValue: get('target').slice(0, 200) || null,
        progressPercent: 0,
      });
    });

    if (toCreate.length) {
      await prisma.$transaction(toCreate.map((data) => prisma.performanceGoal.create({ data })));
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'BULK_IMPORT_PERFORMANCE_GOALS',
      entityType: 'PERFORMANCE_GOAL',
      afterState: { cycleId: cycle.id, totalRows: rows.length, imported: toCreate.length, failed: errors.length },
    });

    return NextResponse.json({
      success: true,
      cycle: { id: cycle.id, title: cycle.title },
      totalProcessed: rows.length,
      importedCount: toCreate.length,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
