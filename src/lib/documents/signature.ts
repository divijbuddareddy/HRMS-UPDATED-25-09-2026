import { prisma } from '../prisma';

/** Max size of a signature image (as a data URL string). PNG signatures are typically 5–60 KB. */
const MAX_DATA_URL_LENGTH = 700_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const SIGN_METHODS = ['DRAW', 'TYPE', 'UPLOAD'] as const;

/** A signature must be a real PNG image (the browser converts drawn / typed / uploaded ones to PNG). */
export function validateSignatureImage(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl) return 'Please provide your signature.';
  if (dataUrl.length > MAX_DATA_URL_LENGTH) return 'Signature image is too large.';
  const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return 'Signature must be a PNG image.';
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 100 || !buf.subarray(0, 8).equals(PNG_MAGIC)) return 'Signature image is not valid.';
  return null;
}

export async function getAdoptedSignature(employeeId: string) {
  return prisma.adoptedSignature.findUnique({ where: { employeeId } });
}

export async function adoptSignature(tenantId: string, employeeId: string, signatureDataUrl: string, method: string) {
  const m = (SIGN_METHODS as readonly string[]).includes(method) ? method : 'DRAW';
  return prisma.adoptedSignature.upsert({
    where: { employeeId },
    create: { tenantId, employeeId, signatureDataUrl, method: m },
    update: { signatureDataUrl, method: m },
  });
}
