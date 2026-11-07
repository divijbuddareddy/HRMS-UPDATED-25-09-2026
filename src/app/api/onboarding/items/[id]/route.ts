import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateOnboardingItemStatus } from '@/lib/onboarding/engine';
import { can, forbidden } from '@/lib/access';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { status, evidenceUrl, notes } = body;

    const item = await prisma.onboardingItem.findFirst({
      where: { id, instance: { tenantId: user.tenantId } },
      select: { id: true, instance: { select: { employeeId: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Onboarding item not found' }, { status: 404 });
    }

    if (!can(user, 'onboarding:manage')) {
      // A new joiner may submit evidence for their OWN checklist items; completing /
      // verifying items (which can activate the employee) is reserved for HR.
      const isOwnItem = !!user.employeeId && item.instance.employeeId === user.employeeId;
      if (!isOwnItem) {
        return forbidden('You can only update items on your own onboarding checklist.');
      }
      if (status !== 'SUBMITTED') {
        return forbidden('You can submit your own onboarding items; HR completes and verifies them.');
      }
    }

    const result = await updateOnboardingItemStatus({
      tenantId: user.tenantId,
      itemId: id,
      status: status || 'COMPLETED',
      evidenceUrl,
      notes,
      actor: user,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
