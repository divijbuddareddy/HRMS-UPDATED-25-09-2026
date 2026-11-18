import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can, forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { STANDARD_DEPARTMENTS } from '@/lib/org/departments';

/**
 * Update a department: { name?, headEmployeeId? ('' clears) , applyHeadToTeam? (default true) }.
 * Setting a head makes them the Reporting Manager of everyone in the department who has no manager yet
 * (people who already report to someone keep their manager).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'org:manage')) return forbidden('Only HR Admin or the company owner can change departments.');

    const dept = await prisma.department.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Department name cannot be empty.' }, { status: 400 });
      const clash = await prisma.department.findFirst({
        where: { tenantId: user.tenantId, NOT: { id }, name: { equals: name } },
        select: { id: true },
      });
      if (clash) return NextResponse.json({ error: `A department called “${name}” already exists.` }, { status: 409 });
      data.name = name.slice(0, 100);
    }

    let newHead: string | null | undefined;
    if (body.headEmployeeId !== undefined) {
      newHead = body.headEmployeeId || null;
      if (newHead) {
        const head = await prisma.employee.findFirst({
          where: { id: newHead, tenantId: user.tenantId, status: { notIn: ['EXITED', 'ARCHIVED'] } },
          select: { id: true },
        });
        if (!head) return NextResponse.json({ error: 'Department head not found.' }, { status: 400 });
      }
      data.headEmployeeId = newHead;
    }

    let assigned = 0;
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.department.update({ where: { id }, data });
      if (newHead && body.applyHeadToTeam !== false) {
        const r = await tx.employee.updateMany({
          where: {
            tenantId: user.tenantId,
            departmentId: id,
            reportingManagerId: null,
            NOT: { id: newHead },
            status: { notIn: ['EXITED', 'ARCHIVED'] },
          },
          data: { reportingManagerId: newHead },
        });
        assigned = r.count;
      }
      return d;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: id,
      beforeState: { name: dept.name, headEmployeeId: dept.headEmployeeId },
      afterState: { name: updated.name, headEmployeeId: updated.headEmployeeId, reportingAssigned: assigned },
    });

    return NextResponse.json({ success: true, department: updated, reportingAssigned: assigned });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Delete an empty department (no employees, designations or job openings). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(user, 'org:manage')) return forbidden('Only HR Admin or the company owner can change departments.');

    const dept = await prisma.department.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { _count: { select: { employees: true, designations: true, jobRequisitions: true } } },
    });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    if (STANDARD_DEPARTMENTS.some((d) => d.code === dept.code.toUpperCase())) {
      return NextResponse.json({ error: 'Standard departments can be renamed but not deleted.' }, { status: 400 });
    }
    if (dept._count.employees || dept._count.designations || dept._count.jobRequisitions) {
      return NextResponse.json(
        { error: 'This department is in use (employees, designations or job openings). Move them first.' },
        { status: 409 },
      );
    }
    await prisma.department.delete({ where: { id } });
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'DELETE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: id,
      beforeState: { name: dept.name, code: dept.code },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
