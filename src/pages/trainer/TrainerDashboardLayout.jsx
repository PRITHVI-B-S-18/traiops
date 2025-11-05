import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const TrainerDashboardLayout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5F5] text-[#2C2C2C]">
      <aside className="w-64 bg-white p-6 space-y-6 border-r border-[#E0E0E0] shadow-sm">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#3D3D3D] via-[#5A5A5A] to-[#707070]">Trainer Portal</h1>
        <nav className="space-y-2">
          <Link to="schedule" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-[#F5F5F5] transition-colors duration-200 text-[#2C2C2C]">
            <CalendarCheck className="w-5 h-5 text-[#5A5A5A]" />
            <span>My Schedule</span>
          </Link>
          <Link to="profiles" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-[#F5F5F5] transition-colors duration-200 text-[#2C2C2C]">
            <span role="img" aria-label="profile">👤</span>
            <span>Trainer Profiles</span>
          </Link>
        </nav>
         <div className="pt-4 mt-auto border-t border-[#E0E0E0]">
           <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 hover:text-red-600 w-full text-left transition-colors duration-200 text-[#666666]"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto bg-[#FAFAFA]">
        <Outlet />
      </main>
    </div>
  );
};

export default TrainerDashboardLayout;
  