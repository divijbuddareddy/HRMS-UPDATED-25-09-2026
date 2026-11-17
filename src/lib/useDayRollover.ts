'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `onNewDay` when the calendar day changes while the page is open (e.g. the tab was
 * left open overnight) and when the user returns to the tab, so Clock In / Clock Out
 * buttons reset for the new day without a manual refresh.
 */
export function useDayRollover(onNewDay: () => void) {
  const cb = useRef(onNewDay);
  cb.current = onNewDay;

  useEffect(() => {
    let day = new Date().toDateString();
    const check = (force: boolean) => {
      const now = new Date().toDateString();
      if (force || now !== day) {
        day = now;
        cb.current();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check(true);
    };
    const timer = window.setInterval(() => check(false), 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
