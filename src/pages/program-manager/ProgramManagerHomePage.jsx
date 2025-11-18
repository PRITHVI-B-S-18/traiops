import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  User,
  Clock,
  Calendar,
  MapPin,
  Building2,
  X,
  AlertCircle
} from 'lucide-react';
import { 
  subscribeToClockRequests,
  approveClockRequest,
  rejectClockRequest
} from '../../utils/firestoreClockRequests';
import { subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { loadTrainerData } from '../../utils/firestoreTrainers';
import { formatTimestamp, formatDateForDisplay, getCurrentDateInUserTimezone } from '@/utils/timezoneUtils';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export default function ProgramManagerHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setCommandState, resetCommandState } = useOutletContext();
  const [todayRequests, setTodayRequests] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalDescription, setApprovalDescription] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState(null);
  const [todayResolvedRequests, setTodayResolvedRequests] = useState([]);
  const [trainerDataMap, setTrainerDataMap] = useState(new Map()); // Map of trainer name/email to trainer data

  // Get today's date in user timezone
  const todayStr = useMemo(() => {
    return getCurrentDateInUserTimezone();
  }, []);

  // Load trainer data to get emails
  useEffect(() => {
    const loadTrainers = async () => {
      try {
        const trainers = await loadTrainerData();
        const map = new Map();
        trainers.forEach(trainer => {
          if (trainer.email) {
            map.set(trainer.email.trim().toLowerCase(), trainer);
          }
          if (trainer.name) {
            map.set(trainer.name.trim().toLowerCase(), trainer);
          }
        });
        setTrainerDataMap(map);
      } catch (error) {
        console.error('Error loading trainer data:', error);
      }
    };
    loadTrainers();
  }, []);

  // Combine requests and schedules for today - merge into single entries per trainer
  // Match by email first, then fallback to trainerId or trainerName
  // Only compute when both data sources are loaded to prevent intermediate renders
  const todayTrainers = useMemo(() => {
    // Don't compute if still loading - prevents showing partial data
    if (!requestsLoaded || !schedulesLoaded) {
      return [];
    }
    
    const trainersMap = new Map();

    // Helper function to get trainer email from name if not available
    const getTrainerEmail = (item) => {
      if (item.trainerEmail) {
        return item.trainerEmail.trim().toLowerCase();
      }
      // Try to get email from trainer data map using name
      const trainerName = (item.trainerName || item.trainer || '').trim().toLowerCase();
      if (trainerName && trainerDataMap.has(trainerName)) {
        const trainerData = trainerDataMap.get(trainerName);
        return trainerData.email ? trainerData.email.trim().toLowerCase() : null;
      }
      return null;
    };

    // Helper function to get a unique key for matching
    const getTrainerKey = (item) => {
      // First try to get email (from item or lookup)
      const email = getTrainerEmail(item);
      if (email) {
        return `email:${email}`;
      }
      // Fallback to trainerId
      if (item.trainerId) {
        return `id:${String(item.trainerId).trim()}`;
      }
      // Fallback to trainerName/trainer (normalized)
      const name = (item.trainerName || item.trainer || '').trim().toLowerCase();
      if (name) {
        return `name:${name}`;
      }
      return null;
    };

    const getTimestampValue = (timestamp) => {
      if (!timestamp) return 0;
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().getTime();
      }
      try {
        return new Date(timestamp).getTime();
      } catch {
        return 0;
      }
    };

    const buildStatusInfo = (request) => {
      const approvals = Array.isArray(request.approvals) ? request.approvals : [];
      const rejections = Array.isArray(request.rejections) ? request.rejections : [];
      const lastApproval = approvals.length > 0 ? approvals[approvals.length - 1] : null;
      const lastRejection = rejections.length > 0 ? rejections[rejections.length - 1] : null;

      let resolvedAt = null;
      let resolvedTimestamp = 0;

      if (request.status === 'approved' && lastApproval?.approvedAt) {
        resolvedAt = lastApproval.approvedAt;
        resolvedTimestamp = getTimestampValue(lastApproval.approvedAt);
      } else if (request.status === 'rejected' && lastRejection?.rejectedAt) {
        resolvedAt = lastRejection.rejectedAt;
        resolvedTimestamp = getTimestampValue(lastRejection.rejectedAt);
      } else if (request.updatedAt) {
        resolvedAt = request.updatedAt;
        resolvedTimestamp = getTimestampValue(request.updatedAt);
      } else {
        resolvedAt = request.requestedAt;
        resolvedTimestamp = getTimestampValue(request.requestedAt);
      }

      return {
        status: request.status,
        type: request.type,
        requestId: request.requestId,
        approvedInfo: lastApproval,
        rejectedInfo: lastRejection,
        rejectionReason: request.rejectionReason || lastRejection?.reason || null,
        resolvedAt,
        resolvedTimestamp
      };
    };

    const resolvedStatusMap = new Map();

    todayResolvedRequests.forEach((request) => {
      const key = getTrainerKey(request);
      if (!key) return;
      const info = buildStatusInfo(request);
      const existing = resolvedStatusMap.get(key);
      if (!existing || info.resolvedTimestamp > existing.resolvedTimestamp) {
        resolvedStatusMap.set(key, info);
      }
    });

    // First, add all schedules
    todaySchedules.forEach(schedule => {
      const key = getTrainerKey(schedule);
      if (key) {
        const trainerName = schedule.trainer || schedule.trainerName;
        const trainerEmail = getTrainerEmail(schedule) || schedule.trainerEmail;
        
        trainersMap.set(key, {
          trainerId: schedule.trainerId,
          trainerName: trainerName,
          trainerEmail: trainerEmail,
          hasRequest: false,
          request: null,
          schedule: schedule
        });
      }
    });

    // Then, merge requests with existing schedules
    // Only create new entries for requests if there's NO matching schedule
    todayRequests.forEach(request => {
      const key = getTrainerKey(request);
      if (!key) return;

      // Try to find existing entry by checking all possible keys
      let existing = trainersMap.get(key);
      
      // If not found by primary key, try to find by email or name match (more aggressive matching)
      if (!existing) {
        const requestEmail = getTrainerEmail(request);
        const requestName = (request.trainerName || '').trim().toLowerCase();
        
        // Search for matching entry - try multiple matching strategies
        for (const [existingKey, entry] of trainersMap.entries()) {
          const entryEmail = entry.trainerEmail ? entry.trainerEmail.trim().toLowerCase() : null;
          const entryName = entry.trainerName ? entry.trainerName.trim().toLowerCase() : null;
          
          // Match by email (exact)
          if (requestEmail && entryEmail && requestEmail === entryEmail) {
            existing = entry;
            break;
          }
          // Match by name (exact, case-insensitive)
          if (requestName && entryName && requestName === entryName) {
            existing = entry;
            break;
          }
          // Match by name (partial - one contains the other)
          if (requestName && entryName && (requestName.includes(entryName) || entryName.includes(requestName))) {
            existing = entry;
            break;
          }
          // Match by trainerId if available
          if (request.trainerId && entry.trainerId && String(request.trainerId).trim() === String(entry.trainerId).trim()) {
            existing = entry;
            break;
          }
        }
      }
      
      if (existing) {
        // Merge request with existing schedule entry - ALWAYS merge, never create duplicate
        existing.hasRequest = true;
        existing.request = request;
        // Update trainer info from request if schedule didn't have it
        if (!existing.trainerId && request.trainerId) {
          existing.trainerId = request.trainerId;
        }
        if (!existing.trainerName && request.trainerName) {
          existing.trainerName = request.trainerName;
        }
        if (!existing.trainerEmail && request.trainerEmail) {
          existing.trainerEmail = request.trainerEmail.trim().toLowerCase();
        }
      } else {
        // Only create new entry if there's NO schedule for this trainer
        // This prevents showing separate request widgets when a schedule exists
        const trainerEmail = getTrainerEmail(request) || request.trainerEmail;
        trainersMap.set(key, {
          trainerId: request.trainerId,
          trainerName: request.trainerName,
          trainerEmail: trainerEmail,
          hasRequest: true,
          request: request,
          schedule: null
        });
      }
    });

    // Final pass: Remove any duplicate entries and ensure requests are merged with schedules
    const finalTrainers = Array.from(trainersMap.values());
    const consolidated = new Map();
    const scheduleEntries = new Map(); // Track entries with schedules
    
    // First pass: Collect all schedule entries and add them to consolidated
    finalTrainers.forEach(trainer => {
      if (trainer.schedule) {
        const key = trainer.trainerEmail 
          ? `email:${trainer.trainerEmail.trim().toLowerCase()}`
          : trainer.trainerId 
          ? `id:${String(trainer.trainerId).trim()}`
          : `name:${(trainer.trainerName || '').trim().toLowerCase()}`;
        
        if (key && key !== 'name:') {
          scheduleEntries.set(key, trainer);
          consolidated.set(key, trainer); // Add schedule entries to consolidated first
        }
      }
    });
    
    // Helper to find matching schedule entry for a request-only entry
    const findMatchingScheduleEntry = (requestTrainer) => {
      const requestEmail = requestTrainer.trainerEmail ? requestTrainer.trainerEmail.trim().toLowerCase() : null;
      const requestName = requestTrainer.trainerName ? requestTrainer.trainerName.trim().toLowerCase() : null;
      const requestId = requestTrainer.trainerId ? String(requestTrainer.trainerId).trim() : null;
      
      for (const [key, scheduleEntry] of scheduleEntries.entries()) {
        const entryEmail = scheduleEntry.trainerEmail ? scheduleEntry.trainerEmail.trim().toLowerCase() : null;
        const entryName = scheduleEntry.trainerName ? scheduleEntry.trainerName.trim().toLowerCase() : null;
        const entryId = scheduleEntry.trainerId ? String(scheduleEntry.trainerId).trim() : null;
        
        // Match by email
        if (requestEmail && entryEmail && requestEmail === entryEmail) {
          return scheduleEntry;
        }
        // Match by name
        if (requestName && entryName && requestName === entryName) {
          return scheduleEntry;
        }
        // Match by name (partial)
        if (requestName && entryName && (requestName.includes(entryName) || entryName.includes(requestName))) {
          return scheduleEntry;
        }
        // Match by ID
        if (requestId && entryId && requestId === entryId) {
          return scheduleEntry;
        }
      }
      return null;
    };
    
    // Second pass: Consolidate all entries
    finalTrainers.forEach(trainer => {
      const key = trainer.trainerEmail 
        ? `email:${trainer.trainerEmail.trim().toLowerCase()}`
        : trainer.trainerId 
        ? `id:${String(trainer.trainerId).trim()}`
        : `name:${(trainer.trainerName || '').trim().toLowerCase()}`;
      
      if (!key || key === 'name:') return;
      
      const existing = consolidated.get(key);
      
      // If this is a request-only entry, check if a matching schedule entry exists
      if (!trainer.schedule && trainer.hasRequest) {
        const matchingSchedule = findMatchingScheduleEntry(trainer);
        if (matchingSchedule) {
          // Merge request into schedule entry and skip adding this request-only entry
          if (!matchingSchedule.hasRequest) {
            matchingSchedule.hasRequest = true;
            matchingSchedule.request = trainer.request;
          }
          return; // Don't add this request-only entry
        }
      }
      
      if (!existing) {
        consolidated.set(key, trainer);
      } else {
        // Merge logic: prefer entries with schedules
        if (existing.schedule && !trainer.schedule) {
          // Existing has schedule, new doesn't - merge request if needed
          if (trainer.hasRequest && !existing.hasRequest) {
            existing.hasRequest = true;
            existing.request = trainer.request;
          }
        } else if (trainer.schedule && !existing.schedule) {
          // New has schedule, existing doesn't - replace and merge request
          if (existing.hasRequest && !trainer.hasRequest) {
            trainer.hasRequest = true;
            trainer.request = existing.request;
          }
          consolidated.set(key, trainer);
        } else if (existing.schedule && trainer.schedule) {
          // Both have schedules - merge requests
          if (trainer.hasRequest && !existing.hasRequest) {
            existing.hasRequest = true;
            existing.request = trainer.request;
          }
        }
      }
    });
    
    const trainersArray = Array.from(consolidated.values()).map((trainer) => {
      const key = trainer.trainerEmail
        ? `email:${trainer.trainerEmail.trim().toLowerCase()}`
        : trainer.trainerId
        ? `id:${String(trainer.trainerId).trim()}`
        : `name:${(trainer.trainerName || '').trim().toLowerCase()}`;

      return {
        ...trainer,
        statusInfo: key ? resolvedStatusMap.get(key) || null : null
      };
    });

    return trainersArray;
  }, [todayRequests, todaySchedules, todayResolvedRequests, trainerDataMap, requestsLoaded, schedulesLoaded]);

  // Reset loading state when navigating to this page or date changes
  useEffect(() => {
    // Immediately reset all states to prevent showing stale data
    setLoading(true);
    setRequestsLoaded(false);
    setSchedulesLoaded(false);
    setInitialLoadComplete(false);
    setTodayRequests([]);
    setTodaySchedules([]);
    setTodayResolvedRequests([]);
    setSelectedRequest(null);
    setSelectedSchedule(null);
    setShowDetailsModal(false);
    setShowApproveModal(false);
    setShowRejectModal(false);
  }, [user?.uid, todayStr]);

  // Subscribe to today's clock requests
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let hasReceivedData = false;

    const unsubscribe = subscribeToClockRequests(
      { status: 'pending', programManagerId: user.uid },
      (data) => {
        if (!isMounted) return;
        hasReceivedData = true;
        
        // Filter for today only
        const today = todayStr;
        const filtered = data.filter(request => {
          const requestDate = request.date || '';
          return requestDate === today;
        });

        setTodayRequests(filtered);
        setRequestsLoaded(true);
      },
      (error) => {
        console.error('Error in real-time requests listener:', error);
        if (!isMounted) return;
        if (!hasReceivedData) {
          setTodayRequests([]);
          setRequestsLoaded(true); // Mark as loaded even on error to prevent infinite loading
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid, todayStr]);

  // Subscribe to today's resolved requests to show status updates
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;

    const unsubscribe = subscribeToClockRequests(
      { programManagerId: user.uid },
      (data) => {
        if (!isMounted) return;
        const today = todayStr;
        const resolved = data.filter(
          (request) => request.date === today && request.status && request.status !== 'pending'
        );
        setTodayResolvedRequests(resolved);
      },
      (error) => {
        console.error('Error in resolved requests listener:', error);
        if (isMounted) {
          setTodayResolvedRequests([]);
        }
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, todayStr]);

  // Subscribe to schedules and filter for today
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let hasReceivedData = false;
    const pmId = user.uid;
    const today = todayStr;

    const unsubscribe = subscribeToScheduleUpdates((allSchedules) => {
      if (!isMounted) return;
      hasReceivedData = true;

      const todayTasks = [];
      
      // Helper function to check if a date is within range and not excluded
      const isDateInRange = (startDate, endDate, excludedDates = []) => {
        if (!startDate) return false;
        const end = endDate || startDate;
        const todayDate = new Date(today);
        const start = new Date(startDate);
        const endDateObj = new Date(end);
        
        // Check if today is in excluded dates
        if (excludedDates && excludedDates.includes(today)) {
          return false;
        }
        
        // Check if today is between start and end
        return todayDate >= start && todayDate <= endDateObj;
      };
      
      // Process all schedules
      Object.entries(allSchedules || {}).forEach(([dateKey, tasks]) => {
        if (!Array.isArray(tasks)) return;

        tasks.forEach(task => {
          // Check if PM is assigned
          const isPMAssigned = task.assignedPMIds && task.assignedPMIds.includes(pmId);
          if (!isPMAssigned) return;

          // Check if task is for today
          const taskDate = task.startDate || task.date || dateKey;
          const isToday = taskDate === today || isDateInRange(task.startDate, task.endDate, task.excludedDates);
          
          if (isToday) {
            // Get trainer info - try multiple sources
            const trainerName = task.trainer || task.trainerName;
            const trainerId = task.trainerId;
            const trainerEmail = task.trainerEmail;
            
            if (trainerName) {
              todayTasks.push({
                ...task,
                date: today,
                trainerId: trainerId,
                trainer: trainerName,
                trainerEmail: trainerEmail
              });
            }
          }
        });
      });

      setTodaySchedules(todayTasks);
      setSchedulesLoaded(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid, todayStr]);

  // Update loading state when both requests and schedules have loaded
  useEffect(() => {
    if (requestsLoaded && schedulesLoaded) {
      // Use a small delay to ensure all state updates are complete before showing UI
      // This prevents flickering during page transitions
      const timer = setTimeout(() => {
        setLoading(false);
        setInitialLoadComplete(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // If either source is not loaded, ensure loading state is true
      setLoading(true);
      setInitialLoadComplete(false);
    }
  }, [requestsLoaded, schedulesLoaded]);

  // Set command state
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Home',
        description: "Today's requests and assigned trainers",
        actions: null,
        metrics: null,
      });
    }
    return () => {
      if (resetCommandState) {
        resetCommandState();
      }
    };
  }, [setCommandState, resetCommandState]);

  const getStatusDisplay = (statusInfo) => {
    if (!statusInfo) return null;

    const timeLabel = statusInfo.resolvedAt
      ? formatTimestamp(statusInfo.resolvedAt, 'hh:mm a')
      : null;

    if (statusInfo.status === 'approved') {
      const approvedInfo = statusInfo.approvedInfo || {};
      const isCurrentUser =
        approvedInfo.programManagerId && approvedInfo.programManagerId === user?.uid;
      const approverName =
        approvedInfo.approvedBy ||
        (approvedInfo.adminId ? 'Administrator' : 'Approver');

      return {
        tone: 'success',
        message: `${isCurrentUser ? 'Approved by you' : `Approved by ${approverName || 'Reviewer'}`}${
          timeLabel ? ` · ${timeLabel}` : ''
        }`
      };
    }

    if (statusInfo.status === 'rejected') {
      const rejectedInfo = statusInfo.rejectedInfo || {};
      const isCurrentUser =
        rejectedInfo.programManagerId && rejectedInfo.programManagerId === user?.uid;
      const rejecterName =
        rejectedInfo.rejectedBy ||
        (rejectedInfo.adminId ? 'Administrator' : 'Reviewer');

      return {
        tone: 'danger',
        message: `${isCurrentUser ? 'Rejected by you' : `Rejected by ${rejecterName || 'Reviewer'}`}${
          timeLabel ? ` · ${timeLabel}` : ''
        }`,
        reason: statusInfo.rejectionReason || null
      };
    }

    return null;
  };

  // Handle approve click
  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setApprovalDescription('');
    setError(null);
    setShowApproveModal(true);
  };

  // Handle reject click
  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setError(null);
    setShowRejectModal(true);
  };

  // Handle approve submit
  const handleApproveSubmit = async () => {
    if (!selectedRequest) return;

    setProcessing(selectedRequest.requestId);
    setError(null);

    try {
      const result = await approveClockRequest(
        selectedRequest.requestId,
        user.uid,
        null,
        approvalDescription.trim() || null
      );

      if (result.success) {
        toast({
          title: 'Request approved',
          description: `Clock ${selectedRequest.type === 'clock_in' ? 'in' : 'out'} request approved for ${selectedRequest.trainerName}`,
        });
        setShowApproveModal(false);
        setSelectedRequest(null);
        setApprovalDescription('');
      } else {
        setError(result.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setError(error.message || 'Failed to approve request');
    } finally {
      setProcessing(null);
    }
  };

  // Handle reject submit
  const handleRejectSubmit = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setProcessing(selectedRequest.requestId);
    setError(null);

    try {
      const result = await rejectClockRequest(
        selectedRequest.requestId,
        rejectionReason.trim(),
        user.uid,
        null
      );

      if (result.success) {
        toast({
          title: 'Request rejected',
          description: `Clock ${selectedRequest.type === 'clock_in' ? 'in' : 'out'} request rejected for ${selectedRequest.trainerName}`,
        });
        setShowRejectModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
      } else {
        setError(result.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError(error.message || 'Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  // Handle details click
  const handleDetailsClick = (trainer) => {
    // Show both request and schedule if both exist
    setSelectedRequest(trainer.hasRequest ? trainer.request : null);
    setSelectedSchedule(trainer.schedule);
    setShowDetailsModal(true);
  };

  return (
    <div className="min-h-full w-full">
      <div className="space-y-4 px-4 py-6 sm:px-5 max-w-6xl mx-auto">
        {(loading || !initialLoadComplete || !requestsLoaded || !schedulesLoaded) ? (
          <div className="bg-white rounded-lg border border-[#E0E0E0] p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-slate-600">Loading today's requests...</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
          {todayTrainers.length > 0 ? (
          <div className="space-y-3">
            {todayTrainers.map((trainer, index) => {
              const statusDisplay = trainer.statusInfo ? getStatusDisplay(trainer.statusInfo) : null;
              return (
                <motion.div
                  key={trainer.trainerId || trainer.trainerName || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-lg border border-[#E0E0E0] shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-[#2C2C2C] truncate">
                            {trainer.trainerName || 'Unknown Trainer'}
                          </h3>
                          {trainer.hasRequest ? (
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                              {trainer.request.type === 'clock_in' ? 'Clock In Request' : 'Clock Out Request'}
                            </p>
                          ) : statusDisplay ? (
                            <div className="mt-0.5 space-y-0.5">
                              <p
                                className={cn(
                                  'text-xs sm:text-sm font-medium truncate',
                                  statusDisplay.tone === 'success' ? 'text-emerald-600' : 'text-red-600'
                                )}
                              >
                                {statusDisplay.message}
                              </p>
                              {statusDisplay.reason && (
                                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                                  Reason: {statusDisplay.reason}
                                </p>
                              )}
                            </div>
                          ) : trainer.schedule ? (
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                              Assigned - No request yet
                            </p>
                          ) : (
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                              No tasks assigned
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {trainer.hasRequest && (
                          <>
                            <button
                              onClick={() => handleApproveClick(trainer.request)}
                              disabled={processing === trainer.request.requestId}
                              className="p-2 sm:px-3 sm:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                              aria-label="Approve"
                            >
                              <CheckCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden sm:inline ml-1.5 text-xs sm:text-sm font-medium">Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick(trainer.request)}
                              disabled={processing === trainer.request.requestId}
                              className="p-2 sm:px-3 sm:py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                              aria-label="Reject"
                            >
                              <XCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden sm:inline ml-1.5 text-xs sm:text-sm font-medium">Reject</span>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDetailsClick(trainer)}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex-shrink-0"
                          aria-label="View details"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg border border-[#E0E0E0] p-6 sm:p-8 text-center"
          >
            <AlertCircle className="mx-auto w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-[#2C2C2C] mb-2">No trainers assigned for today</h3>
            <p className="text-sm text-slate-600">
              There are no trainers assigned to tasks for today.
            </p>
          </motion.div>
          )}
        </motion.div>
        )}

        {/* Task Details Modal */}
        {showDetailsModal && createPortal(
          <div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDetailsModal(false);
                setSelectedRequest(null);
                setSelectedSchedule(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {selectedRequest && selectedSchedule ? 'Task & Request Details' : selectedRequest ? 'Request Details' : 'Task Details'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {selectedRequest?.trainerName || selectedSchedule?.trainer || 'Trainer'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedRequest(null);
                    setSelectedSchedule(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-6">
                  {/* Task Details (Schedule) */}
                  {selectedSchedule && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2">Task Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>
                            <strong>Date:</strong> {selectedSchedule.date ? formatDateForDisplay(selectedSchedule.date, 'MMM d, yyyy') : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <span>
                            <strong>Client:</strong> {selectedSchedule.client || 'N/A'}
                          </span>
                        </div>
                        {selectedSchedule.course && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>
                              <strong>Course:</strong> {selectedSchedule.course}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span>
                            <strong>Task Type:</strong> {selectedSchedule.type === 'training' ? 'Training' : 'Non-Training'}
                          </span>
                        </div>
                        {selectedSchedule.description && (
                          <div className="text-sm text-slate-600">
                            <strong>Description:</strong>
                            <p className="mt-1 text-slate-900">{selectedSchedule.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Request Details */}
                  {selectedRequest && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2">Request Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>
                            <strong>Requested for:</strong> {selectedRequest.date ? formatDateForDisplay(selectedRequest.date, 'MMM d, yyyy') : 'N/A'}
                          </span>
                        </div>
                        {selectedRequest.requestedAt && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>
                              <strong>Requested at:</strong> {formatTimestamp(selectedRequest.requestedAt, 'MMM dd, yyyy hh:mm a')}
                            </span>
                          </div>
                        )}
                      </div>

                    {/* Clock In/Out Info */}
                    {selectedRequest.type === 'clock_in' && selectedRequest.clockInLocation && (
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold text-slate-900">Clock In Information</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-slate-600">Time: </span>
                              <span className="font-medium text-slate-900">
                                {formatTimestamp(selectedRequest.clockInTime, 'hh:mm a')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-slate-600">Location: </span>
                              <span className="font-medium text-slate-900">
                                {selectedRequest.clockInLocation.formattedAddress || 
                                 selectedRequest.clockInLocation.address || 
                                 `${selectedRequest.clockInLocation.latitude}, ${selectedRequest.clockInLocation.longitude}`}
                              </span>
                              {(selectedRequest.clockInLocation.latitude || selectedRequest.clockInLocation.accuracy) && (
                                <span className="text-xs text-slate-500 ml-2">
                                  ({selectedRequest.clockInLocation.latitude?.toFixed(4)}, {selectedRequest.clockInLocation.longitude?.toFixed(4)}
                                  {selectedRequest.clockInLocation.accuracy && `, ±${selectedRequest.clockInLocation.accuracy}m`})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRequest.type === 'clock_out' && selectedRequest.clockOutLocation && (
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold text-slate-900">Clock Out Information</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-slate-600">Time: </span>
                              <span className="font-medium text-slate-900">
                                {formatTimestamp(selectedRequest.clockOutTime, 'hh:mm a')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-slate-600">Location: </span>
                              <span className="font-medium text-slate-900">
                                {selectedRequest.clockOutLocation.formattedAddress || 
                                 selectedRequest.clockOutLocation.address || 
                                 `${selectedRequest.clockOutLocation.latitude}, ${selectedRequest.clockOutLocation.longitude}`}
                              </span>
                              {(selectedRequest.clockOutLocation.latitude || selectedRequest.clockOutLocation.accuracy) && (
                                <span className="text-xs text-slate-500 ml-2">
                                  ({selectedRequest.clockOutLocation.latitude?.toFixed(4)}, {selectedRequest.clockOutLocation.longitude?.toFixed(4)}
                                  {selectedRequest.clockOutLocation.accuracy && `, ±${selectedRequest.clockOutLocation.accuracy}m`})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                      {/* Client Info */}
                      {selectedRequest.trainerClientNames && selectedRequest.trainerClientNames.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-slate-600">Client(s): </span>
                            <span className="font-medium text-slate-900">
                              {selectedRequest.trainerClientNames.join(', ')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedRequest && createPortal(
          <div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowApproveModal(false);
                setSelectedRequest(null);
                setApprovalDescription('');
                setError(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#2C2C2C]">Approve Request</h3>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedRequest(null);
                    setApprovalDescription('');
                    setError(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X size={20} className="text-slate-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">Approve clock-in/out request for:</p>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="font-medium text-slate-900">{selectedRequest.trainerName}</p>
                  <p className="text-sm text-slate-600">{selectedRequest.date}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedRequest.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={approvalDescription}
                  onChange={(e) => setApprovalDescription(e.target.value)}
                  placeholder="Add any notes or comments..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {approvalDescription.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedRequest(null);
                    setApprovalDescription('');
                    setError(null);
                  }}
                  disabled={processing === selectedRequest.requestId}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveSubmit}
                  disabled={processing === selectedRequest.requestId}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {processing === selectedRequest.requestId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Approve
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && createPortal(
          <div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRejectModal(false);
                setSelectedRequest(null);
                setRejectionReason('');
                setError(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#2C2C2C]">Reject Request</h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                    setError(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X size={20} className="text-slate-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">Reject clock-in/out request for:</p>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="font-medium text-slate-900">{selectedRequest.trainerName}</p>
                  <p className="text-sm text-slate-600">{selectedRequest.date}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedRequest.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none text-sm"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  {rejectionReason.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                    setError(null);
                  }}
                  disabled={processing === selectedRequest.requestId}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={processing === selectedRequest.requestId || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {processing === selectedRequest.requestId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Reject
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

