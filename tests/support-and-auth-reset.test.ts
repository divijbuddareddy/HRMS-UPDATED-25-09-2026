import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('Master Spec — Support Tickets & Password Reset Single-Use Tokens', () => {
  let tenantId: string;
  let testUser: any;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'ai-automation-labs' } });
    if (!tenant) throw new Error('AI Automation Labs tenant must exist');
    tenantId = tenant.id;

    testUser = await prisma.user.findFirst({ where: { tenantId } });
    if (!testUser) throw new Error('Test user must exist');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create and retrieve customer support tickets with unique ticketCode', async () => {
    const ticketCount = await prisma.supportTicket.count({ where: { tenantId } });
    const ticketCode = `TCK-TEST-${Date.now().toString().slice(-4)}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        userId: testUser.id,
        ticketCode,
        subject: 'Payroll tax slab inquiry for FY26-27',
        description: 'Need clarification on Section 87A rebate calculation',
        category: 'PAYROLL',
        priority: 'MEDIUM',
        status: 'OPEN',
      },
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.ticketCode).toBe(ticketCode);
    expect(ticket.status).toBe('OPEN');

    const fetched = await prisma.supportTicket.findUnique({
      where: { tenantId_ticketCode: { tenantId, ticketCode } },
    });
    expect(fetched?.subject).toBe('Payroll tax slab inquiry for FY26-27');
  });

  it('should generate single-use password reset tokens and invalidate them upon use', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    const resetTokenRecord = await prisma.passwordResetToken.create({
      data: {
        tenantId,
        userId: testUser.id,
        tokenHash,
        expiresAt,
        isUsed: false,
      },
    });

    expect(resetTokenRecord.isUsed).toBe(false);

    // Simulate password reset
    const newPassword = 'NewSecretPassword@2026';
    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: testUser.id },
        data: { passwordHash: newHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: { isUsed: true, usedAt: new Date() },
      }),
    ]);

    const updatedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    expect(updatedToken?.isUsed).toBe(true);
    expect(updatedToken?.usedAt).toBeDefined();

    // Verify user password hash changed and verifies
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    const isValid = await bcrypt.compare(newPassword, updatedUser!.passwordHash);
    expect(isValid).toBe(true);

    // Reset back to standard password for test predictability
    const standardHash = await bcrypt.hash('Password@123', 10);
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordHash: standardHash },
    });
  });
});
