import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  X, 
  BookOpen, 
  Briefcase, 
  Building2, 
  User, 
  FileText,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateForDisplay, getCurrentDateInUserTimezone, convertFromUTC } from '@/utils/timezoneUtils';
import { cardStyles, cardPadding } from '@/styles/designSystem';

const UpcomingTasksView = ({ schedules = {}, clockStatus = {}, onTaskClick, onClose }) => {
  const [expandedDates, setExpandedDates] = useState(new Set());

  // Get today's date in user timezone
  const todayStr = getCurrentDateInUserTimezone();

  // Filter and sort upcoming tasks (excluding today)
  const upcomingTasks = useMemo(() => {
    if (!schedules) return [];

    const tasks = [];
    const scheduleKeys = Object.keys(schedules);

    scheduleKeys.forEach(dateKey => {
      // Convert UTC date to user timezone for comparison
      const userTimezoneDate = convertFromUTC(dateKey);
      
      // Only include future dates (after today)
      if (userTimezoneDate > todayStr) {
        const dateTasks = schedules[dateKey] || [];
        dateTasks.forEach(task => {
          tasks.push({
            ...task,
            date: userTimezoneDate,
            dateKey: dateKey // Keep original UTC key for reference
          });
        });
      }
    });

    // Sort by date (ascending)
    return tasks.sort((a, b) => a.date.localeCompare(b.date));
  }, [schedules, todayStr]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped = {};
    upcomingTasks.forEach(task => {
      if (!grouped[task.date]) {
        grouped[task.date] = [];
      }
      grouped[task.date].push(task);
    });
    return grouped;
  }, [upcomingTasks]);

  // Auto-expand the first upcoming task date on initial load
  React.useEffect(() => {
    if (upcomingTasks.length > 0) {
      const firstDate = upcomingTasks[0].date;
      setExpandedDates(prev => {
        if (prev.size === 0) {
          return new Set([firstDate]);
        }
        return prev;
      });
    }
  }, [upcomingTasks.length]); // Only run when tasks change

  const toggleDateExpansion = (dateStr) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  if (upcomingTasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(cardStyles.surface, 'p-4 sm:p-5 text-center')}
      >
        <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1.5">No Upcoming Tasks</h3>
        <p className="text-xs sm:text-sm text-slate-600 mb-3">
          You don't have any tasks scheduled for the future.
        </p>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(cardStyles.surface, 'p-2 sm:p-3 flex flex-col h-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] w-full overflow-hidden')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 truncate">Upcoming Tasks</h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            {upcomingTasks.length} task{upcomingTasks.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1.5 sm:p-2 h-auto"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* List View */}
      <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2 min-h-0 w-full">
          {Object.entries(tasksByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateStr, tasks]) => {
              const isExpanded = expandedDates.has(dateStr);
              const date = new Date(dateStr + 'T00:00:00');
              
              return (
                <motion.div
                  key={dateStr}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* Date Header - Clickable */}
                  <button
                    onClick={() => toggleDateExpansion(dateStr)}
                    className="w-full flex items-center justify-between p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors touch-manipulation"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDateForDisplay(dateStr, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {/* Tasks List - Expandable */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-1.5 bg-white">
                          {tasks.map((task, idx) => (
                            <div
                              key={idx}
                              className="p-1.5 sm:p-2 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              {/* Task Type Badge */}
                              <div className="flex items-center gap-2 mb-2">
                                {task.type === 'training' ? (
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

                              {/* Task Details */}
                              {task.type === 'training' ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 min-w-[45px]">Course:</span>
                                    <span className="text-sm font-medium text-slate-700 flex-1">{task.course}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 min-w-[45px]">Client:</span>
                                    <span className="text-sm text-slate-600 flex-1 truncate">{task.client}</span>
                                  </div>
                                  {task.role && (
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500 min-w-[45px]">Role:</span>
                                      <span className="text-sm text-slate-600 flex-1">{task.role}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 min-w-[45px]">Task:</span>
                                    <span className="text-sm font-medium text-slate-700 flex-1">{task.taskDetails}</span>
                                  </div>
                                  {task.taskType && (
                                    <div className="flex items-center gap-2">
                                      <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500 min-w-[45px]">Type:</span>
                                      <span className="text-sm text-slate-600 flex-1">{task.taskType}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {task.description && (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <p className="text-xs text-slate-500 mb-1">Description:</p>
                                  <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
        </div>
    </motion.div>
  );
};

export default UpcomingTasksView;

