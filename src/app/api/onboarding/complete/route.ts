import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { can, canActOnEmployee, forbidden } from '@/lib/access';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Completing onboarding activates the employee and stores PAN / Aadhaar / bank details
    // as verified, so it is an HR action.
    if (!can(user, 'onboarding:manage')) {
      return forbidden('Only HR or the company owner can complete employee onboarding.');
    }

    const body = await req.json();
    const {
      instanceId,
      employeeId,
      personal,
      identity,
      bank,
      emergencyContact,
      documents,
    } = body;

    const instance = instanceId
      ? await prisma.onboardingInstance.findFirst({
          where: { id: instanceId, tenantId: user.tenantId },
          select: { id: true, employeeId: true },
        })
      : null;
    if (instanceId && !instance) {
      return NextResponse.json({ error: 'Onboarding instance not found' }, { status: 404 });
    }
    if (instance && employeeId && instance.employeeId !== employeeId) {
      return NextResponse.json({ error: 'Onboarding instance does not belong to this employee' }, { status: 400 });
    }

    const targetEmployeeId: string | null = employeeId || instance?.employeeId || null;

    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Employee ID or valid Onboarding Instance ID required' }, { status: 400 });
    }

    // Employee must be in the caller's company; HR cannot verify their own onboarding.
    if (!(await canActOnEmployee(user, targetEmployeeId, 'onboarding:manage'))) {
      return forbidden('You cannot complete onboarding for this employee.');
    }

    // Validate PAN & Aadhaar numbers
    if (!identity?.panNumber || !identity?.aadhaarNumber) {
      return NextResponse.json({ error: 'PAN Number and Aadhaar Number are mandatory' }, { status: 400 });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(identity.panNumber.trim().toUpperCase())) {
      return NextResponse.json({ error: 'Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F)' }, { status: 400 });
    }

    const cleanAadhaar = identity.aadhaarNumber.replace(/\s+/g, '');
    if (cleanAadhaar.length !== 12 || isNaN(Number(cleanAadhaar))) {
      return NextResponse.json({ error: 'Invalid Aadhaar format. Must be a 12-digit number' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Employee status from ONBOARDING -> ACTIVE
      const emp = await tx.employee.update({
        where: { id: targetEmployeeId },
        data: {
          status: 'ACTIVE',
          dob: personal?.dob ? new Date(personal.dob) : undefined,
          gender: personal?.gender,
          bloodGroup: personal?.bloodGroup,
          maritalStatus: personal?.maritalStatus,
          personalEmail: personal?.personalEmail,
          mobilePhone: personal?.mobilePhone,
        },
        include: { department: true, designation: true },
      });

      // 2. Upsert Statutory Identity (PAN, Aadhaar, UAN, Passport)
      await tx.employeeIdentity.upsert({
        where: { employeeId: targetEmployeeId },
        update: {
          panNumber: identity.panNumber.trim().toUpperCase(),
          aadhaarNumber: cleanAadhaar,
          uanNumber: identity.uanNumber || undefined,
          passportNumber: identity.passportNumber || undefined,
        },
        create: {
          employeeId: targetEmployeeId,
          panNumber: identity.panNumber.trim().toUpperCase(),
          aadhaarNumber: cleanAadhaar,
          uanNumber: identity.uanNumber || undefined,
          passportNumber: identity.passportNumber || undefined,
        },
      });

      // 3. Upsert Bank Account & Direct Deposit Details
      if (bank?.accountNumber && bank?.ifscCode) {
        await tx.employeeBank.upsert({
          where: { employeeId: targetEmployeeId },
          update: {
            accountHolderName: bank.accountHolderName || `${emp.firstName} ${emp.lastName}`,
            bankName: bank.bankName || 'HDFC Bank',
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode.toUpperCase(),
            branchName: bank.branchName || undefined,
            isVerified: true,
          },
          create: {
            employeeId: targetEmployeeId,
            accountHolderName: bank.accountHolderName || `${emp.firstName} ${emp.lastName}`,
            bankName: bank.bankName || 'HDFC Bank',
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode.toUpperCase(),
            branchName: bank.branchName || undefined,
            isVerified: true,
          },
        });
      }

      // 4. Save Emergency Contact
      if (emergencyContact?.name && emergencyContact?.phone) {
        await tx.employeeEmergencyContact.deleteMany({ where: { employeeId: targetEmployeeId } });
        await tx.employeeEmergencyContact.create({
          data: {
            employeeId: targetEmployeeId,
            name: emergencyContact.name,
            relationship: emergencyContact.relationship || 'Spouse / Parent',
            phone: emergencyContact.phone,
            email: emergencyContact.email || undefined,
          },
        });
      }

      // 5. Update Onboarding Instance Status to COMPLETED
      if (instanceId) {
        await tx.onboardingInstance.update({
          where: { id: instanceId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            completedTasksCount: (await tx.onboardingItem.count({ where: { onboardingInstanceId: instanceId } })),
          },
        });

        await tx.onboardingItem.updateMany({
          where: { onboardingInstanceId: instanceId },
          data: { status: 'VERIFIED', completedAt: new Date() },
        });
      }

      return emp;
    });

    await createAuditLog({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorRole: user.roles[0],
      action: 'COMPLETE_EMPLOYEE_ONBOARDING',
      entityType: 'ONBOARDING',
      entityId: targetEmployeeId,
      afterState: {
        employeeCode: updated.employeeCode,
        status: updated.status,
        pan: identity.panNumber,
        aadhaar: cleanAadhaar,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Onboarding completed! ${updated.firstName} ${updated.lastName} (${updated.employeeCode}) is now officially active in the Employees directory.`,
      employee: updated,
    });
  } catch (error: any) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
