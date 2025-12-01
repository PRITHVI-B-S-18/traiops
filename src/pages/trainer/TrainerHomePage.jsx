import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation as useLocationHook } from '@/hooks/useLocation';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Loader2,
  Briefcase,
  User,
  Building2,
  BookOpen,
  FileText,
  ArrowRight,
  CalendarDays,
  History,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { filterTrainerSchedules } from '@/utils/trainerSchedule';
import { subscribeToScheduleUpdates } from '@/utils/firestoreSchedule';
import { loadTrainerData } from '@/utils/firestoreTrainers';
import { getClockRecordByDate } from '@/utils/firestoreClockRecords';
import { getClockRequestsByTrainer } from '@/utils/firestoreClockRequests';
import { createClockRequest } from '@/utils/firestoreClockRequests';
import { createClockRecord, updateClockRecord } from '@/utils/firestoreClockRecords';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import TaskDetailsModal from '@/components/trainer/TaskDetailsModal';
import TrainerCalendar from '@/components/trainer/TrainerCalendar';
import UpcomingTasksView from '@/components/trainer/UpcomingTasksView';
import LocationPermissionModal from '@/components/trainer/LocationPermissionModal';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import { formatDateForDisplay } from '@/utils/timezoneUtils';

const TrainerHomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setCommandState, resetCommandState } = useOutletContext();
  const {
    locationPermission,
    requestLocation,
    saveLocationPermission
  } = useLocationHook(user?.uid);

  const [todayTasks, setTodayTasks] = useState([]);
  const [trainerName, setTrainerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [clockInStatus, setClockInStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [clockOutStatus, setClockOutStatus] = useState(null); // null, 'approved'
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [showClockOutButton, setShowClockOutButton] = useState(false); // Controls delayed display of clock-out button
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [allSchedules, setAllSchedules] = useState({});
  const [trainerSchedules, setTrainerSchedules] = useState({});
  const [clockStatus, setClockStatus] = useState({});
  const [selectedTaskDate, setSelectedTaskDate] = useState(null);
  const [selectedTaskList, setSelectedTaskList] = useState([]);

  const latestSchedulesRef = useRef({});
  const trainerNameRef = useRef('');

  // Get today's date in YYYY-MM-DD format
  const getTodayDateStr = () => {
    return format(new Date(), 'yyyy-MM-dd');
  };

  // Get trainer name
  useEffect(() => {
    const getTrainerName = async () => {
      if (!user?.email) return;
      try {
        const trainers = await loadTrainerData();
        const trainer = trainers.find(t => (t.email || '').trim().toLowerCase() === user.email?.trim().toLowerCase());
        if (trainer) {
          setTrainerName(trainer.name);
          trainerNameRef.current = trainer.name;
        }
      } catch (error) {
        console.error('Error loading trainer name:', error);
      }
    };
    getTrainerName();
  }, [user?.email]);

  // Subscribe to schedule updates
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToScheduleUpdates((allSchedules) => {
      const schedules = allSchedules || {};
      latestSchedulesRef.current = schedules;
      setAllSchedules(schedules);

      const currentTrainerName = trainerNameRef.current;
      if (currentTrainerName) {
        console.log('Filtering schedules for trainer:', currentTrainerName);
        const filteredSchedules = filterTrainerSchedules(schedules, currentTrainerName);
        setTrainerSchedules(filteredSchedules);
        const todayStr = getTodayDateStr();
        const todayTasksList = filteredSchedules[todayStr] || [];
        setTodayTasks(todayTasksList);
        setLoading(false);
      } else {
        console.log('Trainer name not available yet, waiting...');
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Process schedules when trainer name becomes available
  useEffect(() => {
    if (trainerName && Object.keys(latestSchedulesRef.current).length > 0) {
      console.log('Processing schedules for trainer:', trainerName);
      const filteredSchedules = filterTrainerSchedules(latestSchedulesRef.current, trainerName);
      setTrainerSchedules(filteredSchedules);
      const todayStr = getTodayDateStr();
      const todayTasksList = filteredSchedules[todayStr] || [];
      setTodayTasks(todayTasksList);
      setLoading(false);
    }
  }, [trainerName, allSchedules]);

  // Real-time clock status listener
  useEffect(() => {
    if (!user?.uid) return;

    const todayStr = getTodayDateStr();
    let unsubscribeRequests = null;
    let unsubscribeRecords = null;

    // Real-time listener for clock records
    const setupListeners = async () => {
      const { collection, query, where, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('@/firebase');

      // Listen to clock records
      const recordsQuery = query(
        collection(db, 'clock_records'),
        where('trainerId', '==', user.uid),
        where('date', '==', todayStr)
      );

      unsubscribeRecords = onSnapshot(
        recordsQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const record = {
              recordId: snapshot.docs[0].id,
              ...snapshot.docs[0].data()
            };
            
            if (record.clockIn) {
              setClockInStatus('approved');
              setShowClockOutButton(true); // Show immediately if approved
            }
            if (record.clockOut) {
              setClockOutStatus('approved');
            }
          }
        },
        (error) => {
          console.error('Error in clock records listener:', error);
        }
      );

      // Listen to clock requests
      const requestsQuery = query(
        collection(db, 'clock_requests'),
        where('trainerId', '==', user.uid)
      );

      unsubscribeRequests = onSnapshot(
        requestsQuery,
        (snapshot) => {
          const requests = snapshot.docs.map(doc => ({
            requestId: doc.id,
            ...doc.data()
          }));

          const todayRequest = requests.find(req => {
            const reqDate = req.date || (req.requestedAt?.toDate ? format(req.requestedAt.toDate(), 'yyyy-MM-dd') : '');
            return reqDate === todayStr && req.type === 'clock_in';
          });

          if (todayRequest) {
            setClockInStatus(todayRequest.status);
            // If status is approved, show clock-out button immediately
            if (todayRequest.status === 'approved') {
              setShowClockOutButton(true);
            }
          } else {
            // Only reset if we don't have an approved record
            const checkRecord = async () => {
              const record = await getClockRecordByDate(user.uid, todayStr);
              if (!record?.clockIn) {
                setClockInStatus(null);
                setShowClockOutButton(false);
              }
            };
            checkRecord();
          }
        },
        (error) => {
          console.error('Error in clock requests listener:', error);
        }
      );
    };

    setupListeners();

    return () => {
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeRecords) unsubscribeRecords();
    };
  }, [user?.uid]);

  // Delay showing clock-out button by 2 seconds when clock-in status becomes pending
  useEffect(() => {
    if (clockInStatus === 'pending') {
      // Reset the button visibility
      setShowClockOutButton(false);
      // Show after 2 seconds
      const timer = setTimeout(() => {
        setShowClockOutButton(true);
      }, 4 * 1000);
      return () => clearTimeout(timer);
    } else if (clockInStatus === 'approved') {
      // Show immediately if approved
      setShowClockOutButton(true);
    } else if (clockInStatus === null || clockInStatus === 'rejected') {
      // Hide if no clock-in or rejected
      setShowClockOutButton(false);
    }
  }, [clockInStatus]);

  // Check location permission
  useEffect(() => {
    const checkLocation = async () => {
      if (!user?.uid) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/firebase');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setLocationGranted(userData.locationAccessGranted || false);
          if (!userData.locationAccessGranted) {
            setShowLocationModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking location permission:', error);
      }
    };
    checkLocation();
  }, [user?.uid]);

  // Set page title
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Home',
        description: 'View today\'s tasks and clock in/out',
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

  const handleClockIn = async () => {
    if (!user?.uid || isClockingIn) return;

    if (clockInStatus === 'pending' || clockInStatus === 'approved') {
      toast({
        title: 'Already clocked in',
        description: clockInStatus === 'approved' 
          ? 'You have already clocked in for today.'
          : 'Your clock-in request is pending approval.',
        variant: 'destructive'
      });
      return;
    }

    setIsClockingIn(true);
    try {
      const todayStr = getTodayDateStr();
      const location = await requestLocation();

      const currentTask = todayTasks.length > 0 ? todayTasks[0] : null;
      const isNonTrainingTask = currentTask?.type !== 'training';

      if (isNonTrainingTask) {
        // Non-training: create record directly
        const clockInData = {
          timestamp: Timestamp.now(),
          location: {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            placeName: location.placeName || 'Unknown Location',
            formattedAddress: location.formattedAddress || `${location.latitude}, ${location.longitude}`,
            road: location.road || '',
            neighbourhood: location.neighbourhood || '',
            city: location.city || '',
            district: location.district || '',
            state: location.state || '',
            country: location.country || '',
            countryCode: location.countryCode || '',
            postcode: location.postcode || ''
          },
          approvedBy: 'system',
          approvedAt: Timestamp.now()
        };

        let existingRecord = await getClockRecordByDate(user.uid, todayStr);
        
        if (existingRecord) {
          await updateClockRecord(existingRecord.recordId, {
            clockIn: clockInData,
            status: 'active',
            isNonTraining: true,
            requiresApproval: false,
            taskId: currentTask?.id || null
          });
        } else {
          const { createClockRecord } = await import('@/utils/firestoreClockRecords');
          await createClockRecord({
            trainerId: user.uid,
            trainerEmail: user.email,
            trainerName: user.displayName || user.email?.split('@')[0],
            date: todayStr,
            clockIn: clockInData,
            status: 'active',
            isNonTraining: true,
            requiresApproval: false,
            taskId: currentTask?.id || null,
            taskType: currentTask?.taskType || 'Non-Training Task'
          });
        }

        setClockInStatus('approved');
        toast({
          title: 'Clocked in successfully',
          description: `Location: ${location.placeName || 'Location captured'}`,
        });
      } else {
        // Training: create request
        const requestData = {
          trainerId: user.uid,
          trainerEmail: user.email,
          trainerName: user.displayName || user.email?.split('@')[0],
          type: 'clock_in',
          date: todayStr,
          location: {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            placeName: location.placeName || 'Unknown Location',
            formattedAddress: location.formattedAddress || `${location.latitude}, ${location.longitude}`,
            road: location.road || '',
            neighbourhood: location.neighbourhood || '',
            city: location.city || '',
            district: location.district || '',
            state: location.state || '',
            country: location.country || '',
            countryCode: location.countryCode || '',
            postcode: location.postcode || ''
          },
          status: 'pending',
          taskId: currentTask?.id || null,
          taskPMIds: currentTask?.assignedPMIds || null,
          taskClientId: currentTask?.clientId || null,
          taskClientName: currentTask?.client || null
        };

        const result = await createClockRequest(requestData);
        if (result.success) {
          setClockInStatus('pending');
          toast({
            title: 'Clock-in request submitted',
            description: 'Waiting for Program Manager approval.',
          });
        } else {
          throw new Error(result.error || 'Failed to create request');
        }
      }
    } catch (error) {
      console.error('Clock-in error:', error);
      toast({
        title: 'Clock-in failed',
        description: error.message || 'Failed to submit clock-in request',
        variant: 'destructive'
      });
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!user?.uid || isClockingOut || (clockInStatus !== 'pending' && clockInStatus !== 'approved')) return;

    setIsClockingOut(true);
    try {
      const todayStr = getTodayDateStr();
      const location = await requestLocation();

      const currentTask = todayTasks.length > 0 ? todayTasks[0] : null;
      const isNonTrainingTask = currentTask?.type !== 'training';

      const clockOutData = {
        timestamp: Timestamp.now(),
        location: {
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          placeName: location.placeName || 'Unknown Location',
          formattedAddress: location.formattedAddress || `${location.latitude}, ${location.longitude}`,
          road: location.road || '',
          neighbourhood: location.neighbourhood || '',
          city: location.city || '',
          district: location.district || '',
          state: location.state || '',
          country: location.country || '',
          countryCode: location.countryCode || '',
          postcode: location.postcode || ''
        },
        approvedBy: user.uid, // Clock-out is always self-approved by trainer (no PM/Admin approval needed)
        approvedAt: Timestamp.now()
      };

      let existingRecord = await getClockRecordByDate(user.uid, todayStr);
      
      if (existingRecord) {
        await updateClockRecord(existingRecord.recordId, {
          clockOut: clockOutData,
          status: 'completed',
          isNonTraining: isNonTrainingTask,
          requiresApproval: false // Clock-out never requires approval
        });
      } else {
        // Create new record
        const { createClockRecord } = await import('@/utils/firestoreClockRecords');
        await createClockRecord({
          trainerId: user.uid,
          trainerEmail: user.email,
          trainerName: user.displayName || user.email?.split('@')[0],
          date: todayStr,
          clockOut: clockOutData,
          status: 'completed',
          isNonTraining: isNonTrainingTask,
          requiresApproval: false, // Clock-out never requires approval
          taskId: currentTask?.id || null,
          taskType: currentTask?.taskType || null
        });
      }

      setClockOutStatus('approved');
      toast({
        title: 'Clocked out successfully',
        description: `Location: ${location.placeName || 'Location captured'}`,
      });
    } catch (error) {
      console.error('Clock-out error:', error);
      toast({
        title: 'Clock-out failed',
        description: error.message || 'Failed to record clock-out',
        variant: 'destructive'
      });
    } finally {
      setIsClockingOut(false);
    }
  };

  const handleAllowLocation = async (locationData) => {
    try {
      await saveLocationPermission(true);
      setLocationGranted(true);
      setShowLocationModal(false);
    } catch (error) {
      console.error('Error saving location permission:', error);
    }
  };

  if (loading) {
    return <LoadingSkeleton message="Loading today's tasks..." className="h-[60vh]" />;
  }

  const todayStr = getTodayDateStr();
  const hasTaskToday = todayTasks.length > 0;

  return (
    <div className="min-h-full w-full">
      <div className="space-y-4 px-4 py-6 sm:px-5 max-w-6xl mx-auto">
        {/* Location Permission Modal */}
        <LocationPermissionModal
          isOpen={showLocationModal}
          onAllow={handleAllowLocation}
        />

        {/* Today's Task Widget - Simplified */}
        {hasTaskToday ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(cardStyles.surface, 'p-3 sm:p-4')}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">
                    Today's Task
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">
                    {formatDateForDisplay(todayStr, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Arrow Button to View Details */}
              <button
                onClick={() => setShowTaskDetails(true)}
                className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="View task details"
              >
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Clock In/Out Section - Compact */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
              {/* Clock In Button */}
              {clockInStatus !== 'approved' && (
                <Button
                  onClick={handleClockIn}
                  disabled={isClockingIn || clockInStatus === 'pending' || clockInStatus === 'rejected'}
                  size="sm"
                  className={cn(
                    'w-full sm:w-auto min-w-[120px] h-9 text-sm',
                    clockInStatus === 'pending' 
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : clockInStatus === 'rejected'
                      ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {isClockingIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Getting Location...
                    </>
                  ) : clockInStatus === 'pending' ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                      Pending Approval
                    </>
                  ) : clockInStatus === 'rejected' ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Clock-in Disabled
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      Clock In
                    </>
                  )}
                </Button>
              )}

              {/* Clock Out Section - Show with delay if pending, immediately if approved */}
              {showClockOutButton && (clockInStatus === 'pending' || clockInStatus === 'approved') && clockOutStatus !== 'approved' && (
                <div className="space-y-2">
                  {/* Instructional Note */}
                  <p className="text-xs text-slate-500 italic">
                    💡 Clock out when your training session is complete
                  </p>
                  
                  {/* Clock Out Button */}
                  <Button
                    onClick={handleClockOut}
                    disabled={isClockingOut}
                    size="sm"
                    className="w-full sm:w-auto min-w-[120px] h-9 text-sm bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isClockingOut ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Clock Out
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Completed Status - Compact */}
              {clockOutStatus === 'approved' && (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Completed for today</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* No Task Today - Show View Upcoming Tasks Button */
          !showCalendar && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(cardStyles.surface, 'p-4 sm:p-6 text-center')}
            >
              <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
                No tasks assigned for today
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                You don't have any tasks scheduled for today.
              </p>
              <Button
                onClick={() => setShowCalendar(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                View Upcoming Tasks
              </Button>
            </motion.div>
          )
        )}

        {/* Task Details Modal */}
        <TaskDetailsModal
          isOpen={showTaskDetails}
          onClose={() => {
            setShowTaskDetails(false);
            setSelectedTaskDate(null);
            setSelectedTaskList([]);
          }}
          date={selectedTaskDate || todayStr}
          tasks={selectedTaskList.length > 0 ? selectedTaskList : todayTasks}
          showClockActions={selectedTaskDate === todayStr || !selectedTaskDate}
        />

        {/* Upcoming Tasks View */}
        {showCalendar && (
          <div className="w-full h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
            <UpcomingTasksView
              schedules={trainerSchedules}
              clockStatus={clockStatus}
              onTaskClick={(date, tasks) => {
                setSelectedTaskDate(date);
                setSelectedTaskList(tasks);
                setShowTaskDetails(true);
              }}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerHomePage;

