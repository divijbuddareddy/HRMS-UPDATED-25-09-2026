import { jsPDF } from 'jspdf';

export interface OfferLetterPDFData {
  companyName?: string;
  companyAddress?: string;
  referenceNumber?: string;
  issuedDate?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  designation: string;
  department?: string;
  branchLocation?: string;
  offeredCtc: number;
  joiningDate: string;
  probationMonths?: number;
  reportingManager?: string;
  validUntil?: string;
}

export function generateOfferLetterPDF(data: OfferLetterPDFData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Header background banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent bar
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Company Name & Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.companyName || 'AI AUTOMATION LABS', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('OFFICIAL OFFER OF EMPLOYMENT', margin, 20);

  // Reference & Date on header right
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  const refText = `Ref: ${data.referenceNumber || 'HR/OFFER/' + new Date().getFullYear()}`;
  doc.text(refText, pageWidth - margin, 13, { align: 'right' });
  const dateText = `Date: ${data.issuedDate || new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  doc.text(dateText, pageWidth - margin, 20, { align: 'right' });

  // Reset text color for body
  doc.setTextColor(30, 41, 59); // slate-800
  let y = 39;

  // Candidate Address / Salutation block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('To,', margin, y);
  y += 5;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(data.candidateName, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${data.candidateEmail}${data.candidatePhone ? '  |  Phone: ' + data.candidatePhone : ''}`, margin, y);
  y += 8;

  // Subject line
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Subject: Offer of Employment — ${data.designation}`, margin + 3, y + 5.5);
  y += 14;

  // Intro paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const introText = `Dear ${data.candidateName},\n\nOn behalf of ${data.companyName || 'AI Automation Labs'}, we are thrilled to extend an official offer of employment for the position of ${data.designation}. Following our evaluation and interview discussions, we are confident that your expertise, skills, and energy will make a vital contribution to our team.`;
  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, y);
  y += splitIntro.length * 4.5 + 4;

  // Offer Summary Card / Table
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 54, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Summary of Employment Terms', margin + 4, y + 7);

  // Table items
  const terms = [
    { label: 'Position / Designation:', value: data.designation },
    { label: 'Department:', value: data.department || 'Technology & Engineering' },
    { label: 'Work Location / Base:', value: data.branchLocation || 'Headquarters / Hybrid' },
    { label: 'Proposed Joining Date:', value: data.joiningDate },
    { label: 'Annual Total Cost to Company (CTC):', value: `INR ${data.offeredCtc.toLocaleString('en-IN')} / annum (₹${(data.offeredCtc / 100000).toFixed(2)} LPA)` },
    { label: 'Probation Period:', value: `${data.probationMonths || 3} Months from Date of Joining` },
  ];

  let termY = y + 14;
  terms.forEach((t, idx) => {
    // Zebra background
    if (idx % 2 === 1) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin + 1, termY - 3.5, contentWidth - 2, 6, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(t.label, margin + 4, termY);

    doc.setFont('helvetica', idx === 4 ? 'bold' : 'normal');
    doc.setTextColor(idx === 4 ? 16 : 30, idx === 4 ? 149 : 41, idx === 4 ? 85 : 59); // highlight emerald for CTC
    doc.text(t.value, margin + 70, termY);

    termY += 6.5;
  });

  y += 62;

  // Compensation & Benefits section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Compensation Breakdown & Benefits Structure', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const monthlyGross = Math.round(data.offeredCtc / 12);
  const basicSalary = Math.round(monthlyGross * 0.5);
  const hra = Math.round(basicSalary * 0.4);
  const specialAllow = monthlyGross - basicSalary - hra;

  const compText = `Your total annual CTC of INR ${data.offeredCtc.toLocaleString('en-IN')} includes Basic Salary (~₹${(basicSalary * 12).toLocaleString('en-IN')}), House Rent Allowance (~₹${(hra * 12).toLocaleString('en-IN')}), Special Allowances (~₹${(specialAllow * 12).toLocaleString('en-IN')}), Statutory Provident Fund (EPF) and ESI as per statutory regulations. Detailed salary structure and tax deductions will be administered via our digital payroll portal.`;
  const splitComp = doc.splitTextToSize(compText, contentWidth);
  doc.text(splitComp, margin, y);
  y += splitComp.length * 4 + 4;

  // Terms & Acceptance section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Acceptance & Formalities', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const termsText = `This offer is subject to satisfactory verification of your background, academic records, and previous employment credentials. To accept this offer, please sign and return the duplicate copy or accept digitally within 7 business days (${data.validUntil || 'prior to joining'}).`;
  const splitTerms = doc.splitTextToSize(termsText, contentWidth);
  doc.text(splitTerms, margin, y);
  y += splitTerms.length * 4 + 8;

  // Signature Blocks
  const sigBoxY = Math.min(y, 230);
  
  // Left: Authorized HR Signatory
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, sigBoxY + 16, margin + 70, sigBoxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Authorized HR Signatory', margin, sigBoxY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.companyName || 'AI Automation Labs'} — Talent Acquisition`, margin, sigBoxY + 25);

  // Right: Candidate Signature
  const rightSigX = pageWidth - margin - 70;
  doc.line(rightSigX, sigBoxY + 16, rightSigX + 70, sigBoxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Candidate Acceptance (${data.candidateName})`, rightSigX, sigBoxY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Date of Acceptance', rightSigX, sigBoxY + 25);

  // Footer bar
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Strictly Confidential — Generated electronically by AI Automation Labs HRMS Platform', margin, pageHeight - 5);
  doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 5, { align: 'right' });

  return doc;
}
