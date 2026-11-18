import { prisma } from '../prisma';

/** Documents Indian companies commonly ask new joiners for. HR picks which ones their company needs. */
export const DOCUMENT_CATALOG: { key: string; label: string; hint: string; multiple?: boolean }[] = [
  { key: 'AADHAAR', label: 'Aadhaar Card', hint: 'Front and back, as PDF or a clear photo' },
  { key: 'PAN', label: 'PAN Card', hint: 'Clear scan or photo of your PAN card' },
  { key: 'OFFER_LETTER', label: 'Signed Offer Letter', hint: 'Your offer letter, signed by you' },
  { key: 'BANK_PROOF', label: 'Cancelled Cheque / Bank Passbook', hint: 'For salary credit: cancelled cheque or first page of passbook' },
  { key: 'NDA', label: 'Signed NDA / Confidentiality Agreement', hint: 'The NDA shared by HR, signed by you' },
  { key: 'PHOTO', label: 'Passport-size Photograph', hint: 'Recent photo with a plain background' },
  { key: 'ADDRESS_PROOF', label: 'Address Proof', hint: 'Utility bill, rent agreement or similar' },
  { key: 'EDUCATION', label: 'Educational Certificates', hint: '10th, 12th, degree certificates / mark sheets', multiple: true },
  { key: 'EXPERIENCE_LETTER', label: 'Experience / Relieving Letter', hint: 'From your previous employer(s)', multiple: true },
  { key: 'PAYSLIPS', label: 'Last 3 Months’ Payslips', hint: 'From your previous employer', multiple: true },
  { key: 'FORM16', label: 'Form 16 / Previous Employer Tax Details', hint: 'For income tax calculation this year' },
  { key: 'PF_DETAILS', label: 'PF / UAN Details', hint: 'UAN card or PF nomination form (Form 2)' },
  { key: 'PASSPORT', label: 'Passport', hint: 'First and last page' },
  { key: 'DRIVING_LICENSE', label: 'Driving Licence', hint: 'Front and back' },
  { key: 'RESUME', label: 'Updated Resume', hint: 'Your latest CV' },
  { key: 'MEDICAL', label: 'Medical Fitness Certificate', hint: 'From a registered doctor' },
  { key: 'BACKGROUND_FORM', label: 'Background Verification Form', hint: 'Filled and signed form shared by HR' },
];

export type DocRequirement = { key: string; label: string; hint: string; required: boolean; multiple?: boolean; custom?: boolean };
type StoredItem = { key: string; required: boolean; label?: string; hint?: string; multiple?: boolean };

/** Used until a company chooses its own list (matches the original behaviour). */
const DEFAULT_SELECTION: StoredItem[] = [
  { key: 'AADHAAR', required: true },
  { key: 'PAN', required: true },
  { key: 'OFFER_LETTER', required: true },
];

/** "Other document" is always available as an optional extra upload. */
export const OTHER_DOC: DocRequirement = { key: 'OTHER', label: 'Other Document', hint: 'Anything else HR asked for (optional)', required: false, multiple: true };

function parseSettings(raw: string | null | undefined): any {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** The company's onboarding document list (required + optional), in display order, plus "Other". */
export async function getCompanyDocuments(tenantId: string): Promise<{ docs: DocRequirement[]; configured: boolean }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const stored: StoredItem[] | undefined = parseSettings(tenant?.settings).onboardingDocuments;
  const selection = Array.isArray(stored) ? stored : DEFAULT_SELECTION;
  const docs: DocRequirement[] = [];
  for (const s of selection) {
    const cat = DOCUMENT_CATALOG.find((c) => c.key === s.key);
    if (cat) docs.push({ ...cat, required: !!s.required });
    else if (s.key?.startsWith('CUSTOM_') && s.label) {
      docs.push({ key: s.key, label: s.label, hint: s.hint || '', required: !!s.required, multiple: !!s.multiple, custom: true });
    }
  }
  return { docs: [...docs, OTHER_DOC], configured: Array.isArray(stored) };
}

/** Save the company's list. Unknown catalog keys are ignored; custom ones get a CUSTOM_ key. */
export async function saveCompanyDocuments(tenantId: string, items: StoredItem[]) {
  const clean: StoredItem[] = [];
  const seen = new Set<string>();
  for (const it of items || []) {
    if (!it) continue;
    if (typeof it.key !== 'string') it.key = ''; // custom document sent with just a label
    if (DOCUMENT_CATALOG.some((c) => c.key === it.key)) {
      if (!seen.has(it.key)) clean.push({ key: it.key, required: !!it.required });
      seen.add(it.key);
    } else {
      const label = String(it.label ?? '').trim().slice(0, 80);
      if (!label) continue;
      const key = it.key.startsWith('CUSTOM_')
        ? it.key.replace(/[^A-Z0-9_]/g, '').slice(0, 40)
        : `CUSTOM_${label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)}`;
      if (seen.has(key) || key === 'CUSTOM_') continue;
      seen.add(key);
      clean.push({ key, required: !!it.required, label, hint: String(it.hint ?? '').trim().slice(0, 150), multiple: !!it.multiple });
    }
  }
  if (clean.length > 40) throw new Error('Too many documents (max 40).');
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = parseSettings(tenant?.settings);
  settings.onboardingDocuments = clean;
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: JSON.stringify(settings) } });
  return getCompanyDocuments(tenantId);
}
