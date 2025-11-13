import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOutletContext } from 'react-router-dom';
import { subscribeToClockRequests, subscribeToClockRecords } from '@/utils/firestoreClockRequests';
import { format } from 'date-fns';
import { formatDateForDisplay, formatTimestamp } from '@/utils/timezoneUtils';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  MapPin,
  Calendar,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import {
  cardPadding,
  cardStyles,
  getChipClasses,
  panelPadding,
  sectionSpacing,
  toggleButtonBase,
  toggleIconChip
} from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  expired: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
};

const statusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled'
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  expired: AlertCircle,
  cancelled: AlertCircle
};

const RequestHistoryPage = () => {
  const { user } = useAuth();
  const { setCommandState, resetCommandState } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [expandedTrainers, setExpandedTrainers] = useState({});
  const [expandedEntries, setExpandedEntries] = useState({});

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    let isMounted = true;
    let currentRequestsData = [];
    let currentRecordsData = {};
    let initialLoaded = false;

    const processCombinedData = () => {
      if (!isMounted) return;

      const mergedData = {};

      currentRequestsData.forEach((req) => {
        const dateKey = req.date ||
          (req.requestedAt?.toDate ? format(req.requestedAt.toDate(), 'yyyy-MM-dd') : '');
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

      Object.keys(currentRecordsData).forEach((key) => {
        const record = currentRecordsData[key];
        const trainerDateKey = `${record.trainerId}_${record.date}`;

        if (mergedData[trainerDateKey]) {
          mergedData[trainerDateKey].clockOut = record.clockOut
            ? {
                timestamp: record.clockOut.timestamp?.toDate
                  ? record.clockOut.timestamp.toDate()
                  : new Date(record.clockOut.timestamp || 0),
                location: record.clockOut.location,
                approvedBy: record.clockOut.approvedBy || null
              }
            : null;

          if (record.clockIn) {
            mergedData[trainerDateKey].clockIn = {
              timestamp: record.clockIn.timestamp?.toDate
                ? record.clockIn.timestamp.toDate()
                : new Date(record.clockIn.timestamp || 0),
              location: record.clockIn.location,
              status: record.clockIn.status || mergedData[trainerDateKey].status
            };
          }
        } else if (record.clockIn) {
          mergedData[trainerDateKey] = {
            requestId: record.recordId,
            trainerId: record.trainerId,
            trainerName: record.trainerName || 'Unknown',
            trainerEmail: record.trainerEmail || '',
            date: record.date,
            status: 'approved',
            type: record.clockOut ? 'clock_out' : 'clock_in',
            clockIn: {
              timestamp: record.clockIn.timestamp?.toDate
                ? record.clockIn.timestamp.toDate()
                : new Date(record.clockIn.timestamp || 0),
              location: record.clockIn.location,
              status: 'approved'
            },
            clockOut: record.clockOut
              ? {
                  timestamp: record.clockOut.timestamp?.toDate
                    ? record.clockOut.timestamp.toDate()
                    : new Date(record.clockOut.timestamp || 0),
                  location: record.clockOut.location,
                  approvedBy: record.clockOut.approvedBy || null
                }
              : null,
            approvals: [],
            rejections: [],
            rejectionReason: null
          };
        }
      });

      const mergedArray = Object.values(mergedData).sort((a, b) => {
        const aTime = a.clockIn?.timestamp?.getTime ? a.clockIn.timestamp.getTime() : 0;
        const bTime = b.clockIn?.timestamp?.getTime ? b.clockIn.timestamp.getTime() : 0;
        return bTime - aTime;
      });

      setRequests(mergedArray);
      if (!initialLoaded) {
        setLoading(false);
        initialLoaded = true;
      }
    };

    const unsubscribeRequests = subscribeToClockRequests(
      { programManagerId: user.uid },
      (data) => {
        if (!isMounted) return;
        const sorted = [...data].sort((a, b) => {
          const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
          const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
        currentRequestsData = sorted;
        processCombinedData();
      },
      (error) => {
        console.error('PM request history listener error:', error);
        if (!initialLoaded && isMounted) {
          setLoading(false);
          initialLoaded = true;
        }
      }
    );

    const unsubscribeRecords = subscribeToClockRecords(
      {},
      (records) => {
        if (!isMounted) return;
        const recordMap = {};
        records.forEach((record) => {
          recordMap[`${record.trainerId}_${record.date}`] = record;
        });
        currentRecordsData = recordMap;
        processCombinedData();
      },
      (error) => {
        console.error('Clock records listener error (PM history):', error);
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeRecords) unsubscribeRecords();
    };
  }, [user?.uid]);

  const filteredRequests = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === 'all' ? true : request.status === statusFilter;

      const trainerName = request.trainerName || '';
      const matchesSearch = term
        ? trainerName.toLowerCase().includes(term) ||
          (request.trainerEmail || '').toLowerCase().includes(term)
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, debouncedSearchTerm]);

  const groupedByTrainer = useMemo(() => {
    const grouped = {};

    filteredRequests.forEach((request) => {
      const trainerId = request.trainerId || 'unknown';
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
            rejected: 0,
            expired: 0,
            cancelled: 0
          }
        };
      }

      grouped[trainerId].requests.push(request);
      grouped[trainerId].stats.total += 1;
      if (grouped[trainerId].stats[request.status] !== undefined) {
        grouped[trainerId].stats[request.status] += 1;
      }
    });

    return Object.values(grouped).sort((a, b) =>
      a.trainerName.localeCompare(b.trainerName)
    );
  }, [filteredRequests]);

  // Calculate overall stats
  const stats = useMemo(() => {
    const total = requests.length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    return { total, approved, pending, rejected };
  }, [requests]);

  // Set command state for this page - title immediately, metrics when data loads
  useEffect(() => {
    if (setCommandState) {
      setCommandState({
        title: 'Request History',
        description: 'View historical clock-in/out requests and their approval status.',
        metrics: !loading ? [
          <div key="total" className={cn(cardStyles.surface, cardPadding)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Requests</p>
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
              <Clock className="h-8 w-8 text-amber-600" />
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
  }, [stats, loading, setCommandState, resetCommandState]);

  const toggleTrainer = useCallback((trainerId) => {
    setExpandedTrainers((prev) => ({
      ...prev,
      [trainerId]: !prev[trainerId]
    }));
  }, []);

  const toggleEntry = useCallback((entryKey) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [entryKey]: !prev[entryKey]
    }));
  }, []);

  const renderStatusBadge = (status) => {
    const Icon = statusIcons[status] || Clock;
    const styles = statusStyles[status] || statusStyles.pending;
    const label = statusLabels[status] || status;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${styles}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  };

const statsBadgeMap = {
  Total: { variant: 'neutral', icon: Users },
  Approved: { variant: 'success', icon: CheckCircle },
  Rejected: { variant: 'danger', icon: XCircle },
  Pending: { variant: 'warning', icon: Clock }
};

const renderStatsBadge = (label, value, variantOverride = null) => {
  const config = statsBadgeMap[label] || {};
  const IconComponent = config.icon;
  const variant = variantOverride || config.variant || 'neutral';

  return (
    <span className={cn(getChipClasses(variant), 'uppercase tracking-tight')}>
      {IconComponent ? <IconComponent className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{label}</span>
      <strong className="text-[13px]">{value}</strong>
    </span>
  );
};

  const renderRequestDetails = (request) => {
    const toDateSafe = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value.toDate === 'function') return value.toDate();
      const cast = new Date(value);
      return Number.isNaN(cast.getTime()) ? null : cast;
    };

    const rejectionNotes =
      request.rejectionReason || request.rejections?.[0]?.reason || null;

    const clockInTimestamp = toDateSafe(request.clockIn?.timestamp);
    const clockInLocation =
      request.clockIn?.location?.formattedAddress ||
      request.clockIn?.location?.placeName ||
      request.clockIn?.location ||
      request.location?.formattedAddress ||
      null;

    const clockOutData = request.clockOut || null;
    const clockOutTimestamp = toDateSafe(clockOutData?.timestamp);
    const clockOutLocation =
      clockOutData?.location?.formattedAddress ||
      clockOutData?.location?.placeName ||
      clockOutData?.location ||
      null;

    const requestedAtTimestamp = toDateSafe(request.requestedAt || request.clockIn?.timestamp);

    return (
      <div key={request.requestId} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Clock-In
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {clockInTimestamp ? format(clockInTimestamp, 'PPpp') : 'Clock-in pending'}
            </p>
            {clockInLocation && (
              <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                <span>{clockInLocation}</span>
              </p>
            )}
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Clock-Out
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {clockOutTimestamp ? format(clockOutTimestamp, 'PPpp') : 'Not clocked out'}
            </p>
            {clockOutLocation && (
              <p className="mt-1 flex items-start gap-2 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 text-slate-400" />
                <span>{clockOutLocation}</span>
              </p>
            )}
          </div>
        </div>

        {rejectionNotes && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:px-4">
            <span className="font-semibold text-rose-800">Rejection Notes:</span>{' '}
            <span>{rejectionNotes}</span>
          </div>
        )}

        {/* {request.approvals?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
            <span className="font-semibold text-emerald-800">Approved by:</span>
            {request.approvals.map((approval, idx) => {
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
              return (
                <span
                  key={idx}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5"
                >
                  {name} ({roleLabel})
                </span>
              );
            })}
          </div>
        )} */}
      </div>
    );
  };

  return (
    <div className={cn(sectionSpacing, panelPadding)}>
      {/* Header removed - now in command ribbon */}
      {/* Filters */}
      <div className={cn(cardStyles.surface, cardPadding, 'flex flex-col gap-4')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={cn(cardStyles.subtle, cardPadding, 'flex flex-col gap-2')}>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className={cn('flex flex-col gap-2 sm:col-span-2', cardStyles.subtle, cardPadding)}>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search by trainer
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search trainer name or email…"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton message="Loading request history…" className="h-48" />
      ) : groupedByTrainer.length === 0 ? (
        <div className={cn(cardStyles.surface, cardPadding, 'text-center text-sm text-slate-600')}>
          No requests found for the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByTrainer.map((group) => {
            const isExpanded = expandedTrainers[group.trainerId] ?? false;
            const pendingChip =
              group.stats.pending > 0
                ? renderStatsBadge('Pending', group.stats.pending, 'warning')
                : null;
            const requestsByDate = group.requests.reduce((acc, req) => {
              const baseDate =
                req.date ||
                (req.clockIn?.timestamp?.toDate
                  ? format(req.clockIn.timestamp.toDate(), 'yyyy-MM-dd')
                  : req.clockIn?.timestamp
                    ? format(new Date(req.clockIn.timestamp), 'yyyy-MM-dd')
                    : req.requestedAt?.toDate
                      ? format(req.requestedAt.toDate(), 'yyyy-MM-dd')
                      : 'unknown');
              if (!acc[baseDate]) acc[baseDate] = [];
              acc[baseDate].push(req);
              return acc;
            }, {});

            const toTime = (dateKey) => {
              const parsed = new Date(dateKey);
              return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
            };

            const dateEntries = Object.entries(requestsByDate)
              .map(([dateKey, reqs]) => {
                const sorted = [...reqs].sort((a, b) => {
                  const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
                  const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
                  return bTime - aTime;
                });
                return { dateKey, requests: sorted };
              })
              .sort((a, b) => {
                return toTime(b.dateKey) - toTime(a.dateKey);
              });

            const trainerPanelId = `trainer-panel-${group.trainerId}`;

            return (
              <div
                key={group.trainerId}
                className={cn(cardStyles.surface, 'overflow-hidden transition hover:shadow-md')}
              >
                <button
                  onClick={() => toggleTrainer(group.trainerId)}
                  aria-expanded={isExpanded}
                  aria-controls={trainerPanelId}
                  className={cn(
                    toggleButtonBase,
                    'flex-col bg-slate-50 hover:bg-slate-100 md:flex-row md:items-center md:justify-between'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {group.trainerName}
                      </p>
                      {group.trainerEmail && (
                        <p className="text-xs text-slate-500">
                          {group.trainerEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderStatsBadge('Total', group.stats.total)}
                    {renderStatsBadge('Approved', group.stats.approved)}
                    {renderStatsBadge('Rejected', group.stats.rejected)}
                    {pendingChip}
                    <span className={toggleIconChip}>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={trainerPanelId}
                    className="space-y-3 border-t border-slate-200 bg-white/80 p-4 sm:p-5"
                  >
                    {dateEntries.map((entry) => {
                      const entryKey = `${group.trainerId}_${entry.dateKey}`;
                      const entryExpanded = expandedEntries[entryKey] ?? false;
                      const firstRequest = entry.requests[0];
                      const hasValidDate = !Number.isNaN(new Date(entry.dateKey).getTime());
                      const sessionLabel = hasValidDate
                        ? format(new Date(entry.dateKey), 'PP')
                        : 'No date';
                      const toDateSafe = (value) => {
                        if (!value) return null;
                        if (value instanceof Date) return value;
                        if (typeof value.toDate === 'function') return value.toDate();
                        const cast = new Date(value);
                        return Number.isNaN(cast.getTime()) ? null : cast;
                      };
                      const requestedAtTimestamp = firstRequest?.requestedAt ? toDateSafe(firstRequest.requestedAt) : null;
                      const statusCounts = entry.requests.reduce(
                        (acc, req) => ({
                          ...acc,
                          total: acc.total + 1,
                          [req.status]: (acc[req.status] || 0) + 1
                        }),
                        { total: 0 }
                      );
                      const approverSummaries = Array.from(
                        new Set(
                          entry.requests.flatMap((req) =>
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
                        )
                      )
                        .filter(Boolean)
                        .slice(0, 3);

                      return (
                        <div
                          key={entryKey}
                          className={cn(cardStyles.surface, 'shadow-sm')}
                        >
                          <button
                            onClick={() => toggleEntry(entryKey)}
                            aria-expanded={entryExpanded}
                            aria-controls={`${entryKey}-panel`}
                            className={cn(toggleButtonBase, 'bg-slate-50 hover:bg-slate-100')}
                          >
                            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-left">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calendar className="h-4 w-4 text-slate-500" />
                                  <span className="text-sm font-semibold text-slate-900">
                                    {sessionLabel}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1 text-xs">
                                  {/* <span className="text-slate-600">
                                    <span className="font-semibold text-slate-700">Requested for:</span> {firstRequest?.date ? formatDateForDisplay(firstRequest.date, 'MMM d, yyyy') : sessionLabel}
                                  </span> */}
                                  {requestedAtTimestamp && (
                                    <span className="text-slate-600">
                                      <span className="font-semibold text-slate-700">Requested at:</span> {formatTimestamp(requestedAtTimestamp, 'MMM d, yyyy hh:mm a')}
                                    </span>
                                  )}
                                </div>
                                {approverSummaries.length > 0 && (
                                  <span className="mt-2 block text-xs text-slate-400">
                                    Approved by {approverSummaries.join(', ')}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:justify-end">
                                {renderStatsBadge('Total', statusCounts.total)}
                                {statusCounts.approved ? renderStatsBadge('Approved', statusCounts.approved) : null}
                                {statusCounts.pending ? renderStatsBadge('Pending', statusCounts.pending) : null}
                                {statusCounts.rejected ? renderStatsBadge('Rejected', statusCounts.rejected) : null}
                                <span className={toggleIconChip}>
                                  {entryExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                              </div>
                            </div>
                          </button>
                          {entryExpanded && (
                            <div
                              id={`${entryKey}-panel`}
                              className="space-y-2 border-t border-slate-200 bg-white p-4 sm:p-4"
                            >
                              {entry.requests.map(renderRequestDetails)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default RequestHistoryPage;

