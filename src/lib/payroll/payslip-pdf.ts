import { jsPDF } from "jspdf";

export interface PayslipPDFData {
  companyName?: string;
  companyAddress?: string;
  companyTaxInfo?: string;
  payslipNumber?: string;
  month: number;
  year: number;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation?: string;
    department?: string;
    dateOfJoining?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    panNumber?: string;
    uanNumber?: string;
    taxRegime?: string;
  };
  payableDays: number;
  lopDays?: number;
  totalDaysInMonth?: number;
  earningsBreakdown: Record<string, number>;
  deductionsBreakdown: Record<string, number>;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function numberToWordsINR(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  }

  let amount = Math.floor(num);
  let crore = Math.floor(amount / 10000000);
  amount %= 10000000;
  let lakh = Math.floor(amount / 100000);
  amount %= 100000;
  let thousand = Math.floor(amount / 1000);
  amount %= 1000;
  let remainder = amount;

  let res = "";
  if (crore) res += inWords(crore) + " Crore ";
  if (lakh) res += inWords(lakh) + " Lakh ";
  if (thousand) res += inWords(thousand) + " Thousand ";
  if (remainder) res += inWords(remainder);

  return (res.trim() + " Rupees Only").replace(/\s+/g, " ");
}

export function generatePayslipPDF(data: PayslipPDFData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // 1. Header Banner Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, "F");

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.companyName || "AI AUTOMATION LABS LLP", margin + 6, y + 8);

  // Company Address / Tax
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    data.companyAddress || "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
    margin + 6,
    y + 14
  );
  doc.text(
    data.companyTaxInfo || "PAN: AAACA1234F | GSTIN: 29AAACA1234F1Z5 | TAN: BLRA12345B",
    margin + 6,
    y + 20
  );

  // Payslip Badge
  const monthName = MONTH_NAMES[(data.month - 1) % 12] || "Month";
  const titleText = `PAYSLIP - ${monthName.toUpperCase()} ${data.year}`;
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - margin - 60, y + 4, 54, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(56, 189, 248); // cyan-400
  doc.text(titleText, pageWidth - margin - 33, y + 11, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const slipNo = data.payslipNumber || `PS-${data.year}${String(data.month).padStart(2, "0")}-${data.employee.employeeCode}`;
  doc.text(slipNo, pageWidth - margin - 33, y + 17, { align: "center" });

  y += 31;

  // 2. Employee & Employment Details Section
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 36, 2, 2, "FD");

  doc.setFontSize(8.5);
  const col1 = margin + 4;
  const col2 = margin + 45;
  const col3 = margin + contentWidth / 2 + 4;
  const col4 = margin + contentWidth / 2 + 45;

  const drawRow = (label1: string, val1: string, label2: string, val2: string, rowY: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(label1, col1, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(val1 || "—", col2, rowY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(label2, col3, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(val2 || "—", col4, rowY);
  };

  const fullName = `${data.employee.firstName} ${data.employee.lastName}`;
  drawRow("Employee Name:", fullName, "Payable Days:", `${data.payableDays} Days`, y + 7);
  drawRow("Employee Code:", data.employee.employeeCode, "Bank Name:", data.employee.bankName || "HDFC Bank", y + 13.5);
  drawRow("Designation:", data.employee.designation || "Engineer", "Account Number:", data.employee.accountNumber || "XXXXXX4321", y + 20);
  drawRow("Department:", data.employee.department || "Engineering", "IFSC / Tax Regime:", `${data.employee.ifscCode || "HDFC0001234"} / ${data.employee.taxRegime || "NEW"}`, y + 26.5);
  drawRow("Date of Joining:", data.employee.dateOfJoining || "01-Apr-2024", "PAN / UAN:", `${data.employee.panNumber || "ABCDE1234F"} / ${data.employee.uanNumber || "101234567890"}`, y + 33);

  y += 42;

  // 3. Earnings & Deductions Tables
  const tableWidth = (contentWidth - 6) / 2;
  const earningsX = margin;
  const deductionsX = margin + tableWidth + 6;

  // Table Headers
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);

  // Earnings Header
  doc.roundedRect(earningsX, y, tableWidth, 8, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("EARNINGS", earningsX + 4, y + 5.5);
  doc.text("AMOUNT (INR)", earningsX + tableWidth - 4, y + 5.5, { align: "right" });

  // Deductions Header
  doc.roundedRect(deductionsX, y, tableWidth, 8, 1, 1, "FD");
  doc.text("DEDUCTIONS", deductionsX + 4, y + 5.5);
  doc.text("AMOUNT (INR)", deductionsX + tableWidth - 4, y + 5.5, { align: "right" });

  y += 10;
  const startTableY = y;

  const earningsEntries = Object.entries(data.earningsBreakdown || {});
  const deductionsEntries = Object.entries(data.deductionsBreakdown || {});
  const maxRows = Math.max(earningsEntries.length, deductionsEntries.length, 5);
  const rowHeight = 6.5;

  for (let i = 0; i < maxRows; i++) {
    const rowY = startTableY + i * rowHeight;

    // Draw alternate background
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(earningsX, rowY - 4, tableWidth, rowHeight, "F");
      doc.rect(deductionsX, rowY - 4, tableWidth, rowHeight, "F");
    }

    // Earnings item
    if (i < earningsEntries.length) {
      const [k, v] = earningsEntries[i];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(k.replace(/_/g, " "), earningsX + 4, rowY);
      doc.text(`INR ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, earningsX + tableWidth - 4, rowY, { align: "right" });
    }

    // Deductions item
    if (i < deductionsEntries.length) {
      const [k, v] = deductionsEntries[i];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(k.replace(/_/g, " "), deductionsX + 4, rowY);
      doc.text(`INR ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, deductionsX + tableWidth - 4, rowY, { align: "right" });
    }
  }

  y = startTableY + maxRows * rowHeight + 2;

  // Table Totals
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);

  // Gross Earnings Footer
  doc.roundedRect(earningsX, y, tableWidth, 8, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Gross Earnings", earningsX + 4, y + 5.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`INR ${Number(data.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, earningsX + tableWidth - 4, y + 5.5, { align: "right" });

  // Total Deductions Footer
  doc.roundedRect(deductionsX, y, tableWidth, 8, 1, 1, "FD");
  doc.setTextColor(15, 23, 42);
  doc.text("Total Deductions", deductionsX + 4, y + 5.5);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`INR ${Number(data.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, deductionsX + tableWidth - 4, y + 5.5, { align: "right" });

  y += 14;

  // 4. Net Salary Callout Banner
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("NET TAKE-HOME SALARY:", margin + 6, y + 8);

  doc.setFontSize(13);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(`INR ${Number(data.netSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, margin + 62, y + 8.5);

  // Amount in Words
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Amount in Words: ${numberToWordsINR(data.netSalary)}`, margin + 6, y + 15);

  y += 26;

  // 5. Statutory & Employer Note
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("STATUTORY & TAX COMPLIANCE SUMMARY:", margin + 4, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const pfContribution = data.deductionsBreakdown["PF_EE"] || 0;
  const ptContribution = data.deductionsBreakdown["PT"] || 0;
  const tdsContribution = data.deductionsBreakdown["TDS"] || 0;
  doc.text(
    `EPF Deducted: INR ${pfContribution.toLocaleString("en-IN")} | Professional Tax (PT): INR ${ptContribution.toLocaleString("en-IN")} | TDS / Income Tax: INR ${tdsContribution.toLocaleString("en-IN")}`,
    margin + 4,
    y + 11
  );

  y += 22;

  // 6. Sign-off & System Generation Seal
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, margin + contentWidth, y);
  doc.setLineDashPattern([], 0);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a computer-generated salary document and does not require a physical signature.", margin, y);
  doc.text("Generated by AI Automation Labs HRMS Enterprise Engine", margin + contentWidth, y, { align: "right" });

  return doc;
}

export function downloadPayslipPDF(data: PayslipPDFData) {
  const doc = generatePayslipPDF(data);
  const monthStr = String(data.month).padStart(2, "0");
  const fileName = `Payslip_${data.employee.employeeCode}_${monthStr}_${data.year}.pdf`;
  doc.save(fileName);
}
