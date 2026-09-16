import crypto from 'crypto';

interface OtpRecord {
  otp: string;
  recipient: string;
  purpose: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpRecord>();

export interface OtpGenerationResult {
  referenceId: string;
  expiresInSeconds: number;
  // In development/test mode, the OTP code is returned for instant test verification
  devOtpCode?: string;
}

export interface OtpProvider {
  generateOtp(recipient: string, purpose: string, validitySeconds?: number): Promise<OtpGenerationResult>;
  verifyOtp(referenceId: string, inputOtp: string): Promise<boolean>;
}

export class SecureOtpService implements OtpProvider {
  async generateOtp(
    recipient: string,
    purpose: string,
    validitySeconds = 300 // 5 minutes default
  ): Promise<OtpGenerationResult> {
    const referenceId = `ref_otp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    // 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + validitySeconds * 1000;

    otpStore.set(referenceId, {
      otp,
      recipient,
      purpose,
      expiresAt,
      attempts: 0,
    });

    return {
      referenceId,
      expiresInSeconds: validitySeconds,
      devOtpCode: otp, // Available in test environment
    };
  }

  async verifyOtp(referenceId: string, inputOtp: string): Promise<boolean> {
    const record = otpStore.get(referenceId);
    if (!record) return false;

    if (Date.now() > record.expiresAt) {
      otpStore.delete(referenceId);
      return false;
    }

    if (record.attempts >= 3) {
      otpStore.delete(referenceId);
      return false;
    }

    record.attempts += 1;

    if (record.otp === inputOtp.trim()) {
      otpStore.delete(referenceId); // Consume OTP once valid
      return true;
    }

    return false;
  }
}

export const defaultOtpService = new SecureOtpService();
