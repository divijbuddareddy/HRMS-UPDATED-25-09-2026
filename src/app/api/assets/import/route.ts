import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { assetTagAllocator, normaliseCategory, parseAssetDate } from '@/lib/assets/tags';

const MAX_ROWS = 2000;
const norm = (h: string) => h.replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COLS: Record<string, string[]> = {
  name: ['assetname', 'name', 'asset', 'item', 'description'],
  tag: ['assettag', 'tag', 'assetid', 'assetcode', 'code'],
  category: ['category', 'type', 'assettype'],
  serial: ['serialnumber', 'serial', 'serialno', 'sno'],
  purchaseDate: ['purchasedate', 'dateofpurchase', 'boughton', 'purchased'],
  warranty: ['warrantyexpiry', 'warrantyend', 'warrantytill', 'warranty'],
  cost: ['purchasecost', 'cost', 'price', 'amount', 'value'],
  branch: ['branch', 'location', 'branchcode', 'office'],
  assignTo: ['assignto', 'assignedto', 'employee', 'employeeemail', 'employeecode', 'owner'],
  condition: ['condition', 'handovercondition'],
};
const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];

/**
 * Bulk-add assets from CSV. Body: { csvContent }. HR / owner only.
 * Columns: assetName (required), assetTag (blank = auto AST-0001), category, serialNumber,
 * purchaseDate, warrantyExpiry, purchaseCost, branch, assignTo (employee email or code), condition.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'assets:manage')) return forbidden('Only HR or the company owner can import assets.');

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
    if (!COLS.name.some((a) => headers.has(a))) {
      return NextResponse.json({ error: `Missing column: assetName. Found: ${(parsed.meta.fields || []).join(', ')}` }, { status: 400 });
    }

    const tenantId = user.tenantId;
    const [branches, employees] = await Promise.all([
      prisma.branchLocation.findMany({ where: { tenantId }, select: { id: true, name: true, code: true } }),
      prisma.employee.findMany({
        where: { tenantId, status: { notIn: ['EXITED', 'ARCHIVED'] } },
        select: { id: true, workEmail: true, employeeCode: true },
      }),
    ]);
    const branchBy = new Map<string, string>();
    branches.forEach((b) => {
      branchBy.set(b.name.toLowerCase(), b.id);
      branchBy.set(b.code.toLowerCase(), b.id);
    });
    const empBy = new Map<string, string>();
    employees.forEach((e) => {
      empBy.set(e.workEmail.toLowerCase(), e.id);
      empBy.set(e.employeeCode.toLowerCase(), e.id);
    });

    // Tags given in the file are reserved before auto-numbering the blanks
    const getter = (raw: Record<string, string>) => {
      const r = new Map(Object.entries(raw).map(([k, v]) => [norm(k), String(v ?? '').trim()]));
      return (k: string) => {
        for (const a of COLS[k]) if (r.get(a)) return r.get(a)!;
        return '';
      };
    };
    const fileTags = rows.map((r) => getter(r)('tag')).filter(Boolean);
    const existingAssets = await prisma.asset.findMany({ where: { tenantId }, select: { assetTag: true, serialNumber: true } });
    const existingTags = new Set(existingAssets.map((a) => a.assetTag.toUpperCase()));
    // Serial numbers identify a physical device: re-importing the same file must not create copies
    const existingSerials = new Set(existingAssets.map((a) => (a.serialNumber || '').trim().toUpperCase()).filter(Boolean));
    const seenSerials = new Set<string>();
    const nextTag = await assetTagAllocator(tenantId, fileTags);

    const errors: { row: number; message: string }[] = [];
    const seenTags = new Set<string>();
    let imported = 0;
    let assigned = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const get = getter(rows[i]);
      const name = get('name');
      if (!name) {
        errors.push({ row: rowNum, message: 'Asset name is required' });
        continue;
      }
      const serialKey = get('serial').toUpperCase();
      if (serialKey && existingSerials.has(serialKey)) {
        errors.push({ row: rowNum, message: `Serial number ${get('serial')} already exists (asset already in inventory)` });
        continue;
      }
      if (serialKey && seenSerials.has(serialKey)) {
        errors.push({ row: rowNum, message: `Serial number ${get('serial')} appears twice in this file` });
        continue;
      }
      let tag = get('tag').toUpperCase();
      if (tag) {
        if (existingTags.has(tag)) {
          errors.push({ row: rowNum, message: `Asset tag ${tag} already exists` });
          continue;
        }
        if (seenTags.has(tag)) {
          errors.push({ row: rowNum, message: `Asset tag ${tag} appears twice in this file` });
          continue;
        }
      } else {
        tag = nextTag();
      }

      const category = normaliseCategory(get('category'));
      if (!category) {
        errors.push({ row: rowNum, message: `Unknown category "${get('category')}" (use Laptop, Desktop, Monitor, Phone, Accessory, Software License or Other)` });
        continue;
      }
      const purchaseDate = parseAssetDate(get('purchaseDate'));
      const warrantyExpiry = parseAssetDate(get('warranty'));
      if (purchaseDate === undefined || warrantyExpiry === undefined) {
        errors.push({ row: rowNum, message: 'Invalid date (use YYYY-MM-DD or DD/MM/YYYY)' });
        continue;
      }
      const costRaw = get('cost').replace(/[,\s₹]/g, '');
      const cost = costRaw ? parseFloat(costRaw) : null;
      if (costRaw && (!isFinite(cost!) || cost! < 0)) {
        errors.push({ row: rowNum, message: `Invalid purchase cost "${get('cost')}"` });
        continue;
      }
      const branchVal = get('branch');
      const branchLocationId = branchVal ? branchBy.get(branchVal.toLowerCase()) : undefined;
      if (branchVal && !branchLocationId) {
        errors.push({ row: rowNum, message: `Unknown branch "${branchVal}"` });
        continue;
      }
      const assignVal = get('assignTo');
      const employeeId = assignVal ? empBy.get(assignVal.toLowerCase()) : undefined;
      if (assignVal && !employeeId) {
        errors.push({ row: rowNum, message: `Employee "${assignVal}" not found (use work email or employee code)` });
        continue;
      }
      const cond = get('condition').toUpperCase();

      try {
        await prisma.$transaction(async (tx) => {
          const asset = await tx.asset.create({
            data: {
              tenantId,
              assetName: name.slice(0, 200),
              assetTag: tag,
              serialNumber: get('serial').slice(0, 100) || null,
              category,
              purchaseDate,
              warrantyExpiry,
              purchaseCost: cost,
              branchLocationId: branchLocationId || null,
              status: employeeId ? 'ASSIGNED' : 'AVAILABLE',
            },
          });
          if (employeeId) {
            await tx.assetAssignment.create({
              data: { assetId: asset.id, employeeId, condition: CONDITIONS.includes(cond) ? cond : 'GOOD', assignedDate: new Date() },
            });
          }
        });
        seenTags.add(tag);
        if (serialKey) seenSerials.add(serialKey);
        imported += 1;
        if (employeeId) assigned += 1;
      } catch (e: any) {
        errors.push({ row: rowNum, message: e?.code === 'P2002' ? `Asset tag ${tag} already exists` : e.message || 'Could not save' });
      }
    }

    await createAuditLog({
      tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'BULK_IMPORT_ASSETS',
      entityType: 'ASSET',
      afterState: { totalRows: rows.length, imported, assigned, failed: errors.length },
    });

    return NextResponse.json({ success: true, totalProcessed: rows.length, importedCount: imported, assignedCount: assigned, failedCount: errors.length, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
