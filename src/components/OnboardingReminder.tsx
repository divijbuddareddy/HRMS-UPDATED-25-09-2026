'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Missing = { key: string; label: string; reason: 'MISSING' | 'REJECTED'; note?: string | null };

/**
 * Banner shown on every page to an employee whose required onboarding documents are missing or were
 * rejected. It cannot be dismissed; it disappears by itself once everything is uploaded.
 */
export function OnboardingReminder() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [missing, setMissing] = useState<Missing[]>([]);

  useEffect(() => {
    if (!user?.employee?.id || user.mustChangePassword) return;
    let alive = true;
    const check = () =>
      fetch('/api/onboarding/my-status')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && setMissing(d?.missing || []))
        .catch(() => undefined);
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.employee?.id, pathname]);

  if (!missing.length || pathname === '/my-onboarding') return null;

  const notUploaded = missing.filter((m) => m.reason === 'MISSING');
  const rejected = missing.filter((m) => m.reason === 'REJECTED');

  return (
    <div className="mb-4 p-3.5 rounded-2xl border border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <div className="font-semibold text-sm">Please upload your onboarding documents</div>
          {notUploaded.length > 0 && <div>Missing: {notUploaded.map((m) => m.label).join(', ')}</div>}
          {rejected.length > 0 && (
            <div>
              Rejected by HR — please re-upload: {rejected.map((m) => `${m.label}${m.note ? ` (${m.note})` : ''}`).join(', ')}
            </div>
          )}
        </div>
      </div>
      <Link
        href="/my-onboarding"
        className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5"
      >
        Upload now <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
