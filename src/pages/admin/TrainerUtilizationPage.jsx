import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Filter, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { loadScheduleData, subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { loadTrainerData } from '../../utils/firestoreTrainers';
import { formatDateForDisplay } from '@/utils/timezoneUtils';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';

const TrainerUtilizationPage = () => {
  const { setCommandState } = useOutletContext();
  const { toast } = useToast();
  const [scheduleData, setScheduleData] = useState({});
  const [trainerList, setTrainerList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('currentMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTrainers, setSelectedTrainers] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [sortBy, setSortBy] = useState('utilization'); // utilization, name, trainingDays
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showFilters, setShowFilters] = useState(false);

  // Load schedule and trainer data
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToScheduleUpdates((data) => {
      setScheduleData(data || {});
    });

    async function fetchTrainers() {
      try {
      const data = await loadTrainerData();
      setTrainerList(data || []);
      } catch (error) {
        console.error('Error loading trainers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load trainers. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    }
    fetchTrainers();

    return () => unsubscribe();
  }, [toast]);

  // Filter active trainers only
  const activeTrainers = useMemo(() => {
    return trainerList.filter(trainer => trainer.status !== 'Inactive');
  }, [trainerList]);

  // Calculate date range based on selected time period
  const getDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (timePeriod) {
      case 'currentWeek':
        // Start of current week (Monday)
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start.setDate(now.getDate() - daysToMonday);
        start.setHours(0, 0, 0, 0);
        // End of current week (Sunday)
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'currentMonth':
        // Start of current month
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        // End of current month
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      
      case 'custom':
        if (customStartDate && customEndDate) {
          start.setTime(new Date(customStartDate).getTime());
          end.setTime(new Date(customEndDate).getTime());
          end.setHours(23, 59, 59, 999);
        }
        break;
      
      case 'allTime':
        start.setFullYear(2020, 0, 1); // Start from 2020
        start.setHours(0, 0, 0, 0);
        end.setTime(now.getTime());
        break;
      
      default:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [timePeriod, customStartDate, customEndDate]);

  // Calculate working days (Monday to Saturday)
  const calculateWorkingDays = (startDate, endDate) => {
    let workingDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0) { // Not Sunday
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  };

  // Calculate training days for a trainer
  const calculateTrainingDays = (trainerName, startDate, endDate) => {
    let trainingDays = 0;
    const trainingDates = new Set();

    Object.entries(scheduleData).forEach(([date, entries]) => {
      const currentDate = new Date(date);
      if (currentDate >= startDate && currentDate <= endDate) {
        entries.forEach(entry => {
          if (entry.trainer === trainerName && entry.type === 'training') {
            trainingDates.add(date);
          }
        });
      }
    });

    return trainingDates.size;
  };

  const trainerClientStats = useMemo(() => {
    const { start, end } = getDateRange;
    const stats = new Map();

    Object.entries(scheduleData).forEach(([date, entries]) => {
      const currentDate = new Date(date);
      if (currentDate < start || currentDate > end) return;
      entries.forEach(entry => {
        if (entry.type !== 'training') return;
        if (!entry.client || entry.client === 'Not Alloted') return;
        const trainerName = entry.trainer;
        if (!trainerName) return;
        if (!stats.has(trainerName)) stats.set(trainerName, {});
        const trainerMap = stats.get(trainerName);
        trainerMap[entry.client] = (trainerMap[entry.client] || 0) + 1;
      });
    });

    return stats;
  }, [scheduleData, getDateRange]);

  const uniqueClients = useMemo(() => {
    const set = new Set();
    trainerClientStats.forEach((clientMap) => {
      Object.keys(clientMap || {}).forEach(client => set.add(client));
    });
    return Array.from(set).sort();
  }, [trainerClientStats]);

  // Calculate utilization for all trainers
  const utilizationData = useMemo(() => {
    const { start, end } = getDateRange;
    const workingDays = calculateWorkingDays(start, end);
    
    return activeTrainers
      .filter(trainer => {
        if (selectedTrainers.length === 0) return true;
        return selectedTrainers.includes(trainer.name);
      })
      .map(trainer => {
        const trainingDays = calculateTrainingDays(trainer.name, start, end);
        const utilization = workingDays > 0 ? (trainingDays / workingDays) * 100 : 0;
        const clientMap = trainerClientStats.get(trainer.name) || {};
        const clients = Object.entries(clientMap)
          .sort((a, b) => b[1] - a[1])
          .map(([client]) => client);
        
        return {
          name: trainer.name,
          id: trainer.id,
          specialization: trainer.specialization,
          clients,
          status: trainer.status,
          trainingDays,
          workingDays,
          utilization: Math.round(utilization * 100) / 100, // Round to 2 decimal places
          efficiency: utilization >= 80 ? 'High' : utilization >= 60 ? 'Medium' : 'Low'
        };
      })
      .filter(trainer => {
        if (selectedClients.length === 0) return true;
        return trainer.clients.some(client => selectedClients.includes(client));
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'utilization':
            comparison = b.utilization - a.utilization;
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'trainingDays':
            comparison = b.trainingDays - a.trainingDays;
            break;
          default:
            comparison = b.utilization - a.utilization;
        }
        return sortOrder === 'asc' ? -comparison : comparison;
      });
  }, [scheduleData, activeTrainers, getDateRange, selectedTrainers, selectedClients, sortBy, sortOrder, trainerClientStats]);

  const isFilterActive = useMemo(() => {
    const dateActive = timePeriod !== 'currentMonth' || (timePeriod === 'custom' && (customStartDate || customEndDate));
    const trainerActive = selectedTrainers.length > 0;
    const clientActive = selectedClients.length > 0;
    return dateActive || trainerActive || clientActive || sortBy !== 'utilization' || sortOrder !== 'desc';
  }, [timePeriod, customStartDate, customEndDate, selectedTrainers, selectedClients, sortBy, sortOrder]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (utilizationData.length === 0) return null;

    const totalUtilization = utilizationData.reduce((sum, trainer) => sum + trainer.utilization, 0);
    const averageUtilization = totalUtilization / utilizationData.length;
    const totalTrainingDays = utilizationData.reduce((sum, trainer) => sum + trainer.trainingDays, 0);
    const totalWorkingDays = utilizationData[0]?.workingDays || 0;

    return {
      averageUtilization: Math.round(averageUtilization * 100) / 100,
      totalTrainingDays,
      totalWorkingDays,
      totalTrainers: utilizationData.length,
      highEfficiency: utilizationData.filter(t => t.efficiency === 'High').length,
      mediumEfficiency: utilizationData.filter(t => t.efficiency === 'Medium').length,
      lowEfficiency: utilizationData.filter(t => t.efficiency === 'Low').length
    };
  }, [utilizationData]);

  // Export utilization data
  const handleExport = () => {
    const { start, end } = getDateRange;
    // Format dates using timezone-aware formatting
    const formatDate = (date) => {
      const dateStr = date.toISOString().split('T')[0];
      return formatDateForDisplay(dateStr, 'MMM d, yyyy');
    };
    const periodText = timePeriod === 'custom' 
      ? `${formatDate(start)} to ${formatDate(end)}`
      : timePeriod === 'currentWeek' ? 'Current Week'
      : timePeriod === 'currentMonth' ? 'Current Month'
      : 'All Time';

    const exportData = utilizationData.map(trainer => ({
      'Employee ID': trainer.id,
      'Trainer Name': trainer.name,
      'Tech Stack': trainer.specialization,
      'Clients': trainer.clients.length ? trainer.clients.join(', ') : '—',
      'Status': trainer.status,
      'Training Days': trainer.trainingDays,
      'Working Days': trainer.workingDays,
      'Utilization %': trainer.utilization,
      'Efficiency Level': trainer.efficiency,
      'Period': periodText
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TrainerUtilization');
    XLSX.writeFile(workbook, `TrainerUtilization_${periodText.replace(/\s+/g, '_')}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `Utilization report exported for ${utilizationData.length} trainers.`,
    });
  };

  // Set up command ribbon
  useEffect(() => {
    const stats = summaryStats || {
      averageUtilization: 0,
      totalTrainers: 0,
      highEfficiency: 0,
      mediumEfficiency: 0,
      lowEfficiency: 0
    };

    setCommandState({
      title: 'Trainer Utilization',
      description: 'Track trainer efficiency and resource utilization across different time periods.',
      actions: (
        <>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className={cn(
              "flex items-center gap-2 whitespace-nowrap",
              showFilters && "border-blue-500 bg-blue-50 text-blue-700"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button onClick={handleExport} size="sm" className="flex items-center gap-2 whitespace-nowrap">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </>
      ),
      metrics: [
        <div key="avg" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Avg Utilization</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.averageUtilization}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="total" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Trainers</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalTrainers}</p>
            </div>
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
        </div>,
        <div key="high" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">High Efficiency</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.highEfficiency}</p>
            </div>
            <Target className="h-8 w-8 text-emerald-600" />
          </div>
        </div>,
        <div key="low" className={cn(cardStyles.surface, cardPadding)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Low Efficiency</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{stats.lowEfficiency}</p>
            </div>
            <Clock className="h-8 w-8 text-rose-600" />
          </div>
        </div>,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryStats, setCommandState]);

  const getEfficiencyColor = (efficiency) => {
    switch (efficiency) {
      case 'High': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUtilizationColor = (utilization) => {
    if (utilization >= 80) return 'text-green-600';
    if (utilization >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return <LoadingSkeleton message="Loading utilization data..." />;
  }

  return (
    <div className="space-y-6">

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Filters</h4>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-gray-500">Click the Filters button again to close filters.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Time Period */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time Period</label>
                <select 
                  value={timePeriod} 
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="currentWeek">Current Week</option>
                  <option value="currentMonth">Current Month</option>
                  <option value="custom">Custom Range</option>
                  <option value="allTime">All Time</option>
                </select>
              </div>

              {/* Custom Date Range */}
              {timePeriod === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Sort Options */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="utilization">Utilization %</option>
                  <option value="name">Name</option>
                  <option value="trainingDays">Training Days</option>
                </select>
              </div>

              {/* Client Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Filter by Clients</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {uniqueClients.map(client => (
                    <label key={client} className="flex items-center space-x-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClients(prev =>
                              prev.includes(client) ? prev : [...prev, client]
                            );
                          } else {
                            setSelectedClients(prev => prev.filter(c => c !== client));
                          }
                        }}
                      />
                      <span className="truncate">{client}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">No client selected = all clients.</p>
                {uniqueClients.length === 0 && (
                  <p className="text-xs text-gray-500">No clients in the selected period.</p>
                )}
              </div>
            </div>

            {/* Trainer Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Filter by Trainers</label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {activeTrainers.map(trainer => (
                  <label key={trainer.id} className="flex items-center space-x-2 text-xs">
                    <input 
                      type="checkbox" 
                      checked={selectedTrainers.includes(trainer.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTrainers(prev => 
                            prev.includes(trainer.name) ? prev : [...prev, trainer.name]
                          );
                        } else {
                          setSelectedTrainers(prev => prev.filter(t => t !== trainer.name));
                        }
                      }}
                    />
                    <span className="truncate">{trainer.name}</span>
                  </label>
                ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">No trainer selected = all trainers.</p>
          </div>

          {isFilterActive && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setTimePeriod('currentMonth');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSelectedTrainers([]);
                  setSelectedClients([]);
                  setSortBy('utilization');
                  setSortOrder('desc');
                }}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Utilization Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {utilizationData.map((trainer, index) => (
          <div key={trainer.id} className="bg-white rounded-lg shadow-sm border border-border/50 overflow-hidden hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Users className="w-3 h-3 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{trainer.name}</h3>
                    <p className="text-xs text-gray-500">ID: {trainer.id}</p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getEfficiencyColor(trainer.efficiency)}`}>
                  {trainer.efficiency}
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3 space-y-3">
              {/* Utilization Percentage */}
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500 mb-1">Utilization Rate</p>
                <p className={`text-2xl font-bold ${getUtilizationColor(trainer.utilization)}`}>
                  {trainer.utilization}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500">Clients</p>
                <p className="text-xs font-semibold text-gray-900">
                  {trainer.clients.length ? trainer.clients.join(', ') : '—'}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500">Training Days</p>
                  <p className="text-lg font-semibold text-gray-900">{trainer.trainingDays}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500">Working Days</p>
                  <p className="text-lg font-semibold text-gray-900">{trainer.workingDays}</p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Tech Stack:</span>
                  <span className="text-gray-900 truncate ml-2">{trainer.specialization}</span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-gray-500">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    trainer.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {trainer.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Data Message */}
      {utilizationData.length === 0 && (
        <div className="text-center py-8">
          <BarChart3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No Utilization Data</h3>
          <p className="text-xs text-gray-500">No trainer utilization data found for the selected criteria.</p>
        </div>
      )}
    </div>
  );
};

export default TrainerUtilizationPage; 