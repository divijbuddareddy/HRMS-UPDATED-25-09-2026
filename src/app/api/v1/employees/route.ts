import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateV1Request, jsonResponse, errorResponse } from '@/lib/api/v1-auth';
import { filterSensitiveEmployeeData } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized: Invalid API key or Bearer token', 401, 'UNAUTHORIZED');

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const departmentId = searchParams.get('departmentId') || undefined;
  const status = searchParams.get('status') || undefined;

  const where = {
    tenantId: auth.user.tenantId,
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        department: true,
        designation: true,
        branchLocation: true,
        identity: true,
        bank: true,
        salaryAssignments: { where: { isCurrent: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const sanitized = employees.map((emp) =>
    filterSensitiveEmployeeData(
      {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        workEmail: emp.workEmail,
        mobilePhone: emp.mobilePhone,
        joiningDate: emp.joiningDate,
        status: emp.status,
        department: emp.department?.name,
        designation: emp.designation?.title,
        branchLocation: emp.branchLocation?.name,
        panNumber: emp.identity?.panNumber,
        aadhaarNumber: emp.identity?.aadhaarNumber,
        bankAccountNumber: emp.bank?.accountNumber,
        ctc: emp.salaryAssignments[0]?.ctc,
      },
      auth.user,
      false
    )
  );

  return jsonResponse({
    employees: sanitized,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateV1Request(req);
  if (!auth) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      workEmail,
      joiningDate,
      departmentId,
      designationId,
      branchLocationId,
      legalEntityId,
    } = body;

    if (!firstName || !lastName || !workEmail || !departmentId || !designationId || !branchLocationId || !legalEntityId) {
      return errorResponse('Missing required employee fields', 400, 'VALIDATION_ERROR');
    }

    const count = await prisma.employee.count({ where: { tenantId: auth.user.tenantId } });
    const employeeCode = `EMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        tenantId: auth.user.tenantId,
        employeeCode,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        workEmail: workEmail.toLowerCase().trim(),
        joiningDate: new Date(joiningDate || new Date()),
        departmentId,
        designationId,
        branchLocationId,
        legalEntityId,
        status: 'ACTIVE',
      },
    });

    await createAuditLog({
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      actorRole: auth.user.roles[0] || 'API',
      action: 'V1_CREATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      afterState: employee,
    });

    return jsonResponse(employee, 201);
  } catch (e: any) {
    return errorResponse(e.message, 500, 'INTERNAL_SERVER_ERROR');
  }
}
