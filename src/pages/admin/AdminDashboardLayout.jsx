import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Users, LogOut, Menu, X, User, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboardLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getInitials = (user) => {
    if (!user) return '';
    if (user.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0,2).toUpperCase();
    }
    return '';
  };
  const initials = getInitials(user);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate to login even if logout fails
      navigate('/login', { replace: true });
    }
  };

  const navItems = [
    { path: '/admin/schedule', label: 'Schedule Management', icon: CalendarDays },
    { path: '/admin/trainers', label: 'Trainer Accounts', icon: Users },
    { path: '/admin/profiles', label: 'Trainer Profiles', icon: Users },
    { path: '/admin/utilization', label: 'Trainer Utilization', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      <motion.aside 
        initial={{ x: -200 }}
        animate={{ 
          x: sidebarCollapsed ? -200 : 0,
          width: sidebarCollapsed ? 0 : 200
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="sidebar-minimal flex flex-col overflow-hidden bg-white"
      >
        <div className="p-4 border-b border-[#E0E0E0] relative">
          {/* Sidebar Toggle Button - positioned inside sidebar */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-4 right-4 p-2 sidebar-toggle rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F5F5F5]"
      >
            <X className="h-4 w-4 text-[#666666]" />
          </button>
          
          <Link to="/admin/schedule" className="flex items-center text-lg font-semibold text-[#2C2C2C] hover:text-[#000000] transition-colors pr-12">
            <span>Admin Panel</span>
          </Link>
        </div>
        
        <nav className="flex-grow p-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                    ${location.pathname === item.path 
                      ? 'bg-[#E8E8E8] text-[#2C2C2C] border border-[#D0D0D0]' 
                      : 'text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2C2C2C]'}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-3 border-t border-[#E0E0E0] space-y-3">
          {/* User Details Section */}
          {user && (
            <div className="px-3 py-2 bg-[#F5F5F5] rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-[#888888]" />
                <span className="text-xs font-medium text-[#888888] uppercase tracking-wide">Logged in as</span>
              </div>
              <div className="space-y-1">
                {user.displayName && (
                  <p className="text-sm font-medium text-[#2C2C2C] truncate">
                    {user.displayName}
                  </p>
                )}
                <p className="text-xs text-[#666666] truncate">
                  {user.email}
                </p>
              </div>
            </div>
          )}
          
        <Button
          onClick={handleLogout}
          variant="ghost"
            className="w-full flex items-center justify-start space-x-3 px-3 py-2 text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2C2C2C] transition-colors text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
        </div>
      </motion.aside>
      
      {/* Floating toggle button for when sidebar is collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed top-4 left-4 z-50 p-2 sidebar-toggle rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F5F5F5]"
        >
          <Menu className="h-4 w-4 text-[#666666]" />
        </button>
      )}
      
      <main className={`flex-1 p-2 md:p-6 overflow-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : 'ml-0'}`}>
        <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm min-h-full">
         <Outlet context={{ sidebarCollapsed }} />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardLayout;
  