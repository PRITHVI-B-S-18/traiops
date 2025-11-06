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
import TrainerDashboardLayout from './pages/trainer/TrainerDashboardLayout';
import TrainerSchedulePage from './pages/trainer/TrainerSchedulePage';
import ProgramManagerDashboardLayout from './pages/program-manager/ProgramManagerDashboardLayout';
import ProgramManagerDashboard from './pages/program-manager/ProgramManagerDashboard';
import ProgramManagerRequests from './pages/program-manager/ProgramManagerRequests';
import ProgramManagerTrainers from './pages/program-manager/ProgramManagerTrainers';
import ProgramManagerHistory from './pages/program-manager/ProgramManagerHistory';
import { Toaster } from './components/ui/toaster';
import { MotionConfig } from 'framer-motion';
import SignupPage from './pages/SignupPage';
import TrainerProfilesPage from './pages/admin/TrainerProfilesPage';
import LocationManagementPage from './pages/admin/LocationManagementPage';
import UserInvitationPage from './pages/admin/UserInvitationPage';

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
            <Route path="locations" element={<LocationManagementPage />} />
            <Route path="invitations" element={<UserInvitationPage />} />
            <Route index element={<Navigate to="schedule" replace />} />
          </Route>
        </Route>

        {/* Trainer routes - Protected with trainer role */}
        <Route 
          path="/trainer" 
          element={<ProtectedRoute allowedRoles={['trainer']} />}
        >
          <Route element={<TrainerDashboardLayout />}>
            <Route path="schedule" element={<TrainerSchedulePage />} />
            <Route path="profiles" element={<TrainerProfilesPage />} />
            <Route index element={<Navigate to="schedule" replace />} />
          </Route>
        </Route>

        {/* Program Manager routes - Protected with program_manager role */}
        <Route 
          path="/program-manager" 
          element={<ProtectedRoute allowedRoles={['program_manager']} />}
        >
          <Route element={<ProgramManagerDashboardLayout />}>
            <Route path="dashboard" element={<ProgramManagerDashboard />} />
            <Route path="trainers" element={<ProgramManagerTrainers />} />
            <Route path="requests" element={<ProgramManagerRequests />} />
            <Route path="history" element={<ProgramManagerHistory />} />
            <Route index element={<Navigate to="dashboard" replace />} />
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
  