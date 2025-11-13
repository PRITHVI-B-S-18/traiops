import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Calendar, User, Briefcase, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
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

const TaskDetailsModal = ({ isOpen, onClose, date, tasks = [] }) => {
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

  // Real-time listener for clock requests for this specific date
  useEffect(() => {
    if (!isOpen || !user?.uid || !date) {
      // Reset states when modal closes or date changes
      setClockInStatus(null);
      setClockOutStatus(null);
      setClockInData(null);
      setClockOutData(null);
      setRejectionReason(null);
      return;
    }

    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    console.log('🔍 Setting up real-time listener for date:', dateStr);
    
    // Reset states first
    setClockInStatus(null);
    setClockOutStatus(null);
    setClockInData(null);
    setClockOutData(null);
    setRejectionReason(null);

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
                setClockInData(record.clockIn);
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
                setClockInData(record.clockIn);
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
          setClockInStatus(clockInReq.status);
          setClockInData(clockInReq);
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

    // Cleanup listeners on unmount or date change
    return () => {
      console.log('🧹 Cleaning up real-time listeners for date:', dateStr);
      unsubscribe();
      if (unsubscribeRecords) {
        unsubscribeRecords();
      }
    };
  }, [isOpen, user?.uid, date]);

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
    if (clockInStatus !== 'approved' && !existingRecord?.clockIn) {
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
        approvedBy: isNonTrainingTask ? 'system' : user.uid, // Auto-approved for non-training, trainer for training
        approvedAt: Timestamp.now()
      };

      // Check if clock record exists for this date (or previous date if forgot to clock out)
      let existingRecord = await getClockRecordByDate(user.uid, dateStr);
      
      // Edge case: If no record for today but clock-in was approved, check if we need to create record
      // Or if clock-in was yesterday and forgot to clock out
      if (!existingRecord && clockInStatus === 'approved' && clockInData) {
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
          requiresApproval: !isNonTrainingTask,
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
          
          // If it's a non-training task, ensure flags are set
          if (isNonTrainingTask) {
            updateData.isNonTraining = true;
            updateData.requiresApproval = false;
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
          status: 'completed'
        };
        
        // If it's a non-training task, ensure flags are set
        if (isNonTrainingTask) {
          updateData.isNonTraining = true;
          updateData.requiresApproval = false;
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
          requiresApproval: !isNonTrainingTask,
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] p-6 flex items-center justify-between rounded-t-lg">
            <div>
              <h2 className="text-2xl font-bold text-white">Task Details</h2>
              <p className="text-sm text-white/80 mt-1">
                {date && format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Tasks List */}
            {tasks.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#2C2C2C] flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Assigned Tasks ({tasks.length})
                </h3>
                {tasks.map((task, index) => (
                  <div key={index} className="bg-[#F5F5F5] p-4 rounded-lg border border-[#E0E0E0]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {task.type === 'training' ? (
                            <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              Training Session
                            </div>
                          ) : (
                            <div className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                              Non-Training Task
                            </div>
                          )}
                        </div>
                        {task.type === 'training' ? (
                          <>
                            <p className="text-sm text-[#666666]"><span className="font-medium">Course:</span> {task.course}</p>
                            <p className="text-sm text-[#666666]"><span className="font-medium">Client:</span> {task.client}</p>
                            <p className="text-sm text-[#666666]"><span className="font-medium">Role:</span> {task.role}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-[#666666]"><span className="font-medium">Task:</span> {task.taskDetails}</p>
                            <p className="text-sm text-[#666666]"><span className="font-medium">Type:</span> {task.taskType}</p>
                          </>
                        )}
                        {task.description && (
                          <p className="text-sm text-[#888888] mt-2">{task.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-[#D0D0D0] mx-auto mb-3" />
                <p className="text-[#666666]">No tasks scheduled for this date</p>
              </div>
            )}

            {/* Clock-in/out Section */}
            <div className="border-t border-[#E0E0E0] pt-6">
              <h3 className="text-lg font-semibold text-[#2C2C2C] flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                Attendance
              </h3>

              {/* Rejection Notice */}
              {clockInStatus === 'rejected' && rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900 text-sm">Clock-in/out disabled for this day</p>
                      <p className="text-sm text-red-700 mt-1">{rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Clock-in/out Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleClockIn}
                  disabled={isClockingIn || clockInStatus === 'approved' || clockInStatus === 'pending' || clockInStatus === 'rejected'}
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

                <Button
                  onClick={handleClockOut}
                  disabled={isClockingOut || clockOutStatus === 'approved' || clockInStatus !== 'approved' || clockInStatus === 'rejected'}
                  className={`w-full ${
                    clockOutStatus === 'approved'
                      ? 'bg-green-600 hover:bg-green-600'
                      : 'bg-[#5A5A5A] hover:bg-[#3D3D3D]'
                  }`}
                >
                  {getClockOutButtonContent()}
                </Button>
              </div>

              {/* Status Info */}
              {clockInData && clockInStatus === 'approved' && clockInData.location && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="font-medium text-green-900 mb-1">
                        Clock-in Location: {clockInData.location.placeName || clockInData.location.institution || clockInData.location.building || 'Location'}
                      </p>
                      <p className="text-xs text-green-700 break-words">
                        {clockInData.location.formattedAddress || 
                          `${clockInData.location.city || ''}, ${clockInData.location.state || ''}, ${clockInData.location.postcode || ''}, ${clockInData.location.country || ''}`
                            .replace(/^,\s*|,\s*$/g, '')
                            .replace(/,\s*,/g, ',')
                            .trim() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E0E0E0] p-4 bg-[#F5F5F5] flex justify-end rounded-b-lg">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-[#D0D0D0] hover:bg-[#E8E8E8]"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskDetailsModal;

