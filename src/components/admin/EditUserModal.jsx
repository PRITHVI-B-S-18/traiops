import React, { useState } from 'react';
import { updateUser } from '../../utils/firestoreUsers';
import { syncUserStatusToTrainer } from '../../utils/trainerSync';
import { Button } from '@/components/ui/button';
import { X, User, Mail, Shield, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";

const EditUserModal = ({ user, onClose }) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const oldStatus = user.status;
    const newStatus = status;

    const result = await updateUser(user.uid, {
      displayName,
      role,
      status
    });

    if (result.success) {
      // Sync status to trainer if user is a trainer and status changed
      if (user.role === 'trainer' && oldStatus !== newStatus && user.email) {
        try {
          const syncResult = await syncUserStatusToTrainer(user.email, newStatus);
          if (syncResult.success && !syncResult.skipped) {
            toast({
              title: "Status Synced",
              description: `Trainer status updated to ${newStatus === 'inactive' ? 'Inactive' : 'Active'} in Trainer Accounts.`,
              variant: "default"
            });
          } else if (syncResult.skipped) {
            // Trainer not found in Trainer Accounts, that's okay
            console.log('Trainer not found in Trainer Accounts, sync skipped');
          } else {
            console.error('Sync failed:', syncResult.error);
            toast({
              title: "Sync Warning",
              description: "User status updated, but sync to Trainer Accounts failed. Please check manually.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error syncing user status to trainer:', error);
          toast({
            title: "Sync Error",
            description: "Failed to sync status to Trainer Accounts. Please update manually.",
            variant: "destructive"
          });
        }
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      onClose();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update user',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const roleOptions = [
    { value: 'trainer', label: 'Trainer' },
    { value: 'program_manager', label: 'Program Manager' },
    { value: 'admin', label: 'Admin' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
          <h2 className="text-xl font-bold text-[#2C2C2C]">Edit User</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[#666666]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg bg-[#F5F5F5] text-[#666666] cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-[#888888] mt-1">Email cannot be changed</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Display Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Role *
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888888]" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-[#D0D0D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A5A] focus:border-transparent appearance-none bg-white"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
              Status *
            </label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={status === 'active'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="text-[#5A5A5A]"
                />
                <span className="text-sm text-[#2C2C2C]">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={status === 'inactive'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="text-[#5A5A5A]"
                />
                <span className="text-sm text-[#2C2C2C]">Inactive</span>
              </label>
            </div>
            {status === 'inactive' && (
              <div className="bg-[#FFF9E6] border border-[#FFD700] rounded-lg p-3">
                <p className="text-xs text-[#F57C00]">
                  ⚠️ Inactive users will not be able to log in to the application.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] text-white hover:from-[#4A4A4A] hover:to-[#2C2C2C]"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default EditUserModal;

