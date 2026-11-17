import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { finalizeAttendance } from '@/lib/attendance/engine';

// Called nightly by a server timer (systemd) to close the previous days' attendance:
// no clock-in / no clock-out on a working day => ABSENT. Protected by CRON_SECRET.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });

  const given = req.headers.get('x-cron-secret') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const daysBack = Math.min(31, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '7', 10) || 7));
  try {
    const result = await finalizeAttendance(daysBack);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
