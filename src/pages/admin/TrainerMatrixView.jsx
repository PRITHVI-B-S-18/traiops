import React, { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Search, X as CloseIcon, Trash2, CheckSquare, Square, Calendar, User, AlertTriangle } from 'lucide-react';
import { saveScheduleData } from '../../utils/firestoreSchedule';
import { motion, AnimatePresence } from 'framer-motion';

// Color mapping for statuses with darker, more professional colors
const STATUS_COLORS = {
  training: 'bg-blue-700 text-white',
  nonTraining: 'bg-orange-600 text-white',
  none: 'bg-green-700 text-white',
};

const STATUS_LABELS = {
  training: 'Training Allocated',
  nonTraining: 'Non-Training Task',
  none: 'Available',
};

function pad2(n) {
  return n.toString().padStart(2, '0');
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed
}

function getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters) {
  const dateStr = `${currentYear}-${pad2(currentMonth + 1)}-${pad2(day)}`;
  const currentDate = parseLocalDate(dateStr);

  const allEntries = Object.values(scheduleData).flat();

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

    // 6. Type Filter (training/non-training/available)
    if (matrixFilters.type === 'training' && entry.type !== 'training') {
      return false;
    }
    if (matrixFilters.type === 'non-training' && entry.type !== 'non-training') {
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

const TrainerMatrixView = ({
  trainers,
  scheduleData,
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
  sidebarCollapsed = false,
  toast = () => {},
}) => {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const [selectedDay, setSelectedDay] = useState(null);
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

    // Check if any filters are applied (excluding specialization and search which are handled above)
    const hasActiveFilters = 
      matrixFilters.client.length > 0 ||
      matrixFilters.course.length > 0 ||
      matrixFilters.type !== 'all' ||
      matrixFilters.role !== 'all' ||
      matrixFilters.nonTrainingTaskTypes.length > 0 ||
      (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') ||
      (matrixFilters.endDate && matrixFilters.endDate.trim() !== '');

    // If no filters are applied, show all trainers (including available ones)
    if (!hasActiveFilters) {
      return currentTrainers;
    }

    // Apply ALL matrix filters to determine which trainers should be shown
    // A trainer should only be shown if they have entries that match ALL the selected criteria
    currentTrainers = currentTrainers.filter(trainer => {
      // Check if this trainer has any entries in the current month that match ALL the matrix filters
      const hasMatchingEntries = Object.values(scheduleData).some(entries => {
        return entries.some(entry => {
          // 1. Trainer Name Match
          if (entry.trainer !== trainer.name) return false;

          // 2. Entry's own Date Range Check (within current month)
          const entryDate = parseLocalDate(entry.startDate);
          const currentMonthStart = new Date(currentYear, currentMonth, 1);
          const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
          if (!(entryDate >= currentMonthStart && entryDate <= currentMonthEnd)) return false;

          // 3. Skip "Not Alloted" entries
          if (entry.client === 'Not Alloted' || entry.course === 'Not Alloted' || entry.role === 'Not Alloted') {
            return false;
          }

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

          // 6. Type Filter (training/non-training/available)
          if (matrixFilters.type === 'training' && entry.type !== 'training') {
            return false;
          }
          if (matrixFilters.type === 'non-training' && entry.type !== 'non-training') {
            return false;
          }
          if (matrixFilters.type === 'available') {
            // For available type, we don't want to show any entries (trainers should be available)
            return false;
          }

          // 7. Role Filter (TA/Trainer) - for training entries that have a role
          if (matrixFilters.role !== 'all' && entry.type === 'training') {
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
            if (entryDate < filterStartDate) return false;
          }
          if (matrixFilters.endDate && matrixFilters.endDate.trim() !== '') {
            const filterEndDate = parseLocalDate(matrixFilters.endDate);
            if (entryDate > filterEndDate) return false;
          }

          // If we reach here, this entry matches ALL the matrix filters
          return true;
        });
      });

      // Special handling for 'available' type - show trainers who have NO entries in the current month
      if (matrixFilters.type === 'available') {
        const hasAnyEntriesInMonth = Object.values(scheduleData).some(entries => {
          return entries.some(entry => {
            if (entry.trainer === trainer.name) {
              const entryDate = parseLocalDate(entry.startDate);
              const currentMonthStart = new Date(currentYear, currentMonth, 1);
              const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
              return entryDate >= currentMonthStart && entryDate <= currentMonthEnd;
            }
            return false;
          });
        });
        return !hasAnyEntriesInMonth; // Show trainers who have NO schedules
      }

      return hasMatchingEntries;
    });

    return currentTrainers;
  }, [trainers, matrixFilters, matrixSearchTerm, isMultiSelectMode, selectedTrainers, scheduleData, currentYear, currentMonth]);

  // Helper for daily section search/filter
  const matchesDailySearch = (entryOrTrainer) => {
    const searchTermLower = dailySearchTerm.toLowerCase();
    if (searchTermLower === '') return true;

    // If no filter fields are selected, search in all fields
    const hasActiveFilters = Object.values(dailyFilterFields).some(field => field);
    if (!hasActiveFilters) {
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
  };

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

  // getTrainerCategories function for the three detailed sections
  const getTrainerCategories = (day) => {
    let trainingTrainers = [];
    let nonTrainingTrainers = [];
    const assignedTrainersNames = new Set();

    // Iterate over `filteredTrainers` (trainers passing overall specialization filter)
    filteredTrainers.forEach(trainer => {
      // Get all entries for this specific trainer on the selected day,
      // and ensure these entries also pass the matrixFilters (client, course, type, role, date range)
      const entriesForThisTrainerOnSelectedDay = getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters);

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
        }
      });
    });

    // Determine available trainers from the already specialization-filtered list
    // These are trainers from `filteredTrainers` who are not assigned anything on this specific `day` (after all other filters)
    let availableTrainers = filteredTrainers.filter(trainer => {
      if (assignedTrainersNames.has(trainer.name)) return false;

      // Check if any filters are applied (excluding specialization which is handled in filteredTrainers)
      const hasActiveFilters = 
        matrixFilters.client.length > 0 ||
        matrixFilters.course.length > 0 ||
        matrixFilters.type !== 'all' ||
        matrixFilters.role !== 'all' ||
        matrixFilters.nonTrainingTaskTypes.length > 0 ||
        (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') ||
        (matrixFilters.endDate && matrixFilters.endDate.trim() !== '');

      // If no filters are applied, show all available trainers
      if (!hasActiveFilters) {
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
      availableTrainers = [];
    } else if (dailyFilterType === 'non-training') {
      trainingTrainers = [];
      availableTrainers = [];
    } else if (dailyFilterType === 'available') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
    }

    // Apply overall matrix type filter to sections
    if (matrixFilters.type === 'training') {
      nonTrainingTrainers = [];
      availableTrainers = [];
    } else if (matrixFilters.type === 'non-training') {
      trainingTrainers = [];
      availableTrainers = [];
    } else if (matrixFilters.type === 'available') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
    }

    return {
      trainingTrainers,
      nonTrainingTrainers,
      availableTrainers
    };
  };

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
          const entries = getEntriesForDay(
            filteredTrainers.find(t => t.id === tId), 
            parseInt(day), 
            scheduleData, 
            parseInt(year), 
            parseInt(month), 
            matrixFilters
          );
          if (entries.length > 0) {
            newSelected.add(cellKey);
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
          const entries = getEntriesForDay(
            trainer, 
            parseInt(day), 
            scheduleData, 
            parseInt(year), 
            parseInt(month), 
            matrixFilters
          );
          if (entries.length > 0) {
            newSelected.add(cellKey);
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
    
    selectedCells.forEach(cellKey => {
      const [year, month, trainerId, day] = cellKey.split('-');
      const date = `${year}-${pad2(parseInt(month) + 1)}-${pad2(parseInt(day))}`;
      
      if (newScheduleData[date]) {
        const trainer = filteredTrainers.find(t => t.id === trainerId);
        if (trainer) {
          // Get entries for this trainer on this specific date
          const entriesForTrainer = getEntriesForDay(trainer, parseInt(day), scheduleData, parseInt(year), parseInt(month), matrixFilters);
          
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
    Object.values(scheduleData).flat().forEach(entry => {
      if (entry.client && entry.client !== 'Not Alloted') clients.add(entry.client);
    });
    return Array.from(clients);
  }, [scheduleData]);

  const uniqueDailyCourses = useMemo(() => {
    const courses = new Set();
    Object.values(scheduleData).flat().forEach(entry => {
      if (entry.course && entry.course !== 'Not Alloted') courses.add(entry.course);
    });
    return Array.from(courses);
  }, [scheduleData]);

  // Calculate responsive grid columns based on screen size and compact view


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
            className={`flex items-center gap-2 ${(() => {
              let hasActiveFilters = false;
              // Check array-based filters
              hasActiveFilters = hasActiveFilters || matrixFilters.specialization.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.client.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.course.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.nonTrainingTaskTypes.length > 0;
              // Check radio button filters
              hasActiveFilters = hasActiveFilters || matrixFilters.type !== 'all';
              hasActiveFilters = hasActiveFilters || matrixFilters.role !== 'all';
              // Check date filters
              hasActiveFilters = hasActiveFilters || (matrixFilters.startDate && matrixFilters.startDate.trim() !== '');
              hasActiveFilters = hasActiveFilters || (matrixFilters.endDate && matrixFilters.endDate.trim() !== '');
              return hasActiveFilters;
            })() ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : ''}`}
          >
            <Filter className="h-4 w-4" /> 
            Filters
            {(() => {
              let hasActiveFilters = false;
              // Check array-based filters
              hasActiveFilters = hasActiveFilters || matrixFilters.specialization.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.client.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.nonTrainingTaskTypes.length > 0;
              hasActiveFilters = hasActiveFilters || matrixFilters.course.length > 0;
              // Check radio button filters
              hasActiveFilters = hasActiveFilters || matrixFilters.type !== 'all';
              hasActiveFilters = hasActiveFilters || matrixFilters.role !== 'all';
              // Check date filters
              hasActiveFilters = hasActiveFilters || (matrixFilters.endDate && matrixFilters.endDate.trim() !== '');
              hasActiveFilters = hasActiveFilters || (matrixFilters.startDate && matrixFilters.startDate.trim() !== '');
              return hasActiveFilters;
            })() && (
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </Button>
        </div>
      </div>
      
      {/* Legend for matrix view with enhanced colors */}
      <div className="flex gap-6 mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-6 h-6 rounded-full ${STATUS_COLORS.training} shadow-sm`}></span>
          <span className="text-sm font-medium">{STATUS_LABELS.training}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-6 h-6 rounded-full ${STATUS_COLORS.nonTraining} shadow-sm`}></span>
          <span className="text-sm font-medium">{STATUS_LABELS.nonTraining}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-6 h-6 rounded-full ${STATUS_COLORS.none} shadow-sm`}></span>
          <span className="text-sm font-medium">{STATUS_LABELS.none}</span>
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
                        const entries = getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters);
                        if (entries.length > 0) {
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
                const entries = getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters);
                return entries.length > 0;
              });

              // Get day abbreviation
              const date = new Date(currentYear, currentMonth, day);
              const dayAbbr = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2);
              
              return (
                <div key={day} className={`p-1 text-center font-medium text-xs ${sidebarCollapsed ? "matrix-cell" : "matrix-cell-sidebar-visible"} relative`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-gray-900 font-semibold">{day}</span>
                    <span className="text-[10px] text-gray-600 font-medium">{dayAbbr}</span>
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
              const entries = getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters);
              return entries.length > 0;
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
                  const entries = getEntriesForDay(trainer, day, scheduleData, currentYear, currentMonth, matrixFilters);
                  const status = getStatusForEntries(entries);
                  const cellKey = `${currentYear}-${currentMonth}-${trainer.id}-${day}`;
                  const isSelected = selectedCells.has(cellKey);
                  const hasEntries = entries.length > 0;
                  
                  const tooltipContent = entries.length === 0
                    ? 'No Task Assigned'
                    : (entries[0].type === 'training'
                        ? `🎓 Training Session\n${entries[0].client ? '👥 Client: ' + entries[0].client + '\n' : ''}${entries[0].course ? '📚 Course: ' + entries[0].course + '\n' : ''}${entries[0].role ? '👤 Role: ' + entries[0].role : ''}`
                        : `📋 Non-Training Task\n${entries[0].taskDetails ? '📝 Task: ' + entries[0].taskDetails + '\n' : ''}${entries[0].taskType ? '🏷️ Type: ' + entries[0].taskType + '\n' : ''}${entries[0].description ? '📄 Description: ' + entries[0].description : ''}`
                      );
                      
                  return (
                    <div 
                      key={day} 
                      className={`p-1 text-center cursor-pointer hover:bg-muted/20 transition-colors ${sidebarCollapsed ? "matrix-cell" : "matrix-cell-sidebar-visible"} relative ${isSelected ? 'bg-red-200' : ''}`}
                      onClick={() => {
                        if (bulkSelectMode && hasEntries) {
                          toggleCellSelection(trainer.id, day);
                        } else {
                          setSelectedDay(day);
                        }
                      }}
                    >
                      <Tooltip content={tooltipContent}>
                        <span
                          className={`inline-block rounded-full font-semibold flex items-center justify-center ${STATUS_COLORS[status]} ${sidebarCollapsed ? "w-7 h-7 text-sm" : "w-9 h-9 text-base"} ${isSelected ? 'ring-2 ring-red-500' : ''}`}
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

      {/* Three sections when a day is selected - only in matrix view */}
      {selectedDay && (
        <div className="mt-8 space-y-6">
          {/* Header row with schedule title and search/filter UI right-aligned for daily view */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="text-2xl font-semibold text-gray-800">
              Schedule for {new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="flex items-center gap-3 relative">
              {/* Enhanced Search Input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search trainers, clients, courses, tasks..."
                  value={dailySearchTerm}
                  onChange={e => setDailySearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 md:w-80 max-w-xs shadow-sm text-sm"
                />
                {dailySearchTerm && (
                  <button
                    onClick={() => setDailySearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Enhanced Filter Button */}
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
              
              {/* Enhanced Filter Dropdown - More Compact */}
              {dailyFilterOpen && (
                <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-64 animate-fade-in">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900 text-sm">Daily Filters</span>
                  </div>
                    <button 
                      onClick={() => setDailyFilterOpen(false)} 
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <CloseIcon className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Search Fields Section - Compact */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-gray-700">Search Fields</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDailyFilterFields({
                            name: true, client: true, course: true, role: true,
                            taskDetails: true, taskType: true, description: true, specialization: true
                          })}
                          className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setDailyFilterFields({
                            name: false, client: false, course: false, role: false,
                            taskDetails: false, taskType: false, description: false, specialization: false
                          })}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.name} 
                          onChange={e => setDailyFilterFields(f => ({...f, name: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Name</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.client} 
                          onChange={e => setDailyFilterFields(f => ({...f, client: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Client</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.course} 
                          onChange={e => setDailyFilterFields(f => ({...f, course: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Course</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.role} 
                          onChange={e => setDailyFilterFields(f => ({...f, role: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Role</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.taskDetails} 
                          onChange={e => setDailyFilterFields(f => ({...f, taskDetails: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Task Details</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.taskType} 
                          onChange={e => setDailyFilterFields(f => ({...f, taskType: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Task Type</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.description} 
                          onChange={e => setDailyFilterFields(f => ({...f, description: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Description</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={dailyFilterFields.specialization} 
                          onChange={e => setDailyFilterFields(f => ({...f, specialization: e.target.checked}))}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Specialization</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Section Type Section - Compact */}
                  <div className="mb-4">
                    <span className="font-medium text-xs text-gray-700 mb-2 block">Section Type</span>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="radio" 
                          name="dailyFilterType" 
                          value="all" 
                          checked={dailyFilterType === 'all'} 
                          onChange={() => setDailyFilterType('all')}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">All Sections</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="radio" 
                          name="dailyFilterType" 
                          value="training" 
                          checked={dailyFilterType === 'training'} 
                          onChange={() => setDailyFilterType('training')}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Training Only</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="radio" 
                          name="dailyFilterType" 
                          value="non-training" 
                          checked={dailyFilterType === 'non-training'} 
                          onChange={() => setDailyFilterType('non-training')}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Non-Training Only</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                        <input 
                          type="radio" 
                          name="dailyFilterType" 
                          value="available" 
                          checked={dailyFilterType === 'available'} 
                          onChange={() => setDailyFilterType('available')}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        /> 
                        <span className="text-gray-700">Available Only</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Compact */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors font-medium"
                      onClick={() => { 
                        setDailyFilterFields({ 
                          name: true, client: true, course: true, role: true, 
                          taskDetails: true, taskType: true, description: true, specialization: true 
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
          {/* Bulk Delete Button and Select All for matrix view daily list */}
          {(() => {
            const allTaskIds = [
              ...getTrainerCategories(selectedDay).trainingTrainers.map(e => e.id),
              ...getTrainerCategories(selectedDay).nonTrainingTrainers.map(e => e.id)
            ];
            const allSelected = allTaskIds.length > 0 && allTaskIds.every(id => selectedTaskIds.includes(id));
            return (
              <div className="mb-4 flex items-center gap-4">
                <Button onClick={handleBulkDelete} variant="destructive" disabled={selectedTaskIds.length === 0}>
                  Delete Selected ({selectedTaskIds.length})
                </Button>
                <label className="flex items-center gap-2">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Training Assigned Trainers Section */}
            <div className="bg-white rounded-lg shadow p-4 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 text-blue-600">Training Assigned Trainers</h3>
              <div className="space-y-3">
                {getTrainerCategories(selectedDay).trainingTrainers.map((entry, index) => (
                  <div key={index} className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(entry.id)}
                        onChange={() => toggleTaskSelection(entry.id)}
                      />
                      <div>
                        <p className="font-medium">{entry.trainer}</p>
                        <p className="text-sm text-gray-600">Client: {entry.client}</p>
                        <p className="text-sm text-gray-600">Course: {entry.course}</p>
                        <p className="text-sm text-gray-600">Role: {entry.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => onEditTask(entry, selectedDay)} variant="outline">Edit</Button>
                      <Button onClick={() => onDeleteEntry(entry, selectedDay)} variant="destructive">Delete</Button>
                    </div>
                  </div>
                ))}
                {getTrainerCategories(selectedDay).trainingTrainers.length === 0 && (
                  <p className="text-gray-500 text-sm">No training assignments for this date</p>
                )}
              </div>
            </div>
            {/* Non-Training Task Allocated Trainers Section */}
            <div className="bg-white rounded-lg shadow p-4 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 text-orange-600">Non-Training Task Allocated Trainers</h3>
              <div className="space-y-3">
                {getTrainerCategories(selectedDay).nonTrainingTrainers.map((entry, index) => (
                  <div key={index} className="bg-orange-50 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(entry.id)}
                        onChange={() => toggleTaskSelection(entry.id)}
                      />
                      <div>
                        <p className="font-medium">{entry.trainer}</p>
                        <p className="text-sm text-gray-600">Task: {entry.taskDetails}</p>
                        <p className="text-sm text-gray-600">Type: {entry.taskType}</p>
                        <p className="text-sm text-gray-600">Description: {entry.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => onEditTask(entry, selectedDay)} variant="outline">Edit</Button>
                      <Button onClick={() => onDeleteEntry(entry, selectedDay)} variant="destructive">Delete</Button>
                    </div>
                  </div>
                ))}
                {getTrainerCategories(selectedDay).nonTrainingTrainers.length === 0 && (
                  <p className="text-gray-500 text-sm">No non-training tasks for this date</p>
                )}
              </div>
            </div>
            {/* Available Trainers Section */}
            <div className="bg-white rounded-lg shadow p-4 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 text-green-600">Available Trainers</h3>
              <div className="space-y-3">
                {getTrainerCategories(selectedDay).availableTrainers.map((trainer, index) => (
                  <div key={index} className="bg-green-50 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">{trainer.name}</p>
                      <p className="text-sm text-gray-600">Specialization: {trainer.specialization || 'Not specified'}</p>
                    </div>
                    <Button
                      onClick={() => {
                        onScheduleTask({
                          trainer: { name: trainer.name }, // Pass trainer object with name
                          date: `${currentYear}-${pad2(currentMonth + 1)}-${pad2(selectedDay)}`
                        });
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Schedule Task
                    </Button>
                  </div>
                ))}
                {getTrainerCategories(selectedDay).availableTrainers.length === 0 && (
                  <p className="text-gray-500 text-sm">No available trainers for this date</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerMatrixView; 