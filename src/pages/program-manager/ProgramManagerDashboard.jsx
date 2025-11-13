import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ClipboardCheck, CheckCircle, Clock, Building2, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { getClientsByPM } from '../../utils/firestoreClients';
import { getPendingClockRequests } from '../../utils/firestoreClockRequests';
import { formatTimestamp as formatTimestampTZ } from '@/utils/timezoneUtils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const ProgramManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setCommandState, resetCommandState } = useOutletContext();
  const [stats, setStats] = useState({
    totalTrainers: 0,
    totalClients: 0,
    pendingRequests: 0,
    approvedToday: 0,
    totalRequests: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState([]);

  // Calculate stats from schedule data and requests
  const calculateStats = (schedule, clients, pendingReqs) => {
    if (!user?.uid) return;

    // Count unique trainers with scheduled tasks where this PM is assigned
    const uniqueTrainers = new Set();
    const pmId = user.uid;
    
    if (schedule && typeof schedule === 'object') {
      Object.values(schedule).forEach(tasks => {
        if (Array.isArray(tasks)) {
          tasks.forEach(task => {
            // Only count training tasks where this PM is assigned
            if (task.type === 'training' && 
                task.assignedPMIds && 
                task.assignedPMIds.includes(pmId) &&
                task.trainer) {
              uniqueTrainers.add(task.trainer);
            }
          });
        }
      });
    }

    return {
      totalTrainers: uniqueTrainers.size,
      totalClients: clients?.length || 0,
      pendingRequests: pendingReqs?.length || 0,
      approvedToday: 0, // Would need to query approved requests for today
      totalRequests: pendingReqs?.length || 0
    };
  };

  // Load initial data and subscribe to real-time updates
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    setLoading(true);
    let scheduleUnsubscribe = null;
    let requestsUnsubscribe = null;
    let clientsData = [];
    let currentSchedule = {};
    let currentRequests = [];

    const updateStats = () => {
      if (!isMounted) return;
      const updatedStats = calculateStats(currentSchedule, clientsData, currentRequests);
      setStats(updatedStats);
      setLoading(false);
    };

    // Set page title immediately on mount
    if (setCommandState) {
      setCommandState({
        title: 'Dashboard',
        description: 'Welcome to your Program Manager dashboard',
        metrics: null,
      });
    }

    const loadInitialData = async () => {
      try {
        const [clients] = await Promise.all([
          getClientsByPM(user.uid)
        ]);

        if (!isMounted) return;

        clientsData = clients;

        // Subscribe to real-time schedule updates
        scheduleUnsubscribe = subscribeToScheduleUpdates((schedule) => {
          if (!isMounted) return;
          currentSchedule = schedule || {};
          updateStats();
        });

        // Subscribe to real-time clock requests updates
        const requestsQuery = query(
          collection(db, 'clock_requests'),
          where('status', '==', 'pending'),
          where('routedToPMIds', 'array-contains', user.uid)
        );

        requestsUnsubscribe = onSnapshot(
          requestsQuery,
          (snapshot) => {
            if (!isMounted) return;

            const requestsData = snapshot.docs.map(doc => ({
              requestId: doc.id,
              ...doc.data()
            }));

            // Sort by requestedAt (most recent first)
            requestsData.sort((a, b) => {
              const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
              const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
              return bTime - aTime;
            });

            currentRequests = requestsData;
            setRecentRequests(requestsData.slice(0, 5));
            updateStats();
          },
          (error) => {
            console.error('Error in real-time requests listener:', error);
            if (isMounted) {
              setLoading(false);
            }
          }
        );
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
      if (scheduleUnsubscribe) {
        scheduleUnsubscribe();
      }
      if (requestsUnsubscribe) {
        requestsUnsubscribe();
      }
    };
  }, [user?.uid, setCommandState]);

  // Update command state when stats change
  useEffect(() => {
    if (setCommandState && !loading && stats) {
      setCommandState({
        title: 'Dashboard',
        description: 'Welcome to your Program Manager dashboard',
        metrics: [
          <div key="trainers" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">My Trainers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalTrainers}</p>
              </div>
              <Users className="h-8 w-8 text-slate-600" />
            </div>
          </div>,
          <div key="requests" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Pending Requests</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pendingRequests}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>,
          <div key="clients" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">My Clients</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalClients}</p>
              </div>
              <Building2 className="h-8 w-8 text-emerald-600" />
            </div>
          </div>,
          <div key="total" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Requests</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalRequests}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-blue-600" />
            </div>
          </div>,
        ],
      });
    }
    return () => {
      if (resetCommandState) {
        resetCommandState();
      }
    };
  }, [stats, loading, setCommandState, resetCommandState]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Use timezone-aware formatting
    return formatTimestampTZ(timestamp, 'MMM d, hh:mm a');
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards - Now in command ribbon, keeping here as fallback */}
      {false && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.button
          onClick={() => navigate('/program-manager/trainers')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">My Trainers</span>
            <Users className="h-5 w-5 text-slate-600" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? '...' : stats.totalTrainers}
          </p>
        </motion.button>

        <motion.button
          onClick={() => navigate('/program-manager/requests')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Pending Requests</span>
            <Clock className="h-5 w-5 text-[#F97316]" />
          </div>
          <p className="text-3xl font-bold text-[#F97316]">
            {loading ? '...' : stats.pendingRequests}
          </p>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">My Clients</span>
            <Building2 className="h-5 w-5 text-[#66BB6A]" />
          </div>
          <p className="text-3xl font-bold text-[#66BB6A]">
            {loading ? '...' : stats.totalClients}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Requests</span>
            <ClipboardCheck className="h-5 w-5 text-[#5A5A5A]" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {loading ? '...' : stats.totalRequests}
          </p>
        </motion.div>
      </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm">
        <h2 className="text-lg font-semibold text-[#2C2C2C] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/program-manager/requests')}
            className="flex items-center justify-between p-4 bg-[#F5F5F5] hover:bg-[#E8E8E8] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock className="text-[#F97316]" size={24} />
              <div className="text-left">
                <p className="font-medium text-[#2C2C2C]">Review Requests</p>
                <p className="text-sm text-[#888888]">Approve or reject clock requests</p>
              </div>
            </div>
            <ArrowRight className="text-[#888888]" size={20} />
          </button>

          <button
            onClick={() => navigate('/program-manager/trainers')}
            className="flex items-center justify-between p-4 bg-[#F5F5F5] hover:bg-[#E8E8E8] rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="text-[#5A5A5A]" size={24} />
              <div className="text-left">
                <p className="font-medium text-[#2C2C2C]">View Trainers</p>
                <p className="text-sm text-[#888888]">See all assigned trainers</p>
              </div>
            </div>
            <ArrowRight className="text-[#888888]" size={20} />
          </button>
        </div>
      </div>

      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-[#E0E0E0] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[#2C2C2C]">Recent Requests</h2>
            <button
              onClick={() => navigate('/program-manager/requests')}
              className="text-sm text-[#5A5A5A] hover:text-[#2C2C2C] flex items-center gap-1"
            >
              View All <ArrowRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {recentRequests.map(request => (
              <div
                key={request.requestId}
                className="flex items-center justify-between p-4 bg-[#F5F5F5] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    request.type === 'clock_in' ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    <Clock className={
                      request.type === 'clock_in' ? 'text-blue-600' : 'text-green-600'
                    } size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-[#2C2C2C]">{request.trainerName}</p>
                    <p className="text-sm text-[#888888]">
                      {request.type === 'clock_in' ? 'Clock In' : 'Clock Out'} • {formatTimestamp(request.requestedAt)}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#FEF3C7] text-[#F59E0B] text-sm font-medium rounded-full">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramManagerDashboard;

