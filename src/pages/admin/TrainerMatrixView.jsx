import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Search, X as CloseIcon, Trash2, CheckSquare, Square, Calendar, User, AlertTriangle, Edit3, PlusCircle, ChevronDown } from 'lucide-react';
import { saveScheduleData } from '../../utils/firestoreSchedule';
import { motion, AnimatePresence } from 'framer-motion';
import { cancelPendingRequestsForTask } from '../../utils/firestoreClockRequests';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { holidays } from '../../data/holidays';
import { getCurrentDateInUserTimezone } from '../../utils/timezoneUtils';

// Color mapping for statuses with darker, more professional colors
const STATUS_COLORS = {
  training: 'bg-blue-700 text-white',
  nonTraining: 'bg-orange-500 text-white',
  leave: 'bg-red-600 text-white',
  none: 'bg-green-700 text-white',
  holiday: 'bg-slate-500 text-white',
};

const STATUS_LABELS = {
  training: 'Training Allocated',
  nonTraining: 'Non-Training Task',
  leave: 'Leave',
  none: 'Available',
  holiday: 'Holiday',
};

function pad2(n) {
  return n.toString().padStart(2, '0');
}

/** Sunday (getDay() === 0) or a named holiday from data */
function isHolidayDay(year, month, day) {
  const date = new Date(year, month, day);
  if (date.getDay() === 0) return true; // Sunday
  const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
  return !!holidays[dateStr];
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed
}

function getEntriesForDay(trainer, day, flattenedScheduleData, currentYear, currentMonth, matrixFilters) {
  const dateStr = `${currentYear}-${pad2(currentMonth + 1)}-${pad2(day)}`;
  const currentDate = parseLocalDate(dateStr);

  const allEntries = flattenedScheduleData;

  return allEntries.filter(entry => {
    // 1. Trainer Name Match
    if (entry.trainer !== trainer.name) return false;

    // 2. Entry's own Date Range Check
    const entryStartDate = parseLocalDate(entry.startDate);
    const entryEndDate = parseLocalDate(entry.endDate);
    if (!(currentDate >= entryStartDate && currentDate <= entryEndDate)) return false;

    // 3. Skip "Not Alloted" entries
    if (entry.client === 'Not Alloted' || entry.course === 'Not Alloted' || entry.role === 'Not Alloted') {
      return false;
    }

    // Apply matrix filters
    // 4. Client Filter
    if (matrixFilters.client.length > 0) {
      if (!entry.client || !matrixFilters.client.includes(entry.client)) {
      return false;
      }
    }

    // 5. Course Filter
    if (matrixFilters.course.length > 0) {
      if (!entry.course || !matrixFilters.course.includes(entry.course)) {
      return false;
      }
    }

    // 6. Type Filter (training/non-training/leave/available)
    if (matrixFilters.type === 'training' && entry.type !== 'training') {
      return false;
    }
    if (matrixFilters.type === 'non-training' && entry.type !== 'non-training') {
      return false;
    }
    if (matrixFilters.type === 'leave' && entry.type !== 'leave') {
      return false;
    }
    if (matrixFilters.type === 'available') {
      // For available type, we don't want to show any entries (trainers should be available)
      return false;
    }

    // 7. Role Filter (TA/Trainer) - for training entries that have a role
    if (matrixFilters.role !== 'all' && entry.type === 'training') {
      // The entry must have the specified role to be included
      if (!entry.role || entry.role !== matrixFilters.role) {
        return false;
      }
    }

    // 8. Non-Training Task Type Filter - for non-training entries
    if (matrixFilters.nonTrainingTaskTypes && matrixFilters.nonTrainingTaskTypes.length > 0 && entry.type === 'non-training') {
      if (!entry.taskType || !matrixFilters.nonTrainingTaskTypes.includes(entry.taskType)) {
        return false;
      }
    }

    // 9. Date range from matrixFilters (overall view filter)
    if (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') {
      const filterStartDate = parseLocalDate(matrixFilters.startDate);
      if (currentDate < filterStartDate) return false;
    }
    if (matrixFilters.endDate && matrixFilters.endDate.trim() !== '') {
      const filterEndDate = parseLocalDate(matrixFilters.endDate);
      if (currentDate > filterEndDate) return false;
    }

    return true;
  });
}

function getStatusForEntries(entries) {
  if (entries.length === 0) return 'none';
  if (entries.some(e => e.type === 'training' && e.client !== 'Not Alloted')) return 'training';
  if (entries.some(e => e.type === 'non-training' && e.taskDetails && e.taskDetails !== 'Not Alloted')) return 'nonTraining';
  if (entries.some(e => e.type === 'leave')) return 'leave';
  return 'none';
}

const Tooltip = ({ children, content }) => {
  const [show, setShow] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0, isAbove: false });
  const containerRef = React.useRef(null);

  const handleMouseEnter = (e) => {
    setShow(true);
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate dynamic dimensions based on content
    const contentLines = content.split('\n').length;
    const isSimpleContent = contentLines <= 1 && content.length <= 20;
    const tooltipHeight = isSimpleContent ? 50 : Math.max(120, contentLines * 25 + 40);
    const tooltipWidth = isSimpleContent ? 150 : 220;
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let x = rect.left + rect.width / 2;
    let y = rect.bottom + 8;
    
    // For simple content, prefer staying close to the element
    if (!isSimpleContent) {
      // Adjust horizontal position if tooltip would go off-screen
      if (x + tooltipWidth / 2 > viewportWidth) {
        x = viewportWidth - tooltipWidth / 2 - 10;
      } else if (x - tooltipWidth / 2 < 0) {
        x = tooltipWidth / 2 + 10;
      }
    }
    
    // Adjust vertical position if tooltip would go off-screen
    let isAbove = false;
    if (y + tooltipHeight > viewportHeight) {
      y = rect.top - tooltipHeight - 8; // Show above the element
      isAbove = true;
    }
    
    setPosition({ x, y, isAbove });
  };

  const handleMouseLeave = () => {
    setShow(false);
  };

  return (
    <>
    <span
        ref={containerRef}
      className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
    >
      {children}
      </span>
      {show && (
        <div
          className={`fixed z-[9999] bg-gray-900 text-white text-sm rounded-lg shadow-xl border border-gray-700 whitespace-pre-line transform -translate-x-1/2 ${
            content.split('\n').length <= 1 && content.length <= 20 
              ? 'p-2 min-w-[120px] max-w-xs' 
              : 'p-3 min-w-[200px] max-w-sm'
          }`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            pointerEvents: 'none'
          }}
        >
          <div className={`${content.split('\n').length <= 1 && content.length <= 20 ? 'text-center' : 'space-y-1'}`}>
            {content.split('\n').map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div 
            className={`absolute left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border border-gray-700 rotate-45 ${
              position.isAbove 
                ? '-bottom-1 border-b border-r border-t-0 border-l-0' 
                : '-top-1 border-l border-t border-b-0 border-r-0'
            }`}
          />
        </div>
      )}
    </>
  );
};

const TrainerMatrixView = React.memo(({
  trainers,
  scheduleData,
  flattenedScheduleData = [], // Add memoized flattened data with default
  setScheduleData,
  currentYear,
  currentMonth,
  onScheduleTask,
  onEditTask,
  onDeleteEntry,
  selectedTaskIds = [],
  toggleTaskSelection = () => {},
  handleBulkDelete = () => {},
  selectAllForDay = () => {},
  // New props for matrix filters (overall matrix view filters)
  matrixFilters,
  setIsMatrixFilterModalOpen,
  onOpenAvailability = () => {},
  sidebarCollapsed = false,
  toast = () => {},
}) => {
  const daysInMonth = useMemo(
    () => new Date(currentYear, currentMonth + 1, 0).getDate(),
    [currentYear, currentMonth]
  );
  const daysArray = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeDailyPanel, setActiveDailyPanel] = useState('training');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Clear selections when month/year changes
  React.useEffect(() => {
    setSelectedCells(new Set());
    setBulkSelectMode(false);
  }, [currentYear, currentMonth]);

  // New state for search/filter within the selected day's sections
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [dailyFilterOpen, setDailyFilterOpen] = useState(false);
  const [dailyFilterFields, setDailyFilterFields] = useState({
    name: true,
    client: true,
    course: true,
    role: true,
    taskDetails: true,
    taskType: true,
    description: true,
    specialization: true
  });
  const [dailyFilterType, setDailyFilterType] = useState('all'); // all, training, non-training, available

  // New state for matrix view trainer search
  const [matrixSearchTerm, setMatrixSearchTerm] = useState("");
  
  // New state for multi-select search functionality
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTrainers, setSelectedTrainers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSelectedTrainersVisible, setIsSelectedTrainersVisible] = useState(true);

  // Category detail modal: 'training' | 'nonTraining' | 'leave' | 'none' (available) | null
  const [categoryDetailModal, setCategoryDetailModal] = useState(null);
  const [categoryDetailSearch, setCategoryDetailSearch] = useState('');

  const hasActiveFilters = useMemo(() => {
    return (
      matrixFilters.specialization.length > 0 ||
      matrixFilters.client.length > 0 ||
      matrixFilters.course.length > 0 ||
      matrixFilters.nonTrainingTaskTypes.length > 0 ||
      matrixFilters.type !== 'all' ||
      matrixFilters.role !== 'all' ||
      (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') ||
      (matrixFilters.endDate && matrixFilters.endDate.trim() !== '')
    );
  }, [matrixFilters]);

  // Today's date and lists per category for the category-detail popup (today = user's current date)
  const todayCategoryDetails = useMemo(() => {
    const todayStr = getCurrentDateInUserTimezone();
    const todayDate = parseLocalDate(todayStr);
    if (!todayDate) return { todayStr, training: [], nonTraining: [], leave: [], available: [] };

    const trainingByTrainer = new Map();
    const nonTrainingByTrainer = new Map();
    const leaveByTrainer = new Map();
    const assignedTrainerNames = new Set();

    (flattenedScheduleData || []).forEach((entry) => {
      if (!entry.trainer) return;
      const entryStart = parseLocalDate(entry.startDate);
      const entryEnd = parseLocalDate(entry.endDate || entry.startDate);
      if (!entryStart || !entryEnd) return;
      if (todayDate < entryStart || todayDate > entryEnd) return;

      const name = (entry.trainer || '').trim();
      // Use trimmed name for display and sort so names fixed in Trainer Accounts (e.g. leading space removed) sort correctly
      const item = { trainerName: name, ...entry };

      // Skip "Not Alloted" placeholders for training
      if (entry.type === 'training') {
        if (entry.client === 'Not Alloted' || entry.course === 'Not Alloted' || entry.role === 'Not Alloted') return;
        assignedTrainerNames.add(name);
        if (!trainingByTrainer.has(name)) trainingByTrainer.set(name, item);
        return;
      }
      if (entry.type === 'non-training') {
        assignedTrainerNames.add(name);
        if (!nonTrainingByTrainer.has(name)) nonTrainingByTrainer.set(name, item);
        return;
      }
      if (entry.type === 'leave') {
        assignedTrainerNames.add(name);
        if (!leaveByTrainer.has(name)) leaveByTrainer.set(name, item);
      }
    });

    const available = (trainers || []).filter((t) => !assignedTrainerNames.has((t.name || '').trim())).map((t) => ({ trainerName: (t.name || '').trim(), trainer: t }));

    const sortByName = (a, b) => (a.trainerName || '').trim().localeCompare((b.trainerName || '').trim(), undefined, { sensitivity: 'base' });
    const training = Array.from(trainingByTrainer.values()).sort(sortByName);
    const nonTraining = Array.from(nonTrainingByTrainer.values()).sort(sortByName);
    const leave = Array.from(leaveByTrainer.values()).sort(sortByName);

    return {
      todayStr,
      todayFormatted: todayStr ? `${todayStr.slice(8, 10)}/${todayStr.slice(5, 7)}/${todayStr.slice(0, 4)}` : '',
      training,
      nonTraining,
      leave,
      available: available.sort(sortByName),
    };
  }, [flattenedScheduleData, trainers]);

  const trainerMonthlyEntries = useMemo(() => {
    const index = new Map();
    if (!flattenedScheduleData || flattenedScheduleData.length === 0) {
      return index;
    }

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);

    flattenedScheduleData.forEach((entry) => {
      if (!entry?.trainer) return;
      const entryStart = parseLocalDate(entry.startDate);
      const entryEnd = parseLocalDate(entry.endDate || entry.startDate);
      if (!entryStart || !entryEnd) return;
      if (entryEnd < monthStart || entryStart > monthEnd) return;

      if (!index.has(entry.trainer)) {
        index.set(entry.trainer, []);
      }
      index.get(entry.trainer).push(entry);
    });

    return index;
  }, [flattenedScheduleData, currentYear, currentMonth]);

  const matchesMatrixFilters = useCallback(
    (entry, dateOverride) => {
      if (!entry) return false;
      if (matrixFilters.type === 'available') return false;

      if (matrixFilters.client.length > 0) {
        if (!entry.client || !matrixFilters.client.includes(entry.client)) return false;
      }

      if (matrixFilters.course.length > 0) {
        if (!entry.course || !matrixFilters.course.includes(entry.course)) return false;
      }

      if (matrixFilters.type === 'training' && entry.type !== 'training') return false;
      if (matrixFilters.type === 'non-training' && entry.type !== 'non-training') return false;
      if (matrixFilters.type === 'leave' && entry.type !== 'leave') return false;

      if (matrixFilters.role !== 'all' && entry.type === 'training') {
        if (!entry.role || entry.role !== matrixFilters.role) return false;
      }

      if (
        matrixFilters.nonTrainingTaskTypes.length > 0 &&
        entry.type === 'non-training'
      ) {
        if (!entry.taskType || !matrixFilters.nonTrainingTaskTypes.includes(entry.taskType)) {
          return false;
        }
      }

      const entryStart = parseLocalDate(entry.startDate);
      const entryEnd = parseLocalDate(entry.endDate || entry.startDate);
      const filterStart = matrixFilters.startDate?.trim() ? parseLocalDate(matrixFilters.startDate) : null;
      const filterEnd = matrixFilters.endDate?.trim() ? parseLocalDate(matrixFilters.endDate) : null;
      const referenceDate = dateOverride ? parseLocalDate(dateOverride) : null;

      if (filterStart) {
        if (referenceDate) {
          if (referenceDate < filterStart) return false;
        } else if (entryEnd && entryEnd < filterStart) {
          return false;
        }
      }

      if (filterEnd) {
        if (referenceDate) {
          if (referenceDate > filterEnd) return false;
        } else if (entryStart && entryStart > filterEnd) {
          return false;
        }
      }

      return true;
    },
    [matrixFilters]
  );

  // Filter trainers based on ALL matrix filters (overall matrix view filter)
  const filteredTrainers = useMemo(() => {
    let currentTrainers = trainers;

    // Apply matrix search filter based on mode
    if (isMultiSelectMode) {
      // Multi-select mode: show only selected trainers
      if (selectedTrainers.length > 0) {
        currentTrainers = currentTrainers.filter(trainer => 
          selectedTrainers.some(selected => selected.id === trainer.id)
        );
      } else {
        // No trainers selected, show all trainers
        currentTrainers = trainers;
      }
    } else {
      // Simple mode: filter by search term
      if (matrixSearchTerm.trim() !== '') {
        const searchTermLower = matrixSearchTerm.toLowerCase();
        currentTrainers = currentTrainers.filter(trainer => {
          const trainerName = trainer.name || '';
          const trainerSpecialization = trainer.specialization || trainer.skill || '';
          return trainerName.toLowerCase().includes(searchTermLower) || 
                 trainerSpecialization.toLowerCase().includes(searchTermLower);
        });
      }
    }

    // Apply specialization filter
    if (matrixFilters.specialization.length > 0) {
      currentTrainers = currentTrainers.filter(trainer => {
        const trainerSpecializations = [
          trainer.specialization || '',
          trainer.skill || '',
        ].filter(s => s.trim() !== '').map(s => s.toLowerCase());
        
        if (trainerSpecializations.length === 0) return false;
        
        return matrixFilters.specialization.some(filterSpec => {
          const filterSpecLower = filterSpec.toLowerCase();
          return trainerSpecializations.some(ts => ts.includes(filterSpecLower));
        });
      });
    }

    // If no filters are applied, show all trainers (including available ones)
    if (!hasActiveFilters) {
      return [...currentTrainers].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
    }

    // Apply ALL matrix filters to determine which trainers should be shown
    // A trainer should only be shown if they have entries that match ALL the selected criteria
    currentTrainers = currentTrainers.filter((trainer) => {
      const entriesForTrainer = trainerMonthlyEntries.get(trainer.name) || [];

          if (matrixFilters.type === 'available') {
        return entriesForTrainer.length === 0;
          }

      if (entriesForTrainer.length === 0) {
              return false;
            }

      return entriesForTrainer.some((entry) => {
        if (
          entry.client === 'Not Alloted' ||
          entry.course === 'Not Alloted' ||
          entry.role === 'Not Alloted'
        ) {
              return false;
            }
        return matchesMatrixFilters(entry);
      });
    });

    return [...currentTrainers].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [
    trainers,
    matrixFilters,
    matrixSearchTerm,
    isMultiSelectMode,
    selectedTrainers,
    hasActiveFilters,
    trainerMonthlyEntries,
    matchesMatrixFilters,
  ]);

  // Helper for daily section search/filter - memoized with useCallback
  const matchesDailySearch = useCallback((entryOrTrainer) => {
    const searchTermLower = dailySearchTerm.toLowerCase();
    if (searchTermLower === '') return true;

    // If no filter fields are selected, search in all fields
    const hasActiveDailyFilters = Object.values(dailyFilterFields).some(field => field);
    if (!hasActiveDailyFilters) {
      const allFields = [
        entryOrTrainer.trainer || entryOrTrainer.name || '',
        entryOrTrainer.client || '',
        entryOrTrainer.course || '',
        entryOrTrainer.role || '',
        entryOrTrainer.taskDetails || '',
        entryOrTrainer.taskType || '',
        entryOrTrainer.description || '',
        entryOrTrainer.specialization || entryOrTrainer.skill || ''
      ];
      return allFields.some(f => f && f.toLowerCase().includes(searchTermLower));
    }
    
    // Search only in selected fields
    const fields = [];
    if (dailyFilterFields.name) fields.push(entryOrTrainer.trainer || entryOrTrainer.name || '');
    if (dailyFilterFields.client) fields.push(entryOrTrainer.client || '');
    if (dailyFilterFields.course) fields.push(entryOrTrainer.course || '');
    if (dailyFilterFields.role) fields.push(entryOrTrainer.role || '');
    if (dailyFilterFields.taskDetails) fields.push(entryOrTrainer.taskDetails || '');
    if (dailyFilterFields.taskType) fields.push(entryOrTrainer.taskType || '');
    if (dailyFilterFields.description) fields.push(entryOrTrainer.description || '');
    if (dailyFilterFields.specialization) fields.push(entryOrTrainer.specialization || entryOrTrainer.skill || '');

    return fields.some(f => f && f.toLowerCase().includes(searchTermLower));
  }, [dailySearchTerm, dailyFilterFields]);

  // Multi-select search helper functions
  const handleSearchChange = (searchTerm) => {
    setMatrixSearchTerm(searchTerm);
    
    if (isMultiSelectMode && searchTerm.trim() !== '') {
      // Filter trainers based on search term for multi-select mode
      const searchTermLower = searchTerm.toLowerCase();
      const filtered = trainers.filter(trainer => {
        const trainerName = trainer.name || '';
        const trainerSpecialization = trainer.specialization || trainer.skill || '';
        return trainerName.toLowerCase().includes(searchTermLower) || 
               trainerSpecialization.toLowerCase().includes(searchTermLower);
      });
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const addTrainerToSelection = (trainer) => {
    if (!selectedTrainers.find(t => t.id === trainer.id)) {
      setSelectedTrainers(prev => [...prev, trainer]);
    }
    setMatrixSearchTerm('');
    setSearchResults([]);
  };

  const removeTrainerFromSelection = (trainerId) => {
    setSelectedTrainers(prev => prev.filter(t => t.id !== trainerId));
  };

  const clearAllSelectedTrainers = () => {
    setSelectedTrainers([]);
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      // Switching to multi-select mode, clear current search
      setMatrixSearchTerm('');
      setSearchResults([]);
    } else {
      // Switching to simple mode, clear selected trainers
      setSelectedTrainers([]);
    }
  };

  // Pre-index entries by date and trainer for O(1) lookup instead of O(n) filtering
  // MUST be defined before trainerCategoriesMemo which uses it
  const entriesByDateAndTrainer = useMemo(() => {
    const index = new Map();
    const dateStr = `${currentYear}-${pad2(currentMonth + 1)}`;
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    flattenedScheduleData.forEach(entry => {
      // Only process entries that might be in the current month
      const entryStartDate = parseLocalDate(entry.startDate);
      const entryEndDate = parseLocalDate(entry.endDate);
      
      // Skip if entry doesn't overlap with current month at all
      if (entryEndDate < currentMonthStart || entryStartDate > currentMonthEnd) {
        return;
      }
      
      // Calculate the range of days in current month that this entry covers
      const startDay = entryStartDate < currentMonthStart ? 1 : entryStartDate.getDate();
      const endDay = entryEndDate > currentMonthEnd ? daysInMonth : entryEndDate.getDate();
      const entryMonth = entryStartDate.getMonth();
      const entryYear = entryStartDate.getFullYear();
      
      // Only process if entry is in current month (or spans into it)
      if (entryMonth === currentMonth && entryYear === currentYear) {
        // For each day in the entry's range that falls in current month
        for (let d = startDay; d <= endDay; d++) {
          const dayDateStr = `${dateStr}-${pad2(d)}`;
          const trainerKey = `${dayDateStr}-${entry.trainer}`;
          
          if (!index.has(trainerKey)) {
            index.set(trainerKey, []);
          }
          index.get(trainerKey).push(entry);
        }
      } else if (entryStartDate < currentMonthStart && entryEndDate >= currentMonthStart) {
        // Entry spans from previous month into current month
        for (let d = 1; d <= Math.min(endDay, daysInMonth); d++) {
          const dayDateStr = `${dateStr}-${pad2(d)}`;
          const trainerKey = `${dayDateStr}-${entry.trainer}`;
          
          if (!index.has(trainerKey)) {
            index.set(trainerKey, []);
          }
          index.get(trainerKey).push(entry);
        }
      } else if (entryStartDate <= currentMonthEnd && entryEndDate > currentMonthEnd) {
        // Entry spans from current month into next month
        for (let d = Math.max(1, startDay); d <= daysInMonth; d++) {
          const dayDateStr = `${dateStr}-${pad2(d)}`;
          const trainerKey = `${dayDateStr}-${entry.trainer}`;
          
          if (!index.has(trainerKey)) {
            index.set(trainerKey, []);
          }
          index.get(trainerKey).push(entry);
        }
      }
    });
    
    return index;
  }, [flattenedScheduleData, currentYear, currentMonth, daysInMonth]);

  // Memoize getTrainerCategories to prevent expensive recalculations
  const trainerCategoriesMemo = useMemo(() => {
    if (!selectedDay) return null;
    
    let trainingTrainers = [];
    let nonTrainingTrainers = [];
    let leaveTrainers = [];
    const assignedTrainersNames = new Set();
    const dateStr = `${currentYear}-${pad2(currentMonth + 1)}`;
    const dayDateStr = `${dateStr}-${pad2(selectedDay)}`;

    // Iterate over `filteredTrainers` (trainers passing overall specialization filter)
    filteredTrainers.forEach(trainer => {
      // Get entries from pre-indexed map (much faster than filtering)
      const trainerKey = `${dayDateStr}-${trainer.name}`;
      const rawEntries = entriesByDateAndTrainer.get(trainerKey) || [];
      
      // Apply filters (much smaller set now)
      const entriesForThisTrainerOnSelectedDay = rawEntries.filter((entry) => {
        // Leave entries don't have client/course/role; skip "Not Alloted" check only for non-leave
        if (entry.type !== 'leave' && (
          entry.client === 'Not Alloted' ||
          entry.course === 'Not Alloted' ||
          entry.role === 'Not Alloted'
        )) {
          return false;
        }

        if (!matchesMatrixFilters(entry, dayDateStr)) {
            return false;
        }

        return true;
      });

      entriesForThisTrainerOnSelectedDay.forEach(entry => {
        if (entry.type === 'training') {
          if (matchesDailySearch(entry)) {
            trainingTrainers.push(entry);
            assignedTrainersNames.add(entry.trainer);
          }
        } else if (entry.type === 'non-training') {
          if (matchesDailySearch(entry)) {
            nonTrainingTrainers.push(entry);
            assignedTrainersNames.add(entry.trainer);
          }
        } else if (entry.type === 'leave') {
          if (matchesDailySearch(entry)) {
            leaveTrainers.push(entry);
            assignedTrainersNames.add(entry.trainer);
          }
        }
      });
    });

    // Determine available trainers from the already specialization-filtered list
    // These are trainers from `filteredTrainers` who are not assigned anything on this specific `day` (after all other filters)
    let availableTrainers = filteredTrainers.filter(trainer => {
      if (assignedTrainersNames.has(trainer.name)) return false;

      // Check if any filters are applied (excluding specialization which is handled in filteredTrainers)
      const hasActiveFiltersForAvailable = 
        matrixFilters.client.length > 0 ||
        matrixFilters.course.length > 0 ||
        matrixFilters.type !== 'all' ||
        matrixFilters.role !== 'all' ||
        matrixFilters.nonTrainingTaskTypes.length > 0 ||
        (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') ||
        (matrixFilters.endDate && matrixFilters.endDate.trim() !== '');

      // If no filters are applied, show all available trainers
      if (!hasActiveFiltersForAvailable) {
        return matchesDailySearch(trainer);
      }

      // Apply type-specific filters to available trainers only when filters are active
      if (matrixFilters.type === 'training') {
        // For training type, available trainers should have potential for training (role filter applies)
        if (matrixFilters.role !== 'all') {
          const hasRoleInSchedule = Object.values(scheduleData).some(entries => {
            return entries.some(entry => {
              if (entry.trainer === trainer.name && entry.type === 'training' && entry.role === matrixFilters.role) {
                const entryDate = parseLocalDate(entry.startDate);
                const currentMonthStart = new Date(currentYear, currentMonth, 1);
                const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
                return entryDate >= currentMonthStart && entryDate <= currentMonthEnd;
              }
              return false;
            });
          });
          if (!hasRoleInSchedule) {
            return false;
          }
        }
      } else if (matrixFilters.type === 'non-training') {
        // For non-training type, available trainers should have potential for non-training tasks
        // We don't filter by specific task types for available trainers
        return matchesDailySearch(trainer);
      } else if (matrixFilters.type === 'available') {
        // For available type, all available trainers should be shown
        return matchesDailySearch(trainer);
      }
      
      // Apply daily search filter for available trainers
      return matchesDailySearch(trainer);
    }).map(trainer => ({
      name: trainer.name,
      specialization: trainer.specialization || trainer.skill || 'Not specified'
    }));

    // Apply dailyFilterType for available section
    if (dailyFilterType === 'training') {
      nonTrainingTrainers = [];
      leaveTrainers = [];
      availableTrainers = [];
    } else if (dailyFilterType === 'non-training') {
      trainingTrainers = [];
      leaveTrainers = [];
      availableTrainers = [];
    } else if (dailyFilterType === 'leave') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
      availableTrainers = [];
    } else if (dailyFilterType === 'available') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
      leaveTrainers = [];
    }

    // Apply overall matrix type filter to sections
    if (matrixFilters.type === 'training') {
      nonTrainingTrainers = [];
      availableTrainers = [];
    } else if (matrixFilters.type === 'non-training') {
      trainingTrainers = [];
      availableTrainers = [];
    } else if (matrixFilters.type === 'leave') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
      availableTrainers = [];
    } else if (matrixFilters.type === 'available') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
    }

    return {
      trainingTrainers,
      nonTrainingTrainers,
      leaveTrainers,
      availableTrainers
    };
  }, [
    selectedDay,
    filteredTrainers,
    entriesByDateAndTrainer,
    currentYear,
    currentMonth,
    matrixFilters,
    matchesMatrixFilters,
    matchesDailySearch,
    dailyFilterType,
  ]);


  // getTrainerCategories function wrapper for backward compatibility
  const getTrainerCategories = useCallback((day) => {
    if (day !== selectedDay) {
      // For non-selected days, calculate on the fly (shouldn't happen in normal flow)
      return {
        trainingTrainers: [],
        nonTrainingTrainers: [],
        availableTrainers: []
      };
    }
    return trainerCategoriesMemo || {
      trainingTrainers: [],
      nonTrainingTrainers: [],
      availableTrainers: []
    };
  }, [selectedDay, trainerCategoriesMemo]);

  // Memoize cell data to avoid recalculating for every cell on every render
  const cellDataMap = useMemo(() => {
    const map = new Map();
    const dateStr = `${currentYear}-${pad2(currentMonth + 1)}`;
    
    filteredTrainers.forEach(trainer => {
      daysArray.forEach(day => {
        const key = `${trainer.id}-${day}`;
        const dayDateStr = `${dateStr}-${pad2(day)}`;
        const trainerKey = `${dayDateStr}-${trainer.name}`;
        
        // Get entries from pre-indexed map (O(1) lookup)
        const rawEntries = entriesByDateAndTrainer.get(trainerKey) || [];
        
        // Apply filters (much smaller set now); leave entries have no client/course/role
        const entries = rawEntries.filter((entry) => {
          if (entry.type === 'leave') return matchesMatrixFilters(entry, dayDateStr);
          if (
            entry.client === 'Not Alloted' ||
            entry.course === 'Not Alloted' ||
            entry.role === 'Not Alloted'
          ) {
            return false;
          }
          return matchesMatrixFilters(entry, dayDateStr);
        });
        
        map.set(key, {
          entries,
          status: getStatusForEntries(entries),
          hasEntries: entries.length > 0,
          tooltipContent: entries.length === 0
            ? 'No Task Assigned'
            : entries[0].type === 'leave'
              ? `🏷️ Leave\n${entries[0].description ? '📄 Reason: ' + entries[0].description : ''}`
              : (entries[0].type === 'training'
                ? `🎓 Training Session\n${entries[0].client ? '👥 Client: ' + entries[0].client + '\n' : ''}${entries[0].course ? '📚 Course: ' + entries[0].course + '\n' : ''}${entries[0].role ? '👤 Role: ' + entries[0].role : ''}`
                : `📋 Non-Training Task\n${entries[0].taskDetails ? '📝 Task: ' + entries[0].taskDetails + '\n' : ''}${entries[0].taskType ? '🏷️ Type: ' + entries[0].taskType + '\n' : ''}${entries[0].description ? '📄 Description: ' + entries[0].description : ''}`
              )
        });
      });
    });
    return map;
  }, [filteredTrainers, daysArray, entriesByDateAndTrainer, currentYear, currentMonth, matchesMatrixFilters]);

  const handleScheduleTask = (trainer) => {
    if (onScheduleTask) {
      onScheduleTask({
        trainer,
        date: `${currentYear}-${pad2(currentMonth + 1)}-${pad2(selectedDay)}`
      });
    }
  };

  // Bulk selection functions with month/year specificity
  const toggleCellSelection = (trainerId, day) => {
    const cellKey = `${currentYear}-${currentMonth}-${trainerId}-${day}`;
    setSelectedCells(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey);
      } else {
        newSelected.add(cellKey);
      }
      return newSelected;
    });
  };

  const selectTrainerRow = (trainerId) => {
    const trainerCells = daysArray.map(day => `${currentYear}-${currentMonth}-${trainerId}-${day}`);
    setSelectedCells(prev => {
      const newSelected = new Set(prev);
      const allSelected = trainerCells.every(cell => newSelected.has(cell));
      
      if (allSelected) {
        // Deselect all cells for this trainer
        trainerCells.forEach(cell => newSelected.delete(cell));
      } else {
        // Select all cells for this trainer (only if they have entries)
        trainerCells.forEach(cellKey => {
          const [year, month, tId, day] = cellKey.split('-');
          const trainer = filteredTrainers.find(t => t.id === tId);
          if (trainer) {
            const cellKeyForMap = `${trainer.id}-${parseInt(day)}`;
            const cellData = cellDataMap.get(cellKeyForMap);
            if (cellData && cellData.hasEntries) {
            newSelected.add(cellKey);
            }
          }
        });
      }
      return newSelected;
    });
  };

  const selectDateColumn = (day) => {
    const dateCells = filteredTrainers.map(trainer => `${currentYear}-${currentMonth}-${trainer.id}-${day}`);
    setSelectedCells(prev => {
      const newSelected = new Set(prev);
      const allSelected = dateCells.every(cell => newSelected.has(cell));
      
      if (allSelected) {
        // Deselect all cells for this date
        dateCells.forEach(cell => newSelected.delete(cell));
      } else {
        // Select all cells for this date (only if they have entries)
        dateCells.forEach(cellKey => {
          const [year, month, tId, day] = cellKey.split('-');
          const trainer = filteredTrainers.find(t => t.id === tId);
          if (trainer) {
            const cellKeyForMap = `${trainer.id}-${parseInt(day)}`;
            const cellData = cellDataMap.get(cellKeyForMap);
            if (cellData && cellData.hasEntries) {
            newSelected.add(cellKey);
            }
          }
        });
      }
      return newSelected;
    });
  };

  const handleBulkDeleteFromMatrix = async () => {
    if (selectedCells.size === 0) return;
    
    const newScheduleData = { ...scheduleData };
    let deletedCount = 0;
    const tasksToRemove = new Map();
    
    selectedCells.forEach(cellKey => {
      const [year, month, trainerId, day] = cellKey.split('-');
      const date = `${year}-${pad2(parseInt(month) + 1)}-${pad2(parseInt(day))}`;
      
      if (newScheduleData[date]) {
        const trainer = filteredTrainers.find(t => t.id === trainerId);
        if (trainer) {
          // Get entries for this trainer on this specific date using cached cell data
          const cellKeyForMap = `${trainer.id}-${parseInt(day)}`;
          const cellData = cellDataMap.get(cellKeyForMap);
          const entriesForTrainer = cellData ? cellData.entries : [];
          
          entriesForTrainer.forEach(entry => {
            if (entry?.id) {
              tasksToRemove.set(entry.id, entry);
            }
          });
          
          // Remove all entries that match the trainer and have entries on this date
          const originalLength = newScheduleData[date].length;
          newScheduleData[date] = newScheduleData[date].filter(entry => {
            // Keep entry if it's not for this trainer OR if it doesn't match any of the entries we want to delete
            if (entry.trainer !== trainer.name) return true;
            
            // Check if this entry matches any of the entries we want to delete
            return !entriesForTrainer.some(targetEntry => 
              targetEntry.id === entry.id || 
              (targetEntry.trainer === entry.trainer && 
               targetEntry.type === entry.type &&
               targetEntry.startDate === entry.startDate &&
               targetEntry.endDate === entry.endDate)
            );
          });
          
          deletedCount += originalLength - newScheduleData[date].length;
          
          // Remove the date key if no entries left
          if (newScheduleData[date].length === 0) {
            delete newScheduleData[date];
          }
        }
      }
    });
    
    // Close modal immediately
    setIsConfirmModalOpen(false);
    
    setScheduleData(newScheduleData);
    
    try {
      await saveScheduleData(newScheduleData);
      setSelectedCells(new Set());
      setBulkSelectMode(false);
      
      for (const [taskId, entry] of tasksToRemove) {
        try {
          await cancelPendingRequestsForTask(taskId, {
            reason: 'Associated schedule task was removed',
            trainerName: entry.trainer,
            taskLabel: entry.taskDetails || entry.client || entry.course || entry.role
          });
        } catch (requestError) {
          console.error('⚠️ Failed to cancel pending clock requests for deleted task:', requestError);
        }
      }
      
      toast({ 
        title: 'Bulk Delete Success', 
        description: `${deletedCount} schedule entries deleted successfully.` 
      });
    } catch (error) {
      console.error('Error saving matrix bulk deleted data:', error);
      toast({ 
        title: 'Bulk Delete Error', 
        description: 'Failed to save changes to database. Please try again.',
        variant: "destructive"
      });
    }
  };

  // Memoize unique options for the daily filter modal
  const uniqueDailySpecializations = useMemo(() => {
    const specs = new Set();
    trainers.forEach(trainer => {
      if (trainer.specialization) specs.add(trainer.specialization);
      if (trainer.skill) specs.add(trainer.skill);
    });
    return Array.from(specs);
  }, [trainers]);

  const uniqueDailyClients = useMemo(() => {
    const clients = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.client && entry.client !== 'Not Alloted') clients.add(entry.client);
    });
    return Array.from(clients);
  }, [flattenedScheduleData]);

  const uniqueDailyCourses = useMemo(() => {
    const courses = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.course && entry.course !== 'Not Alloted') courses.add(entry.course);
    });
    return Array.from(courses);
  }, [flattenedScheduleData]);

  // Calculate responsive grid columns based on screen size and compact view

  useEffect(() => {
    if (selectedDay) {
      setActiveDailyPanel('training');
    }
  }, [selectedDay]);

  const ActionIconButton = ({ onClick, label, icon: Icon, variant = 'neutral', accent = 'blue' }) => {
    const accentClassMap = {
      blue: 'text-blue-600 hover:bg-blue-100/70 focus:ring-blue-500',
      orange: 'text-orange-600 hover:bg-orange-100/70 focus:ring-orange-500',
      green: 'text-green-600 hover:bg-green-100/70 focus:ring-green-500',
      red: 'text-red-600 hover:bg-red-100/70 focus:ring-red-500'
    };
    const base = 'inline-flex items-center justify-center rounded-full p-2 bg-white/80 shadow-sm border border-white/70 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
    const variantClasses = variant === 'danger'
      ? 'text-red-600 hover:bg-red-100/80 focus:ring-red-500'
      : (accentClassMap[accent] || accentClassMap.blue);
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${variantClasses}`}
        aria-label={label}
        title={label}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  const accentTokens = {
    blue: {
      headerBg: 'bg-blue-50/70',
      cardBg: 'bg-blue-50/40',
      textPrimary: 'text-blue-900',
      badge: 'bg-blue-100 text-blue-700',
      dot: 'bg-blue-500',
      border: 'border-blue-500/40'
    },
    orange: {
      headerBg: 'bg-orange-50/70',
      cardBg: 'bg-orange-50/40',
      textPrimary: 'text-orange-900',
      badge: 'bg-orange-400 text-white',
      dot: 'bg-orange-400',
      border: 'border-orange-400/50'
    },
    green: {
      headerBg: 'bg-green-50/70',
      cardBg: 'bg-green-50/40',
      textPrimary: 'text-green-900',
      badge: 'bg-green-100 text-green-700',
      dot: 'bg-green-500',
      border: 'border-green-500/40'
    },
    red: {
      headerBg: 'bg-red-50/70',
      cardBg: 'bg-red-50/40',
      textPrimary: 'text-red-900',
      badge: 'bg-red-100 text-red-700',
      dot: 'bg-red-500',
      border: 'border-red-500/40'
    }
  };

  const getHighlightBorder = (accent) => accentTokens[accent]?.border || 'border-gray-200';
  const getPrimaryText = (accent) => accentTokens[accent]?.textPrimary || 'text-gray-900';
  const getCardBackground = (accent) => accentTokens[accent]?.cardBg || 'bg-white';
  const getBadgeStyle = (accent) => accentTokens[accent]?.badge || 'bg-gray-100 text-gray-600';
  const getHeaderBg = (accent) => accentTokens[accent]?.headerBg || 'bg-gray-50';
  const getDotStyle = (accent) => accentTokens[accent]?.dot || 'bg-gray-500';
  const getBorderStyle = (accent) => accentTokens[accent]?.border || 'border-gray-200';

  const renderDailySectionItems = (section) => {
    if (!trainerCategoriesMemo) {
      return <p className="text-sm text-muted-foreground">No data for this date</p>;
    }

    if (!section.items || section.items.length === 0) {
      return <p className="text-sm text-muted-foreground">{section.emptyLabel}</p>;
    }

    const dateForSelectedDay = selectedDay
      ? `${currentYear}-${pad2(currentMonth + 1)}-${pad2(selectedDay)}`
      : null;

    if (section.key === 'available') {
      return section.items.map((trainer, index) => (
        <div
          key={trainer.id || `${trainer.name}-${index}`}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border ${accentTokens[section.accent].border} ${accentTokens[section.accent].cardBg} p-3 shadow-sm`}
        >
          <div className="min-w-0">
            <p className={`font-semibold ${getPrimaryText(section.accent)} truncate`}>{trainer.name}</p>
            <p className="text-xs text-gray-600 mt-0.5">Tech Stack: {trainer.specialization || 'Not specified'}</p>
          </div>
          <Button
            onClick={() => {
              setSelectedDay(null);
              onScheduleTask({
                trainer: { name: trainer.name },
                date: dateForSelectedDay
              });
            }}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm rounded-lg"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule</span>
          </Button>
        </div>
      ));
    }

    return section.items.map((entry) => (
      <div
        key={entry.id}
        className={`relative flex w-full items-start gap-3 rounded-xl border ${accentTokens[section.accent].border} ${accentTokens[section.accent].cardBg} p-4 shadow-sm`}
      >
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${accentTokens[section.accent].dot}`}></span>
        <div className="flex items-start gap-3 pl-4 pr-16">
          <input
            type="checkbox"
            className="mt-1"
            checked={selectedTaskIds.includes(entry.id)}
            onChange={() => toggleTaskSelection(entry.id)}
          />
          <div className="min-w-0 space-y-1">
            <p className={`font-semibold ${getPrimaryText(section.accent)} truncate`}>{entry.trainer}</p>
            {section.key === 'training' ? (
              <>
                <div className="flex items-center gap-1 text-xs text-gray-600"><span className="text-gray-400">Client:</span><span className="font-medium text-gray-700">{entry.client}</span></div>
                <div className="flex items-center gap-1 text-xs text-gray-600"><span className="text-gray-400">Course:</span><span className="font-medium text-gray-700">{entry.course}</span></div>
                {entry.role && <div className="flex items-center gap-1 text-xs text-gray-600"><span className="text-gray-400">Role:</span><span className="font-medium text-gray-700">{entry.role}</span></div>}
                {entry.description && <div className="text-xs text-gray-500">Notes: {entry.description}</div>}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 text-xs text-gray-600"><span className="text-gray-400">Task:</span><span className="font-medium text-gray-700">{entry.taskDetails}</span></div>
                <div className="flex items-center gap-1 text-xs text-gray-600"><span className="text-gray-400">Type:</span><span className="font-medium text-gray-700">{entry.taskType}</span></div>
                {entry.description && <div className="text-xs text-gray-500">Notes: {entry.description}</div>}
              </>
            )}
          </div>
        </div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex items-center gap-2">
          <ActionIconButton
            onClick={() => {
              const dayValue = selectedDay;
              setSelectedDay(null);
              onEditTask(entry, dayValue);
            }}
            label="Edit assignment"
            icon={Edit3}
            accent={section.accent}
          />
          <ActionIconButton
            onClick={() => {
              const dayValue = selectedDay;
              setSelectedDay(null);
              onDeleteEntry(entry, dayValue);
            }}
            label="Delete assignment"
            icon={Trash2}
            variant="danger"
          />
        </div>
      </div>
    ));
  };

  const dailySections = useMemo(() => {
    return [
      {
        key: 'training',
        title: 'Training Assigned',
        accent: 'blue',
        items: trainerCategoriesMemo?.trainingTrainers ?? [],
        emptyLabel: 'No training assignments for this date'
      },
      {
        key: 'non-training',
        title: 'Non-Training Tasks',
        accent: 'orange',
        items: trainerCategoriesMemo?.nonTrainingTrainers ?? [],
        emptyLabel: 'No non-training tasks for this date'
      },
      {
        key: 'leave',
        title: 'Leave',
        accent: 'red',
        items: trainerCategoriesMemo?.leaveTrainers ?? [],
        emptyLabel: 'No leave for this date'
      },
      {
        key: 'available',
        title: 'Available Trainers',
        accent: 'green',
        items: trainerCategoriesMemo?.availableTrainers ?? [],
        emptyLabel: 'No available trainers for this date'
      }
    ];
  }, [trainerCategoriesMemo]);

  return (
    <div className="space-y-6">
      {/* Header for Matrix View: Search, Filter Button and Bulk Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              setBulkSelectMode(!bulkSelectMode);
              setSelectedCells(new Set());
            }}
            variant={bulkSelectMode ? "default" : "outline"}
            className="flex items-center gap-2"
          >
            {bulkSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {bulkSelectMode ? 'Exit Selection' : 'Bulk Select'}
        </Button>

          {bulkSelectMode && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              <span className="text-sm text-gray-600">
                {selectedCells.size} selected
              </span>
              <Button 
                onClick={() => setIsConfirmModalOpen(true)}
                variant="destructive"
                size="sm"
                disabled={selectedCells.size === 0}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
              <Button 
                onClick={() => setSelectedCells(new Set())}
                variant="ghost"
                size="sm"
                disabled={selectedCells.size === 0}
              >
                Clear Selection
              </Button>
            </>
          )}
      </div>
      
        <div className="flex items-center gap-3">
          {/* Matrix Search Input */}
          <div className="flex items-center gap-2">
            {/* Multi-select mode toggle */}
            <Button
              onClick={toggleMultiSelectMode}
              variant={isMultiSelectMode ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-1"
            >
              {isMultiSelectMode ? "Multi" : "Simple"}
            </Button>
            
            {/* Search input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={isMultiSelectMode ? "Search to add trainers..." : "Search trainers..."}
                value={matrixSearchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 shadow-sm text-sm"
              />
              {matrixSearchTerm && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              )}
              
              {/* Search results dropdown for multi-select mode */}
              {isMultiSelectMode && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {searchResults.map((trainer) => (
                    <button
                      key={trainer.id}
                      onClick={() => addTrainerToSelection(trainer)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <div className="w-6 h-6 text-xs rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                        {trainer.name ? trainer.name[0] : '?'}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{trainer.name}</div>
                        <div className="text-xs text-gray-500">{trainer.specialization || trainer.skill || 'No specialization'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Selected trainers display for multi-select mode */}
          {isMultiSelectMode && selectedTrainers.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
              {/* Header with toggle */}
              <div 
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setIsSelectedTrainersVisible(!isSelectedTrainersVisible)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-700">
                    Selected Trainers ({selectedTrainers.length})
                  </span>
                  {!isSelectedTrainersVisible && (
                    <span className="text-xs text-blue-500">
                      {selectedTrainers.slice(0, 2).map(t => t.name).join(', ')}
                      {selectedTrainers.length > 2 && ` +${selectedTrainers.length - 2} more`}
                    </span>
                  )}
                  <button className="text-blue-500 hover:text-blue-700">
                    {isSelectedTrainersVisible ? '▼' : '▶'}
                  </button>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllSelectedTrainers();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Clear All
                </Button>
              </div>
              
              {/* Collapsible content */}
              <AnimatePresence>
                {isSelectedTrainersVisible && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-2">
                      <div className="flex flex-wrap gap-1">
                        {selectedTrainers.map((trainer) => (
                          <div
                            key={trainer.id}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full text-xs"
                          >
                            <div className="w-4 h-4 text-xs rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                              {trainer.name ? trainer.name[0] : '?'}
                            </div>
                            <span className="text-blue-700">{trainer.name}</span>
                            <button
                              onClick={() => removeTrainerFromSelection(trainer.id)}
                              className="text-blue-500 hover:text-blue-700 ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          <Button 
            onClick={() => setIsMatrixFilterModalOpen(true)} 
            variant="outline"
            className={`flex items-center gap-2 ${hasActiveFilters ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : ''}`}
          >
            <Filter className="h-4 w-4" /> 
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </Button>
        </div>
      </div>
      
      {/* Category buttons: click to open today's list for that category */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          onClick={() => setCategoryDetailModal('training')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
        >
          <span className={`inline-block w-5 h-5 rounded-full ${STATUS_COLORS.training} shadow-sm`} />
          <span>{STATUS_LABELS.training}</span>
          <span className="ml-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
            {todayCategoryDetails.training.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCategoryDetailModal('nonTraining')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 transition-colors"
        >
          <span className={`inline-block w-5 h-5 rounded-full ${STATUS_COLORS.nonTraining} shadow-sm`} />
          <span>{STATUS_LABELS.nonTraining}</span>
          <span className="ml-1 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
            {todayCategoryDetails.nonTraining.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCategoryDetailModal('leave')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 transition-colors"
        >
          <span className={`inline-block w-5 h-5 rounded-full ${STATUS_COLORS.leave} shadow-sm`} />
          <span>{STATUS_LABELS.leave}</span>
          <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
            {todayCategoryDetails.leave.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCategoryDetailModal('none')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-green-200 bg-green-50 text-green-800 hover:bg-green-100 transition-colors"
        >
          <span className={`inline-block w-5 h-5 rounded-full ${STATUS_COLORS.none} shadow-sm`} />
          <span>{STATUS_LABELS.none}</span>
          <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
            {todayCategoryDetails.available.length}
          </span>
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600">
          <span className={`inline-block w-5 h-5 rounded-full ${STATUS_COLORS.holiday} shadow-sm`} />
          {STATUS_LABELS.holiday}
        </div>
      </div>

      <AnimatePresence>
        {isConfirmModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000]"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4"
            >
              <div className="flex items-start gap-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-0 text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Delete Selected Schedules
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete the {selectedCells.size} selected schedule entries? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteFromMatrix}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category detail modal: today's list for Training / Non-Training / Leave / Available */}
      <Dialog open={!!categoryDetailModal} onOpenChange={(open) => { if (!open) { setCategoryDetailModal(null); setCategoryDetailSearch(''); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {categoryDetailModal === 'training' && `${STATUS_LABELS.training} — Today (${todayCategoryDetails.todayFormatted || todayCategoryDetails.todayStr})`}
              {categoryDetailModal === 'nonTraining' && `${STATUS_LABELS.nonTraining} — Today (${todayCategoryDetails.todayFormatted || todayCategoryDetails.todayStr})`}
              {categoryDetailModal === 'leave' && `${STATUS_LABELS.leave} — Today (${todayCategoryDetails.todayFormatted || todayCategoryDetails.todayStr})`}
              {categoryDetailModal === 'none' && `${STATUS_LABELS.none} — Today (${todayCategoryDetails.todayFormatted || todayCategoryDetails.todayStr})`}
            </DialogTitle>
            <DialogDescription>
              {categoryDetailModal === 'training' && (
                <>
                  Trainers with training assigned today.{' '}
                  <span className="text-base font-semibold text-slate-900">Total: {todayCategoryDetails.training.length}</span>
                </>
              )}
              {categoryDetailModal === 'nonTraining' && (
                <>
                  Trainers with non-training tasks today.{' '}
                  <span className="text-base font-semibold text-slate-900">Total: {todayCategoryDetails.nonTraining.length}</span>
                </>
              )}
              {categoryDetailModal === 'leave' && (
                <>
                  Trainers on leave today.{' '}
                  <span className="text-base font-semibold text-slate-900">Total: {todayCategoryDetails.leave.length}</span>
                </>
              )}
              {categoryDetailModal === 'none' && (
                <>
                  Trainers with no assignment today.{' '}
                  <span className="text-base font-semibold text-slate-900">Total: {todayCategoryDetails.available.length}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={categoryDetailSearch}
                onChange={(e) => setCategoryDetailSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 mt-2">
            {categoryDetailModal === 'training' && (() => {
              const total = todayCategoryDetails.training.length;
              const list = todayCategoryDetails.training.filter((item) => {
                const term = categoryDetailSearch.trim().toLowerCase();
                if (!term) return true;
                const name = (item.trainerName || '').toLowerCase();
                const client = (item.client || '').toLowerCase();
                const course = (item.course || '').toLowerCase();
                const role = (item.role || '').toLowerCase();
                return name.includes(term) || client.includes(term) || course.includes(term) || role.includes(term);
              });
              return list.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">{total === 0 ? 'No training assigned for today.' : 'No matches for your search.'}</p>
              ) : (
                <>
                  {categoryDetailSearch.trim() && (
                    <p className="text-xs text-slate-500 mb-2">Showing {list.length} of {total}</p>
                  )}
                  <ul className="space-y-3">
                  {list.map((item, idx) => (
                    <li key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                      <div className="font-medium text-slate-900">{item.trainerName}</div>
                      <div className="mt-1 text-sm text-slate-600 space-y-0.5">
                        {item.client && <div>Client: {item.client}</div>}
                        {item.course && <div>Course: {item.course}</div>}
                        {item.role && <div>Role: {item.role}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
                </>
              );
            })()}
            {categoryDetailModal === 'nonTraining' && (() => {
              const total = todayCategoryDetails.nonTraining.length;
              const list = todayCategoryDetails.nonTraining.filter((item) => {
                const term = categoryDetailSearch.trim().toLowerCase();
                if (!term) return true;
                const name = (item.trainerName || '').toLowerCase();
                const task = (item.taskDetails || '').toLowerCase();
                const type = (item.taskType || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                return name.includes(term) || task.includes(term) || type.includes(term) || desc.includes(term);
              });
              return list.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">{total === 0 ? 'No non-training tasks for today.' : 'No matches for your search.'}</p>
              ) : (
                <>
                  {categoryDetailSearch.trim() && (
                    <p className="text-xs text-slate-500 mb-2">Showing {list.length} of {total}</p>
                  )}
                  <ul className="space-y-3">
                  {list.map((item, idx) => (
                    <li key={idx} className="p-3 rounded-lg border border-slate-200 bg-orange-50/30">
                      <div className="font-medium text-slate-900">{item.trainerName}</div>
                      <div className="mt-1 text-sm text-slate-600 space-y-0.5">
                        {item.taskDetails && <div>Task: {item.taskDetails}</div>}
                        {item.taskType && <div>Type: {item.taskType}</div>}
                        {item.description && <div>Description: {item.description}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
                </>
              );
            })()}
            {categoryDetailModal === 'leave' && (() => {
              const total = todayCategoryDetails.leave.length;
              const list = todayCategoryDetails.leave.filter((item) => {
                const term = categoryDetailSearch.trim().toLowerCase();
                if (!term) return true;
                const name = (item.trainerName || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                return name.includes(term) || desc.includes(term);
              });
              return list.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">{total === 0 ? 'No leave for today.' : 'No matches for your search.'}</p>
              ) : (
                <>
                  {categoryDetailSearch.trim() && (
                    <p className="text-xs text-slate-500 mb-2">Showing {list.length} of {total}</p>
                  )}
                  <ul className="space-y-3">
                  {list.map((item, idx) => (
                    <li key={idx} className="p-3 rounded-lg border border-slate-200 bg-red-50/30">
                      <div className="font-medium text-slate-900">{item.trainerName}</div>
                      {item.description && <div className="mt-1 text-sm text-slate-600">Reason: {item.description}</div>}
                    </li>
                  ))}
                </ul>
                </>
              );
            })()}
            {categoryDetailModal === 'none' && (() => {
              const total = todayCategoryDetails.available.length;
              const list = todayCategoryDetails.available.filter((item) => {
                const term = categoryDetailSearch.trim().toLowerCase();
                if (!term) return true;
                const name = (item.trainerName || '').toLowerCase();
                const spec = ((item.trainer && (item.trainer.specialization || item.trainer.skill)) || '').toLowerCase();
                return name.includes(term) || spec.includes(term);
              });
              return list.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">{total === 0 ? 'No available trainers for today.' : 'No matches for your search.'}</p>
              ) : (
                <>
                  {categoryDetailSearch.trim() && (
                    <p className="text-xs text-slate-500 mb-2">Showing {list.length} of {total}</p>
                  )}
                  <ul className="space-y-2">
                  {list.map((item, idx) => (
                    <li key={idx} className="p-3 rounded-lg border border-slate-200 bg-green-50/30 flex items-center justify-between">
                      <span className="font-medium text-slate-900">{item.trainerName}</span>
                      {item.trainer && (item.trainer.specialization || item.trainer.skill) && (
                        <span className="text-sm text-slate-500">{item.trainer.specialization || item.trainer.skill}</span>
                      )}
                    </li>
                  ))}
                </ul>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Matrix View with Responsive Grid */}
      <div className={sidebarCollapsed ? "w-full" : "overflow-x-auto"}>
        <div className={sidebarCollapsed ? "w-full" : "min-w-full"}>
          {/* Header Row */}
          <div className={sidebarCollapsed ? "matrix-grid mb-2" : "matrix-grid-sidebar-visible mb-2"}>
            <div className="sticky-left p-2 text-left font-semibold text-gray-900 min-h-12 flex items-center justify-between">
              <span>Trainer Name</span>
              {bulkSelectMode && (
                <Button
                  onClick={() => {
                    // Select/deselect all visible cells with entries
                    const allCells = [];
                    filteredTrainers.forEach(trainer => {
                      daysArray.forEach(day => {
                        const cellKey = `${trainer.id}-${day}`;
                        const cellData = cellDataMap.get(cellKey);
                        if (cellData && cellData.hasEntries) {
                          allCells.push(`${currentYear}-${currentMonth}-${trainer.id}-${day}`);
                        }
                      });
                    });
                    
                    const allSelected = allCells.every(cell => selectedCells.has(cell));
                    
                    if (allSelected) {
                      setSelectedCells(new Set());
                    } else {
                      setSelectedCells(new Set(allCells));
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  All
                </Button>
              )}
            </div>
            {daysArray.map(day => {
              const dateCells = filteredTrainers.map(trainer => `${currentYear}-${currentMonth}-${trainer.id}-${day}`);
              const allDateSelected = dateCells.every(cell => selectedCells.has(cell));
              const hasScheduledTasks = filteredTrainers.some(trainer => {
                const cellKey = `${trainer.id}-${day}`;
                const cellData = cellDataMap.get(cellKey);
                return cellData && cellData.hasEntries;
              });

              // Get day abbreviation and holiday state (Sundays + named holidays)
              const date = new Date(currentYear, currentMonth, day);
              const dayAbbr = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2);
              const holiday = isHolidayDay(currentYear, currentMonth, day);
              const headerBg = holiday ? 'bg-slate-100 border-b border-slate-200' : '';
              const headerText = holiday ? 'text-slate-700' : 'text-gray-900';
              const dayAbbrText = holiday ? 'text-slate-600 font-semibold' : 'text-gray-600 font-medium';
              
              return (
                <div key={day} className={`p-1 text-center font-medium text-xs ${sidebarCollapsed ? "matrix-cell" : "matrix-cell-sidebar-visible"} relative ${headerBg}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`font-semibold ${headerText}`}>{day}</span>
                    <span className={`text-[10px] ${dayAbbrText}`}>{dayAbbr}</span>
                    {bulkSelectMode && hasScheduledTasks && (
                      <Button
                        onClick={() => selectDateColumn(day)}
                        variant="ghost"
                        size="sm"
                        className={`h-4 w-4 p-0 text-xs ${allDateSelected ? 'bg-red-200' : ''}`}
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trainer Rows */}
          {filteredTrainers.map((trainer, idx) => {
            const trainerCells = daysArray.map(day => `${currentYear}-${currentMonth}-${trainer.id}-${day}`);
            const allTrainerSelected = trainerCells.every(cell => selectedCells.has(cell));
            const hasScheduledTasks = daysArray.some(day => {
              const cellKey = `${trainer.id}-${day}`;
              const cellData = cellDataMap.get(cellKey);
              return cellData && cellData.hasEntries;
            });
            
            return (
              <div key={trainer.id || idx} className={sidebarCollapsed ? "matrix-grid mb-1" : "matrix-grid-sidebar-visible mb-1"}>
                <div className="sticky-left p-2 flex items-center gap-2 min-h-12">
                  {/* Avatar placeholder */}
                  <div className="w-7 h-7 text-sm rounded-full bg-gray-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {trainer.name ? trainer.name[0] : '?'}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <span 
                      className="text-sm font-medium text-gray-900 leading-tight block"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.2'
                      }}
                      title={trainer.name}
                    >
                      {trainer.name}
                    </span>
                  </div>
                  {bulkSelectMode && hasScheduledTasks && (
                    <Button
                      onClick={() => selectTrainerRow(trainer.id)}
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 ${allTrainerSelected ? 'bg-red-200' : ''}`}
                    >
                      <User className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {daysArray.map(day => {
                  const cellKey = `${trainer.id}-${day}`;
                  const cellData = cellDataMap.get(cellKey) || { entries: [], status: 'none', hasEntries: false, tooltipContent: 'No Task Assigned' };
                  const { entries, status, hasEntries, tooltipContent } = cellData;
                  const fullCellKey = `${currentYear}-${currentMonth}-${trainer.id}-${day}`;
                  const isSelected = selectedCells.has(fullCellKey);
                  // On holiday days, show "available" as holiday color; keep training/non-training/leave as-is so admin can assign
                  const holiday = isHolidayDay(currentYear, currentMonth, day);
                  const displayStatus = holiday && status === 'none' ? 'holiday' : status;
                  const displayTooltip = displayStatus === 'holiday' ? 'Holiday' : tooltipContent;
                      
                  return (
                    <div 
                      key={day} 
                      className={`p-1 text-center cursor-pointer hover:bg-muted/20 transition-colors ${sidebarCollapsed ? "matrix-cell" : "matrix-cell-sidebar-visible"} relative ${isSelected ? 'bg-red-200' : ''}`}
                      onClick={() => {
                        if (bulkSelectMode && hasEntries) {
                          toggleCellSelection(trainer.id, day);
                        } else {
                          setSelectedDay(day);
                          setActiveDailyPanel('training');
                        }
                      }}
                    >
                      <Tooltip content={displayTooltip}>
                        <span
                          className={`inline-block rounded-full font-semibold flex items-center justify-center ${STATUS_COLORS[displayStatus]} ${sidebarCollapsed ? "w-7 h-7 text-sm" : "w-9 h-9 text-base"} ${isSelected ? 'ring-2 ring-red-500' : ''}`}
                        >
                          {day}
                        </span>
                      </Tooltip>
                      
                      {bulkSelectMode && hasEntries && (
                        <div className="absolute top-0 right-0 w-3 h-3">
                          {isSelected ? (
                            <CheckSquare className="w-3 h-3 text-red-600" />
                          ) : (
                            <Square className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={!!selectedDay}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDay(null);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] w-full p-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {selectedDay && (
              <motion.div
                key={selectedDay}
                className="flex flex-col max-h-[92vh]"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ type: 'spring', damping: 24, stiffness: 320, mass: 0.9 }}
              >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <DialogHeader className="p-0 space-y-1">
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  {selectedDay
                    ? `Schedule for ${new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
                      })}`
                    : 'Schedule Details'}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Review and manage trainer assignments for the selected date.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search trainers, clients, courses, tasks..."
                  value={dailySearchTerm}
                  onChange={e => setDailySearchTerm(e.target.value)}
                      className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 md:w-80 shadow-sm text-sm"
                />
                {dailySearchTerm && (
                  <button
                    onClick={() => setDailySearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
                  <div className="relative">
              <button
                className={`px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center gap-2 text-sm ${dailyFilterOpen ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : ''}`}
                onClick={() => setDailyFilterOpen(v => !v)}
                type="button"
              >
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700">Filters</span>
                {Object.values(dailyFilterFields).some(field => field) && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </button>
              {dailyFilterOpen && (
                      <div className="absolute right-0 mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-64 animate-fade-in">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900 text-sm">Daily Filters</span>
                  </div>
                    <button 
                      onClick={() => setDailyFilterOpen(false)} 
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Close filters"
                    >
                      <CloseIcon className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-gray-700">Search Fields</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                                onClick={() =>
                                  setDailyFilterFields({
                                    name: true,
                                    client: true,
                                    course: true,
                                    role: true,
                                    taskDetails: true,
                                    taskType: true,
                                    description: true,
                                    specialization: true
                                  })
                                }
                          className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          All
                        </button>
                        <button
                          type="button"
                                onClick={() =>
                                  setDailyFilterFields({
                                    name: false,
                                    client: false,
                                    course: false,
                                    role: false,
                                    taskDetails: false,
                                    taskType: false,
                                    description: false,
                                    specialization: false
                                  })
                                }
                          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                            {[
                              ['name', 'Name'],
                              ['client', 'Client'],
                              ['course', 'Course'],
                              ['role', 'Role'],
                              ['taskDetails', 'Task Details'],
                              ['taskType', 'Task Type'],
                              ['description', 'Description'],
                              ['specialization', 'Tech Stack']
                            ].map(([key, label]) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors"
                              >
                        <input 
                          type="checkbox" 
                                  checked={dailyFilterFields[key]}
                                  onChange={e => setDailyFilterFields(f => ({ ...f, [key]: e.target.checked }))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                                <span className="text-gray-700">{label}</span>
                      </label>
                            ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="font-medium text-xs text-gray-700 mb-2 block">Section Type</span>
                    <div className="space-y-1">
                            {[
                              ['all', 'All Sections'],
                              ['training', 'Training Only'],
                              ['non-training', 'Non-Training Only'],
                              ['leave', 'Leave Only'],
                              ['available', 'Available Only']
                            ].map(([value, label]) => (
                              <label
                                key={value}
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors"
                              >
                        <input 
                          type="radio" 
                          name="dailyFilterType" 
                                  value={value}
                                  checked={dailyFilterType === value}
                                  onChange={() => setDailyFilterType(value)}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        /> 
                                <span className="text-gray-700">{label}</span>
                      </label>
                            ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors font-medium"
                      onClick={() => { 
                        setDailyFilterFields({ 
                                name: true,
                                client: true,
                                course: true,
                                role: true,
                                taskDetails: true,
                                taskType: true,
                                description: true,
                                specialization: true
                        }); 
                        setDailyFilterType('all'); 
                      }}
                      type="button"
                    >
                      Reset All
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors font-medium"
                      onClick={() => setDailyFilterOpen(false)}
                      type="button"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

                <div className="flex flex-wrap gap-2">
                  {["training", "non-training", "leave", "available"].map(key => {
                    const section = dailySections.find(s => s.key === key);
                    return (
                      <div key={key} className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                        {section?.title}: {section?.items.length ?? 0}
                      </div>
                    );
                  })}
                </div>
              </div>

              {(() => {
            const allTaskIds = [
                  ...((trainerCategoriesMemo?.trainingTrainers ?? []).map(e => e.id)),
                  ...((trainerCategoriesMemo?.nonTrainingTrainers ?? []).map(e => e.id)),
                  ...((trainerCategoriesMemo?.leaveTrainers ?? []).map(e => e.id))
            ];
            const allSelected = allTaskIds.length > 0 && allTaskIds.every(id => selectedTaskIds.includes(id));
            return (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={handleBulkDelete} variant="destructive" disabled={selectedTaskIds.length === 0}>
                  Delete Selected ({selectedTaskIds.length})
                </Button>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={e => selectAllForDay(allTaskIds, e.target.checked)}
                    disabled={allTaskIds.length === 0}
                  />
                  Select All
                </label>
              </div>
            );
          })()}

              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dailySections.map(section => (
                  <div key={section.key} className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm h-[60vh]">
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${getBorderStyle(section.accent)}`}>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getDotStyle(section.accent)}`}></span>
                        <span className="text-sm font-semibold text-gray-900">{section.title}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getBadgeStyle(section.accent)}`}>
                        {section.items.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                      {renderDailySectionItems(section)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="md:hidden space-y-3">
                {dailySections.map(section => (
                  <div key={section.key} className="border border-gray-200 rounded-2xl shadow-sm bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setActiveDailyPanel(prev => (prev === section.key ? null : section.key))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getDotStyle(section.accent)}`}></span>
                        <span className="text-sm font-semibold text-gray-900">{section.title}</span>
            </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getBadgeStyle(section.accent)}`}>
                          {section.items.length}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${activeDailyPanel === section.key ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {activeDailyPanel === section.key && (
                      <div className="px-4 pb-4 space-y-3 max-h-[70vh] overflow-y-auto">
                        {renderDailySectionItems(section)}
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.trainers === nextProps.trainers &&
    prevProps.scheduleData === nextProps.scheduleData &&
    prevProps.flattenedScheduleData === nextProps.flattenedScheduleData &&
    prevProps.currentYear === nextProps.currentYear &&
    prevProps.currentMonth === nextProps.currentMonth &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.sidebarCollapsed === nextProps.sidebarCollapsed &&
    JSON.stringify(prevProps.matrixFilters) === JSON.stringify(nextProps.matrixFilters)
  );
});

TrainerMatrixView.displayName = 'TrainerMatrixView';

export default TrainerMatrixView; 