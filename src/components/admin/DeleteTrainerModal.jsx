import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const DeleteTrainerModal = ({ isOpen, trainer, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 bg-white rounded-lg shadow-xl max-w-md w-full border border-[#E0E0E0] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-red-50 border-b border-red-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#2C2C2C]">Delete Trainer</h3>
                <p className="text-sm text-[#666666] mt-1">This action cannot be undone</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Trainer Info */}
            {trainer && (
              <div className="bg-[#F5F5F5] rounded-lg p-4 border border-[#E0E0E0]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E0E0E0] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#2C2C2C]">{trainer.name}</p>
                    <p className="text-sm text-[#666666]">{trainer.email}</p>
                    {trainer.id && (
                      <p className="text-xs text-[#888888] mt-1">ID: {trainer.id}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Warning Message */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900 font-medium mb-2">⚠️ Warning: This will:</p>
              <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                <li>Remove trainer from Trainer Accounts</li>
                <li>Remove trainer from Users collection</li>
                <li>Remove trainer from Schedule Management</li>
                <li>Deactivate Firebase Auth account</li>
              </ul>
            </div>

            <p className="text-sm text-[#666666]">
              Are you sure you want to delete <strong>{trainer?.name}</strong>? This action will permanently remove all trainer data and deactivate their account.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-[#E0E0E0] bg-[#FAFAFA]">
            <Button
              onClick={onCancel}
              variant="outline"
              disabled={loading}
              className="border-[#D0D0D0] text-[#666666] hover:bg-[#F5F5F5] px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white px-6"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </div>
              ) : (
                'Delete Trainer'
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  , document.body);
};

export default DeleteTrainerModal;

