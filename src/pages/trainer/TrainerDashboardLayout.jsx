import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      <aside className="w-64 bg-slate-800 p-6 space-y-6 border-r border-slate-700">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-500 to-sky-600">Trainer Portal</h1>
        <nav className="space-y-2">
          <Link to="schedule" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors duration-200">
            <CalendarCheck className="w-5 h-5 text-teal-400" />
            <span>My Schedule</span>
          </Link>
          <Link to="profiles" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors duration-200">
            <span role="img" aria-label="profile">👤</span>
            <span>Trainer Profiles</span>
          </Link>
        </nav>
         <div className="pt-4 mt-auto border-t border-slate-700">
           <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-600 hover:text-white w-full text-left transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default TrainerDashboardLayout;
  