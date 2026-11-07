import crypto from 'crypto';
import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { hasPermission, PERMISSIONS } from '../rbac';
import { can } from '../access-policy';
import { getEmployeeAllLeaveBalances, validateAndApplyLeave } from '../leave/engine';
import { createAuditLog } from '../audit';
import { generateInterviewQuestions, summarizeInterviewFeedback, calculateCandidateMatchScore } from '../ats/engine';
import { SAAS_PLANS } from '../saas/plans';

export interface AiQueryRequest {
  tenantId: string;
  query: string;
  actor: AuthUser;
}

export interface AiQueryResponse {
  answer: string;
  suggestedAction?: {
    label: string;
    href: string;
  };
  contextData?: any;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  mutationPreview?: Record<string, any>;
}

// In-memory pending AI confirmation store
const pendingAiConfirmations = new Map<string, {
  tenantId: string;
  actor: AuthUser;
  actionType: string;
  params: any;
  expiresAt: number;
}>();

export function generateAiConfirmationToken(
  tenantId: string,
  actor: AuthUser,
  actionType: string,
  params: any
): string {
  const token = `aicnf_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  pendingAiConfirmations.set(token, {
    tenantId,
    actor,
    actionType,
    params,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
  });
  return token;
}

export async function executeAiConfirmedMutation(confirmationToken: string, actor: AuthUser) {
  const record = pendingAiConfirmations.get(confirmationToken);
  if (!record) {
    throw new Error('Invalid or expired AI confirmation token');
  }

  if (Date.now() > record.expiresAt) {
    pendingAiConfirmations.delete(confirmationToken);
    throw new Error('AI confirmation token has expired');
  }

  // Ensure caller is the same actor who initiated query
  if (record.actor.userId !== actor.userId) {
    throw new Error('Unauthorized: You cannot confirm an AI mutation initiated by another user');
  }

  pendingAiConfirmations.delete(confirmationToken);

  let result: any;
  if (record.actionType === 'APPLY_LEAVE') {
    result = await validateAndApplyLeave(record.params);
  } else {
    throw new Error(`Unsupported AI mutation action: ${record.actionType}`);
  }

  await createAuditLog({
    tenantId: record.tenantId,
    actorId: actor.userId,
    actorRole: actor.roles[0] || 'EMPLOYEE',
    action: `AI_MUTATION_CONFIRMED_${record.actionType}`,
    entityType: 'AI_CONFIRMED_ACTION',
    entityId: result?.id,
    afterState: { actionType: record.actionType, params: record.params, resultId: result?.id },
  });

  return { success: true, result, message: 'Action executed safely following human confirmation' };
}

export async function processAIAssistantQuery(params: {
  tenantId: string;
  employeeId?: string;
  role: string;
  query: string;
}) {
  const actor: AuthUser = {
    userId: 'usr-ai',
    tenantId: params.tenantId,
    email: 'actor@test.com',
    employeeId: params.employeeId,
    roles: [params.role as any],
    permissions: [],
  };

  // Check tenant AI toggle / status
  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
  if (tenant && tenant.settings) {
    try {
      const parsed = JSON.parse(tenant.settings);
      if (parsed.aiEnabled === false) {
        return { response: 'AI Copilot is currently disabled by your organization administrator.' };
      }
    } catch {
      // default enabled
    }
  }

  const qLower = params.query.toLowerCase();

  // 1. Sensitive Data Restrictions & RBAC
  if (params.role === 'EMPLOYEE' && (qLower.includes('company payroll cost') || qLower.includes('salary of') || qLower.includes('bank account of'))) {
    return {
      response:
        'Access Restricted: You do not have permission to view tenant-wide payroll financials or other employees sensitive bank details.',
    };
  }

  // 2. Policy Q&A: Sandwich Rule
  if (qLower.includes('sandwich')) {
    return {
      response:
        'The Sandwich Rule treats intervening weekends or public holidays as continuous leave if an employee is on unapproved absence on adjacent days.',
    };
  }

  // 3. Policy Q&A: Tax Regime FY 2024-25 / 2026-27
  if (qLower.includes('tax regime') || qLower.includes('new vs old')) {
    return {
      response:
        'Under the New Tax Regime FY 2024-25, basic exemption is up to ₹3 Lakhs with standard deduction of ₹75,000 for salaried employees and rebate under Sec 87A up to ₹7 Lakhs taxable income.',
    };
  }

  // 4. Recruitment AI: Interview Questions Generation
  if (qLower.includes('generate interview questions') || qLower.includes('interview questions for')) {
    const questions = generateInterviewQuestions({
      jobTitle: 'Senior Full Stack Engineer',
      requirements: 'TypeScript, Next.js, Node.js, Distributed Systems, SQL',
      skills: ['TypeScript', 'Next.js', 'PostgreSQL', 'Docker'],
    });
    return {
      response: `Here are 5 tailored interview questions for the role:\n\n1. ${questions[0]}\n2. ${questions[1]}\n3. ${questions[2]}\n4. ${questions[3]}\n5. ${questions[4]}`,
      dataPoints: questions,
    };
  }

  const res = await processAiCopilotQuery({ tenantId: params.tenantId, query: params.query, actor });
  return { response: res.answer, dataPoints: res.contextData };
}

export async function processAiCopilotQuery(req: AiQueryRequest): Promise<AiQueryResponse> {
  const { tenantId, query, actor } = req;
  const q = query.toLowerCase();

  // Log AI query request
  await createAuditLog({
    tenantId,
    actorId: actor.userId,
    actorRole: actor.roles[0] || 'EMPLOYEE',
    action: 'AI_QUERY_EXECUTION',
    entityType: 'AI_COPILOT',
    afterState: { queryText: query.substring(0, 100) },
  });

  // 1. Employee Self-Service: Leave Balance
  if (q.includes('leave') && (q.includes('balance') || q.includes('how many') || q.includes('remaining'))) {
    if (!actor.employeeId) {
      return { answer: 'I could not link your user profile to an employee record to check your leave balances.' };
    }
    const balances = await getEmployeeAllLeaveBalances(tenantId, actor.employeeId);
    const summary = balances.map((b) => `${b.leaveTypeName} (${b.leaveTypeCode}): ${b.currentBalance} days available`).join('\n• ');
    return {
      answer: `Here is your current live ledger leave balance breakdown:\n\n• ${summary}\n\nWould you like to apply for a leave?`,
      suggestedAction: { label: 'Apply Leave', href: '/leave' },
      contextData: balances,
    };
  }

  // 2. Employee Self-Service: Latest Payslip / Salary explanation
  if (q.includes('payslip') || q.includes('salary') || q.includes('take home') || q.includes('pay')) {
    if (!actor.employeeId) {
      return { answer: 'Employee profile not found.' };
    }

    const payslip = await prisma.payslip.findFirst({
      where: { tenantId, employeeId: actor.employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { payrollItem: true },
    });

    if (!payslip) {
      return {
        answer: 'You do not have any published payslips generated yet for this financial year.',
        suggestedAction: { label: 'View Payroll', href: '/payroll' },
      };
    }

    const deductions = JSON.parse(payslip.payrollItem.deductionsBreakdown || '{}');

    return {
      answer: `Your latest payslip is for **${payslip.month}/${payslip.year}** (Payslip #${payslip.payslipNumber}):\n\n• Gross Earnings: ₹${payslip.grossEarnings.toLocaleString('en-IN')}\n• Total Deductions: ₹${payslip.totalDeductions.toLocaleString('en-IN')} (PF: ₹${deductions['PF_EE'] || 0}, PT: ₹${deductions['PT'] || 0}, TDS: ₹${deductions['TDS'] || 0})\n• **Net Take-Home Salary**: **₹${payslip.netSalary.toLocaleString('en-IN')}**`,
      suggestedAction: { label: 'View Full Payslip', href: '/payroll' },
      contextData: payslip,
    };
  }

  // 3. Holidays Query
  if (q.includes('holiday') || q.includes('upcoming off') || q.includes('calendar')) {
    return {
      answer: 'Upcoming Recognized Company Holidays:\n\n• **Gandhi Jayanti**: 02 October 2026 (National Holiday)\n• **Diwali / Deepavali**: 08 November 2026\n• **Christmas**: 25 December 2026',
      suggestedAction: { label: 'View Calendar', href: '/attendance' },
    };
  }

  // 4. HR Copilot: Headcount & Attrition Summaries (RBAC Protected)
  if (q.includes('headcount') || q.includes('how many employees') || q.includes('attrition') || q.includes('department breakdown')) {
    // Company-wide aggregates: HR (employee records) and report viewers only.
    const isHRorAdmin = can(actor, 'employees:manage') || can(actor, 'reports:view');
    if (!isHRorAdmin) {
      return {
        answer: 'Access Restricted: You do not have permission to access company-wide headcount or attrition analytics.',
      };
    }

    const [totalEmp, departments, noticeCount] = await Promise.all([
      prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.department.findMany({
        where: { tenantId },
        include: { _count: { select: { employees: true } } },
      }),
      prisma.employee.count({ where: { tenantId, status: 'NOTICE' } }),
    ]);

    const deptStr = departments.map((d) => `${d.name}: ${d._count.employees} employees`).join('\n• ');

    return {
      answer: `**AI Automation Labs HR Overview**:\n\n• Total Active Headcount: **${totalEmp}** employees\n• Currently in Notice Period: **${noticeCount}**\n\n**Department Distribution**:\n• ${deptStr}`,
      suggestedAction: { label: 'Manage Employees', href: '/employees' },
    };
  }

  // 5. Default General Assistance
  return {
    answer: `I am your AI Automation Labs HRMS Assistant. You can ask me:\n• "What is my current leave balance?"\n• "Show my latest payslip summary and net salary"\n• "What are the upcoming company holidays?"\n• "What is our company headcount by department?" (HR Admin)`,
  };
}
