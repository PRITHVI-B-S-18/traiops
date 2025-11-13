import React, { useState, useMemo } from 'react';
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

const TrainerCalendar = ({ schedules, clockStatus = {}, onDateClick, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

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

  const handleDateClick = (date, tasks) => {
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

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 md:h-32 border border-[#E0E0E0] bg-[#FAFAFA]"></div>
      );
    }

    // Days of the month
    const todayInUserTimezone = getCurrentDateInUserTimezone();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(year, month, day);
      // Convert schedule dates from UTC to user timezone for comparison
      // Schedules are stored in UTC, so we need to check if this date (in user timezone) matches any UTC date
      const scheduleKeys = Object.keys(schedules || {});
      const matchingScheduleKey = scheduleKeys.find(key => {
        // Convert UTC schedule key to user timezone for comparison
        const userTimezoneDate = convertFromUTC(key);
        return userTimezoneDate === dateStr;
      });
      const tasks = matchingScheduleKey ? schedules[matchingScheduleKey] : [];
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
        <div
          key={day}
          onClick={() => hasTask && handleDateClick(dateStr, tasks)}
          className={cn(
            'min-h-[5.5rem] border border-slate-200 bg-white p-2 transition-all duration-200 sm:min-h-[7.5rem]',
            hasTask ? 'cursor-pointer hover:z-10 hover:shadow-md' : 'cursor-default',
            isSelected ? 'ring-2 ring-slate-400 shadow-md' : '',
            isToday ? 'bg-blue-50' : ''
          )}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-sm font-semibold ${
                  isToday ? 'text-blue-600' : 'text-[#2C2C2C]'
                }`}
              >
                {day}
              </span>
              <div className="flex items-center gap-1">
                {/* Clock Status Indicators */}
                {clockInStatus && (
                  <div className="flex items-center gap-0.5">
                    {clockInStatus === 'approved' && (
                      <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" title="Clock-In Approved">
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    {clockInStatus === 'pending' && (
                      <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center" title="Clock-In Pending">
                        <Clock className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    {clockInStatus === 'rejected' && (
                      <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center" title="Clock-In Rejected">
                        <XCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                )}
                {clockOutStatus === 'completed' && (
                  <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center" title="Clock-Out Completed">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                {isToday && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>
            </div>

            {/* Task indicators */}
            {hasTask && (
              <div className="flex-1 space-y-1 overflow-hidden">
                {trainingTasks.length > 0 && (
                  <div className="bg-green-100 border border-green-300 text-green-800 text-[10px] md:text-xs px-1.5 py-1 rounded truncate">
                    <BookOpen className="w-3 h-3 inline mr-1" />
                    {trainingTasks.length} Training
                  </div>
                )}
                {nonTrainingTasks.length > 0 && (
                  <div className="bg-orange-100 border border-orange-300 text-orange-800 text-[10px] md:text-xs px-1.5 py-1 rounded truncate">
                    <Briefcase className="w-3 h-3 inline mr-1" />
                    {nonTrainingTasks.length} Task{nonTrainingTasks.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  }, [schedules, clockStatus, currentDate, selectedDate, onDateClick]);

  return (
    <div className={cn(cardStyles.surface, 'overflow-hidden')}>
      {/* Legend/Indicators - Top */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className={cn(getChipClasses('success'), 'gap-2')}>
            <span className="h-3 w-3 rounded bg-emerald-300" aria-hidden="true" />
            Training Session
          </span>
          <span className={cn(getChipClasses('warning'), 'gap-2')}>
            <span className="h-3 w-3 rounded bg-amber-300" aria-hidden="true" />
            Non-Training Task
          </span>
          <span className={cn(getChipClasses('info'), 'gap-2')}>
            <span className="h-3 w-3 rounded bg-blue-200" aria-hidden="true" />
            Today
          </span>
          <span className={cn(getChipClasses('success'), 'gap-2')}>
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Approved / Completed
          </span>
          <span className={cn(getChipClasses('warning'), 'gap-2')}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Pending
          </span>
          <span className={cn(getChipClasses('danger'), 'gap-2')}>
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Rejected
          </span>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(getChipClasses('muted'), 'text-xs')}>
              <CalendarIcon className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={goToToday}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              Today
            </Button>
            <Button
              onClick={previousMonth}
              variant="outline"
              size="sm"
              className="p-2"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={nextMonth}
              variant="outline"
              size="sm"
              className="p-2"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 bg-slate-50">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="border-b border-slate-200 p-2 text-center text-xs font-semibold text-slate-500 sm:text-sm"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="grid w-full grid-cols-7 sm:min-w-[560px]">
        {calendarDays}
        </div>
      </div>

    </div>
  );
};

export default TrainerCalendar;

