import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { forbidden } from '@/lib/access';
import { createAuditLog } from '@/lib/audit';
import { canReviewDocuments } from '@/lib/uploads';
import { DOCUMENT_CATALOG, getCompanyDocuments, saveCompanyDocuments } from '@/lib/onboarding/documents';

/** The company's onboarding document list and the catalog to choose from. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { docs, configured } = await getCompanyDocuments(user.tenantId);
    return NextResponse.json({ catalog: DOCUMENT_CATALOG, documents: docs.filter((d) => d.key !== 'OTHER'), configured });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * HR / owner: choose which documents new joiners must upload.
 * Body: { documents: [{ key, required }] } — catalog keys, plus custom ones as { key?: 'CUSTOM_…', label, hint?, required, multiple? }.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canReviewDocuments(user)) return forbidden('Only HR or the company owner can change onboarding documents.');
    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.documents)) return NextResponse.json({ error: 'documents must be a list' }, { status: 400 });

    const { docs } = await saveCompanyDocuments(user.tenantId, body.documents);
    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'UPDATE_ONBOARDING_DOCUMENTS',
      entityType: 'TENANT_SETTINGS',
      entityId: user.tenantId,
      afterState: { documents: docs.filter((d) => d.key !== 'OTHER').map((d) => `${d.label}${d.required ? '*' : ''}`) },
    });
    return NextResponse.json({ success: true, documents: docs.filter((d) => d.key !== 'OTHER') });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
