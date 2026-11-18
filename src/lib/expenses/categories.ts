import { prisma } from '../prisma';

/** The company's expense categories, in the order they appear in the dropdown. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'TRAVEL', name: 'Travel' },
  { code: 'STATIONERY', name: 'Stationery' },
  { code: 'FOOD', name: 'Food' },
  { code: 'COMPANY_OUTING', name: 'Company Outing' },
  { code: 'ELECTRONIC_EQUIPMENT', name: 'Electronic Equipment' },
] as const;

const ORDER: string[] = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.code);

/** Creates any missing standard category for the company (safe to call on every request). */
export async function ensureDefaultExpenseCategories(tenantId: string) {
  const existing = await prisma.expenseCategory.findMany({ where: { tenantId }, select: { code: true } });
  const have = new Set(existing.map((c) => c.code));
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    if (have.has(c.code)) continue;
    try {
      await prisma.expenseCategory.create({
        data: { tenantId, code: c.code, name: c.name, maxLimit: null, requiresReceipt: false },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // created by a concurrent request
    }
  }
}

/** Standard categories first (in the order above), then any custom ones alphabetically. */
export function sortExpenseCategories<T extends { code: string; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ia = ORDER.indexOf(a.code);
    const ib = ORDER.indexOf(b.code);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.name.localeCompare(b.name);
  });
}
