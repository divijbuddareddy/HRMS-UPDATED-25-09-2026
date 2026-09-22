import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Employee Onboarding Playbook & Task Verification Engine', () => {
  let tenantId: string;
  let employeeId: string;
  let templateId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantId = tenant!.id;
    const emp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: 'EMP-2026-0005' } });
    employeeId = emp!.id;
    const tmpl = await prisma.onboardingTemplate.findFirst({ where: { tenantId } });
    templateId = tmpl!.id;
  });

  it('should verify onboarding templates and sequential task steps', async () => {
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });

    expect(template).toBeDefined();
    expect(template?.title).toBe('Engineering New Hire Playbook');
    expect(template?.tasks.length).toBeGreaterThanOrEqual(3);

    const docTask = template?.tasks.find((t) => t.category === 'DOCUMENT_SUBMISSION');
    expect(docTask?.taskTitle).toContain('Aadhaar');
  });

  it('should instantiate and track progress of an onboarding checklist for a new employee', async () => {
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });

    const instance = await prisma.onboardingInstance.create({
      data: {
        tenantId,
        employeeId,
        onboardingTemplateId: template!.id,
        status: 'IN_PROGRESS',
        totalTasksCount: template!.tasks.length,
        completedTasksCount: 0,
        items: {
          create: template!.tasks.map((task) => ({
            onboardingTaskId: task.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    expect(instance.items.length).toBe(template!.tasks.length);
    expect(instance.status).toBe('IN_PROGRESS');

    // Complete first item
    const firstItem = instance.items[0];
    const updatedItem = await prisma.onboardingItem.update({
      where: { id: firstItem.id },
      data: { status: 'VERIFIED', completedAt: new Date() },
    });

    expect(updatedItem.status).toBe('VERIFIED');
  });

  it('should complete statutory onboarding form with PAN and Aadhaar and activate employee in directory', async () => {
    // 1. Create candidate in onboarding status
    const emp = await prisma.employee.create({
      data: {
        tenantId,
        employeeCode: `EMP-TEST-${Date.now().toString().slice(-4)}`,
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        workEmail: `ananya.test.${Date.now()}@example.com`,
        joiningDate: new Date(),
        status: 'ONBOARDING',
        legalEntityId: (await prisma.legalEntity.findFirst({ where: { tenantId } }))!.id,
        branchLocationId: (await prisma.branchLocation.findFirst({ where: { tenantId } }))!.id,
        departmentId: (await prisma.department.findFirst({ where: { tenantId } }))!.id,
        designationId: (await prisma.designation.findFirst({ where: { tenantId } }))!.id,
      },
    });

    // Ensure it is not active in normal directory query
    const notInDir = await prisma.employee.findFirst({
      where: { id: emp.id, status: { notIn: ['ONBOARDING', 'DRAFT'] } },
    });
    expect(notInDir).toBeNull();

    // 2. Complete Onboarding form with PAN, Aadhaar, Bank Details
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: emp.id },
        data: { status: 'ACTIVE', gender: 'FEMALE', bloodGroup: 'B+' },
      });
      await tx.employeeIdentity.create({
        data: {
          employeeId: emp.id,
          panNumber: 'ABCDE5678F',
          aadhaarNumber: '987654321098',
        },
      });
      await tx.employeeBank.create({
        data: {
          employeeId: emp.id,
          accountHolderName: 'Ananya Deshmukh',
          bankName: 'HDFC Bank',
          accountNumber: '50100987654321',
          ifscCode: 'HDFC0001234',
          isVerified: true,
        },
      });
    });

    // 3. Now verify they are ACTIVE in the Employees directory
    const activated = await prisma.employee.findUnique({
      where: { id: emp.id },
      include: { identity: true, bank: true },
    });

    expect(activated?.status).toBe('ACTIVE');
    expect(activated?.identity?.panNumber).toBe('ABCDE5678F');
    expect(activated?.identity?.aadhaarNumber).toBe('987654321098');
    expect(activated?.bank?.isVerified).toBe(true);
  });
});
