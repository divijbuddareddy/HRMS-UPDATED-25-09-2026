import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { sendNotification } from '@/lib/notifications/dispatcher';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { tenant: true },
    });

    if (!user) {
      // Return success even if not found to prevent user enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been dispatched.',
      });
    }

    // Invalidate existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true, usedAt: new Date() },
    });

    // Generate single-use secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    await prisma.passwordResetToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash,
        expiresAt,
        isUsed: false,
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: 'USER',
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
      afterState: { email: user.email, expiresAt },
    });

    // Dispatch notification
    await sendNotification({
      tenantId: user.tenantId,
      userId: user.id,
      channel: 'EMAIL',
      templateCode: 'PASSWORD_RESET',
      title: 'Password Reset Request',
      message: `Use your secure single-use token to reset your password. Token expires in 60 minutes.`,
      recipientEmail: user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been dispatched.',
      // In development/test mode, expose raw token for testing
      ...(process.env.NODE_ENV !== 'production' ? { resetToken: rawToken } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
