import crypto from 'crypto';
import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';
import { format } from 'date-fns';

export function interpolateMergeTags(templateHtml: string, context: Record<string, any>): string {
  let result = templateHtml;
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

export function computeDocumentSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export const generateDocumentFromTemplate = (template: string, data: Record<string, any>) =>
  interpolateMergeTags(template, data);

export async function generateEmployeeDocument(params: {
  tenantId: string;
  employeeId: string;
  templateCode?: string;
  title?: string;
  contentHtml?: string;
  documentPdfUrl?: string;
  customData?: Record<string, any>;
  actor: AuthUser;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: {
      legalEntity: true,
      branchLocation: true,
      department: true,
      designation: true,
      salaryAssignments: { where: { isCurrent: true } },
    },
  });

  if (!employee) throw new Error('Employee not found');

  const templateCode = params.templateCode || 'OFFER_LETTER';
  let template = await prisma.documentTemplate.findFirst({
    where: {
      tenantId: params.tenantId,
      code: templateCode,
      isActive: true,
    },
    orderBy: { version: 'desc' },
  });

  if (!template && !params.contentHtml) {
    // Create default offer/appointment template
    template = await prisma.documentTemplate.create({
      data: {
        tenantId: params.tenantId,
        title: 'Employment Offer & Appointment Letter',
        code: templateCode,
        contentHtml: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b;">
            <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px; letter-spacing: 0.05em;">{{company.name}}</h1>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">OFFICIAL LETTER OF EMPLOYMENT OFFER</p>
            </div>

            <p style="font-size: 14px; margin-bottom: 16px;">Date: <strong>{{issuedDate}}</strong></p>
            <p style="font-size: 14px; margin-bottom: 16px;">Dear <strong>{{employee.name}}</strong>,</p>

            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              On behalf of <strong>{{company.name}}</strong>, we are pleased to offer you the position of <strong>{{designation}}</strong> in our <strong>{{department}}</strong> department at our <strong>{{branch.city}}</strong> office.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tbody>
                <tr style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold; width: 35%;">Designation</td>
                  <td style="padding: 10px;">{{designation}}</td>
                </tr>
                <tr style="border: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold;">Department</td>
                  <td style="padding: 10px;">{{department}}</td>
                </tr>
                <tr style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold;">Total Annual CTC</td>
                  <td style="padding: 10px; color: #047857; font-weight: bold; font-size: 14px;">INR {{salary.ctc}} per annum</td>
                </tr>
                <tr style="border: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold;">Proposed Joining Date</td>
                  <td style="padding: 10px;">{{joiningDate}}</td>
                </tr>
                <tr style="background-color: #f8fafc; border: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: bold;">Work Location</td>
                  <td style="padding: 10px;">{{branch.city}}</td>
                </tr>
              </tbody>
            </table>

            <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
              Please review the terms of this offer. By applying your electronic signature below, you confirm your acceptance of this offer of employment and agree to commence your duties on the stated joining date.
            </p>

            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              <p style="margin: 0;">Authorized HR Signatory: <strong>HR Department, {{company.name}}</strong></p>
            </div>
          </div>
        `,
        version: 1,
      },
    });
  }

  const currentCtc = params.customData?.ctc 
    ? Number(params.customData.ctc) 
    : (employee.salaryAssignments[0]?.ctc || 1200000);

  const joiningDateFormatted = params.customData?.joiningDate 
    ? format(new Date(params.customData.joiningDate), 'dd MMMM yyyy')
    : format(new Date(employee.joiningDate), 'dd MMMM yyyy');

  const context = {
    'employee.name': employee.displayName,
    'employee.code': employee.employeeCode,
    'employee.email': employee.workEmail,
    'designation': params.customData?.designation || employee.designation?.title || 'Engineer',
    'department': params.customData?.department || employee.department?.name || 'Engineering',
    'branch.city': employee.branchLocation?.city || 'Bengaluru',
    'company.name': employee.legalEntity?.name || 'AI Automation Labs LLP',
    'salary.ctc': currentCtc.toLocaleString('en-IN'),
    'joiningDate': joiningDateFormatted,
    'issuedDate': format(new Date(), 'dd MMMM yyyy'),
    ...(params.customData || {}),
  };

  let finalContentHtml = params.contentHtml;
  if (!finalContentHtml) {
    const templateHtml = template?.contentHtml || '';
    finalContentHtml = interpolateMergeTags(templateHtml, context);
  } else {
    finalContentHtml = interpolateMergeTags(finalContentHtml, context);
  }

  const contentToHash = params.documentPdfUrl 
    ? `${finalContentHtml}:${params.documentPdfUrl.substring(0, 200)}` 
    : finalContentHtml;

  const checksum = crypto.createHash('sha256').update(contentToHash).digest('hex');

  const defaultTitle = template?.title 
    ? `${template.title} — ${employee.displayName}` 
    : `Offer Letter — ${employee.displayName}`;

  const doc = await prisma.employeeDocument.create({
    data: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      documentTemplateId: template?.id || null,
      title: params.title || defaultTitle,
      contentHtml: finalContentHtml,
      documentPdfUrl: params.documentPdfUrl || null,
      checksumSha256: checksum,
      status: 'SENT_FOR_SIGNATURE',
    },
    include: {
      employee: {
        include: {
          department: true,
          designation: true,
          branchLocation: true,
          legalEntity: true,
        },
      },
      signature: { include: { signer: true } },
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0],
    action: 'GENERATE_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: doc.id,
    afterState: { id: doc.id, title: doc.title, checksum },
  });

  return doc;
}

export async function signEmployeeDocument(params: {
  tenantId: string;
  documentId: string;
  signerEmployeeId: string;
  signatureDataUrl: string;
  ipAddress?: string;
  actor: AuthUser;
}) {
  const doc = await prisma.employeeDocument.findUnique({
    where: { id: params.documentId },
    include: { employee: true },
  });

  if (!doc) throw new Error('Document not found');
  if (doc.status === 'SIGNED') throw new Error('Document is already signed');

  // Verify valid signer employee id in DB, fallback to doc.employeeId
  let validSignerId = params.signerEmployeeId;
  const signerExists = await prisma.employee.findUnique({
    where: { id: validSignerId },
  });

  if (!signerExists) {
    validSignerId = doc.employeeId;
  }

  const signatureHash = crypto
    .createHash('sha256')
    .update(`${doc.checksumSha256}:${validSignerId}:${Date.now()}`)
    .digest('hex');

  const signed = await prisma.$transaction(async (tx) => {
    await tx.documentSignature.create({
      data: {
        employeeDocumentId: doc.id,
        signerId: validSignerId,
        signerIpAddress: params.ipAddress || '127.0.0.1',
        signatureDataUrl: params.signatureDataUrl,
        signatureHash,
      },
    });

    return tx.employeeDocument.update({
      where: { id: doc.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
          },
        },
        signature: {
          include: {
            signer: true,
          },
        },
      },
    });
  });

  await createAuditLog({
    tenantId: params.tenantId,
    actorId: params.actor.userId,
    actorRole: params.actor.roles[0] || 'SIGNER',
    action: 'DIGITALLY_SIGN_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: doc.id,
    afterState: { status: 'SIGNED', signatureHash, signerId: validSignerId },
  });

  return signed;
}
