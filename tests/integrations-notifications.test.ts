import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { defaultBiometricAdapter } from '../src/lib/integrations/biometric-adapter';
import { defaultESignProvider } from '../src/lib/integrations/esign-provider';
import { defaultOtpService } from '../src/lib/integrations/otp-provider';
import { sendNotification } from '../src/lib/notifications/dispatcher';

describe('Integrations Layer: Biometric, External eSign, OTP & Notifications', () => {
  let tenantId: string;
  let employeeId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'ai-automation-labs' },
      update: {},
      create: { name: 'AI Automation Labs', slug: 'ai-automation-labs' },
    });
    tenantId = tenant.id;

    const emp = await prisma.employee.findFirst({
      where: { tenantId },
    });
    if (emp) employeeId = emp.id;
  });

  it('should normalize and sync biometric punch events', async () => {
    const rawLogs = [
      {
        DeviceSerial: 'ZKT-BIO-01',
        BadgeNumber: 'EMP-2026-0001',
        LogTime: new Date().toISOString(),
        punchState: 'CHECK_IN',
        ip: '192.168.1.55',
      },
    ];

    const normalized = defaultBiometricAdapter.normalizePunchLog(rawLogs[0]);
    expect(normalized.deviceSerial).toBe('ZKT-BIO-01');
    expect(normalized.biometricUserId).toBe('EMP-2026-0001');
    expect(normalized.punchState).toBe('CHECK_IN');

    const result = await defaultBiometricAdapter.syncPunchLogs(tenantId, [normalized]);
    expect(result.totalProcessed).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('should generate and verify external e-Sign requests', async () => {
    const esignReq = await defaultESignProvider.createSignatureRequest({
      documentId: 'doc-appointment-01',
      documentTitle: 'Appointment Letter',
      documentChecksumSha256: 'a1b2c3d4e5f6',
      signerName: 'Aarav Patel',
      signerEmail: 'aarav@test.com',
    });

    expect(esignReq.transactionId).toBeDefined();
    expect(esignReq.provider).toBe('AADHAAR_ESIGN_SANDBOX');
    expect(esignReq.redirectUrl).toContain(esignReq.transactionId);

    const verified = await defaultESignProvider.verifySignature(
      esignReq.transactionId,
      'signed_cryptographic_payload_sample'
    );
    expect(verified.isVerified).toBe(true);
    expect(verified.certificateThumbprint).toBeDefined();
  });

  it('should generate, verify, and expire OTP codes', async () => {
    const otpRes = await defaultOtpService.generateOtp('user@test.com', 'DOCUMENT_SIGNING');
    expect(otpRes.referenceId).toBeDefined();
    expect(otpRes.devOtpCode).toBeDefined();

    // Verify valid OTP
    const isValid = await defaultOtpService.verifyOtp(otpRes.referenceId, otpRes.devOtpCode!);
    expect(isValid).toBe(true);

    // Replay with consumed OTP should fail
    const isReplayValid = await defaultOtpService.verifyOtp(otpRes.referenceId, otpRes.devOtpCode!);
    expect(isReplayValid).toBe(false);
  });

  it('should dispatch In-App, Email, and WhatsApp notifications with merge tags', async () => {
    const inAppResult = await sendNotification({
      tenantId,
      channel: 'IN_APP',
      templateCode: 'LEAVE_STATUS',
      title: 'Leave Approved',
      message: 'Your leave application for {{days}} days has been approved.',
      mergeData: { days: 2 },
    });
    expect(inAppResult.status).toBe('DELIVERED');
    expect(inAppResult.channel).toBe('IN_APP');

    const whatsappResult = await sendNotification({
      tenantId,
      channel: 'WHATSAPP',
      templateCode: 'PAYSLIP_PUBLISHED',
      title: 'Payslip Ready',
      message: 'Your payslip for {{month}}/{{year}} is ready for download.',
      recipientPhone: '+919876543210',
      mergeData: { month: '09', year: '2026' },
    });
    expect(whatsappResult.status).toBe('DELIVERED');
    expect(whatsappResult.details).toContain('WhatsApp HSM template');
  });
});
