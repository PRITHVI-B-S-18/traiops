import React from 'react';
import { Users, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const ProgramManagerDashboard = () => {
  // Placeholder data - will be replaced with real data in Phase 3
  const stats = [
    {
      title: 'Total Trainers',
      value: '0',
      icon: Users,
      color: 'text-[#5A5A5A]',
      bgColor: 'bg-[#F5F5F5]',
    },
    {
      title: 'Pending Requests',
      value: '0',
      icon: Clock,
      color: 'text-[#F97316]',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Approved Today',
      value: '0',
      icon: CheckCircle,
      color: 'text-[#66BB6A]',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Rejected Today',
      value: '0',
      icon: TrendingUp,
      color: 'text-[#EF4444]',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-[#2C2C2C] mb-2">
          Program Manager Dashboard
        </h1>
        <p className="text-[#666666] mb-8">
          Welcome back! Here's an overview of your team's activity.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white border border-[#E0E0E0] rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-[#2C2C2C] mb-1">
              {stat.value}
            </h3>
            <p className="text-sm text-[#666666]">{stat.title}</p>
          </motion.div>
        ))}
      </div>

      {/* Placeholder Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="bg-white border border-[#E0E0E0] rounded-lg p-8 text-center"
      >
        <Users className="h-16 w-16 text-[#D0D0D0] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#2C2C2C] mb-2">
          Trainers Under Me
        </h2>
        <p className="text-[#666666] mb-4">
          No trainers assigned yet. Once trainers are mapped to you, they will appear here.
        </p>
        <p className="text-sm text-[#888888]">
          This feature will be implemented in Phase 4
        </p>
      </motion.div>
    </div>
  );
};

export default ProgramManagerDashboard;

