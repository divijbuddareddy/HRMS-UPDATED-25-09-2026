import { NextRequest } from 'next/server';
import { authenticateV1Request, jsonResponse, errorResponse, requireIntegrationAccess } from '@/lib/api/v1-auth';
import { generateHrmsReport } from '@/lib/reports/engine';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  const denied = requireIntegrationAccess(auth);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as any;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const departmentId = searchParams.get('departmentId') || undefined;
  const format = searchParams.get('format') || 'json';

  if (!type) {
    return errorResponse(
      'Missing report type. Supported types: EMPLOYEE_MASTER, ATTENDANCE_SUMMARY, LEAVE_LEDGER, PAYROLL_STATUTORY, ATS_PIPELINE, PERFORMANCE_APPRAISALS, EXPENSE_CLAIMS, ASSET_INVENTORY',
      400,
      'VALIDATION_ERROR'
    );
  }

  try {
    const report = await generateHrmsReport({
      tenantId: auth.user.tenantId,
      reportType: type,
      startDate,
      endDate,
      departmentId,
      actor: auth.user,
    });

    if (format === 'csv') {
      return new Response(report.csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type.toLowerCase()}_report.csv"`,
        },
      });
    }

    return jsonResponse(report);
  } catch (e: any) {
    return errorResponse(e.message, 500, 'REPORT_GENERATION_FAILED');
  }
}
