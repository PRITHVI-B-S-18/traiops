import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboardLayout from './pages/admin/AdminDashboardLayout';
import SchedulePage from './pages/admin/SchedulePage';
import TrainerManagementPage from './pages/admin/TrainerManagementPage';
import TrainerUtilizationPage from './pages/admin/TrainerUtilizationPage';
import TrainerDashboardLayout from './pages/trainer/TrainerDashboardLayout';
import TrainerSchedulePage from './pages/trainer/TrainerSchedulePage';
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
        
        {/* Admin routes */}
          <Route path="/admin" element={<AdminDashboardLayout />}>
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="trainers" element={<TrainerManagementPage />} />
            <Route path="profiles" element={<TrainerProfilesPage />} />
            <Route path="utilization" element={<TrainerUtilizationPage />} />
            <Route index element={<Navigate to="schedule" replace />} />
        </Route>

        {/* Trainer routes */}
          <Route path="/trainer" element={<TrainerDashboardLayout />}>
            <Route path="schedule" element={<TrainerSchedulePage />} />
            <Route path="profiles" element={<TrainerProfilesPage />} />
            <Route index element={<Navigate to="schedule" replace />} />
        </Route>
        
        {/* Catch-all for 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
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
  