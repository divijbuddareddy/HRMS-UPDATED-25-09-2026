import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { AuthUser } from './types';
import { canCompanyWide } from './access-policy';
import { prisma } from './prisma';
import { getCompanyDocuments } from './onboarding/documents';

/** Where uploaded files live. Kept outside the app folder so deploys never touch them. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/** Is this a document type the company asks for (or "Other")? */
export async function companyDocType(tenantId: string, key: unknown) {
  if (typeof key !== 'string') return null;
  const { docs } = await getCompanyDocuments(tenantId);
  return docs.find((d) => d.key === key) || null;
}

/** Detect the real file type from its first bytes (never trust the browser's claim). */
export function sniffFileType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png' };
  return null;
}

/**
 * Performance documents may also be Office files (OKR sheets, review templates).
 * .xlsx / .docx / .pptx are ZIP containers, so we check the ZIP signature plus the extension.
 */
const OFFICE_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function sniffPerformanceFile(buf: Buffer, fileName: string): { mime: string; ext: string } | null {
  const basic = sniffFileType(buf);
  if (basic) return basic;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip && OFFICE_TYPES[ext]) return { mime: OFFICE_TYPES[ext], ext };
  return null;
}

/** HR / owner (company-wide) may see and review every employee's documents. */
export function canReviewDocuments(user: AuthUser): boolean {
  return canCompanyWide(user, 'onboarding:manage') || canCompanyWide(user, 'employees:manage');
}

export function canAccessEmployeeDocs(user: AuthUser, employeeId: string): boolean {
  return (!!user.employeeId && user.employeeId === employeeId) || canReviewDocuments(user);
}

export async function saveUpload(tenantId: string, employeeId: string, buf: Buffer, ext: string) {
  const storageKey = path.posix.join(tenantId, employeeId, `${crypto.randomUUID()}.${ext}`);
  const full = resolveKey(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o750 });
  await fs.writeFile(full, buf, { mode: 0o640 });
  return { storageKey, checksum: crypto.createHash('sha256').update(buf).digest('hex') };
}

export async function readUpload(storageKey: string) {
  return fs.readFile(resolveKey(storageKey));
}

export async function deleteUpload(storageKey: string) {
  await fs.unlink(resolveKey(storageKey)).catch(() => undefined);
}

function resolveKey(storageKey: string) {
  const root = path.resolve(UPLOAD_DIR);
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
  return full;
}

/** A filename that's safe to show and to put in a Content-Disposition header. */
export function cleanFileName(name: string, ext: string) {
  const base = (name || 'document').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9 _.-]+/g, '_').trim().slice(0, 80) || 'document';
  return `${base}.${ext}`;
}

/**
 * Required onboarding documents the employee still has to (re)upload: never uploaded, or the latest
 * upload was rejected by HR. Empty when everything required is uploaded (verified or awaiting HR).
 */
export async function missingOnboardingDocs(tenantId: string, employeeId: string) {
  const { docs } = await getCompanyDocuments(tenantId);
  const required = docs.filter((d) => d.required);
  if (!required.length) return [];
  const uploads = await prisma.employeeUpload.findMany({
    where: { tenantId, employeeId, docType: { in: required.map((d) => d.key) } },
    select: { docType: true, status: true, reviewNote: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const result: { key: string; label: string; reason: 'MISSING' | 'REJECTED'; note?: string | null }[] = [];
  for (const t of required) {
    const mine = uploads.filter((u) => u.docType === t.key);
    // For multi-file documents it is enough to have one file that is not rejected
    const ok = mine.some((u) => u.status !== 'REJECTED');
    if (!mine.length) result.push({ key: t.key, label: t.label, reason: 'MISSING' });
    else if (!ok) result.push({ key: t.key, label: t.label, reason: 'REJECTED', note: mine[0].reviewNote });
  }
  return result;
}
