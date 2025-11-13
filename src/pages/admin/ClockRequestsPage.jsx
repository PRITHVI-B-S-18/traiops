import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Calendar,
  Search,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Mail,
  X,
  Download,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDateForDisplay, formatTimestamp } from '@/utils/timezoneUtils';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { 
  approveClockRequest, 
  rejectClockRequest,
  revokeRejection,
  subscribeToClockRequests,
  subscribeToClockRecords,
  fetchClockRequestsSnapshot,
  fetchClockRecordsSnapshot
} from '../../utils/firestoreClockRequests';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import {
  cardPadding,
  cardStyles,
  getChipClasses,
  panelPadding,
  sectionSpacing,
  toggleIconChip
} from '@/styles/designSystem';

const ClockRequestsPage = () => {
  const { setCommandState } = useOutletContext();
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processingRequest, setProcessingRequest] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null); // Selected trainer for modal
  const [expandedRequests, setExpandedRequests] = useState({}); // Track which individual requests are expanded in modal
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' }); // Date filter for modal
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false);
  const [listenerError, setListenerError] = useState(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    format: 'csv',
    dateRange: 'all',
    customStartDate: '',
    customEndDate: '',
    trainerId: 'all',
    status: 'all'
  });
  
  // Pagination state
  const [displayCount, setDisplayCount] = useState(50);
  const PAGE_SIZE = 50;

  // Real-time listeners for clock requests and records
  useEffect(() => {
    setLoading(true);
    
    let isMounted = true;
    let currentRequestsData = [];
    let currentRecordsData = {};
    let initialRequestsLoaded = false;
    
    const processCombinedData = () => {
      if (!isMounted) return;
      const mergedData = {};
      
      currentRequestsData
        .filter(req => req.type === 'clock_in')
        .forEach(req => {
          const dateKey = req.date || (req.requestedAt?.toDate ? format(req.requestedAt.toDate(), 'yyyy-MM-dd') : '');
          const trainerDateKey = `${req.trainerId}_${dateKey}`;
          
          mergedData[trainerDateKey] = {
            ...req,
            requestId: req.requestId,
            clockIn: {
              timestamp: req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt || 0),
              location: req.location,
              status: req.status
            },
            clockOut: null,
            rejectionReason: req.rejectionReason || null,
            rejections: req.rejections || []
          };
        });
      
      Object.keys(currentRecordsData).forEach(key => {
        const record = currentRecordsData[key];
        const trainerDateKey = `${record.trainerId}_${record.date}`;
        
        if (mergedData[trainerDateKey]) {
          mergedData[trainerDateKey].clockOut = record.clockOut ? {
            timestamp: record.clockOut.timestamp?.toDate ? record.clockOut.timestamp.toDate() : new Date(record.clockOut.timestamp || 0),
            location: record.clockOut.location
          } : null;
        } else if (record.clockIn) {
          mergedData[trainerDateKey] = {
            requestId: record.recordId,
            trainerId: record.trainerId,
            trainerName: record.trainerName || 'Unknown',
            trainerEmail: record.trainerEmail || '',
            date: record.date,
            status: 'approved',
            isNonTraining: record.isNonTraining || false,
            requiresApproval: record.requiresApproval !== false,
            taskType: record.taskType || null,
            clockIn: {
              timestamp: record.clockIn.timestamp?.toDate ? record.clockIn.timestamp.toDate() : new Date(record.clockIn.timestamp || 0),
              location: record.clockIn.location,
              status: 'approved',
              approvedBy: record.clockIn.approvedBy || 'system'
            },
            clockOut: record.clockOut ? {
              timestamp: record.clockOut.timestamp?.toDate ? record.clockOut.timestamp.toDate() : new Date(record.clockOut.timestamp || 0),
              location: record.clockOut.location,
              approvedBy: record.clockOut.approvedBy || 'system'
            } : null
          };
        }
      });
      
      const mergedArray = Object.values(mergedData).sort((a, b) => {
        const aTime = a.clockIn?.timestamp?.getTime ? a.clockIn.timestamp.getTime() : 0;
        const bTime = b.clockIn?.timestamp?.getTime ? b.clockIn.timestamp.getTime() : 0;
        return bTime - aTime;
      });
      
      setRequests(mergedArray);
      if (!initialRequestsLoaded) {
      setLoading(false);
        initialRequestsLoaded = true;
      }
    };
    
    const handleSubscriptionError = (error, fallback) => {
      if (!isMounted) return;
      console.error('Real-time listener error:', error);
      if (!initialRequestsLoaded) {
        setLoading(false);
        initialRequestsLoaded = true;
      }
      setListenerError(error);
      setLiveUpdatesPaused((prev) => {
        if (!prev) {
          toast({
            title: 'Live updates paused',
            description: 'We lost the real-time connection. Showing the latest snapshot instead.',
            variant: 'destructive'
          });
        }
        return true;
      });
      if (typeof fallback === 'function') {
        fallback();
      }
    };
    
    const unsubscribeRequests = subscribeToClockRequests(
      {},
      (data) => {
        if (!isMounted) return;
        setLiveUpdatesPaused(false);
        setListenerError(null);
        const sorted = [...data].sort((a, b) => {
                      const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
                      const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
                      return bTime - aTime;
                    });
        currentRequestsData = sorted;
                  processCombinedData();
                },
      (error) => {
        handleSubscriptionError(error, () => {
          fetchClockRequestsSnapshot({})
            .then((snapshotData) => {
              if (!isMounted) return;
              currentRequestsData = snapshotData;
              processCombinedData();
            })
            .catch((fetchError) => {
              console.error('Failed to fetch clock requests snapshot:', fetchError);
            });
        });
          }
        );
        
    const unsubscribeRecords = subscribeToClockRecords(
      {},
      (records) => {
        if (!isMounted) return;
        setLiveUpdatesPaused(false);
        setListenerError(null);
        const recordMap = {};
        records.forEach((record) => {
              const key = `${record.trainerId}_${record.date}`;
          recordMap[key] = record;
            });
        currentRecordsData = recordMap;
            processCombinedData();
          },
          (error) => {
        handleSubscriptionError(error, () => {
          fetchClockRecordsSnapshot({})
            .then((snapshotRecords) => {
              if (!isMounted) return;
              const recordMap = {};
              snapshotRecords.forEach((record) => {
                const key = `${record.trainerId}_${record.date}`;
                recordMap[key] = record;
              });
              currentRecordsData = recordMap;
            processCombinedData();
            })
            .catch((fetchError) => {
              console.error('Failed to fetch clock records snapshot:', fetchError);
            });
        });
          }
        );

    return () => {
      isMounted = false;
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeRecords) unsubscribeRecords();
    };
  }, [toast, subscriptionKey]);

  // Group requests by trainer and calculate stats
  const groupedByTrainer = useMemo(() => {
    const grouped = {};
    
    requests.forEach(request => {
      const trainerId = request.trainerId;
      const trainerName = request.trainerName || 'Unknown Trainer';
      const trainerEmail = request.trainerEmail || '';
      
      if (!grouped[trainerId]) {
        grouped[trainerId] = {
          trainerId,
          trainerName,
          trainerEmail,
          requests: [],
          stats: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0
          }
        };
      }
      
      grouped[trainerId].requests.push(request);
      
      // Update stats
      const status = request.clockIn?.status || request.status;
      grouped[trainerId].stats.total++;
      if (status === 'pending') grouped[trainerId].stats.pending++;
      else if (status === 'approved') grouped[trainerId].stats.approved++;
      else if (status === 'rejected') grouped[trainerId].stats.rejected++;
    });
    
    return grouped;
  }, [requests]);

  // Keep selectedTrainer in sync with latest data when requests update
  const currentSelectedTrainer = useMemo(() => {
    if (!selectedTrainer) return null;
    // Find the latest trainer data from groupedByTrainer
    const latestTrainer = groupedByTrainer[selectedTrainer.trainerId];
    if (latestTrainer) {
      return latestTrainer;
    }
    // If trainer not found (maybe filtered out), return the selected one
    return selectedTrainer;
  }, [selectedTrainer, groupedByTrainer]);

  // Filter and sort trainers
  const filteredTrainers = useMemo(() => {
    let trainers = Object.values(groupedByTrainer);
    
    // Filter by search term (using debounced value)
    if (debouncedSearchTerm) {
      trainers = trainers.filter(trainer => 
        trainer.trainerName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        trainer.trainerEmail?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }
    
    // Filter by status (show trainers with requests matching status)
    if (selectedStatus !== 'all') {
      trainers = trainers.filter(trainer => {
        if (selectedStatus === 'pending') return trainer.stats.pending > 0;
        if (selectedStatus === 'approved') return trainer.stats.approved > 0;
        if (selectedStatus === 'rejected') return trainer.stats.rejected > 0;
        return true;
      });
    }
    
    // Sort by pending count (descending), then by name
    trainers.sort((a, b) => {
      if (b.stats.pending !== a.stats.pending) {
        return b.stats.pending - a.stats.pending;
      }
      return a.trainerName.localeCompare(b.trainerName);
    });
    
    return trainers;
  }, [groupedByTrainer, debouncedSearchTerm, selectedStatus]);

  const paginatedTrainers = useMemo(() => {
    return filteredTrainers.slice(0, displayCount);
  }, [filteredTrainers, displayCount]);

  const hasMoreTrainers = displayCount < filteredTrainers.length;

  const loadMoreTrainers = () => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, filteredTrainers.length));
  };

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchTerm, selectedStatus, filteredTrainers.length]);

  const handleResumeLiveUpdates = () => {
    setLiveUpdatesPaused(false);
    setListenerError(null);
    setSubscriptionKey((prev) => prev + 1);
  };

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApproveSubmit = async () => {
    if (!selectedRequest?.requestId) return;

    setProcessingRequest(true);
    try {
      // Pass admin ID for admin approvals
      const result = await approveClockRequest(
        selectedRequest.requestId,
        null,
        user?.uid,
        approvalNotes.trim() || undefined
      );
      
      if (result.success) {
        setShowApproveModal(false);
        setSelectedRequest(null);
        setApprovalNotes('');
        setSelectedTrainer(null);
        setDateFilter({ startDate: '', endDate: '' });
        toast({
          title: 'Success',
          description: 'Request approved successfully',
          variant: 'default'
        });
        // Real-time listener will automatically update the UI
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve request',
        variant: 'destructive'
      });
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedRequest?.requestId) return;
    if (!rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      });
      return;
    }

    setProcessingRequest(true);
    try {
      // Pass admin ID for admin rejections
      const result = await rejectClockRequest(
        selectedRequest.requestId, 
        rejectionReason.trim(),
        null, // No PM ID for admin rejections
        user?.uid // Admin ID
      );
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Request rejected',
          variant: 'default'
        });
        setShowRejectModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        setSelectedTrainer(null);
        setDateFilter({ startDate: '', endDate: '' });
        // Real-time listener will automatically update the UI
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject request',
        variant: 'destructive'
      });
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleRevokeRejection = async (request) => {
    if (!request.requestId) return;

    setProcessingRequest(true);
    try {
      const result = await revokeRejection(request.requestId, user?.uid);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rejection revoked. Request is now pending.',
          variant: 'default'
        });
        // Real-time listener will automatically update the UI
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error revoking rejection:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke rejection',
        variant: 'destructive'
      });
    } finally {
      setProcessingRequest(false);
    }
  };

  const getStatusBadge = (status, showText = false) => {
    const variantMap = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    const icons = {
      pending: Clock,
      approved: CheckCircle,
      rejected: XCircle
    };

    const Icon = icons[status] || Clock;
    const label = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Status';

    return (
      <span
        className={cn(getChipClasses(variantMap[status] || 'neutral'), 'gap-1')}
        title={label}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span className={showText ? 'inline' : 'sr-only'}>{label}</span>
      </span>
    );
  };


  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => (r.clockIn?.status || r.status) === 'pending').length;
    const approved = requests.filter(r => (r.clockIn?.status || r.status) === 'approved').length;
    const rejected = requests.filter(r => (r.clockIn?.status || r.status) === 'rejected').length;
    
    return { total, pending, approved, rejected };
  }, [requests]);

  // Set up command ribbon
  useEffect(() => {
    setCommandState({
      title: 'Clock Request Management',
      description: 'Review and manage trainer clock-in/out requests with real-time updates.',
      actions: (
        <Button onClick={() => setIsExportModalOpen(true)} size="sm" className="flex items-center gap-2 whitespace-nowrap">
          <Download className="h-4 w-4" />
          Export
        </Button>
      ),
      metrics: [
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Requests</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <Clock className="h-8 w-8 text-indigo-600" />
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
        <div key="approved" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Approved</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-600" />
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
      ],
    });
  }, [stats, setCommandState, setIsExportModalOpen]);

  const trainerOptions = useMemo(() => {
    const map = new Map();
    requests.forEach((req) => {
      if (!req.trainerId) return;
      const label = req.trainerName || req.trainerEmail || req.trainerId;
      if (!map.has(req.trainerId)) {
        map.set(req.trainerId, label);
      }
    });

    return [{ value: 'all', label: 'All Trainers' }, ...Array.from(map.entries()).map(([value, label]) => ({ value, label }))];
  }, [requests]);

  const getExportDateBounds = () => {
    const range = exportFilters.dateRange;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (range) {
      case 'today':
        return { start, end };
      case 'week': {
        const current = new Date();
        const day = current.getDay();
        const weekStart = new Date(current);
        weekStart.setDate(current.getDate() - day);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      }
      case 'month': {
        const current = new Date();
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        monthStart.setHours(0, 0, 0, 0);
        monthEnd.setHours(23, 59, 59, 999);
        return { start: monthStart, end: monthEnd };
      }
      case 'custom': {
        const customStart = exportFilters.customStartDate ? new Date(exportFilters.customStartDate) : null;
        const customEnd = exportFilters.customEndDate ? new Date(exportFilters.customEndDate) : null;
        if (customStart) customStart.setHours(0, 0, 0, 0);
        if (customEnd) customEnd.setHours(23, 59, 59, 999);
        return { start: customStart, end: customEnd };
      }
      default:
        return { start: null, end: null };
    }
  };

  const toDateSafe = (value) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatLocation = (loc) => {
    if (!loc) return '';
    return (
      loc.formattedAddress ||
      loc.placeName ||
      loc.building ||
      loc.institution ||
      loc.address ||
      loc.displayName ||
      ''
    );
  };

  const buildClockExportRows = () => {
    const { start, end } = getExportDateBounds();
    const filtered = requests.filter((req) => {
      const requestedAtDate = toDateSafe(req.requestedAt);
      if (start && requestedAtDate && requestedAtDate < start) return false;
      if (end && requestedAtDate && requestedAtDate > end) return false;
      if (exportFilters.trainerId !== 'all' && req.trainerId !== exportFilters.trainerId) return false;
      const statusValue = req.clockIn?.status || req.status;
      if (exportFilters.status !== 'all' && statusValue !== exportFilters.status) return false;
      return true;
    });

    return filtered.map((req) => {
      const requestedAtDate = toDateSafe(req.requestedAt);
      const clockInTimestamp = toDateSafe(req.clockIn?.timestamp);
      const clockOutTimestamp = toDateSafe(req.clockOut?.timestamp);
      const statusValue = req.clockIn?.status || req.status;
      const approverSummaries = Array.from(
        new Set(
          (req.approvals || []).map((approval) => {
            const name =
              approval.approvedByName ||
              approval.approvedBy ||
              approval.adminApprovedByName ||
              'Reviewer';
            const roleLabel =
              approval.approvedByRole === 'admin'
                ? 'Admin'
                : approval.approvedByRole === 'program_manager'
                  ? 'Program Manager'
                  : approval.approvedByRole === 'trainer'
                    ? 'Trainer'
                    : 'Reviewer';
            return `${name} (${roleLabel})`;
          })
        )
      ).filter(Boolean);

      return {
        date: req.date || (requestedAtDate ? format(requestedAtDate, 'yyyy-MM-dd') : ''),
        trainer: req.trainerName || 'Unknown',
        trainerEmail: req.trainerEmail || '',
        requestedAt: requestedAtDate ? format(requestedAtDate, 'PPpp') : '',
        type: req.type || req.clockIn?.type || 'clock_in',
        status: statusValue || 'pending',
        clockInTime: clockInTimestamp ? format(clockInTimestamp, 'PPpp') : '',
        clockOutTime: clockOutTimestamp ? format(clockOutTimestamp, 'PPpp') : '',
        clockInLocation: formatLocation(req.clockIn?.location),
        clockOutLocation: formatLocation(req.clockOut?.location),
        approvedBy: approverSummaries.join('; ')
      };
    });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (rows) => {
    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'trainer', label: 'Trainer' },
      { key: 'trainerEmail', label: 'Trainer Email' },
      { key: 'requestedAt', label: 'Requested At' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'clockInTime', label: 'Clock-In Time' },
      { key: 'clockOutTime', label: 'Clock-Out Time' },
      { key: 'clockInLocation', label: 'Clock-In Location' },
      { key: 'clockOutLocation', label: 'Clock-Out Location' },
      { key: 'approvedBy', label: 'Approved By' }
    ];

    const escapeCSV = (value) => {
      const content = value === null || value === undefined ? '' : String(value);
      return `"${content.replace(/"/g, '""')}"`;
    };

    const lines = [headers.map((h) => escapeCSV(h.label)).join(',')];
    rows.forEach((row) => {
      lines.push(headers.map((h) => escapeCSV(row[h.key])).join(','));
    });

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `clock_requests_${Date.now()}.csv`);
  };

  const pdfStyles = StyleSheet.create({
    page: {
      padding: 24,
      fontSize: 10,
      fontFamily: 'Helvetica'
    },
    title: {
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 12
    },
    card: {
      borderWidth: 1,
      borderColor: '#E4E4E7',
      borderRadius: 6,
      padding: 10,
      marginBottom: 8
    },
    row: {
      marginBottom: 4
    },
    label: {
      fontWeight: 600
    }
  });

  const ClockRequestExportDocument = ({ rows }) => (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Clock Requests Export</Text>
        {rows.map((row, index) => (
          <View key={index} style={pdfStyles.card} wrap={false}>
            <Text style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Trainer: </Text>
              {row.trainer} {row.trainerEmail ? `(${row.trainerEmail})` : ''}
            </Text>
            <Text style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Date: </Text>
              {row.date}
            </Text>
            <Text style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Type: </Text>
              {row.type}
            </Text>
            <Text style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Status: </Text>
              {row.status}
            </Text>
            {row.requestedAt ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Requested At: </Text>
                {row.requestedAt}
              </Text>
            ) : null}
            {row.clockInTime ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Clock-In: </Text>
                {row.clockInTime}
              </Text>
            ) : null}
            {row.clockOutTime ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Clock-Out: </Text>
                {row.clockOutTime}
              </Text>
            ) : null}
            {row.clockInLocation ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Clock-In Location: </Text>
                {row.clockInLocation}
              </Text>
            ) : null}
            {row.clockOutLocation ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Clock-Out Location: </Text>
                {row.clockOutLocation}
              </Text>
            ) : null}
            {row.approvedBy ? (
              <Text style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Approved by: </Text>
                {row.approvedBy}
              </Text>
            ) : null}
          </View>
        ))}
      </Page>
    </Document>
  );

  const downloadPDF = async (rows) => {
    const blob = await pdf(<ClockRequestExportDocument rows={rows} />).toBlob();
    downloadBlob(blob, `clock_requests_${Date.now()}.pdf`);
  };

  const handleExportSubmit = async () => {
    try {
      const rows = buildClockExportRows();
      if (!rows.length) {
        toast({
          title: 'Nothing to export',
          description: 'No clock requests match your export filters.',
          variant: 'destructive'
        });
        return;
      }

      if (exportFilters.format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Clock Requests');
        XLSX.writeFile(workbook, `clock_requests_${Date.now()}.xlsx`);
      } else if (exportFilters.format === 'pdf') {
        await downloadPDF(rows);
      } else {
        downloadCSV(rows);
      }

      toast({
        title: 'Export ready',
        description: `Clock data exported as ${exportFilters.format.toUpperCase()}.`
      });
      setIsExportModalOpen(false);
    } catch (error) {
      console.error('Clock export error:', error);
      toast({
        title: 'Export failed',
        description: 'Unable to generate export. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <LoadingSkeleton message="Loading clock requests..." />;
  }

  return (
    <div className={cn(sectionSpacing, panelPadding)}>
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Export Clock Data</h2>
                <p className="text-sm text-slate-500">Choose your export format and filters.</p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close export modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Format</label>
                <select
                  value={exportFilters.format}
                  onChange={(e) => setExportFilters((prev) => ({ ...prev, format: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                  <option value="pdf">PDF (.pdf)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Date Range</label>
                <select
                  value={exportFilters.dateRange}
                  onChange={(e) => setExportFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {exportFilters.dateRange === 'custom' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Start Date</label>
                    <input
                      type="date"
                      value={exportFilters.customStartDate}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, customStartDate: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">End Date</label>
                    <input
                      type="date"
                      value={exportFilters.customEndDate}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, customEndDate: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Trainer</label>
                <select
                  value={exportFilters.trainerId}
                  onChange={(e) => setExportFilters((prev) => ({ ...prev, trainerId: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {trainerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  value={exportFilters.status}
                  onChange={(e) => setExportFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportSubmit}
                  className="rounded-md bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1F1F1F]"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {liveUpdatesPaused && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">Live updates paused</p>
              <p className="text-xs md:text-sm">
                {listenerError?.message || 'Connection temporarily lost. You can continue working with the snapshot below.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleResumeLiveUpdates}
            className="self-start rounded-md border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:self-auto md:text-sm"
          >
            Retry connection
          </button>
        </div>
      )}


      {/* Filters */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <input
                type="text"
                placeholder="Search by trainer name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#2C2C2C] text-white'
                    : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E8E8E8]'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trainers List - Grouped by Trainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.length === 0 && !loading ? (
          <div className={cn(cardStyles.surface, 'col-span-full p-12 text-center')}>
            <Clock className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No clock requests yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Clock-in/out requests from trainers will appear here once they submit their requests.
            </p>
          </div>
        ) : filteredTrainers.length === 0 ? (
          <div className={cn(cardStyles.surface, 'col-span-full p-12 text-center')}>
            <Search className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No trainers found</h3>
            <p className="text-sm text-slate-500 mb-4">
              No trainers match your search or filter criteria. Try adjusting your filters.
            </p>
            <Button onClick={() => {
              setSearchTerm('');
              setSelectedStatus('all');
            }} variant="outline" size="sm">
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            {paginatedTrainers.map((trainer) => {
            return (
              <div 
                key={trainer.trainerId} 
                onClick={() => setSelectedTrainer(trainer)}
                className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:border-[#2C2C2C]/20"
              >
                {/* Trainer Summary Card - Clickable */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-[#F5F5F5] rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-[#666666]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#2C2C2C] truncate">{trainer.trainerName}</h3>
                        <p className="text-xs text-[#888888] truncate mt-0.5">
                          {trainer.trainerEmail}
                        </p>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-[#666666] flex-shrink-0" />
                  </div>
                  
                  {/* Trainer Stats */}
                  <div className="mt-4 pt-3 border-t border-[#E0E0E0]">
                    {trainer.stats.pending > 0 && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-300">
                          <AlertCircle className="w-3 h-3" />
                          {trainer.stats.pending} Pending
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[#888888]">
                      <span className="font-medium text-[#2C2C2C]">{trainer.stats.total} Total</span>
                      <span className="text-green-600">{trainer.stats.approved} Approved</span>
                      {trainer.stats.rejected > 0 && (
                        <span className="text-red-600">{trainer.stats.rejected} Rejected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
            {hasMoreTrainers && (
              <div className="col-span-full flex justify-center pt-4">
                <button
                  onClick={loadMoreTrainers}
                  className="px-6 py-3 bg-[#2C2C2C] text-white rounded-lg hover:bg-[#3C3C3C] transition-colors font-medium"
                >
                  Load More Trainers ({filteredTrainers.length - paginatedTrainers.length} remaining)
                </button>
              </div>
            )}
            {filteredTrainers.length > PAGE_SIZE && (
              <div className="col-span-full text-center text-sm text-[#666666]">
                Showing {paginatedTrainers.length} of {filteredTrainers.length} trainers
              </div>
            )}
          </>
        )}
      </div>

      {/* Trainer Details Modal - Glassmorphic */}
      {currentSelectedTrainer && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTrainer(null);
            }
          }}
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/20">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E0E0E0]/50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#F5F5F5] to-[#E8E8E8] rounded-full flex items-center justify-center border border-[#E0E0E0]">
                    <User className="w-7 h-7 text-[#666666]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#2C2C2C]">{currentSelectedTrainer.trainerName}</h2>
                    <p className="text-sm text-[#888888] flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4" />
                      {currentSelectedTrainer.trainerEmail}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTrainer(null);
                    setDateFilter({ startDate: '', endDate: '' }); // Reset date filter when closing modal
                  }}
                  className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-[#666666]" />
                </button>
              </div>
              
              {/* Trainer Stats in Header - Correct Order: Total, Approved, Rejected, Pending */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#E0E0E0]/50">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[#888888]"><span className="font-semibold text-[#2C2C2C]">{currentSelectedTrainer.stats.total}</span> Total</span>
                  <span className="text-green-600"><span className="font-semibold">{currentSelectedTrainer.stats.approved}</span> Approved</span>
                  {currentSelectedTrainer.stats.rejected > 0 && (
                    <span className="text-red-600"><span className="font-semibold">{currentSelectedTrainer.stats.rejected}</span> Rejected</span>
                  )}
                  {currentSelectedTrainer.stats.pending > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-300">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">{currentSelectedTrainer.stats.pending} Pending</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Date Filter */}
              <div className="mt-4 pt-4 border-t border-[#E0E0E0]/50">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <label className="text-sm font-medium text-[#2C2C2C] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#666666]" />
                    Filter by Date:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                        className="px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm"
                        placeholder="Start Date"
                      />
                      <span className="text-[#888888] text-sm">to</span>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                        className="px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent text-sm"
                        placeholder="End Date"
                      />
                    </div>
                    {(dateFilter.startDate || dateFilter.endDate) && (
                      <button
                        onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                        className="px-3 py-2 text-sm text-[#666666] hover:text-[#2C2C2C] hover:bg-[#F5F5F5] rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Filter trainer's requests by status if needed
                let trainerRequests = currentSelectedTrainer.requests;
                if (selectedStatus !== 'all') {
                  trainerRequests = trainerRequests.filter(req => {
                    const status = req.clockIn?.status || req.status;
                    return status === selectedStatus;
                  });
                }
                
                // Filter by date range
                if (dateFilter.startDate || dateFilter.endDate) {
                  trainerRequests = trainerRequests.filter(req => {
                    const requestDate = req.date || '';
                    if (!requestDate) return false;
                    
                    const reqDateObj = new Date(requestDate);
                    
                    if (dateFilter.startDate && dateFilter.endDate) {
                      const startDateObj = new Date(dateFilter.startDate);
                      const endDateObj = new Date(dateFilter.endDate);
                      endDateObj.setHours(23, 59, 59, 999); // Include entire end date
                      return reqDateObj >= startDateObj && reqDateObj <= endDateObj;
                    } else if (dateFilter.startDate) {
                      const startDateObj = new Date(dateFilter.startDate);
                      return reqDateObj >= startDateObj;
                    } else if (dateFilter.endDate) {
                      const endDateObj = new Date(dateFilter.endDate);
                      endDateObj.setHours(23, 59, 59, 999); // Include entire end date
                      return reqDateObj <= endDateObj;
                    }
                    
                    return true;
                  });
                }
                
                // Sort requests by date (newest first)
                trainerRequests.sort((a, b) => {
                  const aDate = a.date || '';
                  const bDate = b.date || '';
                  return bDate.localeCompare(aDate);
                });
                
                if (trainerRequests.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Clock className="w-16 h-16 text-[#E0E0E0] mx-auto mb-4" />
                      <p className="text-[#888888]">
                        {dateFilter.startDate || dateFilter.endDate || selectedStatus !== 'all'
                          ? 'No requests found matching the selected filters'
                          : 'No requests found for this trainer'}
                      </p>
                      {(dateFilter.startDate || dateFilter.endDate || selectedStatus !== 'all') && (
                        <button
                          onClick={() => {
                            setDateFilter({ startDate: '', endDate: '' });
                            setSelectedStatus('all');
                          }}
                          className="mt-4 px-4 py-2 text-sm text-[#2C2C2C] hover:bg-[#F5F5F5] rounded-lg transition-colors border border-[#E0E0E0]"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {trainerRequests.map((request) => {
                      const hasClockIn = !!request.clockIn;
                      const hasClockOut = !!request.clockOut;
                      const isComplete = hasClockIn && hasClockOut;
                      const isRequestExpanded = expandedRequests[request.requestId] || false;
                      const requestStatus = request.clockIn?.status || request.status;
                      const requestPanelId = `request-panel-${request.requestId}`;
                      const approverSummaries = Array.from(
                        new Set(
                          (request.approvals || []).map((approval) => {
                            const name =
                              approval.approvedByName ||
                              approval.approvedBy ||
                              approval.adminApprovedByName ||
                              'Reviewer';
                            const roleLabel =
                              approval.approvedByRole === 'admin'
                                ? 'Admin'
                                : approval.approvedByRole === 'program_manager'
                                  ? 'Program Manager'
                                  : approval.approvedByRole === 'trainer'
                                    ? 'Trainer'
                                    : 'Reviewer';
                            return `${name} (${roleLabel})`;
                          })
                        )
                      ).filter(Boolean);
                      
                      return (
                        <div key={request.requestId} className="bg-white/60 backdrop-blur-sm border border-[#E0E0E0]/50 rounded-lg p-4 hover:bg-white/80 transition-colors">
                          {/* Request Summary - Compact */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Clock Status Indicator - Shows clock-in only vs clock-in+out */}
                              {hasClockIn ? (
                                <div className="flex-shrink-0">
                                  {isComplete ? (
                                    <div className="flex items-center gap-1" title="Clock-in and Clock-out completed">
                                      <Clock className="w-5 h-5 text-green-600" />
                                      <span className="text-xs text-green-600 font-medium">In&Out</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1" title="Clock-in only">
                                      <Clock className="w-5 h-5 text-blue-600" />
                                      <span className="text-xs text-blue-600 font-medium">In</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-5 h-5 flex-shrink-0" />
                              )}
                              
                              <div className="flex items-center gap-2 text-sm text-[#666666]">
                                <Calendar className="w-4 h-4" />
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[#2C2C2C]">
                                    {request.date ? formatDateForDisplay(request.date, 'MMM d, yyyy') : 'N/A'}
                                  </span>
                                  {request.requestedAt && (
                                    <span className="text-xs text-[#888888]">
                                      Requested at: {formatTimestamp(request.requestedAt, 'MMM d, yyyy hh:mm a')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Non-Training Task Badge */}
                              {request.isNonTraining && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded border border-orange-200" title="Non-Training Task - Auto-approved">
                                  Non-Training
                                </span>
                              )}
                              
                            </div>
                            
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Status Icon Only (No Text) */}
                              {getStatusBadge(requestStatus, false)}
                              {approverSummaries.length > 0 && (
                                <span className="hidden text-xs text-[#888888] md:inline">
                                  Approved by {approverSummaries.slice(0, 2).join(', ')}
                                  {approverSummaries.length > 2
                                    ? ` +${approverSummaries.length - 2}`
                                    : ''}
                                </span>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRequests(prev => ({
                                    ...prev,
                                    [request.requestId]: !prev[request.requestId]
                                  }));
                                }}
                                aria-expanded={isRequestExpanded}
                                aria-controls={requestPanelId}
                                className={cn(toggleIconChip, 'hover:bg-slate-100')}
                                aria-label={isRequestExpanded ? 'Collapse request details' : 'Expand request details'}
                              >
                                {isRequestExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-[#666666]" aria-hidden="true" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-[#666666]" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Request Details - Expanded */}
                          {isRequestExpanded && (
                            <div
                              id={requestPanelId}
                              className="mt-4 space-y-4 border-t border-[#E0E0E0]/50 pt-4"
                            >
                              {/* Clock In & Out Times - Compact Grid */}
                              <div className="grid grid-cols-2 gap-4">
                                {/* Clock In */}
                                <div className="flex flex-col">
                                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    Clock-In
                                  </p>
                                  {hasClockIn && request.clockIn.timestamp ? (
                                    <>
                                      <p className="mt-1 text-sm font-medium text-slate-900">
                                        {format(request.clockIn.timestamp, 'PPpp')}
                                        </p>
                                        {request.clockIn.location && (
                                        <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                                          <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                                          <span>
                                            {request.clockIn.location.formattedAddress || 
                                             request.clockIn.location.placeName || 
                                             request.clockIn.location.institution || 
                                             request.clockIn.location.building || 
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
                                  {hasClockOut && request.clockOut.timestamp ? (
                                    <>
                                      <p className="mt-1 text-sm font-medium text-slate-900">
                                        {format(request.clockOut.timestamp, 'PPpp')}
                                        </p>
                                        {request.clockOut.location && (
                                        <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                                          <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                                          <span>
                                            {request.clockOut.location.formattedAddress || 
                                             request.clockOut.location.placeName || 
                                             request.clockOut.location.institution || 
                                             request.clockOut.location.building || 
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

                              {/* Non-Training Task Info */}
                              {request.isNonTraining && (
                                <div className="pt-2 border-t border-[#E0E0E0]/50">
                                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-orange-900">Non-Training Task</p>
                                      <p className="text-xs text-orange-700 mt-1">
                                        This clock-in/out was automatically registered without requiring approval. 
                                        {request.taskType && ` Task Type: ${request.taskType}`}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons - Only show for pending requests that require approval */}
                              {requestStatus === 'pending' && !request.isNonTraining && (
                                <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E0E0]/50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRejectClick(request);
                                    }}
                                    disabled={processingRequest}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveClick(request);
                                    }}
                                    disabled={processingRequest}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Approve
                                  </button>
                                </div>
                              )}

                              {/* Rejection Reason & Revoke Button */}
                              {requestStatus === 'rejected' && (request.rejectionReason || request.rejections?.[0]?.reason) && (
                                <div className="space-y-2 pt-2 border-t border-[#E0E0E0]/50">
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-xs text-red-800 font-medium mb-1">Rejection Reason:</p>
                                    <p className="text-sm text-red-900 break-words">{request.rejectionReason || request.rejections?.[0]?.reason}</p>
                                  </div>
                                  <div className="flex justify-end">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevokeRejection(request);
                                      }}
                                      disabled={processingRequest}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      Revoke Rejection
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[#2C2C2C] mb-4">Reject Request</h3>
            
            <div className="mb-4">
              <p className="text-sm text-[#666666] mb-2">
                Rejecting clock-in request for:
              </p>
              <div className="bg-[#F5F5F5] p-3 rounded-lg">
                <p className="font-medium text-[#2C2C2C]">{selectedRequest?.trainerName}</p>
                <p className="text-sm text-[#888888]">
                  Requested for: {selectedRequest?.date ? formatDateForDisplay(selectedRequest.date, 'MMM d, yyyy') : 'N/A'}
                </p>
                {selectedRequest?.requestedAt && (
                  <p className="text-sm text-[#888888]">
                    Requested at: {formatTimestamp(selectedRequest.requestedAt, 'MMM d, yyyy hh:mm a')}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a clear reason for rejection..."
                rows={4}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent resize-none text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                disabled={processingRequest}
                className="flex-1 px-4 py-2 border border-[#E0E0E0] text-[#666666] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={processingRequest || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {processingRequest ? 'Processing...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[#2C2C2C] mb-4">Approve Request</h3>

            <div className="mb-4">
              <p className="text-sm text-[#666666] mb-2">
                Approving clock-in request for:
              </p>
              <div className="bg-[#F5F5F5] p-3 rounded-lg">
                <p className="font-medium text-[#2C2C2C]">{selectedRequest?.trainerName}</p>
                <p className="text-sm text-[#888888]">
                  Requested for: {selectedRequest?.date ? formatDateForDisplay(selectedRequest.date, 'MMM d, yyyy') : 'N/A'}
                </p>
                {selectedRequest?.requestedAt && (
                  <p className="text-sm text-[#888888]">
                    Requested at: {formatTimestamp(selectedRequest.requestedAt, 'MMM d, yyyy hh:mm a')}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                Approval Notes <span className="text-[#888888] text-xs font-normal">(optional)</span>
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add a note for audit history (optional)..."
                rows={4}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C2C2C] focus:border-transparent resize-none text-sm"
              />
              <p className="mt-1 text-xs text-[#888888]">
                These notes will appear in the approval history for this request.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                  setApprovalNotes('');
                }}
                disabled={processingRequest}
                className="flex-1 px-4 py-2 border border-[#E0E0E0] text-[#666666] rounded-lg hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmit}
                disabled={processingRequest}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {processingRequest ? 'Processing...' : 'Approve Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockRequestsPage;

