import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { canViewEmployee, forbidden } from '@/lib/access';
import { getEmployeeAllLeaveBalances } from '@/lib/leave/engine';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId') || user.employeeId;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (!(await canViewEmployee(user, employeeId, 'leave:approve'))) {
      return forbidden('You can only view leave balances of yourself or your team.');
    }

    const balances = await getEmployeeAllLeaveBalances(user.tenantId, employeeId);
    return NextResponse.json({ balances });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
