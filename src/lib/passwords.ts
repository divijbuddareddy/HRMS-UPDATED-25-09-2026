import crypto from 'crypto';

// Characters that are easy to read aloud / type (no 0/O, 1/l/I)
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '@#$%&*!';

function pick(set: string): string {
  return set[crypto.randomInt(set.length)];
}

/**
 * Generates a random 12-character temporary password containing
 * at least one uppercase letter, lowercase letter, digit and symbol.
 */
export function generateTempPassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle with crypto randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Returns an error message if the password is too weak, otherwise null. */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 128) return 'Password must be at most 128 characters long.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

/** Roles an administrator may assign to an employee login. PLATFORM_SUPER_ADMIN is never assignable. */
export const ASSIGNABLE_LOGIN_ROLES = [
  'EMPLOYEE',
  'MANAGER',
  'HR_EXECUTIVE',
  'HR_ADMIN',
  'FINANCE',
  'COMPANY_ADMIN',
] as const;

/** Roles that only a Company Admin or Platform Super Admin may grant. */
export const PRIVILEGED_LOGIN_ROLES = ['HR_ADMIN', 'COMPANY_ADMIN'];
