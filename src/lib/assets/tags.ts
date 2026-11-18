import { prisma } from '../prisma';

export const ASSET_CATEGORIES = ['LAPTOP', 'DESKTOP', 'MONITOR', 'PHONE', 'ACCESSORY', 'SOFTWARE_LICENSE', 'OTHER'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

const SYNONYMS: Record<string, AssetCategory> = {
  LAPTOP: 'LAPTOP', NOTEBOOK: 'LAPTOP', MACBOOK: 'LAPTOP',
  DESKTOP: 'DESKTOP', PC: 'DESKTOP', CPU: 'DESKTOP', COMPUTER: 'DESKTOP',
  MONITOR: 'MONITOR', SCREEN: 'MONITOR', DISPLAY: 'MONITOR',
  PHONE: 'PHONE', MOBILE: 'PHONE', SMARTPHONE: 'PHONE', TABLET: 'PHONE',
  ACCESSORY: 'ACCESSORY', ACCESSORIES: 'ACCESSORY', MOUSE: 'ACCESSORY', KEYBOARD: 'ACCESSORY', HEADSET: 'ACCESSORY', CHARGER: 'ACCESSORY',
  SOFTWARE: 'SOFTWARE_LICENSE', LICENSE: 'SOFTWARE_LICENSE', LICENCE: 'SOFTWARE_LICENSE', SOFTWARE_LICENSE: 'SOFTWARE_LICENSE',
  OTHER: 'OTHER', OTHERS: 'OTHER',
};

/** "Mobile", "laptop", "Software licence" ... -> a known category ('' -> OTHER). Unknown -> null. */
export function normaliseCategory(v: string): AssetCategory | null {
  const k = v.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!k) return 'OTHER';
  return SYNONYMS[k] || SYNONYMS[k.replace(/_/g, '')] || null;
}

/** Returns a function that hands out the next free AST-0001 style tag (never one already used). */
export async function assetTagAllocator(tenantId: string, alsoUsed: Iterable<string> = []) {
  const existing = await prisma.asset.findMany({ where: { tenantId }, select: { assetTag: true } });
  const used = new Set(existing.map((a) => a.assetTag.toUpperCase()));
  for (const t of alsoUsed) used.add(t.toUpperCase());
  let n = 0;
  for (const t of used) {
    const m = t.match(/^AST-(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  }
  return () => {
    let tag: string;
    do {
      n += 1;
      tag = `AST-${String(n).padStart(4, '0')}`;
    } while (used.has(tag));
    used.add(tag);
    return tag;
  };
}

/** YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. Returns null for empty, undefined for invalid. */
export function parseAssetDate(input: string): Date | null | undefined {
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [y, mo, d] = [+m[3], +m[2], +m[1]];
  else return undefined;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : undefined;
}
