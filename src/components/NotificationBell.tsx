'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Calendar,
  Clock,
  Receipt,
  UserCheck,
  AlertTriangle,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'APPROVAL' | 'ALERT' | 'INFO' | 'SUCCESS';
  category: 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'EXPENSE' | 'EXIT' | 'ATS' | 'SYSTEM';
  link: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPROVALS' | 'ALERTS'>('ALL');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchNotifications();
      }
    }, 60000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    setIsOpen(false);
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: item.id }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    router.push(item.link);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'LEAVE':
        return <Calendar className="h-4 w-4 text-sky-600" />;
      case 'ATTENDANCE':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'EXPENSE':
        return <Receipt className="h-4 w-4 text-emerald-600" />;
      case 'ATS':
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      case 'EXIT':
        return <AlertTriangle className="h-4 w-4 text-rose-600" />;
      default:
        return <Info className="h-4 w-4 text-slate-600" />;
    }
  };

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'LEAVE':
        return 'bg-sky-50 border-sky-100';
      case 'ATTENDANCE':
        return 'bg-amber-50 border-amber-100';
      case 'EXPENSE':
        return 'bg-emerald-50 border-emerald-100';
      case 'ATS':
        return 'bg-indigo-50 border-indigo-100';
      case 'EXIT':
        return 'bg-rose-50 border-rose-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'APPROVALS') return n.type === 'APPROVAL';
    if (activeTab === 'ALERTS') return n.type === 'ALERT' || n.category === 'EXIT';
    return true;
  });

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diff = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diff < 1) return 'Just now';
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        title="Notifications & Alerts"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
          </>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                <p className="text-[11px] text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline px-2 py-1 rounded-lg hover:bg-emerald-50/50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-3 pt-2.5 pb-1 bg-white border-b border-slate-100 flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('APPROVALS')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'APPROVALS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Approvals
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALERTS')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'ALERTS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Alerts
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors group relative ${
                    !item.isRead ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${getCategoryBg(
                      item.category
                    )}`}
                  >
                    {getCategoryIcon(item.category)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {!item.isRead && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 absolute right-3 top-4 shrink-0" />
                  )}

                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors absolute right-2 bottom-3.5 opacity-0 group-hover:opacity-100" />
                </div>
              ))
            ) : (
              <div className="py-12 px-6 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-slate-700">No notifications here</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You are completely up to date on all pending tasks.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push('/dashboard');
              }}
              className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              Go to HR Command Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
