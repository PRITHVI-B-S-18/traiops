import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const DeleteUserModal = ({ user, onConfirm, onCancel, loading }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-[#2C2C2C]">Delete User</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[#666666]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-sm text-[#666666] mb-4">
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
          
          {/* User Info */}
          <div className="bg-[#F5F5F5] rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#5A5A5A] to-[#3D3D3D] flex items-center justify-center text-white font-semibold">
                {user.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-semibold text-[#2C2C2C]">{user.displayName}</p>
                <p className="text-xs text-[#666666]">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#FFF9E6] border border-[#FFD700] rounded-lg p-3">
            <p className="text-xs text-[#F57C00] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>This will permanently delete the user account and all associated data. This action cannot be reversed.</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#E0E0E0]">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={loading}
            className="flex-1 border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default DeleteUserModal;

