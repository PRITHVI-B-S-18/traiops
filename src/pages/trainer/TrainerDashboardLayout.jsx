import React, { useState, useMemo, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, LogOut, Menu, X, History, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  cardStyles,
  cardPadding,
  layoutBackground,
  getChipClasses
} from '@/styles/designSystem';
import { getUserTimezone } from '@/utils/timezoneUtils';

const defaultCommandState = {
  title: 'Trainer Portal',
  description: 'View your schedule and clock history.',
  actions: null,
  metrics: null,
};

const TrainerDashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse state
  const [commandState, setCommandState] = useState(defaultCommandState);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  const resetCommandState = useCallback(() => setCommandState(defaultCommandState), []);

  const handleLogout = async () => {
    try {
      await logout();
    navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = [
    { path: '/trainer/home', label: 'Home', icon: Home },
    { path: '/trainer/schedule', label: 'Overall Schedules', icon: CalendarDays },
    { path: '/trainer/history', label: 'Clock History', icon: History },
  ];

  const isActive = (path) => location.pathname === path;

  const sidebarWidthClass = useMemo(() => (sidebarCollapsed ? 'lg:w-20' : 'lg:w-56'), [sidebarCollapsed]);

  return (
    <div className={cn('relative flex h-screen w-full overflow-hidden', layoutBackground)}>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarWidthClass
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-slate-900">Trainer Portal</h1>
              <p className="text-xs text-slate-500">Welcome back!</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 lg:inline-flex"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {sidebarOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
            ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
          </Link>
              );
            })}
          </div>
        </nav>

        {/* User info + logout */}
        <div className="border-t border-slate-200 p-4">
          {!sidebarCollapsed && user && (
            <div className={cn(cardStyles.subtle, 'px-3 py-2')}>
              <div className="flex items-center gap-2">
                <span className={cn(getChipClasses('muted'), 'text-[11px] uppercase')}>
                  Logged in as
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {user.displayName ? (
                  <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
                ) : null}
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
          )}

           <button 
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className={cn('flex flex-1 flex-col min-h-0 min-w-0', sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-56')}>
        {/* Mobile top bar */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* <span className="text-sm font-semibold text-slate-700">Trainer Portal</span> */}
          {/* <div className="flex max-w-[55%] flex-col items-end">
            <span className="max-w-full truncate text-xs font-medium text-slate-700">
              {user?.displayName || user?.email || 'Trainer'}
            </span>
            {user?.displayName && user?.email ? (
              <span className="max-w-full truncate text-[11px] text-slate-500">{user.email}</span>
            ) : null}
          </div> */}
        </header>

        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="mx-auto h-full w-full max-w-6xl px-4 py-6 sm:px-5">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-semibold text-slate-900">{commandState.title}</h1>
                      {commandState.metrics && (
                        <button
                          onClick={() => setMetricsExpanded(!metricsExpanded)}
                          className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 flex-shrink-0"
                          aria-label={metricsExpanded ? 'Hide metrics' : 'Show metrics'}
                          aria-expanded={metricsExpanded}
                        >
                          {metricsExpanded ? (
                            <ChevronUp className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-5 w-5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                    {commandState.description && (
                      <p className="text-sm text-slate-500 mt-1">{commandState.description}</p>
                    )}
                    {/* <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-400">Timezone:</span>
                      <span className="text-xs font-medium text-slate-600">{getUserTimezone()}</span>
                    </div> */}
                  </div>
                </div>
                {commandState.actions && (
                  <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0 sm:ml-4">{commandState.actions}</div>
                )}
              </div>
              {commandState.metrics && metricsExpanded && (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4 transition-opacity duration-300 ease-in-out">
                  {commandState.metrics}
                </div>
              )}
              <Outlet context={{ sidebarOpen: !sidebarCollapsed, setCommandState, resetCommandState }} />
            </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default TrainerDashboardLayout;
  