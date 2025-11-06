import React from 'react';
import { CheckCircle, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const ProgramManagerRequests = () => {
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-[#2C2C2C] mb-2">
          Pending Requests
        </h1>
        <p className="text-[#666666] mb-8">
          Review and approve clock-in/clock-out requests from your trainers
        </p>
      </motion.div>

      {/* Filter Section - Placeholder */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-[#666666]">
          <Filter className="h-4 w-4" />
          <span className="text-sm">Filters (will be implemented in Phase 3)</span>
        </div>
      </div>

      {/* Placeholder Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white border border-[#E0E0E0] rounded-lg p-12 text-center"
      >
        <CheckCircle className="h-16 w-16 text-[#D0D0D0] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#2C2C2C] mb-2">
          No Pending Requests
        </h2>
        <p className="text-[#666666] mb-4">
          All caught up! There are no pending clock-in/clock-out requests at the moment.
        </p>
        <p className="text-sm text-[#888888]">
          Request approval workflow will be implemented in Phase 3
        </p>
      </motion.div>
    </div>
  );
};

export default ProgramManagerRequests;

