'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield, UserCheck, Menu, KeyRound } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'AI Automation Labs HRMS',
  subtitle,
  onOpenMobileMenu,
}) => {
  const { user, logout, switchRole } = useAuth();

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        {/* Mobile Menu Hamburger Toggle */}
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            aria-label="Open Mobile Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-semibold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden xs:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Role Simulator Selector */}
        {user && user.roles.length > 1 && (
          <div className="flex items-center gap-1.5 bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 text-[11px] sm:text-xs">
            <Shield className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="text-slate-500 font-medium hidden sm:inline">Role:</span>
            <select
              value={user.activeRole}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              {user.roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current Active Role Badge */}
        {user && user.roles.length === 1 && (
          <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
            <span className="truncate max-w-[90px] sm:max-w-none">{user.activeRole.replace(/_/g, ' ')}</span>
          </span>
        )}

        {/* Bell Notification Dropdown */}
        <NotificationBell />

        {/* User Profile info */}
        <div className="flex items-center gap-2 sm:gap-3 pl-1.5 sm:pl-3 border-l border-slate-200">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase shadow-sm shrink-0">
            {user?.employee?.firstName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="text-left hidden lg:block">
            <div className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
              {user?.employee?.displayName || user?.email.split('@')[0]}
            </div>
            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{user?.email}</div>
          </div>

          <a
            href="/change-password"
            title="Change Password"
            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            <KeyRound className="h-4 w-4" />
          </a>

          <button
            onClick={logout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
