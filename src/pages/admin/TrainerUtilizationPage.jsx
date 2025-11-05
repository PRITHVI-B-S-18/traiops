import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronUp
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { loadScheduleData, subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { loadTrainerData } from '../../utils/firestoreTrainers';
import * as XLSX from 'xlsx';

const TrainerUtilizationPage = () => {
  const { toast } = useToast();
  const [scheduleData, setScheduleData] = useState({});
  const [trainerList, setTrainerList] = useState([]);
  const [timePeriod, setTimePeriod] = useState('currentMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTrainers, setSelectedTrainers] = useState([]);
  const [sortBy, setSortBy] = useState('utilization'); // utilization, name, trainingDays
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showFilters, setShowFilters] = useState(false);

  // Load schedule and trainer data
  useEffect(() => {
    const unsubscribe = subscribeToScheduleUpdates((data) => {
      setScheduleData(data || {});
    });

    async function fetchTrainers() {
      const data = await loadTrainerData();
      setTrainerList(data || []);
    }
    fetchTrainers();

    return () => unsubscribe();
  }, []);

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
        
        return {
          name: trainer.name,
          id: trainer.id,
          specialization: trainer.specialization,
          status: trainer.status,
          trainingDays,
          workingDays,
          utilization: Math.round(utilization * 100) / 100, // Round to 2 decimal places
          efficiency: utilization >= 80 ? 'High' : utilization >= 60 ? 'Medium' : 'Low'
        };
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
  }, [scheduleData, activeTrainers, getDateRange, selectedTrainers, sortBy, sortOrder]);

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
    const periodText = timePeriod === 'custom' 
      ? `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`
      : timePeriod === 'currentWeek' ? 'Current Week'
      : timePeriod === 'currentMonth' ? 'Current Month'
      : 'All Time';

    const exportData = utilizationData.map(trainer => ({
      'Employee ID': trainer.id,
      'Trainer Name': trainer.name,
      'Specialization': trainer.specialization,
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

  return (
    <div className="p-6 bg-muted/5 rounded-lg min-h-full">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-border/50 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Trainer Utilization</h2>
              <p className="text-xs text-gray-500">Track trainer efficiency and resource utilization</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm" className="flex items-center gap-2">
              <Filter className="w-3 h-3" />
              Filters
            </Button>
            <Button onClick={handleExport} size="sm" className="flex items-center gap-2">
              <Download className="w-3 h-3" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
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
            </div>

            {/* Trainer Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Filter by Trainers</label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {activeTrainers.map(trainer => (
                  <label key={trainer.id} className="flex items-center space-x-2 text-xs">
                    <input 
                      type="checkbox" 
                      checked={selectedTrainers.length === 0 || selectedTrainers.includes(trainer.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTrainers(prev => 
                            prev.length === 0 ? [] : prev.filter(t => t !== trainer.name)
                          );
                        } else {
                          setSelectedTrainers(prev => [...prev, trainer.name]);
                        }
                      }}
                    />
                    <span className="truncate">{trainer.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-border/50 p-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Avg Utilization</p>
                <p className="text-lg font-semibold text-gray-900">{summaryStats.averageUtilization}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-border/50 p-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-3 h-3 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Active Trainers</p>
                <p className="text-lg font-semibold text-gray-900">{summaryStats.totalTrainers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-border/50 p-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Target className="w-3 h-3 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">High Efficiency</p>
                <p className="text-lg font-semibold text-gray-900">{summaryStats.highEfficiency}</p>
              </div>
            </div>
          </div>
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
                  <span className="text-gray-500">Specialization:</span>
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