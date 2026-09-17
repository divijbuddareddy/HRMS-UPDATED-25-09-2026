import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
  const emp1 = await prisma.employee.findFirst({
    where: { workEmail: 'emp1@aiautomationlabs.com' },
    include: { designation: true, department: true },
  });

  if (!tenant || !emp1) {
    console.log('Tenant or Priya Sharma (emp1) not found');
    return;
  }

  // Clean up any existing offer letter for emp1
  await prisma.employeeDocument.deleteMany({
    where: { employeeId: emp1.id },
  });

  const contentHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1e293b; background: #ffffff;">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="color: #0f172a; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">AI AUTOMATION LABS LLP</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0; font-weight: 500;">HR & TALENT ACQUISITION DIVISION</p>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <p style="margin: 0;">Ref: OFF-2026-8842</p>
          <p style="margin: 2px 0 0;">Date: <strong>17 September 2026</strong></p>
        </div>
      </div>

      <div style="margin-bottom: 24px; font-size: 14px; line-height: 1.6;">
        <p style="margin: 0 0 6px 0;">To,</p>
        <p style="margin: 0; font-weight: 700; color: #0f172a; font-size: 16px;">Priya Sharma</p>
        <p style="margin: 0; color: #64748b;">emp1@aiautomationlabs.com</p>
      </div>

      <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 18px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #0369a1; font-weight: 700;">SUBJECT: LETTER OF EMPLOYMENT OFFER</h3>
        <p style="margin: 0; font-size: 13px; color: #334155;">
          We are delighted to extend this formal offer of employment with <strong>AI Automation Labs LLP</strong> for the position of <strong>Senior Software Engineer</strong> in our <strong>Engineering</strong> department.
        </p>
      </div>

      <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">1. Compensation & Key Terms</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <tbody>
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; font-weight: 600; color: #475569; width: 35%;">Designation / Role</td>
            <td style="padding: 12px 16px; font-weight: 700; color: #0f172a;">Senior Software Engineer</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Department</td>
            <td style="padding: 12px 16px; color: #1e293b;">Engineering</td>
          </tr>
          <tr style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0;">
            <td style="padding: 12px 16px; font-weight: 700; color: #065f46;">Annual Fixed CTC</td>
            <td style="padding: 12px 16px; font-weight: 800; color: #047857; font-size: 15px;">INR 15,00,000 per annum</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Proposed Joining Date</td>
            <td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">01 October 2026</td>
          </tr>
          <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; font-weight: 600; color: #475569;">Work Location</td>
            <td style="padding: 12px 16px; color: #1e293b;">Indiranagar HQ, Bengaluru</td>
          </tr>
        </tbody>
      </table>

      <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">2. Special Terms & Benefits</h4>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 28px;">
        Standard probation period of 3 months applies. Comprehensive health insurance coverage of INR 5,00,000 provided from Day 1. Flexible hybrid work policy.
      </div>

      <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 32px;">
        Please indicate your acceptance of this offer by affixing your digital signature through your employee portal.
      </p>

      <div style="display: flex; justify-content: space-between; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
        <div>
          <p style="margin: 0; font-weight: 700; color: #0f172a;">Authorized HR Representative</p>
          <p style="margin: 4px 0 0; color: #64748b;">AI Automation Labs LLP</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: 700; color: #0f172a;">Candidate Acceptance</p>
          <p style="margin: 4px 0 0; color: #64748b;">Pending Electronic Signature</p>
        </div>
      </div>
    </div>
  `;

  const checksum = crypto.createHash('sha256').update(contentHtml).digest('hex');

  const doc = await prisma.employeeDocument.create({
    data: {
      tenantId: tenant.id,
      employeeId: emp1.id,
      title: 'Offer Letter — Priya Sharma',
      contentHtml,
      checksumSha256: checksum,
      status: 'SENT_FOR_SIGNATURE',
    },
  });

  console.log('✅ Demo Offer Letter created successfully:', doc.id, 'for Priya Sharma');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
