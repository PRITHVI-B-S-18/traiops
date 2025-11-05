import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/admin/schedule', label: 'Schedule Management', icon: CalendarDays },
    { path: '/admin/trainers', label: 'Trainer Accounts', icon: Users },
    { path: '/admin/profiles', label: 'Trainer Profiles', icon: Users },
    { path: '/admin/utilization', label: 'Trainer Utilization', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-background">
      <motion.aside 
        initial={{ x: -200 }}
        animate={{ 
          x: sidebarCollapsed ? -200 : 0,
          width: sidebarCollapsed ? 0 : 200
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="sidebar-minimal flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 relative">
          {/* Sidebar Toggle Button - positioned inside sidebar */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-4 right-4 p-2 sidebar-toggle rounded-lg"
      >
            <X className="h-4 w-4 text-gray-600" />
          </button>
          
          <Link to="/admin/schedule" className="flex items-center text-lg font-semibold text-gray-800 hover:text-gray-900 transition-colors pr-12">
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
                      ? 'bg-gray-100 text-gray-900 border border-gray-200' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-3 border-t border-gray-100 space-y-3">
          {/* User Details Section */}
          {user && (
            <div className="px-3 py-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Logged in as</span>
              </div>
              <div className="space-y-1">
                {user.displayName && (
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName}
                  </p>
                )}
                <p className="text-xs text-gray-600 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          )}
          
        <Button
          onClick={handleLogout}
          variant="ghost"
            className="w-full flex items-center justify-start space-x-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm font-medium"
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
          className="fixed top-4 left-4 z-50 p-2 sidebar-toggle rounded-lg"
        >
          <Menu className="h-4 w-4 text-gray-600" />
        </button>
      )}
      
      <main className={`flex-1 p-2 md:p-6 overflow-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : 'ml-0'}`}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm min-h-full">
         <Outlet context={{ sidebarCollapsed }} />
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardLayout;
  