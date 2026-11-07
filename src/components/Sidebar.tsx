'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  Banknote,
  History,
  Building2,
  Sparkles,
  UserPlus2,
  CheckSquare,
  FileSignature,
  Target,
  Receipt,
  Laptop,
  LogOut,
  Crown,
  Layers,
  Key,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const isCompanyAdmin = user?.roles.includes('COMPANY_ADMIN') || user?.roles.includes('PLATFORM_SUPER_ADMIN');
  const isHR = isCompanyAdmin || user?.roles.includes('HR_ADMIN') || user?.roles.includes('HR_EXECUTIVE');
  const isFinance = isCompanyAdmin || user?.roles.includes('FINANCE');
  const isManager = isCompanyAdmin || user?.roles.includes('MANAGER');

  const coreNav = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Employees', href: '/employees', icon: Users },
    { label: 'Attendance', href: '/attendance', icon: Clock },
    { label: 'Leave Ledger', href: '/leave', icon: CalendarCheck },
    { label: 'Payroll & Tax', href: '/payroll', icon: Banknote },
  ];

  const lifecycleNav = [
    { label: 'Recruitment (ATS)', href: '/recruitment', icon: UserPlus2 },
    { label: 'Careers Portal', href: '/careers', icon: Sparkles },
    { label: 'Onboarding', href: '/onboarding', icon: CheckSquare },
    { label: 'Documents & E-Sign', href: '/documents', icon: FileSignature },
    { label: 'Performance & OKRs', href: '/performance', icon: Target },
    { label: 'Expenses', href: '/expenses', icon: Receipt },
    { label: 'Assets', href: '/assets', icon: Laptop },
    { label: 'Exit & Settlement', href: '/exit', icon: LogOut },
  ];

  const platformNav = [
    { label: 'Reports & Analytics', href: '/reports', icon: Layers },
    ...(isHR || isFinance || isCompanyAdmin
      ? [{ label: 'Audit Trail', href: '/audit', icon: History }]
      : []),
    ...(isCompanyAdmin ? [{ label: 'AI Configuration', href: '/settings/ai', icon: Key }] : []),
    ...(user?.roles.includes('PLATFORM_SUPER_ADMIN')
      ? [{ label: 'Companies (Super Admin)', href: '/super-admin', icon: Crown }]
      : []),
  ];

  // Proactively prefetch all routes into Next.js cache on mount
  useEffect(() => {
    const allRoutes = [...coreNav, ...lifecycleNav, ...platformNav];
    allRoutes.forEach((item) => {
      try {
        router.prefetch(item.href);
      } catch {
        // ignore
      }
    });
  }, [router, isCompanyAdmin, isHR, isFinance]);

  // Reset navigating state when pathname changes
  useEffect(() => {
    setNavigatingTo(null);
    if (onCloseMobile) {
      onCloseMobile();
    }
  }, [pathname]);

  const handleNavClick = (href: string) => {
    if (pathname !== href) {
      setNavigatingTo(href);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavItem = (item: { label: string; href: string; icon: any }) => {
    const isSelected = navigatingTo ? navigatingTo === item.href : pathname === item.href;
    const isPending = navigatingTo === item.href && pathname !== item.href;
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        onMouseEnter={() => {
          try {
            router.prefetch(item.href);
          } catch {}
        }}
        onClick={() => handleNavClick(item.href)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all duration-100 active:scale-[0.97] select-none ${
          isSelected
            ? 'bg-emerald-600 text-white shadow-sm font-semibold'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 transition-transform duration-100 ${isSelected ? 'text-white scale-105' : 'text-slate-400'}`} />
          <span>{item.label}</span>
        </div>
        {isPending && (
          <div className="w-3.5 h-3.5 border-2 border-white/80 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              AI Automation Labs
            </div>
            <div className="text-[11px] text-emerald-400 font-medium">Enterprise HRMS SaaS</div>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close Navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto text-xs">
        {/* Core HR */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Core HR & Payroll
          </div>
          <div className="space-y-0.5">
            {coreNav.map(renderNavItem)}
          </div>
        </div>

        {/* Full Lifecycle */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Talent & Operations
          </div>
          <div className="space-y-0.5">
            {lifecycleNav.map(renderNavItem)}
          </div>
        </div>

        {/* Governance & SaaS */}
        {platformNav.length > 0 && (
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Governance & Admin
            </div>
            <div className="space-y-0.5">
              {platformNav.map(renderNavItem)}
            </div>
          </div>
        )}
      </div>

      {/* Tenant Indicator Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
          <Building2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="truncate font-medium text-slate-200">
            {user?.tenantName || 'AI Automation Labs'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Tenant: <span className="font-mono text-slate-400">{user?.tenantSlug || 'ai-automation-labs'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-64 flex-col h-screen sticky top-0 shrink-0 border-r border-slate-800 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
