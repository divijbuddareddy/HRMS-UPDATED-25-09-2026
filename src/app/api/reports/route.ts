import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateHrmsReport } from '@/lib/reports/engine';
import { can, forbidden } from '@/lib/access';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!can(user, 'reports:view')) {
    return forbidden('Only HR Admin, Finance or the company owner can view company reports.');
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || 'EMPLOYEE_MASTER') as any;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const departmentId = searchParams.get('departmentId') || undefined;
  const format = searchParams.get('format') || 'json';

  try {
    const report = await generateHrmsReport({
      tenantId: user.tenantId,
      reportType: type,
      startDate,
      endDate,
      departmentId,
      actor: user,
    });

    if (format === 'csv') {
      return new Response(report.csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type.toLowerCase()}_report_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
