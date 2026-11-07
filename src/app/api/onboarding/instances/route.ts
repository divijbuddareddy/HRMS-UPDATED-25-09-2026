import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initializeEmployeeOnboarding } from '@/lib/onboarding/engine';
import { canActOnEmployee, can, employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    // HR / owner see every onboarding; everyone else only their own checklist.
    const visibleIds = await visibleEmployeeIds(user, 'onboarding:manage');
    if (employeeId && visibleIds !== null && !visibleIds.includes(employeeId)) {
      return forbidden('You can only view your own onboarding checklist.');
    }

    const instances = await prisma.onboardingInstance.findMany({
      where: {
        tenantId: user.tenantId,
        ...(employeeId ? { employeeId } : employeeIdFilter(visibleIds)),
      },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branchLocation: true,
            identity: true,
            bank: true,
            emergencyContacts: true,
          },
        },
        template: true,
        items: {
          include: { task: true },
          orderBy: { task: { sortOrder: 'asc' } },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({ instances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { employeeId, templateId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (!can(user, 'onboarding:manage')) {
      return forbidden('Only HR or the company owner can start onboarding for an employee.');
    }
    if (!(await canActOnEmployee(user, employeeId, 'onboarding:manage', { allowSelf: true }))) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const instance = await initializeEmployeeOnboarding({
      tenantId: user.tenantId,
      employeeId,
      templateId,
    });

    return NextResponse.json({ success: true, instance }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
