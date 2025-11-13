import React, { useMemo, useState, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  CalendarDays,
  Users,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  UserCog,
  Clock,
  Building2,
  Contact,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cardStyles, getChipClasses, layoutBackground, panelPadding, sectionSpacing } from '@/styles/designSystem';
import { Button } from '@/components/ui/button';
import { getUserTimezone } from '@/utils/timezoneUtils';

const defaultCommandState = {
  title: 'Admin Console',
  description: 'Orchestrate schedules, trainers, and approvals.',
  actions: null,
  metrics: null,
};

const AdminDashboardLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandState, setCommandState] = useState(defaultCommandState);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  const resetCommandState = useCallback(() => setCommandState(defaultCommandState), []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const navItems = [
    { path: '/admin/schedule', label: 'Schedule Management', icon: CalendarDays },
    { path: '/admin/trainers', label: 'Trainer Accounts', icon: Users },
    { path: '/admin/profiles', label: 'Trainer Profiles', icon: Contact },
    { path: '/admin/utilization', label: 'Trainer Utilization', icon: BarChart3 },
    { path: '/admin/users', label: 'User Management', icon: UserCog },
    { path: '/admin/clients', label: 'Client Management', icon: Building2 },
    { path: '/admin/clock-requests', label: 'Clock Request Management', icon: Clock },
  ];

  const sidebarWidthClass = useMemo(() => (sidebarCollapsed ? 'lg:w-20' : 'lg:w-48'), [sidebarCollapsed]);

  return (
    <div className={cn('relative flex min-h-screen w-full', layoutBackground)}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarWidthClass
        )}
      >
        <div className={cn(
          "flex items-center border-b border-slate-200 py-3",
          sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!sidebarCollapsed && (
            <Link
              to="/admin/schedule"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 text-lg font-semibold text-slate-900"
            >
              Admin Panel
            </Link>
          )}
          <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 lg:inline-flex"
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
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 lg:hidden"
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
              <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <div className={cn("space-y-1", sidebarCollapsed ? "px-2" : "px-3")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex rounded-lg text-sm font-medium transition-colors',
                    sidebarCollapsed 
                      ? 'items-center justify-center px-2 py-2' 
                      : 'items-center gap-3 px-3 py-2',
                    active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span
                    className={cn(
                      'whitespace-normal leading-snug transition-opacity duration-200',
                      sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                    )}
                    aria-hidden={sidebarCollapsed}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
        
        <div className={cn("border-t border-slate-200", sidebarCollapsed ? "p-2" : "p-4")}>
          {!sidebarCollapsed && user && (
            <div className={cn(cardStyles.subtle, 'px-3 py-2')}>
              <span className={cn(getChipClasses('muted'), 'text-[11px] uppercase')}>Logged in as</span>
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
            className={cn(
              "flex w-full items-center rounded-lg border border-slate-200 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900",
              sidebarCollapsed 
                ? "justify-center px-2 py-2" 
                : "gap-2 px-3 py-2",
              !sidebarCollapsed && "mt-3"
            )}
            title={sidebarCollapsed ? 'Logout' : undefined}
        >
            <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="Open navigation menu"
        >
            <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
          <span className="text-sm font-semibold text-slate-700">Admin Panel</span>
        </header>

        <main className="flex-1 overflow-y-auto lg:h-screen lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
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
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-400">Timezone:</span>
                    <span className="text-xs font-medium text-slate-600">{getUserTimezone()}</span>
                  </div>
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

              <div className={cn(cardStyles.surface, panelPadding, sectionSpacing)}>
                <Outlet
                  context={{
                    sidebarCollapsed,
                    setCommandState,
                    resetCommandState,
                  }}
                />
              </div>
            </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;
  