import React from 'react';
import { History, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const ProgramManagerHistory = () => {
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-[#2C2C2C] mb-2">
          Request History
        </h1>
        <p className="text-[#666666] mb-8">
          View all approved and rejected clock-in/clock-out requests
        </p>
      </motion.div>

      {/* Date Filter - Placeholder */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-[#666666]">
          <Calendar className="h-4 w-4" />
          <span className="text-sm">Date range filter (will be implemented in Phase 3)</span>
        </div>
      </div>

      {/* Placeholder Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white border border-[#E0E0E0] rounded-lg p-12 text-center"
      >
        <History className="h-16 w-16 text-[#D0D0D0] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#2C2C2C] mb-2">
          No Request History
        </h2>
        <p className="text-[#666666] mb-4">
          Your approval/rejection history will appear here once you start processing requests.
        </p>
        <p className="text-sm text-[#888888]">
          Request history feature will be implemented in Phase 3
        </p>
      </motion.div>
    </div>
  );
};

export default ProgramManagerHistory;

