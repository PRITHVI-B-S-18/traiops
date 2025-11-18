import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Briefcase,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding, getChipClasses } from '@/styles/designSystem';
import { getCurrentDateInUserTimezone, convertFromUTC } from '@/utils/timezoneUtils';

const TrainerCalendar = ({ schedules, clockStatus = {}, onDateClick, onTaskClick, selectedDate: externalSelectedDate, onSelectionChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState(null);
  const calendarRef = useRef(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  
  // Update ref when prop changes
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  
  // Use external selectedDate if provided, otherwise use internal state
  const selectedDate = externalSelectedDate !== undefined ? externalSelectedDate : internalSelectedDate;
  const setSelectedDate = (date) => {
    if (externalSelectedDate !== undefined) {
      // Controlled component - notify parent
      if (onSelectionChangeRef.current) {
        onSelectionChangeRef.current(date);
      }
    } else {
      // Uncontrolled component - use internal state
      setInternalSelectedDate(date);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const formatDate = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle click outside to deselect
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        if (externalSelectedDate !== undefined) {
          // Controlled component - notify parent
          if (onSelectionChangeRef.current) {
            onSelectionChangeRef.current(null);
          }
        } else {
          // Uncontrolled component - use internal state
          setInternalSelectedDate(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [externalSelectedDate]);

  const handleDateClick = (date, tasks) => {
    // Always select the date (no toggle)
    setSelectedDate(date);
    if (onDateClick) {
      onDateClick(date, tasks);
    }
  };

  // Memoize calendar days to ensure re-render when schedules change
  const calendarDays = useMemo(() => {
    if (!schedules) return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const days = [];

    // Pre-compute a map of user timezone dates to UTC schedule keys (optimization)
    // This avoids calling convertFromUTC repeatedly in the loop
    const scheduleKeys = Object.keys(schedules || {});
    const userTimezoneToUtcMap = new Map();
    scheduleKeys.forEach(utcKey => {
      const userTimezoneDate = convertFromUTC(utcKey);
      if (!userTimezoneToUtcMap.has(userTimezoneDate)) {
        userTimezoneToUtcMap.set(userTimezoneDate, []);
      }
      userTimezoneToUtcMap.get(userTimezoneDate).push(utcKey);
    });

    // Days of the month
    const todayInUserTimezone = getCurrentDateInUserTimezone();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day);
      const isFirstDay = day === 1;
      // Use pre-computed map for fast lookup
      const matchingUtcKeys = userTimezoneToUtcMap.get(dateStr) || [];
      // Get tasks from all matching UTC keys (in case of duplicates)
      const tasks = matchingUtcKeys.flatMap(utcKey => schedules[utcKey] || []);
      const hasTask = tasks.length > 0;
      const isToday = dateStr === todayInUserTimezone;
      const isSelected = dateStr === selectedDate;

      const trainingTasks = tasks.filter(t => t.client && t.course);
      const nonTrainingTasks = tasks.filter(t => t.taskType && t.taskDetails);

      // Get clock status for this date
      const dateClockStatus = clockStatus[dateStr] || {};
      const clockInStatus = dateClockStatus.clockInStatus; // 'pending', 'approved', 'rejected', or null
      const clockOutStatus = dateClockStatus.clockOutStatus; // 'completed' or null
      const isNonTraining = dateClockStatus.isNonTraining || false;

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(dateStr, tasks)}
          disabled={!hasTask}
          style={isFirstDay ? { gridColumnStart: firstDay + 1 } : undefined}
          className={cn(
            'aspect-square p-1 sm:p-1.5 border border-slate-200 rounded transition-all touch-manipulation w-full h-full flex flex-col relative',
            hasTask 
              ? 'cursor-pointer active:bg-blue-50 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm' 
              : 'cursor-default bg-slate-50',
            isSelected ? 'ring-2 ring-slate-400 shadow-md' : '',
            isToday && 'bg-blue-100 border-blue-300'
          )}
        >
          <div className="flex items-center justify-start mb-0.5 flex-shrink-0">
            <span
              className={cn(
                'text-xs sm:text-sm font-semibold',
                isToday ? 'text-blue-600' : 'text-slate-700'
              )}
            >
              {day}
            </span>
          </div>

          {/* Clock Status Indicators - Centered in cell */}
          {(clockInStatus || clockOutStatus) && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5 z-10">
              {clockInStatus && (
                <>
                  {clockInStatus === 'approved' && (
                    <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center" title="Clock-In Approved">
                      <CheckCircle className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                  {clockInStatus === 'pending' && (
                    <div className="w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center" title="Clock-In Pending">
                      <Clock className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                  {clockInStatus === 'rejected' && (
                    <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center" title="Clock-In Rejected">
                      <XCircle className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                </>
              )}
              {clockOutStatus === 'completed' && (
                <div className="w-3 h-3 bg-green-600 rounded-full flex items-center justify-center" title="Clock-Out Completed">
                  <CheckCircle className="w-1.5 h-1.5 text-white" />
                </div>
              )}
            </div>
          )}

          {/* Task indicators - Compact badges */}
          {hasTask && (
            <div className="flex-1 flex flex-col gap-0.5 justify-end min-h-0 mt-auto">
              {trainingTasks.length > 0 && (
                <div className="bg-green-100 border border-green-300 text-green-700 text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate">
                  {trainingTasks.length}T
                </div>
              )}
              {nonTrainingTasks.length > 0 && (
                <div className="bg-orange-100 border border-orange-300 text-orange-700 text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate">
                  {nonTrainingTasks.length}N
                </div>
              )}
            </div>
          )}
        </button>
      );
    }

    return days;
  }, [schedules, clockStatus, currentDate, selectedDate, onDateClick]);

  return (
    <div ref={calendarRef} className={cn(cardStyles.surface, 'overflow-hidden')}>
      {/* Legend/Indicators - Top - Icons Only with Tooltips */}
      <div className="border-b border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-emerald-300 border-2 border-emerald-400 flex items-center justify-center cursor-help">
              <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Training Session
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-amber-300 border-2 border-amber-400 flex items-center justify-center cursor-help">
              <Briefcase className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Non-Training Task
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-200 border-2 border-blue-300 flex items-center justify-center cursor-help">
              <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Today
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center cursor-help">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Approved / Completed
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center cursor-help">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Pending
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
          <div className="group relative">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center cursor-help">
              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-700" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              Rejected
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 flex-shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              onClick={goToToday}
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-xs h-7 sm:h-8 px-1.5 sm:px-2"
            >
              Today
            </Button>
            <Button
              onClick={previousMonth}
              variant="outline"
              size="sm"
              className="p-1 h-7 sm:h-8"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              onClick={nextMonth}
              variant="outline"
              size="sm"
              className="p-1 h-7 sm:h-8"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2 w-full">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] sm:text-xs font-semibold text-slate-500 py-1 sm:py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 w-full px-3 sm:px-4 pb-3 sm:pb-4">
        {calendarDays}
      </div>

    </div>
  );
};

export default TrainerCalendar;

