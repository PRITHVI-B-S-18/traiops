import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import SessionWarning from './components/common/SessionWarning';
import LoginPage from './pages/LoginPage';
import AdminDashboardLayout from './pages/admin/AdminDashboardLayout';
import SchedulePage from './pages/admin/SchedulePage';
import TrainerManagementPage from './pages/admin/TrainerManagementPage';
import TrainerUtilizationPage from './pages/admin/TrainerUtilizationPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ClockRequestsPage from './pages/admin/ClockRequestsPage';
import ClientManagementPage from './pages/admin/ClientManagementPage';
import TrainerDashboardLayout from './pages/trainer/TrainerDashboardLayout';
import TrainerHomePage from './pages/trainer/TrainerHomePage';
import TrainerSchedulePage from './pages/trainer/TrainerSchedulePage';
import ClockHistoryPage from './pages/trainer/ClockHistoryPage';
import ProgramManagerDashboardLayout from './pages/program-manager/ProgramManagerDashboardLayout';
import ProgramManagerHomePage from './pages/program-manager/ProgramManagerHomePage';
import MyTrainersPage from './pages/program-manager/MyTrainersPage';
import RequestApprovalsPage from './pages/program-manager/RequestApprovalsPage';
import RequestHistoryPage from './pages/program-manager/RequestHistoryPage';
import { Toaster } from './components/ui/toaster';
import { MotionConfig } from 'framer-motion';
import SignupPage from './pages/SignupPage';
import TrainerProfilesPage from './pages/admin/TrainerProfilesPage';

function AppContent() {
  return (
    <MotionConfig transition={{ duration: 0.3, ease: "easeInOut" }}>
      <Routes>
        {/* Default route: redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Admin routes - Protected with admin role */}
        <Route 
          path="/admin" 
          element={<ProtectedRoute allowedRoles={['admin']} />}
        >
          <Route element={<AdminDashboardLayout />}>
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="trainers" element={<TrainerManagementPage />} />
            <Route path="profiles" element={<TrainerProfilesPage />} />
            <Route path="utilization" element={<TrainerUtilizationPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="clients" element={<ClientManagementPage />} />
            <Route path="clock-requests" element={<ClockRequestsPage />} />
            <Route index element={<Navigate to="schedule" replace />} />
          </Route>
        </Route>

        {/* Program Manager routes - Protected with program_manager role */}
        <Route 
          path="/program-manager" 
          element={<ProtectedRoute allowedRoles={['program_manager']} />}
        >
          <Route element={<ProgramManagerDashboardLayout />}>
            <Route path="home" element={<ProgramManagerHomePage />} />
            <Route path="trainers" element={<MyTrainersPage />} />
            <Route path="requests" element={<RequestApprovalsPage />} />
            <Route path="history" element={<RequestHistoryPage />} />
            <Route index element={<Navigate to="home" replace />} />
          </Route>
        </Route>

        {/* Trainer routes - Protected with trainer role */}
        <Route 
          path="/trainer" 
          element={<ProtectedRoute allowedRoles={['trainer']} />}
        >
          <Route element={<TrainerDashboardLayout />}>
            <Route path="home" element={<TrainerHomePage />} />
            <Route path="schedule" element={<TrainerSchedulePage />} />
            <Route path="history" element={<ClockHistoryPage />} />
            <Route index element={<Navigate to="home" replace />} />
          </Route>
        </Route>
        
        {/* Catch-all for 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <SessionWarning />
      <Toaster />
    </MotionConfig>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
  