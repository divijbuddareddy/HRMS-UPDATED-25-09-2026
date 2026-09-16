import { describe, it, expect } from 'vitest';
import { checkRateLimit, resetRateLimitKey } from '../src/lib/security/rate-limiter';
import { defaultMalwareScanner } from '../src/lib/security/virus-scanner';
import { revokeToken, isTokenRevoked, revokeAllUserSessions } from '../src/lib/security/session';
import { maskPAN, maskAadhaar, maskBankAccount, filterSensitiveEmployeeData } from '../src/lib/rbac';
import { AuthUser } from '../src/lib/types';

describe('Security, Rate Limiting, Malware Scanner & Sensitive Masking', () => {
  it('should enforce sliding-window rate limit and block excessive calls', () => {
    const testKey = 'ip:192.168.1.100:login';
    resetRateLimitKey(testKey);

    // Call 3 times with limit of 3
    expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);
    expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);
    expect(checkRateLimit(testKey, 3, 60).allowed).toBe(true);

    // 4th call must be blocked
    const blocked = checkRateLimit(testKey, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });

  it('should detect and reject disallowed executable uploads via malware scanner', async () => {
    const maliciousBuffer = Buffer.from('4d5a90000300000004000000ffff0000', 'hex'); // MZ executable
    const result = await defaultMalwareScanner.scanBuffer(maliciousBuffer, 'payload.exe');

    expect(result.isClean).toBe(false);
    expect(result.threatName).toContain('Disallowed executable file extension');
  });

  it('should approve safe document and image uploads', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.5 test document stream', 'utf-8');
    const result = await defaultMalwareScanner.scanBuffer(pdfBuffer, 'offer_letter.pdf');

    expect(result.isClean).toBe(true);
    expect(result.checksumSha256).toBeDefined();
  });

  it('should track token revocation and session blacklisting', () => {
    const token = 'jwt_token_sample_12345';
    expect(isTokenRevoked(token)).toBe(false);

    revokeToken(token);
    expect(isTokenRevoked(token)).toBe(true);
  });

  it('should correctly mask PAN, Aadhaar, and Bank Account numbers for unauthorized users', () => {
    expect(maskPAN('ABCDE1234F')).toBe('AB******4F');
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX-XXXX-9012');
    expect(maskBankAccount('987654321012')).toBe('XXXXXX1012');

    const rawEmp = {
      id: 'emp-mask-1',
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '123456789012',
      bankAccountNumber: '987654321012',
      ctc: 2400000,
    };

    const regularUser: AuthUser = {
      userId: 'usr-regular',
      tenantId: 't-1',
      email: 'regular@test.com',
      roles: ['EMPLOYEE'],
      permissions: [],
    };

    const masked = filterSensitiveEmployeeData(rawEmp, regularUser, false);
    expect(masked.panNumber).toBe('••••••••••');
    expect(masked.aadhaarNumber).toBe('•••• •••• ••••');
    expect(masked.bankAccountNumber).toBe('••••••••••••');
    expect(masked.ctc).toBe('••••••');
  });
});
