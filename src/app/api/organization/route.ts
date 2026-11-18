import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { ensureStandardDepartments } from '@/lib/org/departments';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Every company gets the standard departments (Sales, Finance, IT, Marketing, HR, ...)
    await ensureStandardDepartments(user.tenantId);

    const [legalEntities, branchLocations, departments, designations, grades] = await Promise.all([
      prisma.legalEntity.findMany({ where: { tenantId: user.tenantId } }),
      prisma.branchLocation.findMany({ where: { tenantId: user.tenantId } }),
      prisma.department.findMany({
        where: { tenantId: user.tenantId },
        include: { _count: { select: { employees: { where: { status: { notIn: ['EXITED', 'ARCHIVED'] } } } } } },
        orderBy: { name: 'asc' },
      }),
      prisma.designation.findMany({ where: { tenantId: user.tenantId }, include: { department: true } }),
      prisma.grade.findMany({ where: { tenantId: user.tenantId } }),
    ]);

    // Head names for display (directory info only)
    const headIds = departments.map((d) => d.headEmployeeId).filter(Boolean) as string[];
    const heads = headIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: headIds }, tenantId: user.tenantId },
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        })
      : [];
    const headById = new Map(heads.map((h) => [h.id, h]));

    return NextResponse.json({
      legalEntities,
      branchLocations,
      departments: departments.map(({ _count, ...d }) => ({
        ...d,
        employeeCount: _count.employees,
        head: d.headEmployeeId ? headById.get(d.headEmployeeId) || null : null,
      })),
      designations,
      grades,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const baseCode = (v: unknown, fallback: string) =>
  String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || fallback;

/** Returns `base`, or `base_2`, `base_3`, ... — the first one not already used in this tenant. */
function uniqueCode(base: string, used: string[]) {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  let code = base;
  for (let n = 2; taken.has(code); n++) code = `${base}_${n}`;
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!can(user, 'org:manage')) {
      return forbidden('Only HR Admin or the company owner can modify the organization structure.');
    }

    const body = await req.json();
    const { type, data } = body;

    let result: any;
    if (type === 'LEGAL_ENTITY') {
      if (!data?.name || !data?.code) {
        return NextResponse.json({ error: 'Company name and code are required.' }, { status: 400 });
      }
      result = await prisma.legalEntity.create({
        data: {
          tenantId: user.tenantId,
          name: String(data.name).trim(),
          code: String(data.code).trim().toUpperCase(),
          pan: data.pan ? String(data.pan).trim().toUpperCase() : null,
          gstin: data.gstin ? String(data.gstin).trim().toUpperCase() : null,
          cin: data.cin ? String(data.cin).trim() : null,
          registeredAddress: data.registeredAddress ? String(data.registeredAddress).trim() : null,
          currency: data.currency || 'INR',
        },
      });
    } else if (type === 'DEPARTMENT') {
      if (!String(data?.name ?? '').trim()) {
        return NextResponse.json({ error: 'Department name is required.' }, { status: 400 });
      }
      const existing = await prisma.department.findMany({ where: { tenantId: user.tenantId } });
      // Same name already exists: reuse it instead of failing / creating a duplicate.
      const same = existing.find((d) => norm(d.name) === norm(data.name));
      if (same) return NextResponse.json(same);
      result = await prisma.department.create({
        data: {
          tenantId: user.tenantId,
          name: String(data.name).trim(),
          code: uniqueCode(baseCode(data.code || data.name, 'DEPT'), existing.map((d) => d.code)),
          parentDepartmentId: data.parentDepartmentId || null,
        },
      });
    } else if (type === 'DESIGNATION') {
      if (!String(data?.title ?? '').trim()) {
        return NextResponse.json({ error: 'Designation title is required.' }, { status: 400 });
      }
      const existing = await prisma.designation.findMany({ where: { tenantId: user.tenantId } });
      const same = existing.find((d) => norm(d.title) === norm(data.title));
      if (same) return NextResponse.json(same);
      result = await prisma.designation.create({
        data: {
          tenantId: user.tenantId,
          title: String(data.title).trim(),
          code: uniqueCode(baseCode(data.code || data.title, 'ROLE'), existing.map((d) => d.code)),
          departmentId: data.departmentId || null,
        },
      });
    } else if (type === 'BRANCH') {
      if (!String(data?.name ?? '').trim() || !data?.legalEntityId) {
        return NextResponse.json({ error: 'Branch name and company are required.' }, { status: 400 });
      }
      const existing = await prisma.branchLocation.findMany({ where: { tenantId: user.tenantId } });
      const same = existing.find((b) => norm(b.name) === norm(data.name));
      if (same) return NextResponse.json(same);
      result = await prisma.branchLocation.create({
        data: {
          tenantId: user.tenantId,
          legalEntityId: data.legalEntityId,
          name: String(data.name).trim(),
          code: uniqueCode(baseCode(data.code || data.city || data.name, 'LOC'), existing.map((b) => b.code)),
          city: String(data.city ?? '').trim() || String(data.name).trim(),
          state: String(data.state ?? '').trim(),
          country: data.country || 'India',
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          geofenceRadiusMeters: data.geofenceRadiusMeters ? parseInt(data.geofenceRadiusMeters) : 200,
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid organization entity type' }, { status: 400 });
    }

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: `CREATE_${type}`,
      entityType: type,
      entityId: result.id,
      afterState: result,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
