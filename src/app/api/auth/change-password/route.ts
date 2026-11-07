import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { validatePasswordStrength } from '@/lib/passwords';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json().catch(() => ({}));
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!(await verifyPassword(currentPassword, dbUser.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
    if (await verifyPassword(newPassword, dbUser.passwordHash)) {
      return NextResponse.json({ error: 'New password must be different from the current password.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: user.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
