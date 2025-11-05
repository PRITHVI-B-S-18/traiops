import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper to parse YYYY-MM-DD as local date
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const DateRangeSelector = ({ onDateRangeChange, initialStartDate, initialEndDate }) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [excludedDates, setExcludedDates] = useState(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Generate array of dates between start and end date
  const getDatesInRange = (start, end) => {
    const dates = [];
    let currentDate = parseLocalDate(start);
    const endDate = parseLocalDate(end);
    while (currentDate <= endDate) {
      // Format as YYYY-MM-DD
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      dates.push(parseLocalDate(dateStr));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  // Get days in month
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  
  // Get first day of month
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  // Handle date range change
  useEffect(() => {
    if (startDate && endDate) {
      const dates = getDatesInRange(startDate, endDate);
      const dateStrings = dates.map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
      onDateRangeChange({
        startDate,
        endDate,
        excludedDates: Array.from(excludedDates)
      });
    }
  }, [startDate, endDate, excludedDates]);

  // Update dates when initial dates change
  useEffect(() => {
    if (initialStartDate && initialStartDate !== startDate) {
      setStartDate(initialStartDate);
    }
    if (initialEndDate && initialEndDate !== endDate) {
      setEndDate(initialEndDate);
    }
  }, [initialStartDate, initialEndDate]);

  // Toggle date exclusion
  const toggleDateExclusion = (date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setExcludedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  // Render calendar
  const renderCalendar = () => {
    const totalDays = daysInMonth(currentYear, currentMonth);
    const firstDay = firstDayOfMonth(currentYear, currentMonth);
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const blanks = Array(firstDay).fill(null);
    const allCells = [...blanks, ...daysArray];

    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-[260px]">
        <div className="flex justify-between items-center mb-3">
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-gray-600 text-sm">←</span>
          </button>
          <span className="font-semibold text-gray-900 text-xs">
            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-gray-600 text-sm">→</span>
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-100 border-2 border-blue-500"></div>
            <span className="text-gray-600 text-xs">Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-100 border-2 border-red-500"></div>
            <span className="text-gray-600 text-xs">Excluded</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div key={`day-header-${index}`} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
          {allCells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="h-6" />;
            }
            const date = new Date(currentYear, currentMonth, day);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const isInRange = startDate && endDate && parseLocalDate(dateStr) >= parseLocalDate(startDate) && parseLocalDate(dateStr) <= parseLocalDate(endDate);
            const isExcluded = excludedDates.has(dateStr);
            const isSunday = date.getDay() === 0;

            return (
              <div
                key={idx}
                className={`h-6 flex items-center justify-center rounded cursor-pointer text-xs font-medium transition-all duration-200
                  ${isInRange ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'hover:bg-gray-100 text-gray-700'}
                  ${isExcluded ? 'bg-red-100 text-red-700 border border-red-300' : ''}
                  ${isSunday ? 'text-red-500' : ''}
                  ${!isInRange ? 'opacity-50' : ''}
                `}
                onClick={() => isInRange && toggleDateExclusion(date)}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
          />
        </div>
      </div>
      
      {startDate && endDate && (
        <div className="flex gap-3">
          {/* Left side: Button and excluded dates */}
          <div className="flex-1 space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCalendar(!showCalendar)}
              className="w-full justify-start px-3 py-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm"
          >
              <Calendar className="mr-2 h-3 w-3 text-gray-500" />
              <span className="text-sm text-gray-700">Select Dates to Exclude</span>
              {excludedDates.size > 0 && (
                <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded-full">
                  {excludedDates.size} excluded
                </span>
              )}
          </Button>

      {excludedDates.size > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700">Excluded Dates:</p>
                <div className="flex flex-wrap gap-1">
            {Array.from(excludedDates).map(date => (
              <span
                key={date}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
              >
                {(() => { const d = parseLocalDate(date); return d.toLocaleDateString(); })()}
                <button
                        type="button"
                  onClick={() => toggleDateExclusion(parseLocalDate(date))}
                        className="ml-1 text-red-500 hover:text-red-700 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
              </div>
            )}
          </div>
          
          {/* Right side: Calendar */}
          {showCalendar && (
            <div className="flex-shrink-0">
              {renderCalendar()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector; 