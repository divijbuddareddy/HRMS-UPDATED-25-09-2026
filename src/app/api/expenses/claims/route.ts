import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { submitExpenseClaim } from '@/lib/expenses/engine';
import { employeeIdFilter, forbidden, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view'); // 'mine' or 'team'

    let where: any = { tenantId: user.tenantId };
    if (view === 'mine') {
      where.employeeId = user.employeeId || '__none__';
    } else {
      // Self for employees, self + direct reports for managers, everyone for FINANCE / owner.
      Object.assign(where, employeeIdFilter(await visibleEmployeeIds(user, 'expense:approve')));
    }

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        employee: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ claims });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    const body = await req.json();
    // Claims can only be submitted for yourself.
    if (body.employeeId && body.employeeId !== user.employeeId) {
      return forbidden('You can only submit expense claims for yourself.');
    }
    if (!body.expenseCategoryId) {
      return NextResponse.json({ error: 'expenseCategoryId is required' }, { status: 400 });
    }
    const category = await prisma.expenseCategory.findFirst({
      where: { id: body.expenseCategoryId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: 'Expense category not found' }, { status: 400 });
    }

    const claim = await submitExpenseClaim({
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      expenseCategoryId: body.expenseCategoryId,
      claimDate: new Date(body.claimDate),
      amount: parseFloat(body.amount),
      description: body.description,
      receiptUrl: body.receiptUrl,
      costCenter: body.costCenter,
      paymentMethod: body.paymentMethod,
    });

    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
