import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { recordRawAttendancePunch } from '@/lib/attendance/engine';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { forbidden } from '@/lib/access';
import { isValidCoordinate } from '@/lib/geo';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee profile' }, { status: 400 });
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [todayRecord, rawPunches, shift, me] = await Promise.all([
      prisma.dailyAttendanceRecord.findUnique({
        where: {
          tenantId_employeeId_date: {
            tenantId: user.tenantId,
            employeeId: user.employeeId,
            date: todayStart,
          },
        },
      }),
      prisma.rawAttendancePunch.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId: user.employeeId,
          punchTimestamp: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { punchTimestamp: 'asc' },
      }),
      prisma.shiftPolicy.findFirst({
        where: { tenantId: user.tenantId, isDefault: true },
      }),
      prisma.employee.findFirst({
        where: { id: user.employeeId, tenantId: user.tenantId },
        select: {
          branchLocation: { select: { name: true, latitude: true, longitude: true, geofenceRadiusMeters: true } },
        },
      }),
    ]);

    const hasCheckedIn = rawPunches.some((p) => p.punchType === 'CHECK_IN');
    const hasCheckedOut = rawPunches.some((p) => p.punchType === 'CHECK_OUT');

    return NextResponse.json({
      todayRecord,
      rawPunches,
      shift,
      office: me?.branchLocation || null,
      hasCheckedIn,
      hasCheckedOut,
      nextAction: !hasCheckedIn ? 'CHECK_IN' : !hasCheckedOut ? 'CHECK_OUT' : 'COMPLETED',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.employeeId) {
      return NextResponse.json({ error: 'User is not linked to an employee record' }, { status: 400 });
    }

    const body = await req.json();
    const { punchType, latitude, longitude, accuracy, selfieUrl, deviceType, employeeId: requestedEmployeeId } = body;

    // Self-service only: nobody can punch in/out on behalf of another employee.
    if (requestedEmployeeId && requestedEmployeeId !== user.employeeId) {
      return forbidden('You can only record attendance punches for yourself.');
    }
    const targetEmployeeId = user.employeeId;

    if (!punchType || !['CHECK_IN', 'CHECK_OUT'].includes(punchType)) {
      return NextResponse.json({ error: 'punchType must be CHECK_IN or CHECK_OUT' }, { status: 400 });
    }

    // Enforce the order: one clock-in, then one clock-out, per day.
    const todayPunches = await prisma.rawAttendancePunch.findMany({
      where: {
        tenantId: user.tenantId,
        employeeId: targetEmployeeId,
        punchTimestamp: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      },
      select: { punchType: true },
    });
    const checkedIn = todayPunches.some((p) => p.punchType === 'CHECK_IN');
    const checkedOut = todayPunches.some((p) => p.punchType === 'CHECK_OUT');
    if (punchType === 'CHECK_IN' && checkedIn) {
      return NextResponse.json({ error: 'You have already clocked in today.' }, { status: 409 });
    }
    if (punchType === 'CHECK_OUT' && !checkedIn) {
      return NextResponse.json({ error: 'You have not clocked in today. Please clock in first.' }, { status: 409 });
    }
    if (punchType === 'CHECK_OUT' && checkedOut) {
      return NextResponse.json({ error: 'You have already clocked out today.' }, { status: 409 });
    }

    // Location is mandatory for every self-service punch: no location, no punch (no default coordinates).
    if (!isValidCoordinate(latitude, longitude)) {
      return NextResponse.json(
        {
          error: 'Your location is required to clock in or out. Please allow location access for this site and try again.',
          code: 'LOCATION_REQUIRED',
        },
        { status: 400 },
      );
    }
    const acc = accuracy != null && Number.isFinite(parseFloat(accuracy)) ? Math.max(0, parseFloat(accuracy)) : null;

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined;

    const punch = await recordRawAttendancePunch({
      tenantId: user.tenantId,
      employeeId: targetEmployeeId,
      punchType,
      deviceType: deviceType || 'WEB',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: acc ?? undefined,
      selfieUrl,
      ipAddress: clientIp,
    });

    const emp = await prisma.employee.findFirst({
      where: { id: targetEmployeeId, tenantId: user.tenantId },
      select: { firstName: true, lastName: true, employeeCode: true },
    });

    return NextResponse.json({
      success: true,
      punch,
      employee: emp,
      message: `${punchType === 'CHECK_IN' ? 'Check-in' : 'Check-out'} recorded successfully via ${deviceType || 'WEB'}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
