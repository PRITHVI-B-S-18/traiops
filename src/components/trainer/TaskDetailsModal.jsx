import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, MapPin, Calendar, User, Briefcase, CheckCircle, XCircle, AlertCircle, Loader2, BookOpen, Building2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { createClockRequest, getClockRequestsByTrainer } from '@/utils/firestoreClockRequests';
import { getClockRecordByDate, createClockRecord, updateClockRecord } from '@/utils/firestoreClockRecords';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { formatTimestamp } from '@/utils/timezoneUtils';

const TaskDetailsModal = ({ isOpen, onClose, date, tasks = [], showClockActions = true, showClockButtons = true }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requestLocation, loading: locationLoading } = useLocation(user?.uid);
  
  const [clockInStatus, setClockInStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [clockOutStatus, setClockOutStatus] = useState(null);
  const [clockInData, setClockInData] = useState(null);
  const [clockOutData, setClockOutData] = useState(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [showClockOutButton, setShowClockOutButton] = useState(false); // Controls delayed display of clock-out button
  const [requestedAt, setRequestedAt] = useState(null); // Store original requestedAt from clock_requests (always show this time)
  const currentDateRef = useRef(null); // Track current date to prevent unnecessary resets
  const unsubscribeRequestsRef = useRef(null); // Store unsubscribe function for clock_requests
  const unsubscribeRecordsRef = useRef(null); // Store unsubscribe function for clock_records

  // Real-time listener for clock requests for this specific date
  useEffect(() => {
    if (!isOpen || !user?.uid || !date) {
      // Reset states when modal closes
      if (!isOpen) {
        // Clean up listeners when modal closes
        if (unsubscribeRequestsRef.current) {
          unsubscribeRequestsRef.current();
          unsubscribeRequestsRef.current = null;
        }
        if (unsubscribeRecordsRef.current) {
          unsubscribeRecordsRef.current();
          unsubscribeRecordsRef.current = null;
        }
        setClockInStatus(null);
        setClockOutStatus(null);
        setClockInData(null);
        setClockOutData(null);
        setRejectionReason(null);
        setRequestedAt(null);
        currentDateRef.current = null;
      }
      return;
    }

    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    
    // Only reset states if the date actually changed (not on every render)
    const dateChanged = currentDateRef.current !== dateStr;
    
    if (dateChanged) {
      console.log('🔍 Setting up real-time listener for date:', dateStr, '(date changed)');
      currentDateRef.current = dateStr;
      // Reset states only when date changes
      setClockInStatus(null);
      setClockOutStatus(null);
      setClockInData(null);
      setClockOutData(null);
      setRejectionReason(null);
      setRequestedAt(null);
    } else {
      // Date hasn't changed - listeners are already active, don't reset states or re-setup
      console.log('🔍 Real-time listener already active for date:', dateStr, '- skipping re-initialization');
      return; // Skip re-initialization if already set up for this date
    }

    // Fallback function for one-time check if listener fails
    const checkExistingRecordsOnce = async () => {
      try {
        const requests = await getClockRequestsByTrainer(user.uid);
        const todayRequests = requests.filter(req => {
          if (req.date === dateStr && req.type) return true;
          if (!req.date && req.requestedAt) {
            try {
              const reqDate = req.requestedAt?.toDate 
                ? format(req.requestedAt.toDate(), 'yyyy-MM-dd')
                : format(new Date(req.requestedAt), 'yyyy-MM-dd');
              return reqDate === dateStr;
            } catch {
              return false;
            }
          }
          return false;
        });

        const clockInReq = todayRequests.find(req => req.type === 'clock_in');
        const clockOutReq = todayRequests.find(req => req.type === 'clock_out');

        if (clockInReq) {
          setClockInStatus(clockInReq.status);
          setClockInData(clockInReq);
        }
        if (clockOutReq) {
          setClockOutStatus(clockOutReq.status);
          setClockOutData(clockOutReq);
        }
      } catch (error) {
        console.error('❌ Error in fallback check:', error);
      }
    };

        // Also do an initial check for approved records (not in real-time collection)
        const checkApprovedRecords = async () => {
          try {
            const record = await getClockRecordByDate(user.uid, dateStr);
            if (record) {
              console.log('✅ Found approved record for date:', dateStr);
              if (record.clockIn) {
                setClockInStatus('approved');
                // Keep the requestedAt if already set, otherwise use clockIn data
                setClockInData(prev => {
                  const newData = { ...record.clockIn };
                  // Preserve requestedAt from clock_requests if available
                  if (prev?.requestedAt) {
                    newData.requestedAt = prev.requestedAt;
                  }
                  return newData;
                });
              }
              if (record.clockOut) {
                setClockOutStatus('approved');
                setClockOutData(record.clockOut);
              }
            }
          } catch (error) {
            console.error('❌ Error checking approved records:', error);
          }
        };

        // Real-time listener for clock records (to update clock-in and clock-out status immediately)
        const recordsQuery = query(
          collection(db, 'clock_records'),
          where('trainerId', '==', user.uid),
          where('date', '==', dateStr)
        );

        const unsubscribeRecords = onSnapshot(
          recordsQuery,
          (snapshot) => {
            console.log('🔄 Real-time: Clock records updated for date:', dateStr);
            if (!snapshot.empty) {
              const record = {
                recordId: snapshot.docs[0].id,
                ...snapshot.docs[0].data()
              };
              console.log('✅ Real-time: Found clock record:', record);
              
              // Update clock-in status if record exists (means it was approved)
              if (record.clockIn) {
                console.log('✅ Real-time: Setting clock-in status to approved');
                setClockInStatus('approved');
                // Preserve requestedAt from clock_requests (always show original request time)
                setClockInData(prev => {
                  const newData = { ...record.clockIn };
                  // Always preserve requestedAt if available (from clock_requests)
                  if (prev?.requestedAt) {
                    newData.requestedAt = prev.requestedAt;
                  } else if (requestedAt) {
                    newData.requestedAt = requestedAt;
                  }
                  return newData;
                });
                setShowClockOutButton(true); // Show immediately if approved
              }
              
              // Update clock-out status immediately when clock-out happens
              if (record.clockOut) {
                console.log('✅ Real-time: Setting clock-out status to approved');
                setClockOutStatus('approved');
                setClockOutData(record.clockOut);
              }
            } else {
              // No record found - might be pending or not clocked in yet
              console.log('ℹ️ Real-time: No clock record found for date:', dateStr);
            }
          },
          (error) => {
            console.error('❌ Error in clock records listener:', error);
          }
        );
        
        // Store unsubscribe function in ref
        unsubscribeRecordsRef.current = unsubscribeRecords;

    checkApprovedRecords();

    // Set up real-time listener for clock requests
    const q = query(
      collection(db, 'clock_requests'),
      where('trainerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('🔄 Real-time update: Received', snapshot.docs.length, 'requests');
        
        // Filter requests for this specific date
        const todayRequests = snapshot.docs
          .map(doc => ({
            requestId: doc.id,
            ...doc.data()
          }))
          .filter(req => {
            // Primary check: date field must match exactly
            if (req.date === dateStr && req.type) {
              return true;
            }
            // Fallback: check requestedAt date if date field is missing
            if (!req.date && req.requestedAt) {
              try {
                const reqDate = req.requestedAt?.toDate 
                  ? format(req.requestedAt.toDate(), 'yyyy-MM-dd')
                  : format(new Date(req.requestedAt), 'yyyy-MM-dd');
                return reqDate === dateStr;
              } catch {
                return false;
              }
            }
            return false;
          });

        console.log('📅 Requests for this date:', todayRequests.length);

        // Find clock-in request FOR THIS SPECIFIC DATE ONLY
        // Note: Clock-out is automatic (no request), handled by clock_records listener
        const clockInReq = todayRequests.find(req => req.type === 'clock_in');

        if (clockInReq) {
          console.log('✅ Real-time: Setting clock-in status:', clockInReq.status, 'for date:', dateStr);
          // Always store the requestedAt from clock_requests (original request time)
          if (clockInReq.requestedAt) {
            setRequestedAt(clockInReq.requestedAt);
          }
          
          if (clockInReq.status === 'pending' || clockInReq.status === 'rejected') {
            setClockInStatus(clockInReq.status);
            setClockInData(clockInReq);
          } else if (clockInReq.status === 'approved') {
            // For approved requests, update status but preserve requestedAt
            setClockInStatus(clockInReq.status);
            // Merge clock_requests data (with requestedAt) with any existing clock_records data
            setClockInData(prev => {
              if (prev) {
                // If we have data from clock_records, merge it but keep requestedAt from clock_requests
                return {
                  ...prev,
                  requestedAt: clockInReq.requestedAt || prev.requestedAt,
                  location: prev.location || clockInReq.location
                };
              }
              // Otherwise, use the request data
              return clockInReq;
            });
            setShowClockOutButton(true);
          }
          if (clockInReq.status === 'rejected' && clockInReq.rejections?.length > 0) {
            setRejectionReason(clockInReq.rejections[0].reason);
          }
        } else {
          console.log('ℹ️ Real-time: No clock-in request found for date:', dateStr);
          // Don't reset if we have an approved record (check via clock_records listener)
          // The clock_records listener will handle approved status
        }

        // Clock-out status is handled by the clock_records listener above
        // No need to check clock-out requests since clock-out is automatic
      },
      (error) => {
        console.error('❌ Error in real-time listener:', error);
        // Fallback to one-time check if listener fails
        checkExistingRecordsOnce();
      }
    );
    
    // Store unsubscribe function in ref
    unsubscribeRequestsRef.current = unsubscribe;

    // Cleanup listeners only when date changes or modal closes (handled in early return)
    return () => {
      // Only cleanup if date actually changed (will be handled by dateChanged check above)
      // This prevents cleanup on re-renders when date hasn't changed
      if (currentDateRef.current !== dateStr) {
        console.log('🧹 Cleaning up real-time listeners for date change:', dateStr);
        if (unsubscribeRequestsRef.current) {
          unsubscribeRequestsRef.current();
          unsubscribeRequestsRef.current = null;
        }
        if (unsubscribeRecordsRef.current) {
          unsubscribeRecordsRef.current();
          unsubscribeRecordsRef.current = null;
        }
      }
    };
  }, [isOpen, user?.uid, date]);

  // Delay showing clock-out button by 2 seconds when clock-in status becomes pending
  useEffect(() => {
    if (clockInStatus === 'pending') {
      // Reset the button visibility
      setShowClockOutButton(false);
      // Show after 2 seconds
      const timer = setTimeout(() => {
        setShowClockOutButton(true);
      }, 0 * 1000);
      return () => clearTimeout(timer);
    } else if (clockInStatus === 'approved') {
      // Show immediately if approved
      setShowClockOutButton(true);
    } else if (clockInStatus === null || clockInStatus === 'rejected') {
      // Hide if no clock-in or rejected
      setShowClockOutButton(false);
    }
  }, [clockInStatus]);

  const handleClockIn = async () => {
    if (!user?.uid || !date) return;

    // Debounce: Prevent rapid clicks
    if (isClockingIn) {
      console.log('⏳ Clock-in already in progress, ignoring duplicate click');
      return;
    }

    // Prevent multiple clock-ins for the same date - Check state first
    if (clockInStatus === 'pending' || clockInStatus === 'approved') {
      toast({
        title: 'Clock-in already exists',
        description: clockInStatus === 'approved' 
          ? 'You have already clocked in for this date.'
          : 'You have a pending clock-in request for this date.',
        variant: 'destructive'
      });
      return;
    }

    setIsClockingIn(true);
    try {
      const dateStr = format(new Date(date), 'yyyy-MM-dd');
      
      // Double-check: Verify no existing clock-in for this date (server-side check)
      console.log('🔍 Checking for existing clock-in requests...');
      const existingRequests = await getClockRequestsByTrainer(user.uid);
      const existingClockIn = existingRequests.find(req => {
        // Check by date field first
        if (req.date === dateStr && req.type === 'clock_in') {
          return true;
        }
        // Fallback: check requestedAt date
        try {
          const reqDate = req.requestedAt?.toDate 
            ? format(req.requestedAt.toDate(), 'yyyy-MM-dd')
            : format(new Date(req.requestedAt), 'yyyy-MM-dd');
          return reqDate === dateStr && req.type === 'clock_in';
        } catch {
          return false;
        }
      });

      if (existingClockIn) {
        console.warn('⚠️ Existing clock-in found:', existingClockIn);
        setClockInStatus(existingClockIn.status);
        setClockInData(existingClockIn);
        toast({
          title: 'Clock-in already exists',
          description: existingClockIn.status === 'approved' 
            ? 'You have already clocked in for this date.'
            : existingClockIn.status === 'pending'
            ? 'You have a pending clock-in request for this date.'
            : 'You have already submitted a clock-in request for this date.',
          variant: 'destructive'
        });
        setIsClockingIn(false);
        return;
      }

      // Also check approved records
      const record = await getClockRecordByDate(user.uid, dateStr);
      if (record?.clockIn) {
        console.warn('⚠️ Approved clock-in record found:', record.clockIn);
        setClockInStatus('approved');
        setClockInData(record.clockIn);
        toast({
          title: 'Already clocked in',
          description: 'You have already clocked in for this date.',
          variant: 'destructive'
        });
        setIsClockingIn(false);
        return;
      }

      console.log('🔄 Starting clock-in process...');
      console.log('📍 Requesting location...');
      
      // Get current location with detailed address
      const location = await requestLocation();

      console.log('✅ Location captured successfully!');
      console.log('📍 Full location object:', location);
      console.log('📍 Latitude:', location.latitude);
      console.log('📍 Longitude:', location.longitude);
      console.log('📍 Place Name:', location.placeName);
      console.log('📍 Formatted Address:', location.formattedAddress);
      console.log('📍 City:', location.city);
      console.log('📍 State:', location.state);
      console.log('📍 Country:', location.country);
      console.log('📍 Postcode:', location.postcode);
      console.log('📍 Road:', location.road);
      console.log('📍 Neighbourhood:', location.neighbourhood);
      console.log('📍 Accuracy:', location.accuracy, 'meters');
      console.log('📍 Timestamp:', location.timestamp);

      // Get task data (for PM routing)
      const currentTask = tasks.length > 0 ? tasks[0] : null;
      const isNonTrainingTask = currentTask?.type !== 'training';
      
      // For non-training tasks: directly create clock record (no approval needed)
      if (isNonTrainingTask) {
        console.log('📋 Non-training task detected - creating clock record directly (no approval needed)');
        
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
          approvedBy: 'system', // Auto-approved for non-training tasks
          approvedAt: Timestamp.now()
        };

        // Check if record already exists
        let existingRecord = await getClockRecordByDate(user.uid, dateStr);
        
        if (existingRecord) {
          // Update existing record with clock-in
          const result = await updateClockRecord(existingRecord.recordId, {
            clockIn: clockInData,
            status: 'active',
            isNonTraining: true,
            requiresApproval: false,
            taskId: currentTask?.id || null
          });
          
          if (result.success) {
            setClockInStatus('approved');
            setClockInData(clockInData);
            toast({
              title: 'Clocked in successfully',
              description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}`,
              variant: 'default'
            });
          } else {
            throw new Error(result.error || 'Failed to update clock record');
          }
        } else {
          // Create new record
          const recordData = {
            trainerId: user.uid,
            trainerEmail: user.email,
            trainerName: user.displayName || user.email?.split('@')[0],
            date: dateStr,
            clockIn: clockInData,
            status: 'active',
            isNonTraining: true,
            requiresApproval: false,
            taskId: currentTask?.id || null,
            taskType: currentTask?.taskType || 'Non-Training Task'
          };

          const result = await createClockRecord(recordData);
          
          if (result.success) {
            setClockInStatus('approved');
            setClockInData(clockInData);
            toast({
              title: 'Clocked in successfully',
              description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}`,
              variant: 'default'
            });
          } else {
            throw new Error(result.error || 'Failed to create clock record');
          }
        }
      } else {
        // Training task: create clock-in request (requires approval)
        const requestData = {
          trainerId: user.uid,
          trainerEmail: user.email,
          trainerName: user.displayName || user.email?.split('@')[0],
          type: 'clock_in',
          date: dateStr,
          location: {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            // Detailed address
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
          // Pass task PMs and client info for routing (simplified approach)
          taskPMIds: currentTask?.assignedPMIds || null,
          taskClientId: currentTask?.clientId || null,
          taskClientName: currentTask?.client || null
        };

        console.log('📝 Request data to be saved:', requestData);
        console.log('📝 Location object in request:', requestData.location);

        const result = await createClockRequest(requestData);

        console.log('💾 Create request result:', result);

        if (result.success) {
          console.log('✅ Clock-in request created successfully!');
          setClockInStatus('pending');
          toast({
            title: 'Clock-in request submitted',
            description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}`,
            variant: 'default'
          });
        } else {
          console.error('❌ Failed to create request:', result.error);
          throw new Error(result.error || 'Failed to create request');
        }
      }
    } catch (error) {
      console.error('❌ Clock-in error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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
    if (!user?.uid || !date) return;
    
    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    
    // Check if already clocked out for this date
    const existingRecord = await getClockRecordByDate(user.uid, dateStr);
    if (existingRecord?.clockOut) {
      toast({
        title: 'Already clocked out',
        description: 'You have already clocked out for this date.',
        variant: 'destructive'
      });
      return;
    }
    
    // Check if clocked in (for this date or previous date)
    // Allow clock-out even if clock-in was on a previous date (edge case: forgot to clock out)
    // Allow clock-out if clock-in is pending or approved
    if (clockInStatus !== 'pending' && clockInStatus !== 'approved' && !existingRecord?.clockIn) {
      // Check if there's a clock-in from a previous date
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
      const yesterdayRecord = await getClockRecordByDate(user.uid, yesterdayStr);
      
      if (!yesterdayRecord?.clockIn || yesterdayRecord?.clockOut) {
        toast({
          title: 'Cannot clock out',
          description: 'You must clock in first before clocking out. If you forgot to clock out yesterday, please contact your Program Manager.',
          variant: 'destructive'
        });
        return;
      }
      
      // Allow clock-out for previous day's clock-in (forgot to clock out scenario)
      console.log('⚠️ Clock-out for previous day detected (forgot to clock out scenario)');
    }

    setIsClockingOut(true);
    try {
      console.log('🔄 Starting automatic clock-out process...');
      console.log('📍 Requesting location...');
      
      // Get current location with detailed address
      const location = await requestLocation();

      console.log('✅ Location captured successfully!');
      console.log('📍 Full location object:', location);

      // Get task data to check if it's non-training
      const currentTask = tasks.length > 0 ? tasks[0] : null;
      const isNonTrainingTask = currentTask?.type !== 'training';

      // Prepare clock-out data
      const clockOutData = {
        timestamp: Timestamp.now(), // Use current time as official timestamp (Firestore Timestamp)
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

      // Check if clock record exists for this date (or previous date if forgot to clock out)
      let existingRecord = await getClockRecordByDate(user.uid, dateStr);
      
      // Edge case: If no record for today but clock-in was pending or approved, check if we need to create record
      // Or if clock-in was yesterday and forgot to clock out
      if (!existingRecord && (clockInStatus === 'pending' || clockInStatus === 'approved') && clockInData) {
        // Create record with clock-in data
        const recordData = {
          trainerId: user.uid,
          trainerEmail: user.email,
          trainerName: user.displayName || user.email?.split('@')[0],
          date: dateStr,
          clockIn: {
            timestamp: clockInData.requestedAt || Timestamp.now(),
            location: clockInData.location,
            approvedBy: clockInData.approvals?.[0]?.adminId || clockInData.approvals?.[0]?.programManagerId || 'system',
            approvedAt: clockInData.approvals?.[0]?.approvedAt || Timestamp.now()
          },
          status: 'active',
          isNonTraining: isNonTrainingTask,
          requiresApproval: !isNonTrainingTask, // Clock-in may require approval, but clock-out doesn't
          taskId: tasks.length > 0 ? tasks[0].id : null,
          taskType: currentTask?.taskType || null
        };
        const createResult = await createClockRecord(recordData);
        if (createResult.success) {
          existingRecord = await getClockRecordByDate(user.uid, dateStr);
        }
      }
      
      // Edge case: Forgot to clock out yesterday - allow clock-out on today's date for yesterday's clock-in
      if (!existingRecord || !existingRecord.clockIn) {
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        const yesterdayRecord = await getClockRecordByDate(user.uid, yesterdayStr);
        
        if (yesterdayRecord?.clockIn && !yesterdayRecord?.clockOut) {
          // Update yesterday's record with clock-out
          console.log('📝 Updating yesterday\'s record with clock-out (forgot to clock out scenario)');
          
          // Optimistic update: Update UI immediately
          setClockOutStatus('approved');
          setClockOutData(clockOutData);
          
          const updateData = {
            clockOut: clockOutData,
            status: 'completed'
          };
          
          // Clock-out never requires approval
          updateData.requiresApproval = false;
          
          // If it's a non-training task, ensure flags are set
          if (isNonTrainingTask) {
            updateData.isNonTraining = true;
          }
          
          const result = await updateClockRecord(yesterdayRecord.recordId, updateData);

          if (result.success) {
            console.log('✅ Clock-out recorded successfully for previous day!');
            // State already updated optimistically, real-time listener will confirm
            toast({
              title: 'Clocked out successfully',
              description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}. Note: This clock-out was recorded for the previous day.`,
              variant: 'default'
            });
            setIsClockingOut(false);
            return;
          } else {
            // Revert optimistic update on error
            setClockOutStatus(null);
            setClockOutData(null);
            throw new Error(result.error || 'Failed to update clock record');
          }
        }
      }

      if (existingRecord) {
        // Optimistic update: Update UI immediately before Firestore update
        console.log('📝 Updating existing clock record with clock-out...');
        setClockOutStatus('approved');
        setClockOutData(clockOutData);
        
        // Update record with clock-out, preserving non-training flags if they exist
        const updateData = {
          clockOut: clockOutData,
          status: 'completed',
          requiresApproval: false // Clock-out never requires approval
        };
        
        // If it's a non-training task, ensure flags are set
        if (isNonTrainingTask) {
          updateData.isNonTraining = true;
        }
        
        const result = await updateClockRecord(existingRecord.recordId, updateData);

        if (result.success) {
          console.log('✅ Clock-out recorded successfully!');
          // State already updated optimistically, real-time listener will confirm
          toast({
            title: 'Clocked out successfully',
            description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}`,
            variant: 'default'
          });
        } else {
          // Revert optimistic update on error
          setClockOutStatus(null);
          setClockOutData(null);
          throw new Error(result.error || 'Failed to update clock record');
        }
      } else {
        // Create new record (shouldn't happen if clock-in was approved, but handle edge case)
        // This can happen for non-training tasks where clock-out happens without clock-in record
        console.log('⚠️ No existing record found, creating new record...');
        
        // Optimistic update: Update UI immediately before Firestore create
        setClockOutStatus('approved');
        setClockOutData(clockOutData);
        
        const recordData = {
          trainerId: user.uid,
          trainerEmail: user.email,
          trainerName: user.displayName || user.email?.split('@')[0],
          date: dateStr,
          clockIn: clockInData || null, // Use existing clock-in data if available
          clockOut: clockOutData,
          status: clockInData ? 'completed' : 'active',
          isNonTraining: isNonTrainingTask,
          requiresApproval: false, // Clock-out never requires approval
          taskId: tasks.length > 0 ? tasks[0].id : null,
          taskType: currentTask?.taskType || (isNonTrainingTask ? 'Non-Training Task' : null)
        };

        const result = await createClockRecord(recordData);

        if (result.success) {
          console.log('✅ Clock-out recorded successfully!');
          // State already updated optimistically, real-time listener will confirm
          setClockOutData(clockOutData);
          toast({
            title: 'Clocked out successfully',
            description: `Location: ${location.placeName || 'Location captured'}, ${location.city || ''}${location.postcode ? `, ${location.postcode}` : ''}`,
            variant: 'default'
          });
        } else {
          throw new Error(result.error || 'Failed to create clock record');
        }
      }
    } catch (error) {
      console.error('❌ Clock-out error:', error);
      toast({
        title: 'Clock-out failed',
        description: error.message || 'Failed to record clock-out',
        variant: 'destructive'
      });
    } finally {
      setIsClockingOut(false);
    }
  };

  const getClockInButtonContent = () => {
    if (clockInStatus === 'approved') {
      return (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          Clocked In
        </>
      );
    } else if (clockInStatus === 'pending') {
      return (
        <>
          <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
          Pending Approval
        </>
      );
    } else if (clockInStatus === 'rejected') {
      return (
        <>
          <XCircle className="w-4 h-4 mr-2" />
          Clock-in Disabled
        </>
      );
    } else if (isClockingIn) {
      return (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Getting Location...
        </>
      );
    }
    return (
      <>
        <Clock className="w-4 h-4 mr-2" />
        Clock In
      </>
    );
  };

  const getClockOutButtonContent = () => {
    if (clockOutStatus === 'approved') {
      return (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          Clocked Out
        </>
      );
    } else if (isClockingOut) {
      return (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Getting Location...
        </>
      );
    }
    return (
      <>
        <Clock className="w-4 h-4 mr-2" />
        Clock Out
      </>
    );
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">Task Details</h2>
              <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">
                {date && format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Tasks List */}
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task, index) => {
                  // Determine task type: check explicit type first, then infer from fields
                  const isTraining = task.type === 'training' || 
                    (task.type !== 'non-training' && (task.course || task.client));
                  const isNonTraining = task.type === 'non-training' || 
                    (task.type !== 'training' && (task.taskDetails || task.taskType));
                  
                  // Use explicit type if available, otherwise infer
                  const taskType = task.type || (isTraining ? 'training' : (isNonTraining ? 'non-training' : 'unknown'));
                  
                  return (
                    <div key={index} className="bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                      {/* Task Type Badge */}
                      <div className="flex items-center gap-2 mb-2.5">
                        {taskType === 'training' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            <BookOpen className="h-3 w-3 mr-1" />
                            Training Session
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                            <Briefcase className="h-3 w-3 mr-1" />
                            Non-Training Task
                          </span>
                        )}
                      </div>

                      {/* Task Details - Compact Grid */}
                      <div className="space-y-2">
                        {taskType === 'training' ? (
                          <>
                            {task.course && (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-slate-500">Course</span>
                                  <p className="text-sm font-semibold text-slate-800 leading-tight">{task.course}</p>
                                </div>
                              </div>
                            )}
                            {task.client && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-slate-500">Client</span>
                                  <p className="text-sm text-slate-700 leading-tight truncate">{task.client}</p>
                                </div>
                              </div>
                            )}
                            {task.role && (
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-slate-500">Role</span>
                                  <p className="text-sm text-slate-700 leading-tight">{task.role}</p>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {task.taskDetails && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-slate-500">Task Details</span>
                                  <p className="text-sm font-semibold text-slate-800 leading-tight">{task.taskDetails}</p>
                                </div>
                              </div>
                            )}
                            {task.taskType && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-slate-500">Task Type</span>
                                  <p className="text-sm text-slate-700 leading-tight">{task.taskType}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {task.description && (
                          <div className="pt-2 mt-2 border-t border-slate-200">
                            <span className="text-[11px] text-slate-500 block mb-1">Description</span>
                            <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                          </div>
                        )}
                        {/* Show additional fields if available */}
                        {task.startDate && (
                          <div className="pt-2 mt-2 border-t border-slate-200">
                            <span className="text-[11px] text-slate-500 block mb-1">Date Range</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {task.startDate === task.endDate || !task.endDate
                                ? task.startDate
                                : `${task.startDate} to ${task.endDate}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No tasks scheduled for this date</p>
              </div>
            )}

            {/* Clock-in/out Section - Only show if showClockActions is true */}
            {showClockActions && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-600" />
                Attendance - Today
              </h3>

              {/* Rejection Notice */}
              {clockInStatus === 'rejected' && rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900 text-[11px]">Clock-in/out disabled for this day</p>
                      <p className="text-[11px] text-red-700 mt-0.5">{rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Clock In/Out Status Display */}
              <div className="space-y-2.5 mb-3">
                {/* Clock In Status */}
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Clock In</span>
                    {clockInStatus === 'approved' && (clockInData?.requestedAt || requestedAt) && (
                      <span className="text-[11px] font-semibold text-green-600">
                        {(() => {
                          // Always show requestedAt (original request time) - never show timestamp from clock_records
                          const timeToShow = clockInData?.requestedAt || requestedAt;
                          if (timeToShow) {
                            if (timeToShow?.toDate) {
                              return formatTimestamp(timeToShow.toDate(), 'hh:mm a');
                            } else if (timeToShow instanceof Date) {
                              return formatTimestamp(timeToShow, 'hh:mm a');
                            } else {
                              return formatTimestamp(new Date(timeToShow), 'hh:mm a');
                            }
                          }
                          return 'N/A';
                        })()}
                      </span>
                    )}
                    {clockInStatus === 'pending' && clockInData?.requestedAt && (
                      <span className="text-[11px] font-semibold text-orange-600">
                        Pending Approval
                        {(() => {
                          if (clockInData.requestedAt?.toDate) {
                            return ` (${formatTimestamp(clockInData.requestedAt.toDate(), 'hh:mm a')})`;
                          } else if (clockInData.requestedAt) {
                            return ` (${formatTimestamp(new Date(clockInData.requestedAt), 'hh:mm a')})`;
                          }
                          return '';
                        })()}
                      </span>
                    )}
                    {clockInStatus === 'pending' && !clockInData?.requestedAt && (
                      <span className="text-[11px] font-semibold text-orange-600">Pending Approval</span>
                    )}
                    {!clockInStatus && (
                      <span className="text-[11px] font-medium text-slate-400">Not clocked in</span>
                    )}
                  </div>
                  {clockInData && clockInStatus === 'approved' && clockInData.location && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-600 break-words leading-tight">
                          {clockInData.location.formattedAddress || 
                           clockInData.location.placeName || 
                           clockInData.location.institution || 
                           clockInData.location.building || 
                           'Location not available'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clock Out Status */}
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Clock Out</span>
                    {clockOutStatus === 'approved' && clockOutData?.timestamp && (
                      <span className="text-[11px] font-semibold text-green-600">
                        {clockOutData.timestamp?.toDate 
                          ? formatTimestamp(clockOutData.timestamp.toDate(), 'hh:mm a')
                          : clockOutData.timestamp 
                          ? formatTimestamp(new Date(clockOutData.timestamp), 'hh:mm a')
                          : 'N/A'}
                      </span>
                    )}
                    {!clockOutStatus && (clockInStatus === 'pending' || clockInStatus === 'approved') && (
                      <span className="text-[11px] font-medium text-slate-400">Missing</span>
                    )}
                    {!clockInStatus && (
                      <span className="text-[11px] font-medium text-slate-400">Not available</span>
                    )}
                  </div>
                  {clockOutData && clockOutStatus === 'approved' && clockOutData.location && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-600 break-words leading-tight">
                          {clockOutData.location.formattedAddress || 
                           clockOutData.location.placeName || 
                           clockOutData.location.institution || 
                           clockOutData.location.building || 
                           'Location not available'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Clock-in/out Buttons - Only show if showClockButtons is true */}
              {showClockButtons && (
                <div className="space-y-3">
                  <Button
                    onClick={handleClockIn}
                    disabled={isClockingIn || clockInStatus === 'approved' || clockInStatus === 'pending' || clockInStatus === 'rejected'}
                    size="sm"
                    className={`w-full ${
                      clockInStatus === 'approved'
                        ? 'bg-green-600 hover:bg-green-600'
                        : clockInStatus === 'pending'
                        ? 'bg-orange-500 hover:bg-orange-500'
                        : clockInStatus === 'rejected'
                        ? 'bg-gray-400 hover:bg-gray-400'
                        : 'bg-[#5A5A5A] hover:bg-[#3D3D3D]'
                    }`}
                  >
                    {getClockInButtonContent()}
                  </Button>

                  {/* Clock Out Section - Show with delay if pending, immediately if approved */}
                  {showClockOutButton && (clockInStatus === 'pending' || clockInStatus === 'approved') && clockOutStatus !== 'approved' && (
                    <div className="space-y-2">
                      {/* Instructional Note */}
                      <p className="text-xs text-slate-500 italic text-center">
                        💡 Clock out when your training session is complete
                      </p>
                      
                      {/* Clock Out Button */}
                      <Button
                        onClick={handleClockOut}
                        disabled={isClockingOut}
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {getClockOutButtonContent()}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default TaskDetailsModal;

