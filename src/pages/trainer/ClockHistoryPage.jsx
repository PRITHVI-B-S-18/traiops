import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { History, Clock, MapPin, Calendar, CheckCircle, XCircle, AlertCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation as useLocationHook } from '@/hooks/useLocation';
import { useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { formatTimestamp, formatDateForDisplay, convertFromUTC } from '@/utils/timezoneUtils';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding, getChipClasses } from '@/styles/designSystem';

const ClockHistoryPage = () => {
  const { user } = useAuth();
  const { setCommandState, resetCommandState } = useOutletContext();
  const {
    locationPermission,
    saveLocationPermission
  } = useLocationHook(user?.uid);
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedCards, setExpandedCards] = useState({}); // Track which cards are expanded
  const [locationGranted, setLocationGranted] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const PAGE_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Real-time listeners for clock requests and records
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    let unsubscribeRequests = null;
    let unsubscribeRecords = null;
    
    // Store data from both listeners
    let currentRequestsData = [];
    let currentRecordsData = [];

    // Helper function to combine and process data
    // Priority: clock_records is the source of truth. Only show clock_requests if no record exists.
    const processData = () => {
      const mergedRecords = {};
      
      // First, process all clock_records (source of truth)
      currentRecordsData.forEach(record => {
        const recordDate = record.date;
        const clockInTime = record.clockIn?.timestamp?.toDate 
          ? record.clockIn.timestamp.toDate() 
          : (record.clockIn?.timestamp ? new Date(record.clockIn.timestamp) : null);
        const clockOutTime = record.clockOut?.timestamp?.toDate 
          ? record.clockOut.timestamp.toDate() 
          : (record.clockOut?.timestamp ? new Date(record.clockOut.timestamp) : null);
        
        // Use clock-in time as primary timestamp for sorting, or clock-out if no clock-in
        const primaryTimestamp = clockInTime || clockOutTime || new Date(recordDate);
        
        mergedRecords[recordDate] = {
          recordId: record.recordId,
          date: recordDate,
          status: 'approved',
          source: 'record',
          timestamp: primaryTimestamp,
          clockIn: record.clockIn ? {
            timestamp: clockInTime,
            location: record.clockIn.location,
            approvedBy: record.clockIn.approvedBy,
            description: record.clockIn.description // Add approval description
          } : null,
          clockOut: record.clockOut ? {
            timestamp: clockOutTime,
            location: record.clockOut.location,
            approvedBy: record.clockOut.approvedBy,
            description: record.clockOut.description // Add approval description
          } : null,
          location: record.clockIn?.location || record.clockOut?.location,
          approvals: record.approvals || [] // Include approvals array if available
        };
      });
      
      // Then, add pending/rejected clock-in requests ONLY if no record exists for that date
      currentRequestsData
        .filter(req => req.type === 'clock_in') // Only clock-in requests
        .forEach(req => {
          // Convert date to UTC for storage consistency
          let requestDate = req.date || '';
          if (!requestDate && req.requestedAt) {
            const date = req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt);
            requestDate = format(date, 'yyyy-MM-dd');
          }
          
          // Only add if no record exists for this date (pending/rejected requests)
          if (!mergedRecords[requestDate]) {
            // Extract approval description if available
            const approvalDescription = req.approvals && req.approvals[0]?.description || null;
            
            mergedRecords[requestDate] = {
              requestId: req.requestId,
              date: requestDate,
              status: req.status, // 'pending' or 'rejected'
              source: 'request',
              timestamp: req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt || 0),
              clockIn: {
                timestamp: req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt || 0),
                location: req.location,
                status: req.status,
                description: approvalDescription // Add approval description
              },
              clockOut: null,
              rejectionReason: req.rejectionReason || (req.rejections && req.rejections[0]?.reason) || null,
              rejections: req.rejections || [],
              approvals: req.approvals || [] // Include approvals array
            };
          }
        });
      
      // Convert to array and sort by timestamp (newest first)
      const allRecords = Object.values(mergedRecords).sort((a, b) => b.timestamp - a.timestamp);
      
      setRequests(allRecords);
      setRecords(currentRecordsData);
      setLoading(false);
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
        
        // Process combined data
        processData();
      },
      (error) => {
        console.error('Error in clock requests listener:', error);
        setLoading(false);
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
        
        // Process combined data
        processData();
      },
      (error) => {
        console.error('Error in clock records listener:', error);
        setLoading(false);
      }
    );

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
      if (unsubscribeRecords) {
        unsubscribeRecords();
      }
    };
  }, [user?.uid]);

  const filteredRecords = useMemo(() => {
    return requests.filter(record => {
    if (filter === 'all') return true;
    return record.status === filter;
  });
  }, [requests, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = requests.length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    return { total, approved, pending, rejected };
  }, [requests]);

  // Check location permission
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    let hasRun = false;

    const checkLocationPermission = async () => {
      if (hasRun) return;
      hasRun = true;

      try {
        if (isMounted) {
          setCheckingLocation(true);
        }

        // Check Firestore for saved permission
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!isMounted) return;

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const granted = userData.locationAccessGranted || false;

          if (granted && navigator.geolocation) {
            // Verify with browser
            navigator.geolocation.getCurrentPosition(
              () => {
                if (!isMounted) return;
                setLocationGranted(true);
                setCheckingLocation(false);
              },
              () => {
                if (!isMounted) return;
                setLocationGranted(false);
                setCheckingLocation(false);
                saveLocationPermission(false);
              },
              { timeout: 5000, maximumAge: 0 }
            );
          } else {
            if (isMounted) {
              setLocationGranted(false);
              setCheckingLocation(false);
            }
          }
        } else {
          if (isMounted) {
            setLocationGranted(false);
            setCheckingLocation(false);
          }
        }
      } catch (error) {
        console.error('Error checking location permission:', error);
        if (isMounted) {
          setLocationGranted(false);
          setCheckingLocation(false);
        }
      }
    };

    checkLocationPermission();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, saveLocationPermission]);

  // Set command state for this page - title immediately, metrics when data loads
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Clock History',
        description: 'View your attendance records and requests.',
        actions: null,
        metrics: !loading ? [
          <div key="total" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Records</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <History className="h-8 w-8 text-slate-600" />
            </div>
          </div>,
          <div key="approved" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Approved</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>,
          <div key="pending" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>,
          <div key="rejected" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Rejected</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-rose-600" />
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
  }, [stats, loading, setCommandState, resetCommandState, locationGranted, checkingLocation, filter, showFilterMenu]);

  const visibleRecords = useMemo(() => {
    return filteredRecords.slice(0, displayCount);
  }, [filteredRecords, displayCount]);

  const hasMoreRecords = displayCount < filteredRecords.length;

  const loadMoreRecords = () => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, filteredRecords.length));
  };

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filter, requests.length]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
            <AlertCircle className="w-3 h-3" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Filter button moved to header */}

      {/* Records Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-lg shadow-sm border border-[#E0E0E0] overflow-hidden"
      >
        {/* Card Header */}
        <div className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-white" />
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white">Clock Records</h3>
                <p className="text-sm text-white/80 mt-1">{filteredRecords.length} records found</p>
              </div>
            </div>
            {/* Filter Button */}
            <div className="relative">
              <Button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 whitespace-nowrap bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Filter className="h-4 w-4" />
                Filter: {filter.charAt(0).toUpperCase() + filter.slice(1)}
                <ChevronDown className="h-4 w-4" />
              </Button>

              {showFilterMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                    <button
                      onClick={() => { setFilter('all'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-50 ${filter === 'all' ? 'bg-slate-50 font-medium' : ''}`}
                    >
                      All Records
                    </button>
                    <button
                      onClick={() => { setFilter('approved'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-50 ${filter === 'approved' ? 'bg-slate-50 font-medium' : ''}`}
                    >
                      Approved
                    </button>
                    <button
                      onClick={() => { setFilter('pending'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-50 ${filter === 'pending' ? 'bg-slate-50 font-medium' : ''}`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => { setFilter('rejected'); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-50 ${filter === 'rejected' ? 'bg-slate-50 font-medium' : ''}`}
                    >
                      Rejected
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 md:p-6">
          {loading ? (
            <LoadingSkeleton message="Loading clock history..." />
          ) : filteredRecords.length === 0 ? (
            <div className="border-2 border-dashed border-[#D0D0D0] rounded-lg p-8 md:p-12">
              <div className="text-center">
                <Clock className="w-12 h-12 md:w-16 md:h-16 text-[#D0D0D0] mx-auto mb-4" />
                <p className="text-[#666666] text-base md:text-lg font-medium">No records yet</p>
                <p className="text-[#888888] text-sm md:text-base mt-2">
                  Your clock-in/out history will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRecords.map((record, index) => {
                const hasClockIn = !!record.clockIn;
                const hasClockOut = !!record.clockOut;
                const isComplete = hasClockIn && hasClockOut;
                const cardKey = record.requestId || record.recordId || index;
                const isExpanded = expandedCards[cardKey] || false;
                
                return (
                  <div key={cardKey} className="bg-white rounded-lg border border-[#E0E0E0] overflow-hidden hover:shadow-md transition-shadow">
                    {/* Summary Header - Always Visible */}
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Clock Icon Indicator */}
                          {(() => {
                            // Determine icon color based on clock status
                            let iconColor = 'text-blue-600';
                            let bgColor = 'bg-blue-100';
                            
                            if (record.status === 'rejected') {
                              iconColor = 'text-red-600';
                              bgColor = 'bg-red-100';
                            } else if (isComplete) {
                              // Both clock-in and clock-out done
                              iconColor = 'text-green-600';
                              bgColor = 'bg-green-100';
                            } else if (hasClockIn && !hasClockOut) {
                              // Only clock-in done
                              iconColor = 'text-blue-600';
                              bgColor = 'bg-blue-100';
                            } else if (record.status === 'pending') {
                              iconColor = 'text-orange-600';
                              bgColor = 'bg-orange-100';
                            }
                            
                            return (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}>
                                <Clock className={`w-5 h-5 ${iconColor}`} />
                              </div>
                            );
                          })()}
                          <div>
                          <div>
                            <h4 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#666666]" />
                                {record.date ? formatDateForDisplay(record.date, 'MMM d, yyyy') : (record.timestamp && formatTimestamp(record.timestamp, 'MMM d, yyyy'))}
                            </h4>
                              {record.timestamp && (
                                <p className="text-xs text-[#888888] mt-1">
                                  Requested at: {formatTimestamp(record.timestamp, 'MMM d, yyyy hh:mm a')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(record.status)}
                          <button
                            onClick={() => setExpandedCards(prev => ({
                              ...prev,
                              [cardKey]: !prev[cardKey]
                            }))}
                            className="p-1 hover:bg-[#F5F5F5] rounded transition-colors"
                            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-[#666666]" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-[#666666]" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details - Shown when expanded */}
                    {isExpanded && (
                      <div className="border-t border-[#E0E0E0] p-4 space-y-4">
                        {/* Clock In & Out Times - Compact Grid */}
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#E0E0E0]">
                          {/* Clock In */}
                          <div className="flex flex-col">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              Clock-In
                            </p>
                            {hasClockIn && record.clockIn.timestamp ? (
                              <>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {format(record.clockIn.timestamp, 'PPpp')}
                                  </p>
                                  {record.clockIn.location && (
                                  <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                                    <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                                    <span>
                                      {record.clockIn.location.formattedAddress || 
                                       record.clockIn.location.placeName || 
                                       record.clockIn.location.institution || 
                                       record.clockIn.location.building || 
                                       'No location data'}
                                    </span>
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="mt-1 text-sm font-medium text-slate-900">Clock-in pending</p>
                            )}
                          </div>

                          {/* Clock Out */}
                          <div className="flex flex-col">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              Clock-Out
                            </p>
                            {hasClockOut && record.clockOut.timestamp ? (
                              <>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {format(record.clockOut.timestamp, 'PPpp')}
                                  </p>
                                  {record.clockOut.location && (
                                  <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                                    <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                                    <span>
                                      {record.clockOut.location.formattedAddress || 
                                       record.clockOut.location.placeName || 
                                       record.clockOut.location.institution || 
                                       record.clockOut.location.building || 
                                       'No location data'}
                                    </span>
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="mt-1 text-sm font-medium text-slate-900">Not clocked out</p>
                            )}
                          </div>
                        </div>

                        {/* Approval Description */}
                        {record.status === 'approved' && (record.clockIn?.description || (record.approvals && record.approvals[0]?.description)) && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm font-medium text-green-900">Approval Note:</p>
                            <p className="text-sm text-green-700 mt-1 break-words">
                              {record.clockIn?.description || (record.approvals && record.approvals[0]?.description) || ''}
                            </p>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {record.status === 'rejected' && (record.rejectionReason || (record.rejections && record.rejections.length > 0)) && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-900">Rejection Reason:</p>
                            <p className="text-sm text-red-700 mt-1 break-words">
                              {record.rejectionReason || (record.rejections && record.rejections[0]?.reason) || 'No reason provided'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMoreRecords && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={loadMoreRecords}
                    className="px-6 py-3 bg-[#2C2C2C] text-white rounded-lg hover:bg-[#3C3C3C] transition-colors font-medium"
                  >
                    Load More ({filteredRecords.length - visibleRecords.length} remaining)
                  </button>
                </div>
              )}
              {filteredRecords.length > PAGE_SIZE && (
                <div className="text-center text-sm text-[#666666] pt-2">
                  Showing {visibleRecords.length} of {filteredRecords.length} records
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ClockHistoryPage;
