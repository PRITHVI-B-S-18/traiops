import React from 'react';
import { Clock, CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const PendingApproval = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-[#E0E0E0] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-white animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-white">Pending Approval</h1>
            <p className="text-white/80 text-sm mt-2">Your profile is under review</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Status Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-900 font-medium">Awaiting Administrator Review</p>
                <p className="text-xs text-yellow-800 mt-1">
                  Your profile information has been submitted and is currently being reviewed by an administrator.
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#2C2C2C]">What happens next?</h3>
            
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2C2C2C]">Profile Submitted</p>
                  <p className="text-xs text-[#888888]">Your information has been received</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#2C2C2C]">Under Review</p>
                  <p className="text-xs text-[#888888]">Administrator is reviewing your profile</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#666666]">Notification</p>
                  <p className="text-xs text-[#888888]">You'll be notified once approved</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-900">
              <strong>Note:</strong> This process typically takes 1-2 business days. You'll receive access to the platform once your profile is approved.
            </p>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5]"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;

