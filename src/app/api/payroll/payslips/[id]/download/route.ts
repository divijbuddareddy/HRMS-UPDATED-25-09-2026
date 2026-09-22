import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { generatePayslipPDF } from "@/lib/payroll/payslip-pdf";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const payslip = await prisma.payslip.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        payrollItem: true,
        employee: {
          include: {
            legalEntity: true,
            branchLocation: true,
            department: true,
            designation: true,
            bank: true,
            identity: true,
          },
        },
      },
    });

    if (!payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    if (payslip.employeeId !== user.employeeId && !hasPermission(user, PERMISSIONS.PAYROLL_READ)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const earningsBreakdown = JSON.parse(payslip.payrollItem?.earningsBreakdown || "{}");
    const deductionsBreakdown = JSON.parse(payslip.payrollItem?.deductionsBreakdown || "{}");

    const pdfDoc = generatePayslipPDF({
      companyName: payslip.employee.legalEntity?.name || "AI AUTOMATION LABS LLP",
      companyAddress: payslip.employee.branchLocation ? `${payslip.employee.branchLocation.city}, ${payslip.employee.branchLocation.state}, ${payslip.employee.branchLocation.country}` : "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
      companyTaxInfo: `PAN: ${payslip.employee.legalEntity?.pan || "AAACA1234F"} | GSTIN: ${payslip.employee.legalEntity?.gstin || "29AAACA1234F1Z5"} | CIN: ${payslip.employee.legalEntity?.cin || "U72200KA2024PTC188899"}`,
      payslipNumber: payslip.payslipNumber,
      month: payslip.month,
      year: payslip.year,
      employee: {
        firstName: payslip.employee.firstName,
        lastName: payslip.employee.lastName,
        employeeCode: payslip.employee.employeeCode,
        designation: payslip.employee.designation?.title,
        department: payslip.employee.department?.name,
        dateOfJoining: payslip.employee.joiningDate ? new Date(payslip.employee.joiningDate).toLocaleDateString("en-IN") : undefined,
        bankName: payslip.employee.bank?.bankName || "HDFC Bank",
        accountNumber: payslip.employee.bank?.accountNumber ? `XXXXXX${payslip.employee.bank.accountNumber.slice(-4)}` : "XXXXXX4321",
        ifscCode: payslip.employee.bank?.ifscCode || "HDFC0001234",
        panNumber: payslip.employee.identity?.panNumber || "ABCDE1234F",
        uanNumber: payslip.employee.identity?.uanNumber || "101234567890",
        taxRegime: payslip.payrollItem?.taxRegime || "NEW",
      },
      payableDays: payslip.payableDays,
      lopDays: payslip.payrollItem?.unpaidLopDays || 0,
      earningsBreakdown,
      deductionsBreakdown,
      grossEarnings: payslip.grossEarnings,
      totalDeductions: payslip.totalDeductions,
      netSalary: payslip.netSalary,
    });

    const pdfArrayBuffer = pdfDoc.output("arraybuffer");
    const monthStr = String(payslip.month).padStart(2, "0");
    const filename = `Payslip_${payslip.employee.employeeCode}_${monthStr}_${payslip.year}.pdf`;

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfArrayBuffer.byteLength),
      },
    });
  } catch (error: any) {
    console.error("Payslip PDF download error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
