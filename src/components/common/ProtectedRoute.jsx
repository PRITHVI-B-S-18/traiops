import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-[#7B224C]" />
            <div className="absolute inset-0 h-10 w-10 animate-ping text-[#7B224C] opacity-20"></div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Verifying authentication...</p>
            <p className="text-xs text-gray-500 mt-1">Please wait</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    // Save the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    let redirectPath = '/admin/schedule'; // Default
    
    if (user.role === 'trainer') {
      redirectPath = '/trainer/schedule';
    } else if (user.role === 'program_manager') {
      redirectPath = '/program-manager/dashboard';
    }
    
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
  