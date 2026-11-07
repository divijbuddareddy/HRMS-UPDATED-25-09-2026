import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';
import { can, canCompanyWide, employeeIdFilter, visibleEmployeeIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user-specific notifications from DB
    const dbNotifications = await prisma.notification.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 2. Dynamically gather pending action alerts based on the user's capabilities
    const alerts: Array<{
      id: string;
      title: string;
      message: string;
      type: 'APPROVAL' | 'ALERT' | 'INFO' | 'SUCCESS';
      category: 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'EXPENSE' | 'EXIT' | 'ATS' | 'SYSTEM';
      link: string;
      isRead: boolean;
      createdAt: Date;
    }> = [];

    // DB notifications mapped
    dbNotifications.forEach((n) => {
      alerts.push({
        id: n.id,
        title: n.title,
        message: n.message,
        type: 'INFO',
        category: 'SYSTEM',
        link: n.link || '/dashboard',
        isRead: n.isRead,
        createdAt: n.createdAt,
      });
    });

    // Check for capability-specific pending items
    const notSelf = user.employeeId ? { NOT: { employeeId: user.employeeId } } : {};

    if (can(user, 'leave:approve')) {
      // Pending Leaves
      const pendingLeaves = await prisma.leaveRequest.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'PENDING',
          ...employeeIdFilter(await visibleEmployeeIds(user, 'leave:approve')),
          ...notSelf,
        },
        include: { employee: true, leaveType: true },
        take: 5,
      });

      pendingLeaves.forEach((l) => {
        alerts.push({
          id: `leave-${l.id}`,
          title: 'Pending Leave Request',
          message: `${l.employee.displayName || l.employee.firstName} requested ${l.totalDays} day(s) ${l.leaveType.name}`,
          type: 'APPROVAL',
          category: 'LEAVE',
          link: '/leave',
          isRead: false,
          createdAt: l.createdAt,
        });
      });

    }

    if (can(user, 'attendance:approve')) {
      // Pending Attendance Regularizations
      const pendingRegs = await prisma.attendanceRegularization.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'PENDING',
          ...employeeIdFilter(await visibleEmployeeIds(user, 'attendance:approve')),
          ...notSelf,
        },
        include: { employee: true },
        take: 5,
      });

      pendingRegs.forEach((r) => {
        alerts.push({
          id: `reg-${r.id}`,
          title: 'Attendance Regularization',
          message: `${r.employee.displayName || r.employee.firstName} submitted punch correction for ${new Date(r.requestedDate).toLocaleDateString()}`,
          type: 'APPROVAL',
          category: 'ATTENDANCE',
          link: '/attendance',
          isRead: false,
          createdAt: r.createdAt,
        });
      });

    }

    if (can(user, 'expense:approve')) {
      // Pending Expense Claims
      const pendingExpenses = await prisma.expenseClaim.findMany({
        where: {
          tenantId: user.tenantId,
          status: { in: ['SUBMITTED', 'PENDING_L2'] },
          ...employeeIdFilter(await visibleEmployeeIds(user, 'expense:approve')),
          ...notSelf,
        },
        include: { employee: true, category: true },
        take: 5,
      });

      pendingExpenses.forEach((exp) => {
        alerts.push({
          id: `exp-${exp.id}`,
          title: 'Expense Claim Approval',
          message: `${exp.employee.displayName || exp.employee.firstName} submitted ₹${exp.amount.toLocaleString()} for ${exp.category.name}`,
          type: 'APPROVAL',
          category: 'EXPENSE',
          link: '/expenses',
          isRead: false,
          createdAt: exp.createdAt,
        });
      });

    }

    if (canCompanyWide(user, 'exit:process')) {
      // Pending Exit Requests
      const pendingExits = await prisma.exitRequest.findMany({
        where: { tenantId: user.tenantId, status: { in: ['INITIATED', 'APPROVED', 'CLEARANCE_IN_PROGRESS'] } },
        include: { employee: true },
        take: 5,
      });

      pendingExits.forEach((ex) => {
        alerts.push({
          id: `exit-${ex.id}`,
          title: 'Resignation & Exit Workflow',
          message: `${ex.employee.displayName || ex.employee.firstName} submitted resignation (LWD: ${new Date(ex.requestedLwd || ex.approvedLwd || ex.createdAt).toLocaleDateString()})`,
          type: 'ALERT',
          category: 'EXIT',
          link: '/exit',
          isRead: false,
          createdAt: ex.createdAt,
        });
      });

    }

    if (can(user, 'recruitment:manage')) {
      // Recent Candidate Applications
      const recentCandidates = await prisma.candidate.findMany({
        where: { tenantId: user.tenantId, stage: 'APPLIED' },
        include: { jobRequisition: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      recentCandidates.forEach((c) => {
        alerts.push({
          id: `ats-${c.id}`,
          title: 'New Candidate Applied',
          message: `${c.firstName} ${c.lastName} applied for ${c.jobRequisition?.title || 'Open Role'} (Match: ${c.aiMatchScore || 75}%)`,
          type: 'INFO',
          category: 'ATS',
          link: '/recruitment',
          isRead: false,
          createdAt: c.createdAt,
        });
      });
    }

    // Sort all alerts newest first
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = alerts.filter((a) => !a.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: alerts.slice(0, 15),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { tenantId: user.tenantId, userId: user.userId, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationId && !notificationId.startsWith('leave-') && !notificationId.startsWith('reg-') && !notificationId.startsWith('exp-') && !notificationId.startsWith('exit-') && !notificationId.startsWith('ats-')) {
      // Only the owner of a notification can mark it read.
      await prisma.notification.updateMany({
        where: { id: notificationId, tenantId: user.tenantId, userId: user.userId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
