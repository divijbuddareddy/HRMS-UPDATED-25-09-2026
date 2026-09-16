'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export const TopProgressBar: React.FC = () => {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When pathname changes, complete progress
    setLoading(false);
  }, [pathname]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none transition-all duration-200 ${
        loading ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 animate-pulse shadow-sm shadow-emerald-500/50" />
    </div>
  );
};
