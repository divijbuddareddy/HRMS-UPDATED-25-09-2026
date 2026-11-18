import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { missingOnboardingDocs } from '@/lib/uploads';

/** The logged-in employee's missing / rejected required onboarding documents (drives the reminder banner). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ missing: [] });
    return NextResponse.json({ missing: await missingOnboardingDocs(user.tenantId, user.employeeId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
