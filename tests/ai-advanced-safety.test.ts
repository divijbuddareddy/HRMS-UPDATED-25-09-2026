import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  generateAiConfirmationToken,
  executeAiConfirmedMutation,
  processAIAssistantQuery,
} from '../src/lib/ai/gateway';
import { AuthUser } from '../src/lib/types';

describe('AI Gateway: Advanced Capabilities, Safety, Confirmation Tokens & Policy Q&A', () => {
  let tenantId: string;
  let employeeId: string;
  let leaveTypeId: string;
  const testActor: AuthUser = {
    userId: 'u-ai-tester',
    tenantId: 'temp',
    email: 'ai-tester@test.com',
    roles: ['EMPLOYEE'],
    permissions: [{ permissionKey: 'leave:apply', dataScope: 'OWN', isSensitive: false }],
  };

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'ai-automation-labs' } });
    if (tenant) {
      tenantId = tenant.id;
      testActor.tenantId = tenant.id;
    }

    const emp = await prisma.employee.findFirst({ where: { tenantId } });
    if (emp) {
      employeeId = emp.id;
      testActor.employeeId = emp.id;
    }

    const lt = await prisma.leaveType.findFirst({ where: { tenantId, code: 'CL' } });
    if (lt) leaveTypeId = lt.id;
  });

  it('should answer Policy Q&A queries (Sandwich rule, Tax regime)', async () => {
    const sandwichRes = await processAIAssistantQuery({
      tenantId,
      role: 'EMPLOYEE',
      query: 'What is the sandwich rule for leaves?',
    });
    expect(sandwichRes.response).toContain('Sandwich Rule');

    const taxRes = await processAIAssistantQuery({
      tenantId,
      role: 'EMPLOYEE',
      query: 'Explain the new tax regime exemptions',
    });
    expect(taxRes.response).toContain('New Tax Regime');
  });

  it('should generate recruitment interview questions tailored to tech roles', async () => {
    const qRes = await processAIAssistantQuery({
      tenantId,
      role: 'HR_ADMIN',
      query: 'Generate interview questions for Senior Full Stack Engineer',
    });
    expect(qRes.response).toContain('interview questions');
    expect(qRes.dataPoints?.length).toBeGreaterThan(0);
  });

  it('should enforce human confirmation tokens before executing database mutations', async () => {
    // Pick Monday of a future week to guarantee a valid working day
    const testDate = new Date('2027-11-15T09:00:00Z'); // 15 Nov 2027 is a Monday
    // Delete any previous test leave request for this test date
    await prisma.leaveRequest.deleteMany({
      where: {
        tenantId,
        employeeId,
        startDate: testDate,
      },
    });

    const token = generateAiConfirmationToken(tenantId, testActor, 'APPLY_LEAVE', {
      tenantId,
      employeeId,
      leaveTypeId,
      startDate: testDate,
      endDate: testDate,
      reason: 'AI confirmed casual leave test',
    });

    expect(token).toContain('aicnf_');

    // Executing with unauthorized actor should fail
    const otherActor: AuthUser = {
      userId: 'u-other-intruder',
      tenantId,
      email: 'intruder@test.com',
      roles: ['EMPLOYEE'],
      permissions: [],
    };

    await expect(executeAiConfirmedMutation(token, otherActor)).rejects.toThrow(/Unauthorized/);

    // Executing with original actor should succeed safely
    const execution = await executeAiConfirmedMutation(token, testActor);
    expect(execution.success).toBe(true);
    expect(execution.result?.status).toBe('PENDING');
  });

  it('should restrict employee access to tenant-wide payroll cost data', async () => {
    const restrictedRes = await processAIAssistantQuery({
      tenantId,
      role: 'EMPLOYEE',
      query: 'Show me total company payroll cost and salary details',
    });
    expect(restrictedRes.response).toContain('Access Restricted');
  });
});
