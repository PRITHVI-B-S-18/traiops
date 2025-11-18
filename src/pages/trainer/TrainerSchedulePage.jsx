import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLocation as useLocationHook } from '@/hooks/useLocation';
import { useOutletContext } from 'react-router-dom';
import LocationPermissionModal from '@/components/trainer/LocationPermissionModal';
import TrainerCalendar from '@/components/trainer/TrainerCalendar';
import TaskDetailsModal from '@/components/trainer/TaskDetailsModal';
import OnboardingForm from '@/components/trainer/OnboardingForm';
import PendingApproval from '@/components/trainer/PendingApproval';
import { filterTrainerSchedules, calculateTrainerStats } from '@/utils/trainerSchedule';
import { subscribeToScheduleUpdates } from '@/utils/firestoreSchedule';
import {
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  CalendarDays,
  CheckCircle2
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { loadTrainerData } from '@/utils/firestoreTrainers';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  cardPadding,
  cardStyles,
  getChipClasses,
  panelPadding,
  sectionSpacing,
  statIconWrapper
} from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

const TrainerSchedulePage = () => {
  const { user } = useAuth();
  const { sidebarOpen, setCommandState, resetCommandState } = useOutletContext();
  const {
    locationPermission,
    requestLocation,
    saveLocationPermission
  } = useLocationHook(user?.uid);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [schedules, setSchedules] = useState({});
  const [stats, setStats] = useState(null);
  const [trainerName, setTrainerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [clockStatus, setClockStatus] = useState({}); // Map of date -> { clockInStatus, clockOutStatus }
  
  // Use refs to store latest data so subscription callbacks can access current values
  const latestSchedulesRef = useRef({});
  const trainerNameRef = useRef('');
  const processSchedulesRef = useRef(null);

  // Check onboarding status and get trainer name
  useEffect(() => {
    let isMounted = true;
    let hasRun = false;

    const checkOnboardingAndGetName = async () => {
      if (!user?.uid || !user?.email || hasRun) return;
      hasRun = true;

      try {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!isMounted) return;
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const status = userData.onboardingStatus;
          if (isMounted) {
            setOnboardingStatus(status);
          }

          console.log('Trainer onboarding check:', {
            email: user.email,
            onboardingStatus: status,
            role: userData.role,
            trainerAccountId: userData.trainerAccountId
          });

          // Check different onboarding statuses
          if (status === 'not_started') {
            const trainers = await loadTrainerData();
            if (!isMounted) return;
            const trainer = trainers.find(t => (t.email || '').trim().toLowerCase() === user.email?.trim().toLowerCase());
            if (trainer) {
              setTrainerName(trainer.name);
              setNeedsOnboarding(true);
              setSkipOnboarding(true);
              setCheckingPermission(false);
            } else {
              setNeedsOnboarding(true);
              setSkipOnboarding(false);
              setCheckingPermission(false);
            }
            return;
          } else if (status === 'pending') {
            // Waiting for admin approval - but now we allow immediate access
            // Check if trainer is in collection anyway
            const trainers = await loadTrainerData();
            if (!isMounted) return;
            const trainer = trainers.find(t => t.email === user.email);
            if (trainer) {
              setTrainerName(trainer.name);
              setNeedsOnboarding(false);
              setSkipOnboarding(false);
              setCheckingPermission(false);
            } else {
              setNeedsOnboarding(false);
              setSkipOnboarding(false);
              setCheckingPermission(false);
            }
            return;
          } else if (status === 'rejected') {
            // Rejected - can resubmit
            if (isMounted) {
              setNeedsOnboarding(true);
              setSkipOnboarding(false);
              setCheckingPermission(false);
            }
            return;
          } else if (status === 'approved' || !status) {
            // Approved or existing trainer - check if in Trainer Accounts
            const trainers = await loadTrainerData();
            if (!isMounted) return;
            const trainer = trainers.find(t => t.email === user.email);
            
            console.log('Trainer lookup:', {
              email: user.email,
              found: !!trainer,
              trainerName: trainer?.name,
              totalTrainers: trainers.length
            });
            
            if (trainer) {
              setTrainerName(trainer.name);
              setNeedsOnboarding(false);
              setSkipOnboarding(false);
              setCheckingPermission(false);
            } else {
              // Not found in trainers collection
              console.warn('Trainer not found in trainers collection:', user.email);
              // If approved but not found, might be a timing issue - try again
              if (status === 'approved') {
                // Wait a bit and try again (might be async write)
                setTimeout(async () => {
                  if (!isMounted) return;
                  const trainersRetry = await loadTrainerData();
                  const trainerRetry = trainersRetry.find(t => t.email === user.email);
                  if (trainerRetry) {
                    setTrainerName(trainerRetry.name);
                    setNeedsOnboarding(false);
                    setSkipOnboarding(false);
                  }
                  setCheckingPermission(false);
                }, 1000);
              } else {
                // No status and not in Trainer Accounts = needs onboarding
                if (isMounted) {
                  setNeedsOnboarding(true);
                  setSkipOnboarding(false);
                  setCheckingPermission(false);
                }
              }
            }
          }
        } else {
          // New user without user document, check if in Trainer Accounts
          const trainers = await loadTrainerData();
          if (!isMounted) return;
          const trainer = trainers.find(t => t.email === user.email);
          if (trainer) {
            setTrainerName(trainer.name);
            setNeedsOnboarding(false);
            setSkipOnboarding(false);
          } else {
            setNeedsOnboarding(true);
            setSkipOnboarding(false);
          }
          setCheckingPermission(false);
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        if (isMounted) {
          setCheckingPermission(false);
        }
      }
    };

    checkOnboardingAndGetName();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.email]); // Use specific properties instead of whole user object

  // Function to process schedules for the current trainer - optimized to prevent unnecessary updates
  const processSchedules = useCallback((allSchedules, currentTrainerName) => {
    if (!currentTrainerName) return;

    try {
      // Filter schedules for this trainer
      const trainerSchedules = filterTrainerSchedules(allSchedules || {}, currentTrainerName);
      
      // Calculate stats from filtered schedules
      const trainerStats = calculateTrainerStats(trainerSchedules);
      
      // Update state - ensure new object reference for React to detect changes
      const newSchedules = Object.keys(trainerSchedules).reduce((acc, date) => {
        acc[date] = [...trainerSchedules[date]]; // Create new array reference
        return acc;
      }, {});
      
      // Only update if data actually changed
      setSchedules(prev => {
        const prevKeys = Object.keys(prev).sort().join(',');
        const newKeys = Object.keys(newSchedules).sort().join(',');
        if (prevKeys === newKeys) {
          // Check if content changed
          let hasChanges = false;
          for (const date in newSchedules) {
            if (prev[date]?.length !== newSchedules[date]?.length) {
              hasChanges = true;
              break;
            }
          }
          if (!hasChanges) return prev;
        }
        return newSchedules;
      });
      
      setStats(prev => {
        if (prev && 
            prev.totalDays === trainerStats.totalDays &&
            prev.totalTasks === trainerStats.totalTasks &&
            prev.todayTasks === trainerStats.todayTasks &&
            prev.upcomingTasks === trainerStats.upcomingTasks) {
          return prev;
        }
        return trainerStats;
      });
    } catch (error) {
      console.error('Error processing schedules:', error);
    }
  }, []);
  
  // Store the function in ref for subscription callback
  useEffect(() => {
    processSchedulesRef.current = processSchedules;
  }, [processSchedules]);

  // Set page title immediately on mount
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Overall Schedules',
        description: 'View your complete schedule and manage your tasks',
        actions: null,
        metrics: stats ? [
          <div key="tasks" className={cn(cardStyles.surface, 'p-3 sm:p-4')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-slate-500">Total Task Days</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{stats.totalTasks}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
            </div>
          </div>,
          <div key="upcoming" className={cn(cardStyles.surface, 'p-3 sm:p-4')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs text-slate-500">Upcoming</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{stats.upcomingTasks}</p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
            </div>
          </div>,
        ] : null,
      });
    }
    return () => {
      if (resetCommandState) {
        resetCommandState();
      }
    };
  }, [stats, locationGranted, checkingPermission, setCommandState, resetCommandState]);

  // Update trainer name ref whenever it changes
  useEffect(() => {
    trainerNameRef.current = trainerName;
  }, [trainerName]);

  // Real-time schedule subscription - optimized for performance
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let initialLoad = true;
    let lastProcessedData = null;

    // Start subscription immediately - don't wait for trainerName
    const unsubscribe = subscribeToScheduleUpdates((allSchedules) => {
      if (!isMounted) return;

      try {
        const schedules = allSchedules || {};
        
        // Skip if data hasn't changed (shallow comparison)
        if (lastProcessedData && 
            Object.keys(lastProcessedData).length === Object.keys(schedules).length &&
            Object.keys(lastProcessedData).every(key => 
              lastProcessedData[key]?.length === schedules[key]?.length
            )) {
          return; // No changes, skip processing
        }
        
        // Store the latest schedules
        latestSchedulesRef.current = schedules;
        lastProcessedData = schedules;
        
        // Get current trainer name from ref
        const currentTrainerName = trainerNameRef.current;
        
        // If trainer name is available, process immediately
        if (currentTrainerName) {
          processSchedulesRef.current(schedules, currentTrainerName);
          
          if (initialLoad) {
            setLoading(false);
            initialLoad = false;
          }
        } else {
          // Trainer name not available yet, but mark as loaded
          if (initialLoad && Object.keys(schedules).length > 0) {
            setLoading(false);
            initialLoad = false;
          }
        }
      } catch (error) {
        console.error('Error in schedule subscription callback:', error);
        if (isMounted && initialLoad) {
          setLoading(false);
          initialLoad = false;
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user?.uid]); // Only depend on user.uid

  // Process schedules when trainer name becomes available
  useEffect(() => {
    if (trainerName && Object.keys(latestSchedulesRef.current).length > 0) {
      processSchedulesRef.current(latestSchedulesRef.current, trainerName);
    }
  }, [trainerName]); // Re-process when trainer name becomes available

  // Real-time listener for clock records and requests to show status on calendar
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let unsubscribeRequests = null;
    let unsubscribeRecords = null;
    
    let currentRequestsData = [];
    let currentRecordsData = [];

    // Process clock data to create status map
    const processClockData = () => {
      if (!isMounted) return;

      const statusMap = {};

      // First, process clock_records (source of truth for approved records)
      currentRecordsData.forEach(record => {
        const recordDate = record.date;
        if (!recordDate) return;

        statusMap[recordDate] = {
          clockInStatus: record.clockIn ? 'approved' : null,
          clockOutStatus: record.clockOut ? 'completed' : null,
          isNonTraining: record.isNonTraining || false
        };
      });

      // Then, add pending/rejected clock-in requests ONLY if no record exists for that date
      currentRequestsData
        .filter(req => req.type === 'clock_in') // Only clock-in requests
        .forEach(req => {
          const requestDate = req.date || (req.requestedAt?.toDate ? format(req.requestedAt.toDate(), 'yyyy-MM-dd') : '');
          if (!requestDate) return;

          // Only add if no record exists for this date (pending/rejected requests)
          if (!statusMap[requestDate]) {
            statusMap[requestDate] = {
              clockInStatus: req.status, // 'pending' or 'rejected'
              clockOutStatus: null
            };
          }
        });

      if (isMounted) {
        setClockStatus(statusMap);
      }
    };

    // Real-time listener for clock requests
    const requestsQuery = query(
      collection(db, 'clock_requests'),
      where('trainerId', '==', user.uid)
    );

    unsubscribeRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        currentRequestsData = snapshot.docs.map(doc => ({
          requestId: doc.id,
          ...doc.data()
        }));
        processClockData();
      },
      (error) => {
        console.error('Error in clock requests listener for calendar:', error);
      }
    );

    // Real-time listener for clock records
    const recordsQuery = query(
      collection(db, 'clock_records'),
      where('trainerId', '==', user.uid)
    );

    unsubscribeRecords = onSnapshot(
      recordsQuery,
      (snapshot) => {
        currentRecordsData = snapshot.docs.map(doc => ({
          recordId: doc.id,
          ...doc.data()
        }));
        processClockData();
      },
      (error) => {
        console.error('Error in clock records listener for calendar:', error);
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeRecords) unsubscribeRecords();
    };
  }, [user?.uid]);

  // Check location permission - MANDATORY for trainers
  useEffect(() => {
    let isMounted = true;
    let hasRun = false;

    const checkLocationPermission = async () => {
      if (!user?.uid || hasRun) return;
      hasRun = true;

      try {
        if (isMounted) {
          setCheckingPermission(true);
        }
        
        // Check browser's geolocation permission status first
        if (navigator.permissions) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            console.log('📍 Browser location permission:', permissionStatus.state);
            
            // If browser permission is denied, force the modal
            if (permissionStatus.state === 'denied') {
              console.warn('⚠️ Location permission denied in browser');
              if (isMounted) {
                setLocationGranted(false);
                setShowLocationModal(true);
                setCheckingPermission(false);
              }
              return;
            }
          } catch (permError) {
            console.log('⚠️ Permission API not available, will verify on location request');
          }
        }

        // Check Firestore for saved permission
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!isMounted) return;
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const granted = userData.locationAccessGranted || false;
          
          if (granted && navigator.geolocation) {
            // ALWAYS verify with browser if Firestore says granted
            console.log('📍 Verifying browser location permission...');
            navigator.geolocation.getCurrentPosition(
              () => {
                // Permission still granted
                if (!isMounted) return;
                console.log('✅ Location permission verified');
                setLocationGranted(true);
                setShowLocationModal(false);
                setCheckingPermission(false);
              },
              (error) => {
                // Permission denied or error
                if (!isMounted) return;
                console.error('❌ Location verification failed:', error);
                setLocationGranted(false);
                setShowLocationModal(true);
                setCheckingPermission(false);
                // Update Firestore
                saveLocationPermission(false);
              },
              { timeout: 5000, maximumAge: 0 }
            );
          } else {
            // Not granted in Firestore, show modal
            if (isMounted) {
              console.log('📍 Location not granted, showing modal');
              setLocationGranted(false);
              setShowLocationModal(true);
              setCheckingPermission(false);
            }
          }
        } else {
          // New user, show location modal
          if (isMounted) {
            console.log('📍 New user, showing location modal');
            setLocationGranted(false);
            setShowLocationModal(true);
            setCheckingPermission(false);
          }
        }
      } catch (error) {
        console.error('❌ Error checking location permission:', error);
        if (isMounted) {
          setLocationGranted(false);
          setShowLocationModal(true);
          setCheckingPermission(false);
        }
      }
    };

    checkLocationPermission();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [user?.uid, saveLocationPermission]); // Use specific property instead of whole user object

  const handleAllowLocation = async (locationData) => {
    try {
      console.log('✅ Location permission granted, saving to Firestore...');
      // Save to Firestore
      await saveLocationPermission(true);
      setLocationGranted(true);
      setShowLocationModal(false);
      console.log('✅ Location permission saved');
    } catch (error) {
      console.error('❌ Error saving location permission:', error);
    }
  };

  const handleDateClick = (date, tasks) => {
    setSelectedDate(date);
    setSelectedTasks(tasks || []);
    setShowTaskModal(true);
  };

  const handleOnboardingComplete = () => {
    // After onboarding submission, trainer is added to collection
    // Refresh the page or reload trainer data
    window.location.reload();
  };

  // Show onboarding form if needed
  if (needsOnboarding) {
    return <OnboardingForm user={user} onComplete={handleOnboardingComplete} skipOnboarding={skipOnboarding} />;
  }

  // Note: No longer showing pending approval screen - trainers are added immediately
  // and can access their schedule right away (with verification pending in Trainer Accounts)

  if (checkingPermission || loading) {
    return <LoadingSkeleton message="Loading schedule..." className="h-[60vh]" />;
  }

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-5 flex flex-col gap-4 sm:gap-6">
      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onAllow={handleAllowLocation}
      />

      {/* Header removed - now in command ribbon */}

      {/* Location Warning */}
      {!locationGranted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(cardStyles.surface, 'p-3 sm:p-4 border border-rose-200 bg-rose-50 rounded-lg')}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-rose-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-900">Location Required</p>
              <button
                onClick={() => setShowLocationModal(true)}
                className="mt-1.5 text-xs sm:text-sm font-medium text-rose-700 hover:text-rose-900 underline underline-offset-2 transition-colors"
              >
                Enable Location
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards - Now in command ribbon, keeping here as fallback */}
      {stats && false && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center gap-3">
              <div className={cn(statIconWrapper, 'bg-blue-100 text-blue-600')}>
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalDays}</p>
                <p className="text-xs text-slate-500">Total Days</p>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center gap-3">
              <div className={cn(statIconWrapper, 'bg-emerald-100 text-emerald-600')}>
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalTasks}</p>
                <p className="text-xs text-slate-500">Total Tasks</p>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center gap-3">
              <div className={cn(statIconWrapper, 'bg-violet-100 text-violet-600')}>
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.todayTasks}</p>
                <p className="text-xs text-slate-500">Today&apos;s Tasks</p>
              </div>
            </div>
          </div>

          <div className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center gap-3">
              <div className={cn(statIconWrapper, 'bg-orange-100 text-orange-600')}>
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.upcomingTasks}</p>
                <p className="text-xs text-slate-500">Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar - Show only after data is loaded and schedules are ready */}
      {!loading && Object.keys(schedules).length >= 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <TrainerCalendar
          schedules={schedules}
          clockStatus={clockStatus}
          onDateClick={handleDateClick}
          selectedDate={selectedDate}
          onSelectionChange={setSelectedDate}
        />
        </motion.div>
      )}

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedDate(null); // Deselect when modal closes
        }}
        date={selectedDate}
        tasks={selectedTasks}
      />
    </div>
    </div>
  );

};
export default TrainerSchedulePage;
  