import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOutletContext } from 'react-router-dom';
import { 
  getPendingClockRequests,
  approveClockRequest,
  rejectClockRequest,
  subscribeToClockRequests
} from '../../utils/firestoreClockRequests';
import { db } from '../../firebase';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Calendar,
  Search,
  Filter,
  Building2,
  User,
  Clock3,
  X,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { formatTimestamp, formatDateForDisplay } from '@/utils/timezoneUtils';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import {
  cardPadding,
  cardStyles,
  getChipClasses,
  panelPadding,
  sectionSpacing
} from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

export default function RequestApprovalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setCommandState, resetCommandState } = useOutletContext();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterType, setFilterType] = useState('all'); // 'all', 'clock_in', 'clock_out'
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false);
  const [listenerError, setListenerError] = useState(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalDescription, setApprovalDescription] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Error/retry states
  const [error, setError] = useState(null);
  const [retryableRequest, setRetryableRequest] = useState(null);
  
  // Filter states
  const [selectedTrainer, setSelectedTrainer] = useState('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Real-time listener for clock requests
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    setLoading(true);

    const unsubscribe = subscribeToClockRequests(
      { status: 'pending', programManagerId: user.uid },
      (data) => {
        if (!isMounted) return;
        setLiveUpdatesPaused(false);
        setListenerError(null);
        const sorted = [...data].sort((a, b) => {
          const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
          const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
        setRequests(sorted);
        setLoading(false);
      },
      (error) => {
        console.error('Error in real-time requests listener:', error);
        if (!isMounted) return;
          setLoading(false);
        setListenerError(error);
        setLiveUpdatesPaused((prev) => {
          if (!prev) {
            toast({
              title: 'Live updates paused',
              description: 'We lost the real-time connection. Showing latest snapshot instead.',
              variant: 'destructive'
            });
          }
          return true;
        });
        getPendingClockRequests(user.uid).then((data) => {
            if (isMounted) {
              setRequests(data);
            }
          });
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, subscriptionKey]);

  const handleResumeLiveUpdates = () => {
    setLiveUpdatesPaused(false);
    setListenerError(null);
    setSubscriptionKey((prev) => prev + 1);
  };

  // Open approve modal
  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setApprovalDescription('');
    setError(null);
    setShowApproveModal(true);
  };

  // Process approval with retry logic
  const handleApproveSubmit = async (retryAttempt = 0) => {
    if (!selectedRequest) return;
    
    setProcessing(selectedRequest.requestId);
    setError(null);
    
    try {
      const result = await approveClockRequest(
        selectedRequest.requestId,
        user.uid,
        null,
        approvalDescription.trim() || undefined
      );
      
      if (result.success) {
        setShowApproveModal(false);
        setSelectedRequest(null);
        setApprovalDescription('');
        setRetryableRequest(null);
      } else {
        // Check if error is retryable
        if (result.retryable && retryAttempt < 2) {
          // Auto-retry with exponential backoff
          const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            handleApproveSubmit(retryAttempt + 1);
          }, delay);
        } else {
          setError(result.error || 'Failed to approve request');
          setRetryableRequest({
            type: 'approve',
            request: selectedRequest,
            description: approvalDescription
          });
        }
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setError(error.message || 'Failed to approve request');
      setRetryableRequest({
        type: 'approve',
        request: selectedRequest,
        description: approvalDescription
      });
    } finally {
      setProcessing(null);
    }
  };

  // Open reject modal
  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setError(null);
    setShowRejectModal(true);
  };

  // Process rejection with retry logic
  const handleRejectSubmit = async (retryAttempt = 0) => {
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
        setShowRejectModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        setRetryableRequest(null);
      } else {
        // Check if error is retryable
        if (result.retryable && retryAttempt < 2) {
          // Auto-retry with exponential backoff
          const delay = Math.pow(2, retryAttempt) * 1000;
          setTimeout(() => {
            handleRejectSubmit(retryAttempt + 1);
          }, delay);
        } else {
          setError(result.error || 'Failed to reject request');
          setRetryableRequest({
            type: 'reject',
            request: selectedRequest,
            reason: rejectionReason
          });
        }
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError(error.message || 'Failed to reject request');
      setRetryableRequest({
        type: 'reject',
        request: selectedRequest,
        reason: rejectionReason
      });
    } finally {
      setProcessing(null);
    }
  };

  // Manual retry
  const handleRetry = () => {
    if (!retryableRequest) return;
    
    if (retryableRequest.type === 'approve') {
      setSelectedRequest(retryableRequest.request);
      setApprovalDescription(retryableRequest.description || '');
      setShowApproveModal(true);
      setRetryableRequest(null);
      setTimeout(() => handleApproveSubmit(), 100);
    } else {
      setSelectedRequest(retryableRequest.request);
      setRejectionReason(retryableRequest.reason || '');
      setShowRejectModal(true);
      setRetryableRequest(null);
      setTimeout(() => handleRejectSubmit(), 100);
    }
  };

  // Get unique trainers for filter
  const uniqueTrainers = useMemo(() => {
    const trainers = new Set();
    requests.forEach(request => {
      if (request.trainerId && request.trainerName) {
        trainers.add(JSON.stringify({ id: request.trainerId, name: request.trainerName }));
      }
    });
    return Array.from(trainers)
      .map(str => JSON.parse(str))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Filter by type
      if (filterType !== 'all' && request.type !== filterType) {
        return false;
      }

      // Filter by trainer
      if (selectedTrainer !== 'all' && request.trainerId !== selectedTrainer) {
        return false;
      }

      // Filter by date range
      if (dateRange.startDate || dateRange.endDate) {
        const requestDate = request.date || '';
        if (!requestDate) return false;

        const reqDateObj = new Date(requestDate);
        
        if (dateRange.startDate && dateRange.endDate) {
          const startDateObj = new Date(dateRange.startDate);
          const endDateObj = new Date(dateRange.endDate);
          endDateObj.setHours(23, 59, 59, 999);
          if (reqDateObj < startDateObj || reqDateObj > endDateObj) {
            return false;
          }
        } else if (dateRange.startDate) {
          const startDateObj = new Date(dateRange.startDate);
          if (reqDateObj < startDateObj) {
            return false;
          }
        } else if (dateRange.endDate) {
          const endDateObj = new Date(dateRange.endDate);
          endDateObj.setHours(23, 59, 59, 999);
          if (reqDateObj > endDateObj) {
            return false;
          }
        }
      }

      // Filter by search term (using debounced value)
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        return (
          request.trainerName?.toLowerCase().includes(term) ||
          request.trainerEmail?.toLowerCase().includes(term) ||
          request.trainerClientNames?.some(name => name.toLowerCase().includes(term))
        );
      }

      return true;
    });
  }, [requests, filterType, debouncedSearchTerm, selectedTrainer, dateRange]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      clockIn: requests.filter(r => r.type === 'clock_in').length,
      clockOut: requests.filter(r => r.type === 'clock_out').length
    };
  }, [requests]);

  // Set command state for this page - title immediately, metrics when data loads
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Request Approvals',
        description: 'Review and approve clock-in/out requests from your trainers.',
        actions: null,
        metrics: !loading ? [
          <div key="total" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Pending Requests</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>,
          <div key="clockIn" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Clock-In Requests</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.clockIn}</p>
              </div>
              <Clock3 className="h-8 w-8 text-blue-600" />
            </div>
          </div>,
          <div key="clockOut" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Clock-Out Requests</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.clockOut}</p>
              </div>
              <Clock3 className="h-8 w-8 text-emerald-600" />
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, loading, setCommandState, resetCommandState]);

  if (loading) {
    return <LoadingSkeleton message="Loading requests..." className="h-96" />;
  }

  return (
    <div className={cn(sectionSpacing, panelPadding)}>
      {liveUpdatesPaused && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <div className="text-sm">
              <p className="font-medium">Live updates paused</p>
              <p className="text-xs md:text-sm">
                {listenerError?.message || 'Connection temporarily lost. You can keep working with the snapshot below.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleResumeLiveUpdates}
            className="self-start md:self-auto px-3 py-2 text-xs md:text-sm font-medium rounded-md border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Retry connection
          </button>
        </div>
      )}

      {/* Header and Stats removed - now in command ribbon */}

      {/* Filter Toggle */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setFiltersVisible((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          aria-expanded={filtersVisible}
          aria-controls="request-filter-panel"
        >
          <Filter className="h-4 w-4" />
          {filtersVisible ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Filters */}
      {filtersVisible && (
      <div
        id="request-filter-panel"
        className={cn(cardStyles.surface, cardPadding, 'space-y-4')}
      >
        {/* Search and Type Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#888888]" size={18} />
            <input
              type="text"
              placeholder="Search by trainer name, email, or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              aria-pressed={filterType === 'all'}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                filterType === 'all'
                  ? 'bg-[#2C2C2C] text-white'
                  : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E8E8E8]'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('clock_in')}
              aria-pressed={filterType === 'clock_in'}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                filterType === 'clock_in'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E8E8E8]'
              )}
            >
              Clock-In
            </button>
            <button
              onClick={() => setFilterType('clock_out')}
              aria-pressed={filterType === 'clock_out'}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400',
                filterType === 'clock_out'
                  ? 'bg-green-600 text-white'
                  : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E8E8E8]'
              )}
            >
              Clock-Out
            </button>
          </div>
        </div>

        {/* Additional Filters: Trainer and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Trainer Filter */}
          <div>
            <label className="block text-xs font-medium text-[#888888] mb-1">Filter by Trainer</label>
            <select
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm bg-white"
            >
              <option value="all">All Trainers</option>
              {uniqueTrainers.map(trainer => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filters */}
          <div>
            <label className="block text-xs font-medium text-[#888888] mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm bg-white"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-[#888888] mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm bg-white"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(selectedTrainer !== 'all' || dateRange.startDate || dateRange.endDate || searchTerm) && (
          <button
            onClick={() => {
              setSelectedTrainer('all');
              setDateRange({ startDate: '', endDate: '' });
              setSearchTerm('');
            }}
            className="text-sm text-[#666666] hover:text-[#2C2C2C] underline"
          >
            Clear all filters
          </button>
        )}
      </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            {retryableRequest && (
              <button
                onClick={handleRetry}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setError(null);
              setRetryableRequest(null);
            }}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            <X size={16} className="text-red-600" />
          </button>
        </div>
      )}

      {/* Requests List */}
      {filteredRequests.length > 0 ? (
        <div className="space-y-3">
          {filteredRequests.map(request => (
            <RequestCard
              key={request.requestId}
              request={request}
              processing={processing === request.requestId}
              onApprove={() => handleApproveClick(request)}
              onReject={() => handleRejectClick(request)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#E0E0E0] p-12 text-center shadow-sm">
          <Clock className="mx-auto text-[#E0E0E0] mb-4" size={48} />
          <h3 className="text-lg font-medium text-[#2C2C2C] mb-2">No pending requests</h3>
          <p className="text-[#666666]">
            {requests.length === 0 
              ? 'All requests have been processed'
              : 'No requests match your filters'
            }
          </p>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#2C2C2C]">Approve Request</h3>
              <button 
                onClick={() => { 
                  setShowApproveModal(false); 
                  setSelectedRequest(null); 
                  setApprovalDescription(''); 
                  setError(null);
                }} 
                className="p-1 hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <X size={20} className="text-[#666666]" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-[#666666] mb-2">Approve clock-in/out request for:</p>
              <div className="bg-[#F5F5F5] p-3 rounded-lg">
                <p className="font-medium text-[#2C2C2C]">{selectedRequest.trainerName}</p>
                <p className="text-sm text-[#888888]">{selectedRequest.date}</p>
                <p className="text-xs text-[#888888] mt-1">
                  {selectedRequest.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Description (Optional)
              </label>
              <textarea
                value={approvalDescription}
                onChange={(e) => setApprovalDescription(e.target.value)}
                placeholder="Add any notes or comments about this approval..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent resize-none text-sm"
              />
              <p className="text-xs text-[#888888] mt-1">
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
                className="flex-1 px-4 py-2 border border-[#E0E0E0] text-[#666666] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmit}
                disabled={processing === selectedRequest.requestId}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {processing === selectedRequest.requestId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Approve Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#2C2C2C]">Reject Request</h3>
              <button 
                onClick={() => { 
                  setShowRejectModal(false); 
                  setSelectedRequest(null); 
                  setRejectionReason(''); 
                  setError(null);
                }} 
                className="p-1 hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <X size={20} className="text-[#666666]" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-[#666666] mb-2">Reject clock-in/out request for:</p>
              <div className="bg-[#F5F5F5] p-3 rounded-lg">
                <p className="font-medium text-[#2C2C2C]">{selectedRequest.trainerName}</p>
                <p className="text-sm text-[#888888]">{selectedRequest.date}</p>
                <p className="text-xs text-[#888888] mt-1">
                  {selectedRequest.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a clear reason for rejection..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent resize-none text-sm"
                required
              />
              <p className="text-xs text-[#888888] mt-1">
                {rejectionReason.length}/500 characters
              </p>
              {!rejectionReason.trim() && (
                <p className="text-xs text-red-600 mt-1">Reason is required</p>
              )}
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
                className="flex-1 px-4 py-2 border border-[#E0E0E0] text-[#666666] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={processing === selectedRequest.requestId || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {processing === selectedRequest.requestId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Reject Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Request Card Component
function RequestCard({ request, processing, onApprove, onReject }) {
  const formatTimestampRelative = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Use timezone-aware formatting
    return formatTimestamp(timestamp, 'MMM dd, yyyy hh:mm a');
  };

  const isClockIn = request.type === 'clock_in';
  const typeColor = isClockIn ? 'blue' : 'green';
  const typeLabel = isClockIn ? 'Clock In' : 'Clock Out';

  return (
    <div className="bg-white rounded-lg border border-[#E0E0E0] p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 pb-3 border-b border-[#E0E0E0]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={cn(
                getChipClasses(isClockIn ? 'info' : 'success'),
                'px-2.5 py-1'
              )}
            >
              {typeLabel}
            </span>
          </div>
          <h3 className="text-base font-semibold text-[#2C2C2C] flex items-center gap-2 mb-1">
            <User size={16} className="text-[#666666]" />
            {request.trainerName || 'Unknown Trainer'}
          </h3>
          <p className="text-xs text-[#666666] truncate mb-2">{request.trainerEmail}</p>
          <div className="flex items-center gap-2 text-sm text-[#666666]">
            <Calendar className="w-4 h-4" />
            <div className="flex flex-col">
              <span className="font-semibold text-[#2C2C2C]">
                Requested for: {request.date ? formatDateForDisplay(request.date, 'MMM d, yyyy') : 'N/A'}
              </span>
              {request.requestedAt && (
                <span className="text-xs text-[#888888]">
                  Requested at: {formatDateTime(request.requestedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-1 md:flex-initial"
          >
            <CheckCircle size={16} />
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-1 md:flex-initial"
          >
            <XCircle size={16} />
            Reject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm">
        {/* Location Information */}
        {request.location && (
        <div className="bg-[#F5F5F5] rounded-md p-3">
            <h4 className="text-xs font-semibold text-[#2C2C2C] mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
            <MapPin size={14} className="text-[#666666]" />
            Location Information
          </h4>
          <div className="space-y-1">
              {(() => {
                // Prefer formattedAddress (most complete), fallback to placeName or other fields
                // This avoids duplication since formattedAddress usually contains placeName
                const locationText = request.location.formattedAddress || 
                                   request.location.placeName || 
                                   request.location.institution || 
                                   request.location.building || 
                                   null;
                
                const hasCoordinates = request.location.latitude && request.location.longitude;
                const hasAccuracy = request.location.accuracy;
                
                return (
                  <>
                    {locationText && (
                      <p className="text-xs text-[#666666] leading-relaxed">
                        {locationText}
                  </p>
                )}
                    {(hasCoordinates || hasAccuracy) && (
                <p className="text-xs text-[#888888]">
                        {hasCoordinates && (
                          <span>{request.location.latitude.toFixed(6)}, {request.location.longitude.toFixed(6)}</span>
                        )}
                        {hasAccuracy && (
                          <span>
                            {hasCoordinates && ' • '}
                    Accuracy: ±{request.location.accuracy.toFixed(0)}m
                          </span>
                        )}
                  </p>
                )}
                    {!locationText && !hasCoordinates && (
              <p className="text-xs text-[#888888]">No location data</p>
            )}
                  </>
                );
              })()}
          </div>
        </div>
        )}

        {/* Client Information */}
        {request.trainerClientNames && request.trainerClientNames.length > 0 && (
          <div className="bg-[#F5F5F5] rounded-md p-3">
            <h4 className="text-xs font-semibold text-[#2C2C2C] mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Building2 size={14} className="text-[#666666]" />
              Assigned Clients
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {request.trainerClientNames.map((clientName, idx) => (
                <span
                  key={idx}
                  className={cn(getChipClasses('muted'), 'px-2 py-0.5 text-xs')}
                >
                  {clientName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {request.notes && (
          <div className="bg-[#F5F5F5] rounded-md p-3">
            <h4 className="text-xs font-semibold text-[#2C2C2C] mb-2 uppercase tracking-wide">Notes</h4>
            <p className="text-xs text-[#666666] bg-white p-2 rounded border border-[#E0E0E0]">{request.notes}</p>
          </div>
        )}
      </div>

      {processing && (
        <div className="mt-3 pt-3 border-t border-[#E0E0E0]">
          <p className="text-xs text-[#666666] text-center">Processing...</p>
        </div>
      )}
    </div>
  );
}
