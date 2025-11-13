import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Download, Calendar, X, Edit3, PlusCircle, Filter, Search, X as CloseIcon, ChevronDown, ChevronUp, AlertTriangle, Mail, Trash2, ArrowLeft, Users, Clock, BarChart3, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import TrainerMatrixView from './TrainerMatrixView';
import { saveScheduleData, loadScheduleData, subscribeToScheduleUpdates } from '../../utils/firestoreSchedule';
import { loadTrainerData } from '../../utils/firestoreTrainers';
import { useDebounce } from '@/hooks/useDebounce';
import { notifyScheduleCreated, notifyScheduleUpdated, notifyScheduleDeleted, notifyNonTrainingCreated, notifyNonTrainingUpdated, notifyNonTrainingDeleted } from '../../utils/emailService';
import DateRangeSelector from '@/components/DateRangeSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getClientsWithPMs } from '../../utils/firestoreClients';
import { getUsersByRole } from '../../utils/firestoreUsers';
import { cancelPendingRequestsForTask } from '../../utils/firestoreClockRequests';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { cn } from '@/lib/utils';
import { cardStyles, sectionSpacing, cardPadding, getChipClasses } from '@/styles/designSystem';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import { getDatesInRange as getDatesInRangeTZ, convertToUTC, convertFromUTC, getCurrentDateInUserTimezone, isValidDateString, compareDateStrings, formatDateForDisplay } from '@/utils/timezoneUtils';

// Modal animation variants - matching Dialog component animations
const modalVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1]
    } 
  },
  exit: { 
    opacity: 0,
    transition: { 
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1]
    } 
  },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

const modalContentTransition = {
  type: 'spring',
  damping: 18,
  stiffness: 150,
  mass: 1.2,
  duration: 0.5,
};

const scheduleWizardSteps = [
  {
    key: 'type',
    label: 'Task Type',
    description: 'Choose whether this assignment is training or non-training',
  },
  {
    key: 'details',
    label: 'Assignment Details',
    description: 'Fill in trainer, client, course, and description details',
  },
  {
    key: 'dates',
    label: 'Schedule Window',
    description: 'Confirm the date range, excluded dates, and recipients',
  },
];

const allocateWizardSteps = [
  {
    key: 'type',
    label: 'Choose Type',
    description: 'Training vs. non-training with tailored fields',
  },
  {
    key: 'details',
    label: 'Confirm Details',
    description: 'Review trainer, client, and task metadata',
  },
  {
    key: 'notify',
    label: 'Notify Trainer',
    description: 'Control whether an email notification is sent',
  },
];

const WizardSteps = ({ title, steps }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
      <span className="text-xs font-medium text-slate-400">{steps.length} steps</span>
    </div>
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={cn(
            cardStyles.surface,
            'flex flex-col gap-2 border-dashed border-slate-200/80 bg-slate-50/60 p-3'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-slate-700">{step.label}</p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
        </li>
      ))}
    </ol>
  </div>
);

const SchedulePage = () => {
  const { toast } = useToast();
  const { sidebarCollapsed, setCommandState, resetCommandState } = useOutletContext();
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeDailyPanel, setActiveDailyPanel] = useState('training');
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [scheduleType, setScheduleType] = useState('training');
  const [role, setRole] = useState('');
  const [taskType, setTaskType] = useState('Question creation');
  const [trainerList, setTrainerList] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('matrix'); // 'calendar' or 'matrix'
  const [matrixEditContext, setMatrixEditContext] = useState(null);
  const [form, setForm] = useState({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingForm, setEditingForm] = useState({});
  const [originalTaskType, setOriginalTaskType] = useState(null);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [excludedDates, setExcludedDates] = useState([]);
  const [bulkEditDateRange, setBulkEditDateRange] = useState({ startDate: '', endDate: '' });
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editScope, setEditScope] = useState('day'); // 'day' or 'all'
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    format: 'excel',
    dateRange: 'all', // 'all', 'today', 'week', 'month', 'custom'
    customStartDate: '',
    customEndDate: '',
    includeTraining: true,
    includeNonTraining: true,
    taskTypes: {
      training: true,
      nonTraining: true,
      course: true,
      client: true,
      task: true,
      description: true
    },
    showOnlyScheduled: false,
    selectedTrainers: []
  });
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: '',
    endDate: '',
    excludedDates: []
  });
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isMoreTasksModalOpen, setIsMoreTasksModalOpen] = useState(false);
  const [selectedDayTasks, setSelectedDayTasks] = useState({ date: '', tasks: [] });
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterFields, setFilterFields] = useState({
    name: true,
    client: true,
    course: true,
    role: true,
    taskDetails: true,
    taskType: true,
    description: true,
    specialization: true
  });
  const [filterType, setFilterType] = useState('all'); // all, training, non-training, available
  
  // Client state for PM selection
  const [clientsWithPMs, setClientsWithPMs] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPMs, setSelectedPMs] = useState([]); // Selected PM IDs for the task
  const [availablePMs, setAvailablePMs] = useState([]); // PMs available for selected client
  const [allPMs, setAllPMs] = useState([]); // Cache all PMs to avoid repeated fetches
  const [loadingPMs, setLoadingPMs] = useState(false); // Loading state for PMs

  // New state for Matrix View filters
  const [isMatrixFilterModalOpen, setIsMatrixFilterModalOpen] = useState(false);
  const [matrixFilters, setMatrixFilters] = useState({
    specialization: [],
    client: [],
    course: [],
    startDate: '',
    endDate: '',
    type: 'all', // all, training, non-training
    role: 'all', // all, TA, Trainer
    nonTrainingTaskTypes: [], // For non-training task type filters
  });

  const resolveClientName = useCallback(
    (clientValue, fallbackText = '') => {
      const valuesToCheck = [];
      if (clientValue) valuesToCheck.push(clientValue);
      if (fallbackText) valuesToCheck.push(fallbackText);

      const attemptMatch = (candidate) => {
        if (!candidate) return null;
        const normalized = typeof candidate === 'string' ? candidate.trim() : candidate;
        if (!normalized) return null;

        const directMatch = clientsWithPMs.find(
          (client) => client.clientId === normalized || client.name === normalized
        );
        if (directMatch) {
          return directMatch.name;
        }

        if (typeof normalized === 'string') {
          const stripped = normalized.split('(')[0].trim();
          if (stripped && stripped !== normalized) {
            const strippedMatch = clientsWithPMs.find((client) => client.name === stripped);
            if (strippedMatch) {
              return strippedMatch.name;
            }
          }
        }

        return typeof normalized === 'string' && normalized.length > 0 ? normalized : null;
      };

      for (const value of valuesToCheck) {
        const match = attemptMatch(value);
        if (match) {
          return match;
        }
      }

      return 'N/A';
    },
    [clientsWithPMs]
  );

  const fileInputRef = useRef(null);
  const [isTrainerDropdownOpen, setIsTrainerDropdownOpen] = useState(false);
  const [trainerSearchTerm, setTrainerSearchTerm] = useState('');
  const trainerTriggerRef = useRef(null);
  const trainerDropdownContentRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  // Email notification preferences (default: true - send emails)
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true);
  const [sendEmailOnUpdate, setSendEmailOnUpdate] = useState(true);
  const [sendEmailOnDelete, setSendEmailOnDelete] = useState(true);

  // Async confirm dialog state (for conflicts)
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    content: '',
    okText: 'OK',
    cancelText: 'Cancel',
    resolve: null,
  });

  const showConfirm = (title, content, okText = 'OK', cancelText = 'Cancel') =>
    new Promise((resolve) => {
      setConfirmState({ open: true, title, content, okText, cancelText, resolve });
    });

  const handleConfirmOk = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  const handleConfirmCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  // Memoize flattened schedule data to avoid recalculating on every render
  const flattenedScheduleData = useMemo(() => {
    return Object.values(scheduleData).flat();
  }, [scheduleData]);

  const uniqueClients = useMemo(() => {
    const clients = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.client && entry.client !== 'Not Alloted') clients.add(entry.client);
    });
    return Array.from(clients);
  }, [flattenedScheduleData]);

  const uniqueCourses = useMemo(() => {
    const courses = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.course && entry.course !== 'Not Alloted') courses.add(entry.course);
    });
    return Array.from(courses);
  }, [flattenedScheduleData]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const newScheduleData = { ...scheduleData };
        // Training Schedule summary sheet
        if (workbook.SheetNames.includes('Training Schedule')) {
          const trainingSheet = workbook.Sheets['Training Schedule'];
          const trainingData = XLSX.utils.sheet_to_json(trainingSheet);
          trainingData.forEach(row => {
            const trainerName = row['Trainer Name'];
            if (!trainerName) return;
            Object.entries(row).forEach(([key, value]) => {
              if (key === 'Trainer Name') return;
              // value format: client-course-role or Not Alloted
              if (!newScheduleData[key]) newScheduleData[key] = [];
              if (value && value !== 'Not Alloted') {
                const [client, course, role] = value.split('-');
                newScheduleData[key].push({
                  trainer: trainerName,
                  type: 'training',
                  startDate: key,
                  endDate: key,
                  client: client || '',
                  course: course || '',
                  role: role || '',
                  id: Date.now() + Math.random()
                });
              }
            });
          });
        }
        // Non-Training Schedule summary sheet
        if (workbook.SheetNames.includes('Non-Training Schedule')) {
          const nonTrainingSheet = workbook.Sheets['Non-Training Schedule'];
          const nonTrainingData = XLSX.utils.sheet_to_json(nonTrainingSheet);
          nonTrainingData.forEach(row => {
            const trainerName = row['Trainer Name'];
            if (!trainerName) return;
            Object.entries(row).forEach(([key, value]) => {
              if (key === 'Trainer Name') return;
              // value format: taskType-taskDetails or Not Alloted
              if (!newScheduleData[key]) newScheduleData[key] = [];
              if (value && value !== 'Not Alloted') {
                const [taskType, taskDetails] = value.split('-');
                newScheduleData[key].push({
                  trainer: trainerName,
                  type: 'non-training',
                  startDate: key,
                  endDate: key,
                  taskType: taskType || '',
                  taskDetails: taskDetails || '',
                  description: '',
                  id: Date.now() + Math.random()
                });
              }
            });
          });
        }
        setScheduleData(newScheduleData);
        saveScheduleData(newScheduleData);
        toast({ 
          title: "Success", 
          description: "Summary Excel data imported successfully. Both training and non-training schedules have been updated." 
        });
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ 
          title: "Error", 
          description: "Failed to parse Excel file. Please ensure it matches the summary format.", 
          variant: "destructive" 
        });
      }
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const downloadSampleExcel = useCallback(() => {
    // Sample dates for the next few days
    const sampleDates = [
      '2025-06-23',
      '2025-06-24',
      '2025-06-25',
      '2025-06-26',
      '2025-06-27',
      '2025-06-28',
      '2025-06-29',
      '2025-06-30'
    ];
    // Sample trainers
    const sampleTrainers = [
      'Trainer 1',
      'Trainer 2',
      'Trainer 3'
    ];
    // Training summary sheet
    const trainingHeaders = ['Trainer Name', ...sampleDates];
    const trainingRows = sampleTrainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      sampleDates.forEach((date, idx) => {
        // Example: leave one day as Not Alloted
        row[date] = (trainerName === 'Trainer 1' && date === '2025-06-29') ? 'Not Alloted' : 'VIT-DSA-TA';
      });
      return row;
    });
    // Non-training summary sheet
    const nonTrainingHeaders = ['Trainer Name', ...sampleDates];
    const nonTrainingRows = sampleTrainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      sampleDates.forEach((date, idx) => {
        row[date] = (trainerName === 'Trainer 2' && date === '2025-06-28') ? 'Not Alloted' : 'QC-Review';
      });
      return row;
    });
    // Create workbook with both summary sheets
    const workbook = XLSX.utils.book_new();
    const trainingSheet = XLSX.utils.json_to_sheet(trainingRows, { header: trainingHeaders });
    const nonTrainingSheet = XLSX.utils.json_to_sheet(nonTrainingRows, { header: nonTrainingHeaders });
    XLSX.utils.book_append_sheet(workbook, trainingSheet, 'Training Schedule');
    XLSX.utils.book_append_sheet(workbook, nonTrainingSheet, 'Non-Training Schedule');
    XLSX.writeFile(workbook, 'SampleTrainerScheduleSummary.xlsx');
    toast({ title: "Success", description: "Sample summary Excel file downloaded (matches export summary format)." });
  }, [toast]);

  const downloadAllData = () => {
    // Get all unique dates from scheduleData
    // Convert UTC dates to user timezone for Excel export display
    const allDates = new Set();
    Object.entries(scheduleData).forEach(([utcDate, entries]) => {
      entries.forEach(entry => {
        if (entry.startDate && entry.endDate) {
          // Entry dates are in UTC, convert to user timezone for display
          const dates = getDatesInRangeTZ(entry.startDate, entry.endDate);
          dates.forEach(utcDateStr => {
            const userTimezoneDate = convertFromUTC(utcDateStr);
            allDates.add(userTimezoneDate);
          });
        } else {
          // Convert UTC date key to user timezone
          const userTimezoneDate = convertFromUTC(utcDate);
          allDates.add(userTimezoneDate);
        }
      });
    });
    const dates = Array.from(allDates).sort();

    // Get all unique trainers
    const trainers = getAllUniqueTrainers();

    // Helper to get entry by type and date range
    // date is in user timezone, need to convert to UTC for comparison with scheduleData
    const getEntry = (date, trainerName, type) => {
      const dateUTC = convertToUTC(date);
      return Object.entries(scheduleData).find(([_, entries]) => {
        return entries.some(e => 
          e.trainer === trainerName && 
          e.type === type && 
          dateUTC >= e.startDate && 
          dateUTC <= e.endDate
        );
      })?.[1]?.find(e => e.trainer === trainerName && e.type === type);
    };

    // Build Training Schedule sheet
    const trainingHeaders = [
      'Trainer Name',
      ...dates.flatMap(date => [
        `${date} - Course`,
        `${date} - Client`,
        `${date} - TA/Trainer`,
        `${date} - Description`
      ])
    ];
    const trainingRows = trainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      dates.forEach(date => {
        const entry = getEntry(date, trainerName, 'training');
        row[`${date} - Course`] = entry ? (entry.course || 'Not Alloted') : 'Not Alloted';
        row[`${date} - Client`] = entry ? (entry.client || 'Not Alloted') : 'Not Alloted';
        row[`${date} - TA/Trainer`] = entry ? (entry.role || 'Not Alloted') : 'Not Alloted';
        row[`${date} - Description`] = entry ? (entry.description || 'Not Alloted') : 'Not Alloted';
      });
      return row;
    });

    // Build Non-Training Schedule sheet
    const nonTrainingHeaders = [
      'Trainer Name',
      ...dates.flatMap(date => [
        `${date} - Task`,
        `${date} - Type`,
        `${date} - Description`
      ])
    ];
    const nonTrainingRows = trainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      dates.forEach(date => {
        const entry = getEntry(date, trainerName, 'non-training');
        row[`${date} - Task`] = entry ? (entry.taskDetails || 'Not Alloted') : 'Not Alloted';
        row[`${date} - Type`] = entry ? (entry.taskType || 'Not Alloted') : 'Not Alloted';
        row[`${date} - Description`] = entry ? (entry.description || 'Not Alloted') : 'Not Alloted';
      });
      return row;
    });

    // Write to Excel with two sheets
    const trainingSheet = XLSX.utils.json_to_sheet(trainingRows, { header: trainingHeaders });
    const nonTrainingSheet = XLSX.utils.json_to_sheet(nonTrainingRows, { header: nonTrainingHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, trainingSheet, 'Training Schedule');
    XLSX.utils.book_append_sheet(workbook, nonTrainingSheet, 'Non-Training Schedule');
    XLSX.writeFile(workbook, 'TrainerSchedule.xlsx');
    toast({ title: "Success", description: "Schedule data exported with separate sheets for training and non-training." });
  };
  
  // Replace the useEffect for loading schedule data with real-time subscription
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const unsubscribe = subscribeToScheduleUpdates((data) => {
      // Only update state if component is still mounted to prevent memory leaks
      if (isMounted) {
        setScheduleData(data || {});
        setLoading(false);
      }
    });

    // Cleanup subscription on component unmount
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        trainerTriggerRef.current && !trainerTriggerRef.current.contains(event.target) &&
        trainerDropdownContentRef.current && !trainerDropdownContentRef.current.contains(event.target)
        ) {
        setIsTrainerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load trainer list, clients, and all PMs from Firestore (upfront to avoid delays)
  useEffect(() => {
    async function fetchData() {
      const [trainersData, clientsData, pmsData] = await Promise.all([
        loadTrainerData(),
        getClientsWithPMs(),
        getUsersByRole('program_manager') // Load all PMs upfront
      ]);
      setTrainerList(trainersData || []);
      setClientsWithPMs(clientsData || []);
      setAllPMs(pmsData || []); // Cache all PMs for instant filtering
    }
    fetchData();
  }, []);


  // Update available PMs when client is selected (instant - uses cached PMs)
  useEffect(() => {
    if (selectedClient && allPMs.length > 0) {
      const client = clientsWithPMs.find(c => c.clientId === selectedClient);
      if (client && client.programManagerIds && client.programManagerIds.length > 0) {
        // Filter from cached PMs (instant, no API call)
        const available = allPMs.filter(pm => {
          const pmId = pm.uid || pm.id;
          return client.programManagerIds.includes(pmId);
        });
        setAvailablePMs(available);
        // Auto-select all PMs by default (user can deselect if needed)
        setSelectedPMs(client.programManagerIds);
      } else {
        setAvailablePMs([]);
        setSelectedPMs([]);
      }
    } else {
      setAvailablePMs([]);
      setSelectedPMs([]);
    }
  }, [selectedClient, clientsWithPMs, allPMs]);

  // Filter active trainers only
  const activeTrainers = useMemo(() => {
    return trainerList.filter(trainer => trainer.status !== 'Inactive');
  }, [trainerList]);

  // Use memo to get unique specializations, clients, and courses for filter options
  const uniqueSpecializations = useMemo(() => {
    const specs = new Set();
    activeTrainers.forEach(trainer => {
      const addSpecializations = (specializationString) => {
        if (specializationString) {
          // Split by comma, then trim and filter empty strings
          specializationString.split(/\s*,\s*/).forEach(spec => {
            const trimmedSpec = spec.trim();
            if (trimmedSpec) {
              specs.add(trimmedSpec.toLowerCase()); // Convert to lowercase before adding to Set
            }
          });
        }
      };
      addSpecializations(trainer.specialization);
      addSpecializations(trainer.skill);
    });
    // Convert to array, sort, and convert to title case for consistent display
    return Array.from(specs).sort((a, b) => a.localeCompare(b)).map(spec => {
      if (spec.length === 0) return spec;
      return spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase();
    });
  }, [activeTrainers]);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  // Helper to parse YYYY-MM-DD as local date
  function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Helper to get all dates between two dates (inclusive)
  function getDatesInRange(start, end) {
    const arr = [];
    let dt = parseLocalDate(start);
    const endDt = parseLocalDate(end);
    while (dt <= endDt) {
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      arr.push(dateStr);
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  }

  // Build a set of all dates that have any schedule - memoized
  // Convert UTC dates to user timezone for calendar display
  const scheduledDates = useMemo(() => {
    const dates = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.startDate && entry.endDate) {
        // Entry dates are in UTC, convert to user timezone for display
        getDatesInRange(entry.startDate, entry.endDate).forEach(utcDateStr => {
          const userTimezoneDate = convertFromUTC(utcDateStr);
          dates.add(userTimezoneDate);
        });
      }
    });
    return dates;
  }, [flattenedScheduleData]);

  const handleDateClick = useCallback((day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      setActiveDailyPanel('training');
    }
  }, [selectedDate]);

  // Memoize search function to avoid recreating on every render
  const matchesSearch = useCallback((entryOrTrainer) => {
    // If no search term, return true (no filtering)
    if (!debouncedSearchTerm.trim()) return true;
    
    // If no filter fields are selected, search in all fields
    const hasActiveFilters = Object.values(filterFields).some(field => field);
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
      return allFields.some(f => f && f.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
    }
    
    // Search only in selected fields
    const fields = [];
    if (filterFields.name) fields.push(entryOrTrainer.trainer || entryOrTrainer.name || '');
    if (filterFields.client) fields.push(entryOrTrainer.client || '');
    if (filterFields.course) fields.push(entryOrTrainer.course || '');
    if (filterFields.role) fields.push(entryOrTrainer.role || '');
    if (filterFields.taskDetails) fields.push(entryOrTrainer.taskDetails || '');
    if (filterFields.taskType) fields.push(entryOrTrainer.taskType || '');
    if (filterFields.description) fields.push(entryOrTrainer.description || '');
    if (filterFields.specialization) fields.push(entryOrTrainer.specialization || entryOrTrainer.skill || '');
    
    return fields.some(f => f && f.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
  }, [debouncedSearchTerm, filterFields]);

  // Memoize getTrainerCategories to avoid recalculating on every render
  const getTrainerCategories = useCallback((dateStr) => {
    // Convert selected date (user timezone) to UTC for comparison with scheduleData (stored in UTC)
    const dateStrUTC = convertToUTC(dateStr);
    const trainersForDate = flattenedScheduleData.filter(entry => {
      if (!entry.startDate || !entry.endDate) return false;
      // Entry dates are in UTC, compare with converted date
      return dateStrUTC >= entry.startDate && dateStrUTC <= entry.endDate;
    });
    const assignedTrainers = new Set();
    let trainingTrainers = trainersForDate.filter(entry => {
      if (entry.type === 'training' && entry.client !== 'Not Alloted') {
        assignedTrainers.add(entry.trainer);
        return matchesSearch(entry);
      }
      return false;
    });
    let nonTrainingTrainers = trainersForDate.filter(entry => {
      if (entry.type === 'non-training' && entry.taskDetails && entry.taskDetails !== 'Not Alloted') {
        assignedTrainers.add(entry.trainer);
        return matchesSearch(entry);
      }
      return false;
    });
    let availableTrainers = [
      ...activeTrainers.filter(trainer => !assignedTrainers.has(trainer.name) && matchesSearch(trainer)),
      ...trainersForDate.filter(entry => 
        (entry.client === 'Not Alloted' || 
        entry.course === 'Not Alloted' || 
        entry.role === 'Not Alloted') && matchesSearch(entry)
      ).map(entry => ({
        name: entry.trainer,
        specialization: entry.skill || 'Not specified'
      }))
    ];
    // Filter by section type
    if (filterType === 'training') {
      nonTrainingTrainers = [];
      availableTrainers = [];
    } else if (filterType === 'non-training') {
      trainingTrainers = [];
      availableTrainers = [];
    } else if (filterType === 'available') {
      trainingTrainers = [];
      nonTrainingTrainers = [];
    }
    return {
      trainingTrainers,
      nonTrainingTrainers,
      availableTrainers
    };
  }, [flattenedScheduleData, matchesSearch, activeTrainers, filterType]);

  const selectedTrainerCategories = useMemo(() => {
    if (!selectedDate) {
      return {
        trainingTrainers: [],
        nonTrainingTrainers: [],
        availableTrainers: []
      };
    }
    return getTrainerCategories(selectedDate);
  }, [selectedDate, getTrainerCategories]);

  const startEditTask = (entry, date) => {
    console.log('startEditTask Debug:', { entry, date });
    
    setIsAllocateModalOpen(false);
    setEditingTask({ ...entry, date });
    setEditingForm({ ...entry, type: entry.type }); // Ensure type is explicitly set
    setOriginalTaskType(entry.type); // Store the original task type
    
    console.log('Setting originalTaskType to:', entry.type);
    
    setIsBulkEditMode(false);
    setExcludedDates([]);
    // Initialize bulk edit range with the original entry's date range
    setBulkEditDateRange({ startDate: entry.startDate, endDate: entry.endDate || entry.startDate });
    setIsEditModalOpen(true);
  };

  const cancelEditTask = () => {
    setIsEditModalOpen(false);
    setEditingTask(null);
    setEditingForm({});
    setOriginalTaskType(null);
    setIsBulkEditMode(false);
    setExcludedDates([]);
    setBulkEditDateRange({ startDate: '', endDate: '' });
    setSendEmailOnUpdate(true); // Reset to default
  };

  const saveEditTask = async (e) => {
    e.preventDefault();
    
    // Ensure the task type is always the original type (since radio buttons are disabled)
    console.log('Type Debug:', {
      originalTaskType,
      editingFormType: editingForm.type,
      editingTaskType: editingTask.type
    });
    
    // Fallback to editingTask.type if originalTaskType is null/undefined
    const taskType = originalTaskType || editingTask.type || editingForm.type;
    const finalEditingForm = { ...editingForm, type: taskType };
    
    const { id } = editingTask;
    const newScheduleData = { ...scheduleData };

    if (isBulkEditMode) {
      // Bulk edit mode - update multiple days
      
      console.log('Bulk Edit Debug:', {
        originalTaskType,
        editingForm,
        finalEditingForm,
        bulkEditDateRange,
        excludedDates,
        editingTask
      });
      
      // First, remove the original entry from its original date(s)
      const originalStartDate = editingTask.startDate;
      const originalEndDate = editingTask.endDate || editingTask.startDate;
      
      // Remove from original date range
      console.log('Removing original entry with ID:', id);
      for (let d = new Date(originalStartDate); d <= new Date(originalEndDate); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (newScheduleData[dateStr]) {
          console.log(`Before removal on ${dateStr}:`, newScheduleData[dateStr]);
          
          // First try to remove by ID
          let removed = false;
          newScheduleData[dateStr] = newScheduleData[dateStr].filter(e => {
            if (e.id === id) {
              console.log(`Removing entry by ID:`, e);
              removed = true;
              return false;
            }
            return true;
          });
          
          // If not removed by ID, try to remove by trainer and type match
          if (!removed) {
            console.log('Entry not found by ID, trying to remove by trainer/type match');
            newScheduleData[dateStr] = newScheduleData[dateStr].filter(e => {
              if (e.trainer === editingTask.trainer && e.type === editingTask.type) {
                console.log(`Removing entry by trainer/type match:`, e);
                return false;
              }
              return true;
            });
          }
          
          console.log(`After removal on ${dateStr}:`, newScheduleData[dateStr]);
        }
      }
      
      // Now add the updated entry to the new date range
      const startDate = new Date(bulkEditDateRange.startDate);
      // Validate date range
      if (!isValidDateString(bulkEditDateRange.startDate) || !isValidDateString(bulkEditDateRange.endDate)) {
        toast({ 
          title: 'Error', 
          description: 'Invalid date range. Please select valid dates.', 
          variant: "destructive" 
        });
        return;
      }

      // Compare dates to ensure start <= end
      const dateComparison = compareDateStrings(bulkEditDateRange.startDate, bulkEditDateRange.endDate);
      if (dateComparison > 0) {
        toast({ 
          title: 'Error', 
          description: 'Start date must be before or equal to end date.', 
          variant: "destructive" 
        });
        return;
      }

      // Use timezone-aware date range function
      // Dates from DateRangeSelector are in user's timezone, convert to UTC for storage
      const startDateUTC = convertToUTC(bulkEditDateRange.startDate);
      const endDateUTC = convertToUTC(bulkEditDateRange.endDate);
      
      // Generate all dates in range (returns UTC dates)
      const allDatesInRange = getDatesInRangeTZ(startDateUTC, endDateUTC);
      
      // Filter out excluded dates (excluded dates should also be in UTC)
      const excludedDatesUTC = excludedDates.map(date => convertToUTC(date));
      const datesToUpdate = allDatesInRange.filter(dateStr => !excludedDatesUTC.includes(dateStr));

      // Add updated entries to new dates
      console.log('Dates to update:', datesToUpdate);
      
      datesToUpdate.forEach(dateStr => {
        if (!newScheduleData[dateStr]) {
          newScheduleData[dateStr] = [];
        }
        
        // Add updated entry with new ID for each date
        const updatedEntry = {
          ...finalEditingForm,
          startDate: dateStr,
          endDate: dateStr,
          id: Date.now() + Math.random() // Generate new ID for each entry
        };
        console.log(`Adding entry for ${dateStr}:`, updatedEntry);
        newScheduleData[dateStr].push(updatedEntry);
      });

      toast({ 
        title: 'Bulk Update Success', 
        description: `Task updated for ${datesToUpdate.length} days successfully.` 
      });
    } else {
      // Single day edit mode - update only the specific day
      // Use the entry's startDate if available, otherwise use editingTask.date
      const dateStr = editingTask.startDate || editingTask.date;
      console.log('Single day edit debug:', {
        dateStr,
        id,
        finalEditingForm,
        existingEntries: newScheduleData[dateStr],
        editingTaskStartDate: editingTask.startDate,
        editingTaskDate: editingTask.date
      });
      
      if (newScheduleData[dateStr]) {
        newScheduleData[dateStr] = newScheduleData[dateStr].map(e => {
          if (e.id === id) {
            console.log('Updating entry:', e, 'with:', finalEditingForm);
            return { ...e, ...finalEditingForm };
          }
          return e;
        });
      } else {
        console.error('No schedule data found for date:', dateStr);
        console.log('Available dates:', Object.keys(newScheduleData));
      }
      toast({ title: 'Success', description: 'Task updated successfully.' });
    }

    setScheduleData(newScheduleData);
    // Firestore save in background - don't block UI
    saveScheduleData(newScheduleData).catch(err => {
      console.error('Error saving schedule data:', err);
      toast({ 
        title: 'Warning', 
        description: 'Failed to save to database. Please try again.',
        variant: "destructive"
      });
    });
    
    // Send email notification for updates
    try {
      if (isBulkEditMode) {
        // For bulk updates, send email for the first updated entry as an example
        const sampleEntry = {
          trainer: finalEditingForm.trainer,
          startDate: bulkEditDateRange.startDate,
          endDate: bulkEditDateRange.endDate,
          client: resolveClientName(
            finalEditingForm.clientId || finalEditingForm.client,
            finalEditingForm.client
          ),
          course: finalEditingForm.course || 'N/A',
          role: finalEditingForm.role || 'N/A',
          taskDetails: finalEditingForm.taskDetails || 'N/A',
          taskType: finalEditingForm.taskType || 'N/A',
          description: finalEditingForm.description || 'N/A',
          excludedDates: excludedDates
        };
        
        // Use the actual type from finalEditingForm since originalTaskType might be null
        console.log('Bulk edit email notification debug:', {
          finalEditingFormType: finalEditingForm.type,
          sampleEntry,
          willSendTrainingEmail: finalEditingForm.type === 'training'
        });
        
        if (sendEmailOnUpdate) {
          if (finalEditingForm.type === 'training') {
            await notifyScheduleUpdated(sampleEntry);
          } else {
            await notifyNonTrainingUpdated(sampleEntry);
          }
        }
      } else {
        // For single day updates
        // Ensure we have a valid date - use the original entry's startDate or the editingTask date
        const validStartDate = finalEditingForm.startDate || editingTask.startDate || editingTask.date;
        const validEndDate = finalEditingForm.endDate || editingTask.endDate || editingTask.date;
        
        const updatedEntry = {
          trainer: finalEditingForm.trainer,
          startDate: validStartDate,
          endDate: validEndDate,
          client: resolveClientName(
            finalEditingForm.clientId || finalEditingForm.client,
            finalEditingForm.client
          ),
          course: finalEditingForm.course || 'N/A',
          role: finalEditingForm.role || 'N/A',
          taskDetails: finalEditingForm.taskDetails || 'N/A',
          taskType: finalEditingForm.taskType || 'N/A',
          description: finalEditingForm.description || 'N/A',
          excludedDates: []
        };
        
        // Use the actual type from finalEditingForm since originalTaskType might be null
        console.log('Email notification debug:', {
          finalEditingFormType: finalEditingForm.type,
          updatedEntry,
          willSendTrainingEmail: finalEditingForm.type === 'training'
        });
        
        if (sendEmailOnUpdate) {
          if (finalEditingForm.type === 'training') {
            await notifyScheduleUpdated(updatedEntry);
          } else {
            await notifyNonTrainingUpdated(updatedEntry);
          }
        }
      }
      
      if (sendEmailOnUpdate) {
        toast({ 
          title: 'Success', 
          description: `${isBulkEditMode ? 'Bulk update' : 'Task update'} completed and email notification sent.` 
        });
      } else {
        toast({ 
          title: 'Success', 
          description: `${isBulkEditMode ? 'Bulk update' : 'Task update'} completed.` 
        });
      }
    } catch (emailError) {
      if (sendEmailOnUpdate) {
        console.error('Error sending email notification:', emailError);
        toast({ 
          title: 'Success', 
          description: `${isBulkEditMode ? 'Bulk update' : 'Task update'} completed. (Email notification failed)` 
        });
      } else {
        toast({ 
          title: 'Success', 
          description: `${isBulkEditMode ? 'Bulk update' : 'Task update'} completed.` 
        });
      }
    }
    
    setIsEditModalOpen(false);
    setEditingTask(null);
    setEditingForm({});
    setIsBulkEditMode(false);
    setExcludedDates([]);
    setBulkEditDateRange({ startDate: '', endDate: '' });
    setSendEmailOnUpdate(true); // Reset to default
  };

  const openAllocateModal = (prefilledDate = null) => {
    setIsEditModalOpen(false);
    if (prefilledDate) {
      setSelectedDate(prefilledDate);
      // Initialize selectedDateRange with the prefilled date
      setSelectedDateRange({
        startDate: prefilledDate,
        endDate: prefilledDate,
        excludedDates: []
      });
    }
    setIsAllocateModalOpen(true);
  };

  const handleAllocateTraining = async (e) => {
    e.preventDefault();
    const form = e.target;
    let newEntry;
    
    // Check if date range is selected
    if (!selectedDateRange || !selectedDateRange.startDate || !selectedDateRange.endDate) {
      toast({ 
        title: 'Error', 
        description: 'Please select a date range', 
        variant: "destructive" 
      });
      return;
    }
    
    // Normalize trainer name
    const selectedTrainerObj = trainerList.find(t => t.name === selectedTrainer);
    const trainerName = selectedTrainerObj ? selectedTrainerObj.name : selectedTrainer;
    
    let clientDisplayName = 'N/A';
    
    if (scheduleType === 'training') {
      // Get selected client and PMs
      const clientId = selectedClient || form.client.value;
      const client = clientsWithPMs.find(c => c.clientId === clientId);
      const clientOptionText =
        form.client?.options?.[form.client.selectedIndex]?.text || '';
      clientDisplayName = client?.name || resolveClientName(clientId, clientOptionText);
      
      // Validate PM selection
      if (selectedPMs.length === 0) {
        toast({ 
          title: 'Error', 
          description: 'Please select at least one Program Manager', 
          variant: "destructive" 
        });
        return;
      }
      
      newEntry = {
        startDate: selectedDateRange.startDate,
        endDate: selectedDateRange.endDate,
        trainer: trainerName,
        role: form.role.value,
        client: clientDisplayName,
        clientId: client?.clientId || null,
        course: form.course.value,
        description: form.description.value,
        type: 'training',
        id: Date.now(),
        excludedDates: selectedDateRange.excludedDates || [],
        // Use selected PMs (not all PMs of client)
        assignedPMIds: selectedPMs
      };
    } else {
      newEntry = {
        startDate: selectedDateRange.startDate,
        endDate: selectedDateRange.endDate,
        trainer: trainerName,
        taskDetails: form.taskDetails.value,
        description: form.description.value,
        taskType: form.taskType.value,
        type: 'non-training',
        id: Date.now(),
        excludedDates: selectedDateRange.excludedDates || []
      };
    }
    // Debug log
    console.log('Allocated entry:', newEntry);
    
    // Validate date range
    if (!isValidDateString(selectedDateRange.startDate) || !isValidDateString(selectedDateRange.endDate)) {
      toast({ 
        title: 'Error', 
        description: 'Invalid date range. Please select valid dates.', 
        variant: "destructive" 
      });
      return;
    }

    // Compare dates to ensure start <= end
    const dateComparison = compareDateStrings(selectedDateRange.startDate, selectedDateRange.endDate);
    if (dateComparison > 0) {
      toast({ 
        title: 'Error', 
        description: 'Start date must be before or equal to end date.', 
        variant: "destructive" 
      });
      return;
    }
    
    // Convert dates to UTC for storage (dates from DateRangeSelector are in user's timezone)
    const startDateUTC = convertToUTC(selectedDateRange.startDate);
    const endDateUTC = convertToUTC(selectedDateRange.endDate);
    
    // Generate dates in range (returns UTC dates)
    const dates = getDatesInRangeTZ(startDateUTC, endDateUTC);
    
    // Convert excluded dates to UTC for comparison
    const excludedDatesUTC = (selectedDateRange.excludedDates || []).map(date => convertToUTC(date));
    const validDates = dates.filter(dateStr => !excludedDatesUTC.includes(dateStr));
    
    // Update entry dates to UTC for storage
    newEntry.startDate = startDateUTC;
    newEntry.endDate = endDateUTC;
    newEntry.excludedDates = excludedDatesUTC;
    
    if (validDates.length === 0) {
      toast({ 
        title: 'Error', 
        description: 'No valid dates selected after excluding dates', 
        variant: "destructive" 
      });
      return;
    }
    
    // Prepare entries without mutating existing state
    const newScheduleData = Object.fromEntries(
      Object.entries(scheduleData).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
    );
    let conflicts = [];
    const pendingAddsByDate = {};

    validDates.forEach(date => {
      const existingEntries = (scheduleData[date] || []);
      const hasConflict = existingEntries.some(entry => entry.trainer === trainerName);
      
      if (hasConflict) {
        conflicts.push(date);
      } else {
        const entryForDate = {
          ...newEntry,
          startDate: date,
          endDate: date,
          id: Date.now() + Math.random()
        };
        pendingAddsByDate[date] = [ ...(pendingAddsByDate[date] || []), entryForDate ];
      }
    });
    
    if (conflicts.length > 0) {
      const freeDates = validDates.filter(d => !conflicts.includes(d));
      if (freeDates.length === 0) {
        await showConfirm(
          'Complete Scheduling Conflict',
          `${trainerName} is already assigned tasks on all selected dates (${conflicts.join(', ')}).`
        );
        return;
      }
      const userChoice = await showConfirm(
        'Scheduling Conflict Detected!',
        `Trainer: ${trainerName}\n` +
        `Conflicting dates: ${conflicts.join(', ')}\n` +
        `Available dates: ${freeDates.join(', ')}\n\n` +
        `Options:\n` +
        `• Click "OK" to schedule ONLY on available dates (${freeDates.join(', ')})\n` +
        `• Click "Cancel" to review and modify your selection`
      );
      if (!userChoice) {
        return;
      }
      // Keep only free dates for adding
      Object.keys(pendingAddsByDate).forEach(d => { if (conflicts.includes(d)) delete pendingAddsByDate[d]; });
    }

    // Apply additions after confirmation only
    Object.entries(pendingAddsByDate).forEach(([date, entries]) => {
      if (!newScheduleData[date]) newScheduleData[date] = [];
      newScheduleData[date].push(...entries);
    });
    
    setScheduleData(newScheduleData);
    // Firestore save in background - don't block UI
    saveScheduleData(newScheduleData).catch(err => {
      console.error('Error saving schedule data:', err);
      toast({ 
        title: 'Warning', 
        description: 'Failed to save to database. Please try again.',
        variant: "destructive"
      });
    });
    
    // Send email notification for the first date as an example (only if enabled)
    if (sendEmailOnCreate) {
      try {
        const sampleEntry = {
          trainer: trainerName,
          startDate: validDates[0],
          endDate: validDates[validDates.length - 1],
          client: clientDisplayName || 'N/A',
          course: form.course?.value || 'N/A',
          role: form.role?.value || 'N/A',
          taskDetails: form.taskDetails?.value || 'N/A',
          taskType: form.taskType?.value || 'N/A',
          description: form.description?.value || 'N/A',
          excludedDates: selectedDateRange.excludedDates || []
        };
        
        if (scheduleType === 'training') {
          await notifyScheduleCreated(sampleEntry);
        } else {
          await notifyNonTrainingCreated(sampleEntry);
        }
        toast({ 
          title: 'Success', 
          description: `New schedule allocated successfully for ${trainerName} on ${validDates.length} date(s) and email notification sent.` 
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
        toast({ 
          title: 'Success', 
          description: `New schedule allocated successfully for ${trainerName} on ${validDates.length} date(s). (Email notification failed)` 
        });
      }
    } else {
      toast({ 
        title: 'Success', 
        description: `New schedule allocated successfully for ${trainerName} on ${validDates.length} date(s).` 
      });
    }
    
    setIsAllocateModalOpen(false);
    setSendEmailOnCreate(true); // Reset to default
    setSelectedClient(null); // Reset selected client
    setSelectedPMs([]); // Reset selected PMs
    setAvailablePMs([]); // Reset available PMs
    setForm({}); // Reset form
  };

  const getTrainerSections = (entries) => {
    const inClientLocation = entries.filter(e => e.clientLocation && e.clientLocation.trim() !== '');
    const withTaskNoLocation = entries.filter(e => (!e.clientLocation || e.clientLocation.trim() === '') && e.task && e.task.trim() !== '');
    const noTask = entries.filter(e => (!e.clientLocation || e.clientLocation.trim() === '') && (!e.task || e.task.trim() === ''));
    return { inClientLocation, withTaskNoLocation, noTask };
  };

  const renderMoreTasksModal = () => {
    if (!isMoreTasksModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              Tasks for {formatDateForDisplay(selectedDayTasks.date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button 
              onClick={() => setIsMoreTasksModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedDayTasks.tasks.map((event, i) => (
              <div
                key={i}
                className={`rounded-lg p-4 ${
                  event.type === 'training' 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-orange-50 border border-orange-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{event.trainer}</p>
                    {event.type === 'training' ? (
                      <>
                        <p className="text-sm text-gray-600">Course: {event.course}</p>
                        <p className="text-sm text-gray-600">Client: {event.client}</p>
                        <p className="text-sm text-gray-600">Role: {event.role}</p>
                        <p className="text-sm text-gray-600">Description: {event.description}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">Task: {event.taskDetails}</p>
                        <p className="text-sm text-gray-600">Type: {event.taskType}</p>
                        <p className="text-sm text-gray-600">Description: {event.description}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        startEditTask(event, selectedDayTasks.date);
                        setIsMoreTasksModalOpen(false);
                      }}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteEntry(event, selectedDayTasks.date);
                        setIsMoreTasksModalOpen(false);
                      }}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const totalDays = daysInMonth(currentYear, currentMonth);
    const firstDay = firstDayOfMonth(currentYear, currentMonth);
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const blanks = Array(firstDay).fill(null);
    const allCells = [...blanks, ...daysArray];

    // Build a map of dateStr -> events for that day
    const pad2 = n => n.toString().padStart(2, '0');
    const eventsByDate = {};
    Object.entries(scheduleData).forEach(([date, entries]) => {
      entries.forEach(entry => {
        // Skip entries with "Not Alloted"
        if (entry.client === 'Not Alloted' || entry.course === 'Not Alloted' || entry.role === 'Not Alloted') {
          return;
        }
        // For range events, add to each day in the range
        const start = entry.startDate || date;
        const end = entry.endDate || date;
        let dt = new Date(start);
        const endDt = new Date(end);
        while (dt <= endDt) {
          const dstr = dt.toISOString().slice(0, 10);
          if (!eventsByDate[dstr]) eventsByDate[dstr] = [];
          eventsByDate[dstr].push(entry);
          dt.setDate(dt.getDate() + 1);
        }
      });
    });

    // Get the current month/year as YYYY-MM
    const monthStr = `${currentYear}-${pad2(currentMonth + 1)}`;

    return (
      <div className="bg-white rounded-lg shadow border border-border/50 p-2">
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="p-2 text-center font-semibold bg-indigo-400 text-white border-b border-indigo-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {allCells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="border border-gray-200 bg-gray-50 min-h-[120px]" />;
            }
            const dateStr = `${monthStr}-${pad2(day)}`;
            const events = eventsByDate[dateStr] || [];
            const isSunday = (firstDay + day - 1) % 7 === 0;
            
            return (
              <div
                key={idx}
                className={`border border-gray-200 min-h-[120px] max-h-[120px] p-1 align-top relative cursor-pointer hover:bg-indigo-50 transition overflow-hidden ${
                  isSunday ? 'bg-red-50' : 'bg-white'
                }`}
                onClick={() => handleDateClick(day)}
              >
                <div className={`text-xs font-bold mb-1 ${isSunday ? 'text-red-600' : 'text-gray-800'}`}>
                  {day}
                </div>
                <div className="flex flex-col gap-1">
                  {events.slice(0, 2).map((event, i) => (
                    <div
                      key={i}
                      className={`rounded px-2 py-1 text-xs font-semibold flex items-center gap-1 shadow-sm ${
                        event.type === 'training' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                      }`}
                      title={`${event.type === 'training' ? 'Training' : 'Non-Training'}: ${event.course || event.taskDetails || event.task || ''}`}
                    >
                      <span className="truncate max-w-[90px]">
                        {event.trainer}
                      </span>
                    </div>
                  ))}
                  {events.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayTasks({ date: dateStr, tasks: events });
                        setIsMoreTasksModalOpen(true);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 mt-1"
                    >
                      +{events.length - 2} more tasks
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const openScheduleModal = useCallback(() => {
    setIsScheduleModalOpen(true);
    setScheduleType('training');
    setRole('');
    setTaskType('Question creation');
    setSelectedTrainer('');
    setTrainerSearchTerm('');
    setIsTrainerDropdownOpen(false);
    setSelectedClient(null);
    setSelectedPMs([]);
    setAvailablePMs([]);
  }, []);

  const closeScheduleModal = useCallback(() => {
    setIsScheduleModalOpen(false);
    setSendEmailOnCreate(true); // Reset to default
    setSelectedClient(null); // Reset selected client
    setSelectedPMs([]); // Reset selected PMs
    setAvailablePMs([]); // Reset available PMs
    setScheduleType('training'); // Reset to training
    setRole(''); // Reset role
    setSelectedTrainer(''); // Reset trainer
    setTrainerSearchTerm(''); // Reset search
    setIsTrainerDropdownOpen(false); // Close dropdown
  }, []);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    let newEntry;
    // Normalize trainer name
    const selectedTrainerObj = trainerList.find(t => t.name === (form.trainer.value || selectedTrainer));
    const trainerName = selectedTrainerObj ? selectedTrainerObj.name : (form.trainer.value || selectedTrainer);

    // Get all dates in range excluding the excluded dates
    const startDate = parseLocalDate(selectedDateRange.startDate);
    const endDate = parseLocalDate(selectedDateRange.endDate);
    const dates = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      // Only include dates that are not excluded
      if (!selectedDateRange.excludedDates.includes(dateStr)) {
        dates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // If no valid dates after excluding, show error
    if (dates.length === 0) {
      toast({ 
        title: "Error", 
        description: "No valid dates available after excluding selected dates.",
        variant: "destructive"
      });
      return;
    }

    // Enhanced validation check for duplicate/overlapping entries
    const conflicts = [];
    const existingTasksForTrainer = {};
    
    dates.forEach(date => {
      const existingTasks = scheduleData[date] || [];
      const trainerTask = existingTasks.find(task => task.trainer === trainerName);
      if (trainerTask) {
        conflicts.push(date);
        existingTasksForTrainer[date] = trainerTask;
      }
    });

    if (conflicts.length > 0) {
      const totalDatesRequested = dates.length;
      const conflictCount = conflicts.length;
      const freeDates = dates.filter(date => !conflicts.includes(date));
      
      // Case 1: Full overlap (all requested dates have conflicts)
      if (conflictCount === totalDatesRequested) {
        toast({ 
          title: "Complete Scheduling Conflict",
          description: `${trainerName} is already assigned tasks on all requested dates (${conflicts.join(', ')}). Please choose different dates or a different trainer.`,
          variant: "destructive",
          duration: 10000,
        });
        return;
      }
      
      // Case 2: Partial overlap (some dates conflict, some are free)
      const conflictingSampleTask = Object.values(existingTasksForTrainer)[0];
      const isSameTaskType = scheduleType === conflictingSampleTask?.type;
      const canExtendTask = isSameTaskType && scheduleType === 'training' 
        ? (form.client.value === conflictingSampleTask.client && 
           form.course.value === conflictingSampleTask.course && 
           form.role.value === conflictingSampleTask.role)
        : (scheduleType === 'non-training' && 
           form.taskDetails.value === conflictingSampleTask.taskDetails && 
           form.taskType.value === conflictingSampleTask.taskType);

      let userChoice;
      if (canExtendTask && freeDates.length > 0) {
        // Advanced dialog with extend option
        userChoice = await showConfirm(
          'Scheduling Conflict with Extension Option!',
          `Trainer: ${trainerName}\n` +
          `Conflicting dates: ${conflicts.join(', ')}\n` +
          `Available dates: ${freeDates.join(', ')}\n\n` +
          `The existing task appears to be similar to what you're scheduling.\n\n` +
          `Options:\n` +
          `• Click "OK" to EXTEND existing task to include new dates (${freeDates.join(', ')})\n` +
          `• Click "Cancel" to review and modify your selection`,
          'OK',
          'Cancel'
        );
        
        if (userChoice) {
          // Extend existing task by updating its end date and adding entries for free dates
          const taskId = conflictingSampleTask.id;
          Object.keys(scheduleData).forEach(dateKey => {
            scheduleData[dateKey] = scheduleData[dateKey]?.map(task => {
              if (task.id === taskId) {
                return {
                  ...task,
                  endDate: Math.max(parseLocalDate(task.endDate), parseLocalDate(freeDates[freeDates.length - 1])) 
                    ? freeDates[freeDates.length - 1] : task.endDate
                };
              }
              return task;
            }) || [];
          });
          
          // Add entries for free dates using existing task data
          const newScheduleData = { ...scheduleData };
          freeDates.forEach(date => {
            if (!newScheduleData[date]) {
              newScheduleData[date] = [];
            }
            newScheduleData[date].push({
              ...conflictingSampleTask,
              startDate: date,
              endDate: date,
              id: Date.now() + Math.random()
            });
          });
          
          setScheduleData(newScheduleData);
          saveScheduleData(newScheduleData);
          setIsScheduleModalOpen(false);
          
          toast({
            title: "Task Extended Successfully",
            description: `Extended existing task for ${trainerName} to include dates: ${freeDates.join(', ')}.`,
            duration: 8000,
          });
          return;
        } else {
          return; // User cancelled
        }
      } else {
        // Standard dialog for partial conflicts
        userChoice = await showConfirm(
          'Scheduling Conflict Detected!',
          `Trainer: ${trainerName}\n` +
          `Conflicting dates: ${conflicts.join(', ')}\n` +
          `Available dates: ${freeDates.join(', ')}\n\n` +
          `Options:\n` +
          `• Click "OK" to schedule ONLY on available dates (${freeDates.join(', ')})\n` +
          `• Click "Cancel" to review and modify your selection`,
          'OK',
          'Cancel'
        );
      }
      
      if (!userChoice) {
        return; // User chose to cancel
      }
      
      // Update dates array to only include free dates
      dates.splice(0, dates.length, ...freeDates);
      
      if (dates.length === 0) {
        toast({
          title: "No Available Dates",
          description: "No dates available for scheduling after removing conflicts.",
          variant: "destructive"
        });
        return;
      }

      // Show success message about partial scheduling
      toast({
        title: "Partial Schedule Created",
        description: `Task scheduled for ${trainerName} on available dates: ${dates.join(', ')}. Conflicting dates were skipped.`,
        duration: 8000,
      });
    }

    // Validate PM selection for training tasks before processing dates
    if (scheduleType === 'training') {
      if (!selectedClient) {
        toast({ 
          title: 'Error', 
          description: 'Please select a client', 
          variant: "destructive" 
        });
        return;
      }
      if (!selectedPMs || selectedPMs.length === 0) {
        toast({ 
          title: 'Error', 
          description: 'Please select at least one Program Manager for this task', 
          variant: "destructive" 
        });
        return;
      }
    }

    // Create entries for each valid date (either no conflicts or user chose to proceed with free dates)
    const newScheduleData = { ...scheduleData };
    dates.forEach(date => {
      if (scheduleType === 'training') {
        // Get selected client
        const client = clientsWithPMs.find(c => c.clientId === selectedClient);
        
        if (!client) {
          console.error('Client not found:', selectedClient);
          return; // Skip this date if client not found
        }
        
        newEntry = {
          startDate: date,
          endDate: date,
          trainer: trainerName,
          role: form.role.value,
          client: client.name,
          clientId: client.clientId,
          course: form.course.value,
          description: form.description.value,
          type: 'training',
          id: Date.now() + Math.random(),
          // Use selected PMs (not all PMs of client)
          assignedPMIds: selectedPMs
        };
      } else {
        newEntry = {
          startDate: date,
          endDate: date,
          trainer: trainerName,
          taskDetails: form.taskDetails.value,
          description: form.description.value,
          taskType: form.taskType.value,
          type: 'non-training',
          id: Date.now() + Math.random()
        };
      }

      if (!newScheduleData[date]) {
        newScheduleData[date] = [];
      }
      newScheduleData[date].push(newEntry);
    });

    setScheduleData(newScheduleData);
    // Firestore save in background - don't block UI
    saveScheduleData(newScheduleData).catch(err => {
      console.error('Error saving schedule data:', err);
      toast({ 
        title: 'Warning', 
        description: 'Failed to save to database. Please try again.',
        variant: "destructive"
      });
    });
    
    // Send email notifications for successful allocations (only if enabled)
    if (conflicts.length === 0 && sendEmailOnCreate) {
      try {
        // Send notification for the first date as an example
        let sampleEntry;
        
        if (scheduleType === 'training') {
          const client = clientsWithPMs.find(c => c.clientId === selectedClient);
          const clientNameForEmail = client?.name || resolveClientName(selectedClient);
          sampleEntry = {
            trainer: trainerName,
            startDate: dates[0],
            endDate: dates[dates.length - 1],
            client: clientNameForEmail,
            course: form.course.value,
            role: form.role.value,
            description: form.description.value,
            excludedDates: selectedDateRange.excludedDates || []
          };
          await notifyScheduleCreated(sampleEntry);
        } else {
          sampleEntry = {
            trainer: trainerName,
            startDate: dates[0],
            endDate: dates[dates.length - 1],
            taskDetails: form.taskDetails.value,
            taskType: form.taskType.value,
            description: form.description.value,
            excludedDates: selectedDateRange.excludedDates || []
          };
          await notifyNonTrainingCreated(sampleEntry);
        }
        
        toast({ 
          title: 'Success', 
          description: `New schedule allocated successfully for ${trainerName} on ${dates.length} date(s) and email notification sent.` 
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
        toast({ 
          title: 'Success', 
          description: `New schedule allocated successfully for ${trainerName} on ${dates.length} date(s). (Email notification failed)` 
        });
      }
    } else if (conflicts.length === 0) {
      toast({ 
        title: 'Success', 
        description: `New schedule allocated successfully for ${trainerName} on ${dates.length} date(s).` 
      });
    }
    
    // Close modal and reset form
    closeScheduleModal();
  };

  // Helper: get all unique dates in scheduleData
  const getAllUniqueDates = () => {
    const dates = new Set();
    Object.keys(scheduleData).forEach(date => dates.add(date));
    return Array.from(dates).sort();
  };

  // Helper: get all unique trainers
  const getAllUniqueTrainers = () => {
    const trainers = new Set();
    flattenedScheduleData.forEach(entry => {
      if (entry.trainer && entry.trainer.trim() !== '') trainers.add(entry.trainer);
    });
    return Array.from(trainers);
  };

  const handleDeleteEntry = async (entry, date) => {
    // Set the delete target and open confirmation modal
    // Use entry.startDate as the primary date, fallback to passed date
    const displayDate = entry.startDate || date;
    setDeleteTarget({ entry, date: displayDate });
    setIsDeleteConfirmModalOpen(true);
  };



  const confirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    
    const { entry, date } = deleteTarget;
    const newScheduleData = { ...scheduleData };
    let deletedCount = 0;
    
    // Remove the specific entry from ALL dates where it exists
    // This handles cases where a task might span multiple dates
    Object.keys(newScheduleData).forEach(dateKey => {
      if (newScheduleData[dateKey]) {
        const originalLength = newScheduleData[dateKey].length;
        newScheduleData[dateKey] = newScheduleData[dateKey].filter(e => e.id !== entry.id);
        deletedCount += originalLength - newScheduleData[dateKey].length;
        
        // Remove the date key if no entries left
        if (newScheduleData[dateKey].length === 0) {
          delete newScheduleData[dateKey];
        }
      }
    });
    
    // Close modal immediately
    setIsDeleteConfirmModalOpen(false);
    setDeleteTarget(null);
    setSendEmailOnDelete(true); // Reset to default
    
    // Update state and save to database
    setScheduleData(newScheduleData);
    
    // Save to database with error handling
    try {
      await saveScheduleData(newScheduleData);
      
      try {
        await cancelPendingRequestsForTask(entry.id, {
          reason: 'Associated schedule task was removed',
          trainerName: entry.trainer,
          taskLabel: entry.taskDetails || entry.client || entry.course || entry.role
        });
      } catch (requestError) {
        console.error('⚠️ Failed to cancel pending clock requests for deleted task:', requestError);
      }
      
          // Send email notification for deletion (only if enabled)
    if (sendEmailOnDelete) {
      try {
        if (entry.type === 'training') {
          await notifyScheduleDeleted(entry);
        } else {
          await notifyNonTrainingDeleted(entry);
        }
        toast({ 
          title: 'Task Deleted', 
          description: `Task has been successfully removed from ${deletedCount} date(s) and email notification sent.`,
          variant: "default"
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        toast({ 
          title: 'Task Deleted', 
          description: `Task has been successfully removed from ${deletedCount} date(s). (Email notification failed)`,
          variant: "default"
        });
      }
    } else {
      toast({ 
        title: 'Task Deleted', 
        description: `Task has been successfully removed from ${deletedCount} date(s).`,
        variant: "default"
      });
    }
      
      // Update the selected date trainers list if we're on that date
      if (selectedDate) {
        setTrainersOnSelectedDate((newScheduleData[selectedDate] || []));
      }
    } catch (error) {
      console.error('Error saving deleted data:', error);
      toast({ 
        title: 'Delete Error', 
        description: 'Failed to save changes to database. Please try again.',
        variant: "destructive"
      });
    }
  };

  // Update the getDateRange function to return all dates in range
  const getDateRange = (range) => {
    const today = new Date();
    const start = new Date();
    const end = new Date();

    switch (range) {
      case 'today':
        return { start, end };
      case 'week':
        start.setDate(today.getDate() - today.getDay());
        end.setDate(start.getDate() + 6);
        return { start, end };
      case 'month':
        start.setDate(1);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        return { start, end };
      case 'custom':
        return {
          start: new Date(exportFilters.customStartDate),
          end: new Date(exportFilters.customEndDate)
        };
      default:
        return { start: null, end: null };
    }
  };

  // Helper function to get all dates between start and end
  const getAllDatesInRange = (start, end) => {
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  // Update the download function with filters
  const downloadFilteredData = () => {
    const { dateRange, includeTraining, includeNonTraining, taskTypes } = exportFilters;
    const { start, end } = getDateRange(dateRange);

    // Get all dates in the range
    let filteredDates = dateRange === 'all' 
      ? Object.keys(scheduleData)
      : getAllDatesInRange(start, end);
    filteredDates.sort();

    // Get all unique trainers
    const trainers = getAllUniqueTrainers();

    // Helper to get entry by type and date range
    const getEntry = (date, trainerName, type) => {
      return Object.entries(scheduleData).find(([_, entries]) => {
        return entries.some(e => 
          e.trainer === trainerName && 
          e.type === type && 
          date >= e.startDate && 
          date <= e.endDate
        );
      })?.[1]?.find(e => e.trainer === trainerName && e.type === type);
    };

    const workbook = XLSX.utils.book_new();

    // Training Schedule sheet
    if (includeTraining) {
      const trainingHeaders = ['Trainer Name'];
      filteredDates.forEach(date => {
        if (taskTypes.course) trainingHeaders.push(`${date} - Course`);
        if (taskTypes.client) trainingHeaders.push(`${date} - Client`);
        if (taskTypes.training) trainingHeaders.push(`${date} - TA/Trainer`);
        if (taskTypes.description) trainingHeaders.push(`${date} - Description`);
      });

      const trainingRows = trainers.map(trainerName => {
        const row = { 'Trainer Name': trainerName };
        filteredDates.forEach(date => {
          const entry = getEntry(date, trainerName, 'training');
          if (taskTypes.course) row[`${date} - Course`] = entry ? (entry.course || 'Not Alloted') : 'Not Alloted';
          if (taskTypes.client) row[`${date} - Client`] = entry ? (entry.client || 'Not Alloted') : 'Not Alloted';
          if (taskTypes.training) row[`${date} - TA/Trainer`] = entry ? (entry.role || 'Not Alloted') : 'Not Alloted';
          if (taskTypes.description) row[`${date} - Description`] = entry ? (entry.description || 'Not Alloted') : 'Not Alloted';
        });
        return row;
      });

      const trainingSheet = XLSX.utils.json_to_sheet(trainingRows, { header: trainingHeaders });
      XLSX.utils.book_append_sheet(workbook, trainingSheet, 'Training Schedule');
    }

    // Non-Training Schedule sheet
    if (includeNonTraining) {
      const nonTrainingHeaders = ['Trainer Name'];
      filteredDates.forEach(date => {
        if (taskTypes.task) nonTrainingHeaders.push(`${date} - Task`);
        if (taskTypes.nonTraining) nonTrainingHeaders.push(`${date} - Type`);
        if (taskTypes.description) nonTrainingHeaders.push(`${date} - Description`);
      });

      const nonTrainingRows = trainers.map(trainerName => {
        const row = { 'Trainer Name': trainerName };
        filteredDates.forEach(date => {
          const entry = getEntry(date, trainerName, 'non-training');
          if (taskTypes.task) row[`${date} - Task`] = entry ? (entry.taskDetails || 'Not Alloted') : 'Not Alloted';
          if (taskTypes.nonTraining) row[`${date} - Type`] = entry ? (entry.taskType || 'Not Alloted') : 'Not Alloted';
          if (taskTypes.description) row[`${date} - Description`] = entry ? (entry.description || 'Not Alloted') : 'Not Alloted';
        });
        return row;
      });

      const nonTrainingSheet = XLSX.utils.json_to_sheet(nonTrainingRows, { header: nonTrainingHeaders });
      XLSX.utils.book_append_sheet(workbook, nonTrainingSheet, 'Non-Training Schedule');
    }

    XLSX.writeFile(workbook, 'TrainerSchedule.xlsx');
    toast({ title: "Success", description: "Schedule data exported with selected filters." });
    setIsExportModalOpen(false);
  };

  // Add this JSX for the export modal
  const renderExportModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Export Schedule</h3>
            <p className="text-sm text-slate-500">Choose the format and filters you need for your export.</p>
          </div>
          <button
            onClick={() => setIsExportModalOpen(false)}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close export modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Export Format</label>
            <select
              id="export-format"
              name="export-format"
              value={exportFilters.format}
              onChange={(e) => setExportFilters(f => ({ ...f, format: e.target.value }))}
              className="w-full p-2 border border-border/50 rounded-md bg-muted/5"
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
            <p className="text-xs text-muted-foreground">Excel creates multi-sheet workbooks; CSV/PDF generate compact summaries.</p>
          </div>
          {/* Date Range Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Date Range</label>
            <select 
              id="export-date-range"
              name="export-date-range"
              value={exportFilters.dateRange}
              onChange={(e) => setExportFilters(f => ({ ...f, dateRange: e.target.value }))}
              className="w-full p-2 border border-border/50 rounded-md bg-muted/5"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Show Only Scheduled Tasks Option */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input 
                id="export-show-only-scheduled"
                name="export-show-only-scheduled"
                type="checkbox" 
                checked={exportFilters.showOnlyScheduled}
                onChange={(e) => setExportFilters(f => ({ ...f, showOnlyScheduled: e.target.checked }))}
              />
              Show Only Scheduled Tasks
            </label>
            <p className="text-sm text-gray-500">When checked, only trainers with actual tasks will be included in the export.</p>
          </div>

          {/* Custom Date Range */}
          {exportFilters.dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Start Date</label>
                <input 
                  id="export-custom-start-date"
                  name="export-custom-start-date"
                  type="date" 
                  value={exportFilters.customStartDate}
                  onChange={(e) => setExportFilters(f => ({ ...f, customStartDate: e.target.value }))}
                  className="w-full p-2 border border-border/50 rounded-md bg-muted/5"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">End Date</label>
                <input 
                  id="export-custom-end-date"
                  name="export-custom-end-date"
                  type="date" 
                  value={exportFilters.customEndDate}
                  onChange={(e) => setExportFilters(f => ({ ...f, customEndDate: e.target.value }))}
                  className="w-full p-2 border border-border/50 rounded-md bg-muted/5"
                />
              </div>
            </div>
          )}

          {/* Schedule Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Schedule Types</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input 
                  id="export-include-training"
                  name="export-include-training"
                  type="checkbox" 
                  checked={exportFilters.includeTraining}
                  onChange={(e) => setExportFilters(f => ({ ...f, includeTraining: e.target.checked }))}
                />
                Include Training Schedule
              </label>
              <label className="flex items-center gap-2">
                <input 
                  id="export-include-non-training"
                  name="export-include-non-training"
                  type="checkbox" 
                  checked={exportFilters.includeNonTraining}
                  onChange={(e) => setExportFilters(f => ({ ...f, includeNonTraining: e.target.checked }))}
                />
                Include Non-Training Schedule
              </label>
            </div>
          </div>

          {/* Training Fields Selection */}
          {exportFilters.includeTraining && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Training Fields</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-course"
                    name="export-task-type-course"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.course}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, course: e.target.checked }
                    }))}
                  />
                  Course
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-client"
                    name="export-task-type-client"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.client}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, client: e.target.checked }
                    }))}
                  />
                  Client
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-training"
                    name="export-task-type-training"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.training}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, training: e.target.checked }
                    }))}
                  />
                  TA/Trainer Role
                </label>
              </div>
            </div>
          )}

          {/* Non-Training Fields Selection */}
          {exportFilters.includeNonTraining && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Non-Training Fields</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-task"
                    name="export-task-type-task"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.task}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, task: e.target.checked }
                    }))}
                  />
                  Task Details
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-non-training"
                    name="export-task-type-non-training"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.nonTraining}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, nonTraining: e.target.checked }
                    }))}
                  />
                  Task Type
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    id="export-task-type-description"
                    name="export-task-type-description"
                    type="checkbox" 
                    checked={exportFilters.taskTypes.description}
                    onChange={(e) => setExportFilters(f => ({ 
                      ...f, 
                      taskTypes: { ...f.taskTypes, description: e.target.checked }
                    }))}
                  />
                  Description
                </label>
              </div>
            </div>
          )}

          {/* Trainer Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Trainers</label>
            <div className="rounded-md border border-border/50 bg-muted/5">
              <label className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={exportFilters.selectedTrainers.length === 0}
                  onChange={() => setExportFilters(f => ({ ...f, selectedTrainers: [] }))}
                />
                All Trainers
              </label>
              <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-2 text-sm">
                {trainerList.map((trainer) => {
                  const name = trainer.name || trainer.trainerName || trainer.id || 'Unknown';
                  const checked = exportFilters.selectedTrainers.includes(name);
                  return (
                    <label key={name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setExportFilters(f => {
                            const current = new Set(f.selectedTrainers);
                            if (e.target.checked) {
                              current.add(name);
                            } else {
                              current.delete(name);
                            }
                            return { ...f, selectedTrainers: Array.from(current) };
                          });
                        }}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave all unchecked to export every trainer.</p>
          </div>

          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsExportModalOpen(false)} 
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
            >
              Cancel
            </button>
            <button 
              onClick={handleScheduleExport} 
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Update the export button click handler
  const handleExportClick = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const buildScheduleExportRows = () => {
    const { dateRange, includeTraining, includeNonTraining, showOnlyScheduled, selectedTrainers } = exportFilters;
    const { start, end } = getDateRange(dateRange);
    const trainerFilter = new Set((selectedTrainers || []).filter(Boolean));

    const matchesDateRange = (entry) => {
      const startDate = entry.startDate ? new Date(entry.startDate) : entry.date ? new Date(entry.date) : null;
      const endDate = entry.endDate ? new Date(entry.endDate) : startDate;
      if (start && startDate && endDate && endDate < start) return false;
      if (end && startDate && startDate > end) return false;
      return true;
    };

    return flattenedScheduleData
      .filter((entry) => {
        if (!entry.trainer) return false;
        if (trainerFilter.size > 0 && !trainerFilter.has(entry.trainer)) return false;
        if (!matchesDateRange(entry)) return false;
        if (!includeTraining && entry.type === 'training') return false;
        if (!includeNonTraining && entry.type !== 'training') return false;
        if (showOnlyScheduled) {
          const hasAssignment = !!(
            entry.client ||
            entry.course ||
            entry.taskDetails ||
            entry.taskType ||
            entry.role
          );
          if (!hasAssignment) return false;
        }
        return true;
      })
      .map((entry) => ({
        trainer: entry.trainer,
        type: entry.type === 'training' ? 'Training' : 'Non-Training',
        client: entry.client || '',
        course: entry.course || '',
        role: entry.role || '',
        taskDetails: entry.taskDetails || '',
        taskType: entry.taskType || '',
        description: entry.description || '',
        startDate: entry.startDate || entry.date || '',
        endDate: entry.endDate || entry.date || '',
        specialization: entry.specialization || ''
      }));
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

  const scheduleCsvHeaders = [
    { key: 'trainer', label: 'Trainer' },
    { key: 'type', label: 'Type' },
    { key: 'client', label: 'Client' },
    { key: 'course', label: 'Course' },
    { key: 'role', label: 'Role' },
    { key: 'taskDetails', label: 'Task Details' },
    { key: 'taskType', label: 'Task Type' },
    { key: 'description', label: 'Description' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'specialization', label: 'Specialization' }
  ];

  const downloadScheduleCSV = (rows) => {
    const escapeCSV = (value) => {
      const content = value === null || value === undefined ? '' : String(value);
      return `"${content.replace(/"/g, '""')}"`;
    };

    const lines = [scheduleCsvHeaders.map((h) => escapeCSV(h.label)).join(',')];
    rows.forEach((row) => {
      lines.push(scheduleCsvHeaders.map((h) => escapeCSV(row[h.key])).join(','));
    });

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `schedule_export_${Date.now()}.csv`);
  };

  const schedulePdfStyles = StyleSheet.create({
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

  const ScheduleExportDocument = ({ rows }) => (
    <Document>
      <Page size="A4" style={schedulePdfStyles.page}>
        <Text style={schedulePdfStyles.title}>Schedule Export</Text>
        {rows.map((row, index) => (
          <View key={index} style={schedulePdfStyles.card} wrap={false}>
            <Text style={schedulePdfStyles.row}>
              <Text style={schedulePdfStyles.label}>Trainer: </Text>
              {row.trainer}
            </Text>
            <Text style={schedulePdfStyles.row}>
              <Text style={schedulePdfStyles.label}>Type: </Text>
              {row.type}
            </Text>
            {row.client ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Client: </Text>
                {row.client}
              </Text>
            ) : null}
            {row.course ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Course: </Text>
                {row.course}
              </Text>
            ) : null}
            {row.role ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Role: </Text>
                {row.role}
              </Text>
            ) : null}
            {row.taskDetails ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Task: </Text>
                {row.taskDetails}
              </Text>
            ) : null}
            {row.taskType ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Task Type: </Text>
                {row.taskType}
              </Text>
            ) : null}
            {row.description ? (
              <Text style={schedulePdfStyles.row}>
                <Text style={schedulePdfStyles.label}>Description: </Text>
                {row.description}
              </Text>
            ) : null}
            <Text style={schedulePdfStyles.row}>
              <Text style={schedulePdfStyles.label}>Start Date: </Text>
              {row.startDate}
            </Text>
            <Text style={schedulePdfStyles.row}>
              <Text style={schedulePdfStyles.label}>End Date: </Text>
              {row.endDate}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );

  const downloadSchedulePDF = async (rows) => {
    const blob = await pdf(<ScheduleExportDocument rows={rows} />).toBlob();
    downloadBlob(blob, `schedule_export_${Date.now()}.pdf`);
  };

  const downloadSummaryExcel = () => {
    // Get all dates in the selected range (use export modal filters if needed)
    const { dateRange, showOnlyScheduled } = exportFilters;
    const { start, end } = getDateRange(dateRange);
    let filteredDates = dateRange === 'all' 
      ? Object.keys(scheduleData)
      : getAllDatesInRange(start, end);
    filteredDates.sort();

    // Get all trainers from trainerList instead of just those with tasks
    let trainers = trainerList.map(trainer => trainer.name);
    if (exportFilters.selectedTrainers.length > 0) {
      trainers = trainers.filter((name) => exportFilters.selectedTrainers.includes(name));
    }

    // Helper to get training entry for a trainer and date
    const getTrainingEntry = (date, trainerName) => {
      const entries = Object.entries(scheduleData).find(([d, entries]) => {
        return entries.some(e => 
          e.trainer === trainerName && 
          e.type === 'training' &&
          date >= e.startDate && 
          date <= e.endDate
        );
      })?.[1]?.filter(e => e.trainer === trainerName && e.type === 'training' && date >= e.startDate && date <= e.endDate) || [];
      const training = entries[0];
      if (training) return `${training.client || ''}-${training.course || ''}-${training.role || ''}${training.description ? ` (${training.description})` : ''}`;
      return 'Not Alloted';
    };

    // Helper to get non-training entry for a trainer and date
    const getNonTrainingEntry = (date, trainerName) => {
      const entries = Object.entries(scheduleData).find(([d, entries]) => {
        return entries.some(e => 
          e.trainer === trainerName && 
          e.type === 'non-training' &&
          date >= e.startDate && 
          date <= e.endDate
        );
      })?.[1]?.filter(e => e.trainer === trainerName && e.type === 'non-training' && date >= e.startDate && date <= e.endDate) || [];
      const nonTraining = entries[0];
      if (nonTraining) return `${nonTraining.taskType || ''}-${nonTraining.taskDetails || ''}${nonTraining.description ? ` (${nonTraining.description})` : ''}`;
      return 'Not Alloted';
    };

    // Build headers
    const headers = ['Trainer Name', ...filteredDates];

    // Build training rows
    const trainingRows = trainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      filteredDates.forEach(date => {
        row[date] = getTrainingEntry(date, trainerName);
      });
      return row;
    }).filter(row => {
      if (!showOnlyScheduled) return true;
      // For scheduled tasks only, filter out rows where all dates are "Not Alloted"
      return Object.entries(row).some(([key, value]) => key !== 'Trainer Name' && value !== 'Not Alloted');
    });

    // Build non-training rows
    const nonTrainingRows = trainers.map(trainerName => {
      const row = { 'Trainer Name': trainerName };
      filteredDates.forEach(date => {
        row[date] = getNonTrainingEntry(date, trainerName);
      });
      return row;
    }).filter(row => {
      if (!showOnlyScheduled) return true;
      // For scheduled tasks only, filter out rows where all dates are "Not Alloted"
      return Object.entries(row).some(([key, value]) => key !== 'Trainer Name' && value !== 'Not Alloted');
    });

    // Write to Excel
    const trainingSheet = XLSX.utils.json_to_sheet(trainingRows, { header: headers });
    const nonTrainingSheet = XLSX.utils.json_to_sheet(nonTrainingRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, trainingSheet, 'Training Schedule');
    XLSX.utils.book_append_sheet(workbook, nonTrainingSheet, 'Non-Training Schedule');
    XLSX.writeFile(workbook, 'TrainerSchedule.xlsx');
    toast({ title: "Success", description: "Summary schedule exported with separate sheets." });
    setIsExportModalOpen(false);
  };

  const handleScheduleExport = async () => {
    if (exportFilters.format === 'excel') {
      downloadSummaryExcel();
      return;
    }

    try {
      const rows = buildScheduleExportRows();
      if (!rows.length) {
        toast({
          title: 'Nothing to export',
          description: 'No schedule entries match your export filters.',
          variant: 'destructive'
        });
        return;
      }

      if (exportFilters.format === 'pdf') {
        await downloadSchedulePDF(rows);
      } else {
        downloadScheduleCSV(rows);
      }

      toast({ title: 'Export ready', description: `Schedule exported as ${exportFilters.format.toUpperCase()}.` });
      setIsExportModalOpen(false);
    } catch (error) {
      console.error('Schedule export error:', error);
      toast({ title: 'Export failed', description: 'Unable to generate schedule export.', variant: 'destructive' });
    }
  };

  // Toggle selection for a task
  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // Bulk delete selected tasks
  const handleBulkDelete = async () => {
    const newScheduleData = { ...scheduleData };
    let deletedCount = 0;
    const tasksToRemove = new Map();
    
    Object.keys(newScheduleData).forEach(date => {
      const originalTasks = newScheduleData[date];
      const originalLength = originalTasks.length;

      originalTasks.forEach(task => {
        if (selectedTaskIds.includes(task.id)) {
          tasksToRemove.set(task.id, task);
        }
      });
      
      newScheduleData[date] = newScheduleData[date].filter(
        task => !selectedTaskIds.includes(task.id)
      );
      deletedCount += originalLength - newScheduleData[date].length;
      
      if (newScheduleData[date].length === 0) {
        delete newScheduleData[date];
      }
    });
    
    setScheduleData(newScheduleData);
    
    try {
      await saveScheduleData(newScheduleData);
      
      for (const [taskId, task] of tasksToRemove) {
        try {
          await cancelPendingRequestsForTask(taskId, {
            reason: 'Associated schedule task was removed',
            trainerName: task.trainer,
            taskLabel: task.taskDetails || task.client || task.course || task.role
          });
        } catch (requestError) {
          console.error('⚠️ Failed to cancel pending clock requests for deleted task:', requestError);
        }
      }
      
      toast({ 
        title: 'Tasks Deleted',
        description: `${deletedCount} tasks removed successfully.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error saving bulk deleted data:', error);
      toast({ 
        title: 'Bulk Delete Error', 
        description: 'Failed to save changes to database. Please try again.',
        variant: "destructive"
      });
    }
  };

  // Select all tasks for the current day
  const selectAllForDay = (taskIds, checked) => {
    setSelectedTaskIds(prev => {
      if (checked) {
        // Add all taskIds for the day, avoiding duplicates
        return Array.from(new Set([...prev, ...taskIds]));
      } else {
        // Remove all taskIds for the day
        return prev.filter(id => !taskIds.includes(id));
      }
    });
  };

  const handleToggleTrainerDropdown = () => {
    if (!isTrainerDropdownOpen && trainerTriggerRef.current) {
      const rect = trainerTriggerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const dropdownHeight = 256; // max-h-64
      const dropdownWidth = 288;  // w-72

      let newTop = rect.top;
      let newLeft = rect.right + 8;

      // Adjust if it overflows bottom
      if (newTop + dropdownHeight > vh) {
        newTop = vh - dropdownHeight - 8;
      }
      
      // Adjust if it overflows right, place it on the left
      if (newLeft + dropdownWidth > vw) {
        newLeft = rect.left - dropdownWidth - 8;
      }

      setDropdownStyle({
        top: `${newTop}px`,
        left: `${newLeft}px`,
      });
    }
    setIsTrainerDropdownOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        trainerTriggerRef.current && !trainerTriggerRef.current.contains(event.target) &&
        trainerDropdownContentRef.current && !trainerDropdownContentRef.current.contains(event.target)
        ) {
        setIsTrainerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const ActionIconButton = ({ onClick, label, icon: Icon, variant = 'neutral', accent = 'blue' }) => {
    const accentClassMap = {
      blue: 'text-blue-600 hover:bg-blue-100/70 focus:ring-blue-500',
      orange: 'text-orange-600 hover:bg-orange-100/70 focus:ring-orange-500',
      green: 'text-green-600 hover:bg-green-100/70 focus:ring-green-500'
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
      muted: 'text-blue-700/80',
      badge: 'bg-blue-100 text-blue-700',
      dot: 'bg-blue-500',
      border: 'border-blue-500/40'
    },
    orange: {
      headerBg: 'bg-orange-50/70',
      cardBg: 'bg-orange-50/40',
      textPrimary: 'text-orange-900',
      muted: 'text-orange-700/80',
      badge: 'bg-orange-100 text-orange-700',
      dot: 'bg-orange-500',
      border: 'border-orange-500/40'
    },
    green: {
      headerBg: 'bg-green-50/70',
      cardBg: 'bg-green-50/40',
      textPrimary: 'text-green-900',
      muted: 'text-green-700/80',
      badge: 'bg-green-100 text-green-700',
      dot: 'bg-green-500',
      border: 'border-green-500/40'
    }
  };

  const renderSectionItems = (section) => {
    if (!section.items || section.items.length === 0) {
      return <p className="text-sm text-muted-foreground">{section.emptyLabel}</p>;
    }

    if (section.key === 'available') {
      return section.items.map((trainer, index) => (
        <div
          key={trainer.id || `${trainer.name}-${index}`}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border ${accentTokens[section.accent].border} ${accentTokens[section.accent].cardBg} p-3 shadow-sm`}
        >
          <div className="min-w-0">
            <p className={`font-semibold ${accentTokens[section.accent].textPrimary} truncate`}>{trainer.name}</p>
            <p className="text-xs text-gray-600 mt-0.5">Specialization: {trainer.specialization || 'Not specified'}</p>
          </div>
          <Button
            onClick={() => {
              setSelectedTrainer(trainer.name);
              setSelectedDate(selectedDate);
              setIsAllocateModalOpen(true);
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
             <p className={`font-semibold ${accentTokens[section.accent].textPrimary} truncate`}>{entry.trainer}</p>
             <div className="space-y-0.5 text-xs text-gray-600">
               {section.key === 'training' ? (
                 <>
                   <div className="flex items-center gap-1"><span className="text-gray-400">Client:</span><span className="font-medium text-gray-700">{entry.client}</span></div>
                   <div className="flex items-center gap-1"><span className="text-gray-400">Course:</span><span className="font-medium text-gray-700">{entry.course}</span></div>
                   {entry.role && <div className="flex items-center gap-1"><span className="text-gray-400">Role:</span><span className="font-medium text-gray-700">{entry.role}</span></div>}
                   {entry.description && <div className="text-gray-500">Notes: {entry.description}</div>}
                 </>
               ) : (
                 <>
                   <div className="flex items-center gap-1"><span className="text-gray-400">Task:</span><span className="font-medium text-gray-700">{entry.taskDetails}</span></div>
                   <div className="flex items-center gap-1"><span className="text-gray-400">Type:</span><span className="font-medium text-gray-700">{entry.taskType}</span></div>
                   {entry.description && <div className="text-gray-500">Notes: {entry.description}</div>}
                 </>
               )}
             </div>
           </div>
         </div>
         <div className="absolute top-1/2 right-4 -translate-y-1/2 flex items-center gap-2">
           <ActionIconButton
             onClick={() => startEditTask(entry, selectedDate)}
             label="Edit assignment"
             icon={Edit3}
             accent={section.accent}
           />
           <ActionIconButton
             onClick={() => handleDeleteEntry(entry, selectedDate)}
             label="Delete assignment"
             icon={Trash2}
             variant="danger"
           />
         </div>
       </div>
    ));
  };

  const dailySections = useMemo(() => [
    { key: 'training', title: 'Training', items: selectedTrainerCategories.trainingTrainers, accent: 'blue' },
    { key: 'non-training', title: 'Non-Training', items: selectedTrainerCategories.nonTrainingTrainers, accent: 'orange' },
    { key: 'available', title: 'Available', items: selectedTrainerCategories.availableTrainers, accent: 'green' }
  ], [selectedTrainerCategories]);

  const scheduleMetrics = useMemo(() => {
    const summary = {
      totalAssignments: 0,
      training: 0,
      nonTraining: 0,
      upcoming: 0,
      activeTrainers: 0,
      trainingPercent: 0,
      nonTrainingPercent: 0,
      needsAttention: 0
    };

    if (!flattenedScheduleData.length) {
      return summary;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const trainers = new Set();

    flattenedScheduleData.forEach((entry) => {
      if (!entry?.trainer) return;
      trainers.add(entry.trainer);

      if (entry.type === 'training') {
        summary.training += 1;
      } else {
        summary.nonTraining += 1;
      }

      const start = entry.startDate || entry.date;
      if (start) {
        const dateObj = new Date(start);
        if (!Number.isNaN(dateObj.getTime()) && dateObj >= today && dateObj <= nextWeek) {
          summary.upcoming += 1;
        }
      }

      const needsAttention =
        entry.client === 'Not Alloted' ||
        entry.course === 'Not Alloted' ||
        entry.role === 'Not Alloted' ||
        entry.taskDetails === 'Not Alloted' ||
        entry.description === 'Not Alloted';
      if (needsAttention) {
        summary.needsAttention += 1;
      }
    });

    summary.totalAssignments = summary.training + summary.nonTraining;
    summary.activeTrainers = trainers.size;
    if (summary.totalAssignments > 0) {
      summary.trainingPercent = Math.round((summary.training / summary.totalAssignments) * 100);
      summary.nonTrainingPercent = Math.round((summary.nonTraining / summary.totalAssignments) * 100);
    }

    return summary;
  }, [flattenedScheduleData]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    try {
      return new Date(selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return selectedDate;
    }
  }, [selectedDate]);

  const scheduleSummary = useMemo(() => {
    const client = clientsWithPMs.find((c) => c.clientId === selectedClient);
    const trainer = trainerList.find((t) => t.name === selectedTrainer);
    return {
      trainerName: trainer?.name || selectedTrainer || 'Not selected',
      taskTypeLabel: scheduleType === 'training' ? 'Training Assignment' : 'Non-training Assignment',
      clientName: client?.name || (selectedClient ? resolveClientName(selectedClient) : 'Not selected'),
      pmCount: selectedPMs.length,
      role,
      taskType,
      dateRange: selectedDateRange.startDate && selectedDateRange.endDate
        ? `${selectedDateRange.startDate} → ${selectedDateRange.endDate}`
        : 'Pick a schedule window',
      excludedDates: selectedDateRange.excludedDates || [],
    };
  }, [clientsWithPMs, selectedClient, trainerList, selectedTrainer, scheduleType, selectedPMs, role, taskType, selectedDateRange]);

  const selectedPMNames = useMemo(() => {
    if (!selectedPMs.length) return [];
    const pmLookup = new Map();
    [...allPMs, ...availablePMs].forEach((pm) => {
      const pmId = pm?.uid || pm?.id;
      if (!pmId) return;
      if (!pmLookup.has(pmId)) {
        pmLookup.set(pmId, pm);
      }
    });
    return selectedPMs
      .map((pmId) => pmLookup.get(pmId))
      .filter(Boolean)
      .map((pm) => pm.displayName || pm.name || pm.email || 'Unnamed PM');
  }, [selectedPMs, allPMs, availablePMs]);

  const commandActions = useMemo(() => (
    <>
      <Button
        onClick={() => setViewMode(viewMode === 'calendar' ? 'matrix' : 'calendar')}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 whitespace-nowrap"
      >
            {viewMode === 'calendar' ? 'Matrix View' : 'Calendar View'}
          </Button>
      <Button
        onClick={() => fileInputRef.current.click()}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 border-dashed whitespace-nowrap"
      >
        <Upload className="h-4 w-4" /> Import
          </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
      />
      <Button onClick={downloadSampleExcel} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
        <Download className="h-4 w-4" /> Sample
          </Button>
      <Button onClick={handleExportClick} variant="outline" size="sm" className="flex items-center gap-2 whitespace-nowrap">
        <Download className="h-4 w-4" /> Export
          </Button>
      <Button onClick={openScheduleModal} size="sm" className="flex items-center gap-2 whitespace-nowrap">
        <PlusCircle className="h-4 w-4" /> New Schedule
      </Button>
    </>
  ), [
    viewMode,
    setViewMode,
    handleExportClick,
    downloadSampleExcel,
    openScheduleModal,
  ]);

  const commandMetrics = useMemo(() => {
    return (
      <>
        <div className={cn(cardStyles.surface, 'flex items-center justify-between p-4 shadow-sm')}>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Total Assignments</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{scheduleMetrics.totalAssignments}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                <Users className="h-3 w-3" /> {scheduleMetrics.activeTrainers} active
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-600">
                <AlertTriangle className="h-3 w-3" /> {scheduleMetrics.needsAttention} needs details
              </span>
        </div>
      </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
        <div className={cn(cardStyles.surface, 'flex items-center justify-between p-4 shadow-sm')}>
          <div>
            <p className="text-xs font-medium uppercase text-blue-600">Training</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{scheduleMetrics.training}</p>
            <p className="text-xs text-slate-400">{scheduleMetrics.trainingPercent}% of workload</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>
        <div className={cn(cardStyles.surface, 'flex items-center justify-between p-4 shadow-sm')}>
          <div>
            <p className="text-xs font-medium uppercase text-orange-600">Non-Training</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{scheduleMetrics.nonTraining}</p>
            <p className="text-xs text-slate-400">{scheduleMetrics.nonTrainingPercent}% of workload</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>
        <div className={cn(cardStyles.surface, 'flex items-center justify-between p-4 shadow-sm')}>
          <div>
            <p className="text-xs font-medium uppercase text-purple-600">Upcoming (7 days)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{scheduleMetrics.upcoming}</p>
            <p className="text-xs text-slate-400">Scheduled sessions in the next week</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
      </>
    );
  }, [scheduleMetrics]);

  useEffect(() => {
    if (!setCommandState) return;
    setCommandState({
      title: 'Trainer Schedule Management',
      description: 'Allocate training and non-training assignments, monitor availability, and export insights in one place.',
      actions: commandActions,
      metrics: commandMetrics,
    });
    return () => {
      if (resetCommandState) {
        resetCommandState();
      }
    };
  }, [commandActions, commandMetrics, setCommandState, resetCommandState]);

  if (loading) {
    return <LoadingSkeleton message="Loading schedule data..." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/5 rounded-lg border border-border/50 shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            className="px-3 py-1 rounded bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200"
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
          >
            Previous
          </button>
          <span className="text-xl font-bold text-indigo-700">
            {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} {currentYear}
          </span>
          <button
            className="px-3 py-1 rounded bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200"
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
          >
            Next
          </button>
        </div>
        {viewMode === 'calendar' ? (
          <>
            {/* Legend for calendar view */}
            <div className="flex gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-6 rounded bg-blue-500"></span>
                <span className="text-sm">Training</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-6 rounded bg-orange-500"></span>
                <span className="text-sm">Non-Training</span>
              </div>
            </div>
            {renderCalendar()}
            {selectedDate && (
              <div className="mt-8 space-y-6">
                {/* Header row with schedule title and search/filter UI right-aligned */}
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                  <div className="text-2xl font-semibold text-gray-800">
                    Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { 
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
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 md:w-80 max-w-xs shadow-sm text-sm"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Enhanced Filter Button */}
                    <button
                      className={`px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center gap-2 text-sm ${filterOpen ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : ''}`}
                      onClick={() => setFilterOpen(v => !v)}
                      type="button"
                    >
                      <Filter className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-700">Filters</span>
                      {Object.values(filterFields).some(field => field) && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </button>
                    
                    {/* Enhanced Filter Dropdown */}
                    {filterOpen && (
                      <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-6 w-80 animate-fade-in">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-gray-900">Advanced Filters</span>
                        </div>
                          <button 
                            onClick={() => setFilterOpen(false)} 
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <CloseIcon className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        
                        {/* Search Fields Section */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Search className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-sm text-gray-700">Search Fields</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setFilterFields({
                                  name: true, client: true, course: true, role: true,
                                  taskDetails: true, taskType: true, description: true, specialization: true
                                })}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterFields({
                                  name: false, client: false, course: false, role: false,
                                  taskDetails: false, taskType: false, description: false, specialization: false
                                })}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                None
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.name} 
                                onChange={e => setFilterFields(f => ({...f, name: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Name</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.client} 
                                onChange={e => setFilterFields(f => ({...f, client: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Client</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.course} 
                                onChange={e => setFilterFields(f => ({...f, course: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Course</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.role} 
                                onChange={e => setFilterFields(f => ({...f, role: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Role</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.taskDetails} 
                                onChange={e => setFilterFields(f => ({...f, taskDetails: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Task Details</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.taskType} 
                                onChange={e => setFilterFields(f => ({...f, taskType: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Task Type</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.description} 
                                onChange={e => setFilterFields(f => ({...f, description: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Description</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="checkbox" 
                                checked={filterFields.specialization} 
                                onChange={e => setFilterFields(f => ({...f, specialization: e.target.checked}))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Specialization</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Section Type Section */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                              <span className="text-blue-600 text-xs font-bold">T</span>
                            </div>
                            <span className="font-medium text-sm text-gray-700">Section Type</span>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="radio" 
                                name="filterType" 
                                value="all" 
                                checked={filterType === 'all'} 
                                onChange={() => setFilterType('all')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">All Sections</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="radio" 
                                name="filterType" 
                                value="training" 
                                checked={filterType === 'training'} 
                                onChange={() => setFilterType('training')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Training Only</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="radio" 
                                name="filterType" 
                                value="non-training" 
                                checked={filterType === 'non-training'} 
                                onChange={() => setFilterType('non-training')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Non-Training Only</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input 
                                type="radio" 
                                name="filterType" 
                                value="available" 
                                checked={filterType === 'available'} 
                                onChange={() => setFilterType('available')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              /> 
                              <span className="text-gray-700">Available Only</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                          <button
                            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors font-medium"
                            onClick={() => { 
                              setFilterFields({ 
                                name: true, client: true, course: true, role: true, 
                                taskDetails: true, taskType: true, description: true, specialization: true 
                              }); 
                              setFilterType('all'); 
                            }}
                            type="button"
                          >
                            Reset All
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors font-medium"
                            onClick={() => setFilterOpen(false)}
                            type="button"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Bulk Delete Button and Select All for daily view */}
                {(() => {
                  const allTaskIds = [
                    ...selectedTrainerCategories.trainingTrainers.map(e => e.id),
                    ...selectedTrainerCategories.nonTrainingTrainers.map(e => e.id)
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
                <div className="hidden md:grid md:grid-cols-3 gap-4">
                  {dailySections.map(section => (
                    <div key={section.key} className={`flex flex-col rounded-2xl border ${accentTokens[section.accent].border} bg-white shadow-sm h-[68vh]`}>
                      <div className={`flex items-center justify-between px-4 py-3 border-b ${accentTokens[section.accent].headerBg}`}>
                          <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${accentTokens[section.accent].dot}`}></span>
                          <span className={`text-sm font-semibold ${accentTokens[section.accent].textPrimary}`}>{section.title}</span>
                            </div>
                         <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accentTokens[section.accent].badge}`}>
                           {section.items.length}
                         </span>
                          </div>
                       <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                         {renderSectionItems(section)}
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
                           <span className={`w-2 h-2 rounded-full ${accentTokens[section.accent].dot}`}></span>
                           <span className={`text-sm font-semibold ${accentTokens[section.accent].textPrimary}`}>{section.title}</span>
                  </div>
                          <div className="flex items-center gap-2">
                           <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accentTokens[section.accent].badge}`}>
                             {section.items.length}
                           </span>
                           <ChevronDown className={`w-4 h-4 transition-transform ${activeDailyPanel === section.key ? 'rotate-180' : ''}`} />
                            </div>
                       </button>
                       {activeDailyPanel === section.key && (
                         <div className="px-4 pb-4 space-y-3 max-h-[55vh] overflow-y-auto">
                           {renderSectionItems(section)}
                          </div>
                       )}
                        </div>
                      ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <TrainerMatrixView
            trainers={activeTrainers}
            scheduleData={scheduleData}
            flattenedScheduleData={flattenedScheduleData}
            setScheduleData={setScheduleData}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onScheduleTask={({ trainer, date }) => {
              setSelectedTrainer(trainer.name);
              setSelectedDate(date);
              setIsAllocateModalOpen(true);
            }}
            onEditTask={(entry, date) => {
              startEditTask(entry, date);
            }}
            onDeleteEntry={handleDeleteEntry}
            selectedTaskIds={selectedTaskIds}
            toggleTaskSelection={toggleTaskSelection}
            handleBulkDelete={handleBulkDelete}
            selectAllForDay={selectAllForDay}
            // New props for matrix filters
            matrixFilters={matrixFilters}
            setIsMatrixFilterModalOpen={setIsMatrixFilterModalOpen}
            uniqueSpecializations={uniqueSpecializations}
            uniqueClients={uniqueClients}
            uniqueCourses={uniqueCourses}
            sidebarCollapsed={sidebarCollapsed}
            toast={toast}
          />
        )}
      </div>

      {/* Allocate Modal */}
      {isAllocateModalOpen && createPortal(
      <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={modalContentTransition}
              role="dialog"
              aria-modal="true"
              aria-labelledby="allocate-modal-title"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setIsAllocateModalOpen(false);
                        setSendEmailOnCreate(true); // Reset to default
                      }}
                      className="h-8 w-8 rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      aria-label="Back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  <div>
                      <h3 id="allocate-modal-title" className="text-lg font-semibold text-gray-900">Assign New Schedule</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Allocate training or non-training tasks for selected trainer
                    </p>
                  </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                    setIsAllocateModalOpen(false);
                    setSendEmailOnCreate(true); // Reset to default
                    }} 
                    className="h-8 w-8 rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Content */}
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <WizardSteps title="Allocation Steps" steps={allocateWizardSteps} />
            </div>

              <form 
                id="allocate-form" 
                onSubmit={handleAllocateTraining} 
                className="flex-1 grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]"
              >
                {/* Left Side: Form Fields */}
                <div className={cn('overflow-y-auto border border-slate-200 bg-white px-6 py-6', sectionSpacing, 'rounded-xl shadow-sm')}>
                  {/* Step 1: Task Type Selection */}
                  <div className={cn(cardStyles.surface, 'space-y-4 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Task Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`relative p-2.5 border rounded-md cursor-pointer transition-all duration-150 ${
                        scheduleType === 'training' 
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                        <input 
                          type="radio" 
                          name="scheduleType" 
                          value="training" 
                          checked={scheduleType === 'training'} 
                          onChange={() => setScheduleType('training')} 
                          className="sr-only" 
                        />
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            scheduleType === 'training' ? 'border-blue-500' : 'border-gray-300'
                          }`}>
                            {scheduleType === 'training' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm">Training</p>
                            <p className="text-xs text-gray-500 truncate">Client sessions</p>
                          </div>
                        </div>
                      </label>
                      <label className={`relative p-2.5 border rounded-md cursor-pointer transition-all duration-150 ${
                        scheduleType === 'non-training' 
                          ? 'border-orange-500 bg-orange-50/50 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                        <input 
                          type="radio" 
                          name="scheduleType" 
                          value="non-training" 
                          checked={scheduleType === 'non-training'} 
                          onChange={() => setScheduleType('non-training')} 
                          className="sr-only" 
                        />
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            scheduleType === 'non-training' ? 'border-orange-500' : 'border-gray-300'
                          }`}>
                            {scheduleType === 'non-training' && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm">Non-Training</p>
                            <p className="text-xs text-gray-500 truncate">Internal tasks</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Step 2: Conditional Fields */}
                  {scheduleType === 'training' ? (
                    <div className="space-y-4">
                      <div className={cn(cardStyles.surface, 'space-y-3 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Training Details</label>
                          <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Trainer Name</label>
                            <input 
                              type="text" 
                              name="trainer" 
                              value={selectedTrainer || ''}
                              readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600 text-sm cursor-not-allowed" 
                            />
                          </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Role *</label>
                              <select 
                                name="role" 
                                value={role} 
                                onChange={e => setRole(e.target.value)} 
                                required
                              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors"
                              >
                              <option value="" disabled>Select</option>
                                <option value="TA">TA</option>
                                <option value="Trainer">Trainer</option>
                              </select>
                            </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Client *</label>
                              <select 
                                name="client" 
                                required 
                                value={selectedClient || ''}
                                onChange={(e) => {
                                  setSelectedClient(e.target.value);
                                  const client = clientsWithPMs.find(c => c.clientId === e.target.value);
                                  if (client) {
                                    setForm({ ...form, selectedClientData: client });
                                  }
                                }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors" 
                              >
                                <option value="">Select Client</option>
                                {clientsWithPMs.map(client => (
                                  <option key={client.clientId} value={client.clientId}>
                                    {client.name} ({client.programManagerIds?.length || 0} PM{client.programManagerIds?.length !== 1 ? 's' : ''})
                                  </option>
                                ))}
                              </select>
                            </div>
                        </div>
                        {/* PM Selection - Instant display with smooth animation */}
                        <AnimatePresence>
                            {selectedClient && availablePMs.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-gray-700">
                                    Program Managers <span className="text-gray-500 font-normal">({selectedPMs.length} selected)</span> *
                                </label>
                                  {selectedPMs.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPMs([])}
                                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50/50 max-h-36 overflow-y-auto">
                                  <div className="space-y-1.5">
                                    {availablePMs.map(pm => {
                                      const pmId = pm.uid || pm.id;
                                      const pmName = pm.displayName || pm.name || pm.email?.split('@')[0] || 'Unknown';
                                      const isSelected = selectedPMs.includes(pmId);
                                      return (
                                        <label
                                          key={pmId}
                                          className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-white rounded-md cursor-pointer transition-colors group"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedPMs([...selectedPMs, pmId]);
                                              } else {
                                                setSelectedPMs(selectedPMs.filter(id => id !== pmId));
                                              }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-gray-900">{pmName}</span>
                                            <span className="text-xs text-gray-500 ml-1.5 truncate block">{pm.email}</span>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {selectedPMs.length === 0 && (
                                    <p className="text-xs text-red-600 mt-2 font-medium">Please select at least one Program Manager</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {selectedClient && availablePMs.length === 0 && allPMs.length > 0 && (
                          <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                            <p className="text-xs text-orange-700 font-medium">
                              ⚠️ No Program Managers assigned to this client. Please assign PMs in Client Management first.
                            </p>
                          </div>
                            )}
                        
                            <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Course *</label>
                              <input 
                                type="text" 
                                name="course" 
                                required 
                            placeholder="Enter course name"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors" 
                              />
                            </div>
                        
                          <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Description *</label>
                            <textarea 
                              name="description" 
                              required 
                            placeholder="Enter session description"
                              rows="3"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none bg-white transition-colors" 
                            />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={cn(cardStyles.surface, 'space-y-3 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Task Details</label>
                          <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Trainer Name</label>
                            <input 
                              type="text" 
                              name="trainer" 
                              value={selectedTrainer || ''}
                              readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600 text-sm cursor-not-allowed" 
                            />
                          </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Task Type *</label>
                              <select 
                                name="taskType" 
                                value={taskType} 
                                onChange={e => setTaskType(e.target.value)} 
                              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white transition-colors"
                              >
                              <option value="Question creation">Question Creation</option>
                              <option value="QC">Quality Check</option>
                                <option value="Upskilling">Upskilling</option>
                                <option value="Others">Others</option>
                              </select>
                            </div>
                            <div>
                            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Task Details *</label>
                              <input 
                                type="text" 
                                name="taskDetails" 
                                required 
                              placeholder="Brief description"
                              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white transition-colors" 
                              />
                            </div>
                          </div>
                          <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Description *</label>
                            <textarea 
                              name="description" 
                              required 
                            placeholder="Enter detailed description"
                              rows="3"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-none bg-white transition-colors" 
                            />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Right Side: Date Range & Summary */}
                <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm lg:px-6 lg:py-6">
                  <div className={cn(cardStyles.surface, 'space-y-4 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Select Dates</h4>
                    </div>
                  <p className="text-xs text-slate-500">
                      Define the range for this assignment and exclude dates that should be skipped.
                  </p>
                    <DateRangeSelector 
                      onDateRangeChange={setSelectedDateRange} 
                      initialStartDate={selectedDate}
                      initialEndDate={selectedDate}
                    />
                  <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-700">
                    <h5 className="mb-1 font-semibold uppercase tracking-wide text-blue-600">Quick Tips</h5>
                    <ul className="space-y-1">
                        <li>• Target the full engagement window; you can trim dates later.</li>
                        <li>• Use exclusions for campus holidays, leaves, or custom gaps.</li>
                        <li>• Conflict checks run automatically when you save.</li>
                      </ul>
                    </div>
                  </div>

                  <div className={cn(cardStyles.surface, 'space-y-3 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Live Summary</h4>
                    <span className="text-xs font-medium text-slate-400">Auto-updates</span>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Trainer:</span> {scheduleSummary.trainerName}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Type:</span> {scheduleSummary.taskTypeLabel}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Date Range:</span> {scheduleSummary.dateRange}
                    </div>
                      {scheduleType === 'training' && (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Client:</span> {scheduleSummary.clientName}
                        </div>
                      )}
                    {scheduleSummary.excludedDates.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <span className="font-semibold text-amber-800">Excluded:</span>{' '}
                        {scheduleSummary.excludedDates.join(', ')}
                      </div>
                    )}
                      {scheduleType === 'training' && (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Program Managers:</span>
                          <div className="flex flex-wrap gap-1.5 text-xs mt-1">
                            {selectedPMNames.length > 0 ? (
                              selectedPMNames.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-600"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">
                                PM notifications pending
                              </span>
                            )}
                          </div>
                        </div>
                    )}
                    </div>
                  </div>
                </div>
              </form>
              
              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-4">
                  {/* Email Notification Option */}
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="send-email-allocate"
                      checked={sendEmailOnCreate}
                      onCheckedChange={(checked) => setSendEmailOnCreate(checked)}
                      className="border-gray-300"
                    />
                    <label
                      htmlFor="send-email-allocate"
                      className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4 text-gray-500" />
                      Send email notification
                    </label>
                  </div>
                  
                  {/* Status and Actions */}
                  <div className="flex items-center gap-3">
                    {selectedTrainer && (
                      <div className="text-xs text-gray-600 hidden sm:block">
                        Ready for <span className="font-semibold text-gray-900">{selectedTrainer}</span>
                    </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={() => {
                          setIsAllocateModalOpen(false);
                          setSendEmailOnCreate(true); // Reset to default
                        }} 
                        variant="outline" 
                        className="px-4 py-2 text-sm border-gray-300 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        form="allocate-form" 
                        className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      >
                      Allocate Schedule
                    </Button>
                    </div>
                </div>
              </div>
            </div>
            </motion.div>
          </motion.div>
      </AnimatePresence>
      , document.body)}

      {/* Schedule Modal */}
      {isScheduleModalOpen && createPortal(
      <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            role="presentation"
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={modalContentTransition}
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-modal-title"
            >
            {/* Header */}
            <div className="p-5 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeScheduleModal}
                    className="h-8 w-8 rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                <div>
                  <h3 id="schedule-modal-title" className="text-lg font-semibold text-gray-900">Schedule New Task</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Allocate training or non-training tasks for your team members
                  </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeScheduleModal}
                  className="h-8 w-8 rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <WizardSteps title="Scheduling Steps" steps={scheduleWizardSteps} />
            </div>

            <form
              id="schedule-form"
              onSubmit={handleScheduleSubmit}
              className="flex-1 grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]"
            >
              {/* Left Side: Form Fields */}
              <div className={cn('overflow-y-auto border border-slate-200 bg-white px-6 py-6', sectionSpacing, 'rounded-xl shadow-sm')}>
                {/* Step 1: Task Type Selection */}
                <div className={cn(cardStyles.surface, 'space-y-4 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Task Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`relative p-2.5 border rounded-md cursor-pointer transition-all duration-150 ${
                      scheduleType === 'training' 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                      <input 
                        type="radio" 
                        name="scheduleType" 
                        value="training" 
                        checked={scheduleType === 'training'} 
                        onChange={() => setScheduleType('training')} 
                        className="sr-only" 
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          scheduleType === 'training' ? 'border-blue-500' : 'border-gray-300'
                        }`}>
                          {scheduleType === 'training' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm">Training</p>
                          <p className="text-xs text-gray-500 truncate">Client sessions</p>
                        </div>
                      </div>
                    </label>
                    <label className={`relative p-2.5 border rounded-md cursor-pointer transition-all duration-150 ${
                      scheduleType === 'non-training' 
                        ? 'border-orange-500 bg-orange-50/50 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                      <input 
                        type="radio" 
                        name="scheduleType" 
                        value="non-training" 
                        checked={scheduleType === 'non-training'} 
                        onChange={() => setScheduleType('non-training')} 
                        className="sr-only" 
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          scheduleType === 'non-training' ? 'border-orange-500' : 'border-gray-300'
                        }`}>
                          {scheduleType === 'non-training' && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm">Non-Training</p>
                          <p className="text-xs text-gray-500 truncate">Internal tasks</p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Step 2: Trainer Selection */}
                <div className={cn(cardStyles.surface, 'space-y-4 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Trainer</label>
                  <p className="text-xs text-slate-500">Search by name; only active trainers appear in this list.</p>
                  <div className="relative">
                    <button
                      ref={trainerTriggerRef}
                      type="button"
                      onClick={handleToggleTrainerDropdown}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 text-sm flex justify-between items-center text-left bg-white hover:border-gray-300"
                    >
                      <span className="truncate text-gray-900">{selectedTrainer || 'Choose a trainer...'}</span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isTrainerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isTrainerDropdownOpen && (
                        <motion.div
                          ref={trainerDropdownContentRef}
                          initial={{ opacity: 0, scale: 0.95, y: -5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -5 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          style={dropdownStyle}
                          className="fixed z-[999] w-72 bg-white shadow-lg rounded-md border border-gray-200 max-h-64 flex flex-col"
                        >
                          <div className="p-2 border-b border-gray-100">
                            <input
                              type="text"
                              placeholder="Search trainers..."
                              value={trainerSearchTerm}
                              onChange={e => setTrainerSearchTerm(e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                            />
                          </div>
                          <ul className="py-1 overflow-y-auto">
                            {activeTrainers
                              .filter(t => t.name.toLowerCase().includes(trainerSearchTerm.toLowerCase()))
                              .map(t => (
                                <li
                                  key={t.id}
                                  onClick={() => {
                                    setSelectedTrainer(t.name);
                                    setIsTrainerDropdownOpen(false);
                                  }}
                                  className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer transition-colors duration-100"
                                >
                                  {t.name}
                                </li>
                              ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <input type="hidden" name="trainer" value={selectedTrainer} required />
                </div>

                {/* Step 3: Conditional Fields */}
                {scheduleType === 'training' ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Training Details</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Role *</label>
                          <select 
                            name="role" 
                            value={role} 
                            onChange={e => setRole(e.target.value)} 
                            required
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors"
                          >
                            <option value="" disabled>Select</option>
                            <option value="TA">TA</option>
                            <option value="Trainer">Trainer</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Client *</label>
                          <select 
                            name="client" 
                            required 
                            value={selectedClient || ''}
                            onChange={(e) => {
                              const clientId = e.target.value;
                              setSelectedClient(clientId);
                              const client = clientsWithPMs.find(c => c.clientId === clientId);
                              if (client) {
                                setForm({ ...form, selectedClientData: client });
                              } else {
                                setSelectedPMs([]);
                                setAvailablePMs([]);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors" 
                          >
                            <option value="">Select Client</option>
                            {clientsWithPMs.map(client => (
                              <option key={client.clientId} value={client.clientId}>
                                {client.name} ({client.programManagerIds?.length || 0} PM{client.programManagerIds?.length !== 1 ? 's' : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* PM Selection - Instant display with smooth animation */}
                      <AnimatePresence>
                        {selectedClient && availablePMs.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-700">
                                  Program Managers <span className="text-gray-500 font-normal">({selectedPMs.length} selected)</span> *
                                </label>
                                {selectedPMs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPMs([])}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50/50 max-h-36 overflow-y-auto">
                                <div className="space-y-1.5">
                                  {availablePMs.map(pm => {
                                    const pmId = pm.uid || pm.id;
                                    const pmName = pm.displayName || pm.name || pm.email?.split('@')[0] || 'Unknown';
                                    const isSelected = selectedPMs.includes(pmId);
                                    return (
                                      <label
                                        key={pmId}
                                        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-white rounded-md cursor-pointer transition-colors group"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedPMs([...selectedPMs, pmId]);
                                            } else {
                                              setSelectedPMs(selectedPMs.filter(id => id !== pmId));
                                            }
                                          }}
                                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm font-medium text-gray-900">{pmName}</span>
                                          <span className="text-xs text-gray-500 ml-1.5 truncate block">{pm.email}</span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                                {selectedPMs.length === 0 && (
                                  <p className="text-xs text-red-600 mt-2 font-medium">Please select at least one Program Manager</p>
                                )}
                              </div>
            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {selectedClient && availablePMs.length === 0 && allPMs.length > 0 && (
                        <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                          <p className="text-xs text-orange-700 font-medium">
                            ⚠️ No Program Managers assigned to this client. Please assign PMs in Client Management first.
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1.5 block">Course *</label>
                        <input 
                          type="text" 
                          name="course" 
                          required 
                          placeholder="Enter course name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-colors" 
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1.5 block">Description *</label>
                        <textarea 
                          name="description" 
                          required 
                          placeholder="Enter session description"
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none bg-white transition-colors" 
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Task Details</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Task Type *</label>
                          <select 
                            name="taskType" 
                            value={taskType} 
                            onChange={e => setTaskType(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white transition-colors"
                          >
                            <option value="Question creation">Question Creation</option>
                            <option value="QC">Quality Check</option>
                            <option value="Upskilling">Upskilling</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Task Details *</label>
                          <input 
                            type="text" 
                            name="taskDetails" 
                            required 
                            placeholder="Brief description"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm bg-white transition-colors" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1.5 block">Description *</label>
                        <textarea 
                          name="description" 
                          required 
                          placeholder="Enter detailed description"
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-none bg-white transition-colors" 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
                {/* Right Side: Date Range & Summary */}
              <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm lg:px-6 lg:py-6">
                <div className={cn(cardStyles.surface, 'space-y-4 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Select Dates</h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    Define the range for this assignment and exclude dates that should be skipped.
                  </p>
                    <DateRangeSelector onDateRangeChange={setSelectedDateRange} />
                  <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-700">
                    <h5 className="mb-1 font-semibold uppercase tracking-wide text-blue-600">Quick Tips</h5>
                    <ul className="space-y-1">
                      <li>• Target the full engagement window; you can trim dates later.</li>
                      <li>• Use exclusions for campus holidays, leaves, or custom gaps.</li>
                      <li>• Conflict checks run automatically when you save.</li>
                    </ul>
                  </div>
                  </div>
                  
                <div className={cn(cardStyles.surface, 'space-y-3 border border-slate-200 p-4 sm:p-5 shadow-sm')}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Live Summary</h4>
                    <span className="text-xs font-medium text-slate-400">Auto-updates</span>
                    </div>
                  <div className="grid gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Trainer:</span> {scheduleSummary.trainerName}
                  </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Type:</span> {scheduleSummary.taskTypeLabel}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Date Range:</span> {scheduleSummary.dateRange}
                    </div>
                    {scheduleType === 'training' && (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Client:</span> {scheduleSummary.clientName}
                      </div>
                    )}
                    {scheduleSummary.excludedDates.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <span className="font-semibold text-amber-800">Excluded:</span>{' '}
                        {scheduleSummary.excludedDates.join(', ')}
                      </div>
                    )}
                    {scheduleType === 'training' && (
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {selectedPMNames.length > 0 ? (
                          selectedPMNames.map((name) => (
                            <span
                              key={name}
                              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-600"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">
                            PM notifications pending
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-4">
                {/* Email Notification Option */}
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="send-email-create"
                    checked={sendEmailOnCreate}
                    onCheckedChange={(checked) => setSendEmailOnCreate(checked)}
                    className="border-gray-300"
                  />
                  <label
                    htmlFor="send-email-create"
                    className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-gray-500" />
                    Send email notification
                  </label>
                </div>
                
                {/* Status and Actions */}
                <div className="flex items-center gap-3">
                  {selectedTrainer && (
                    <div className="text-xs text-gray-600 hidden sm:block">
                      Ready for <span className="font-semibold text-gray-900">{selectedTrainer}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      onClick={closeScheduleModal} 
                      variant="outline" 
                      className="px-4 py-2 text-sm border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      form="schedule-form" 
                      className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      Schedule Task
                    </Button>
                </div>
              </div>
            </div>
          </div>
            </motion.div>
        </motion.div>
      </AnimatePresence>
      , document.body)}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmModalOpen && createPortal(
      <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-[60] p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            role="presentation"
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={modalContentTransition}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              aria-describedby="delete-modal-description"
            >
              <div className="flex items-start gap-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-0 text-left">
                  <h3 id="delete-modal-title" className="text-lg leading-6 font-medium text-gray-900">
                    Delete Task
                  </h3>
                  <div className="mt-2">
                    <p id="delete-modal-description" className="text-sm text-gray-500">
                      Are you sure you want to delete this task?
                    </p>
                    {deleteTarget && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">
                          {deleteTarget.entry.trainer}
                        </p>
                        <p className="text-sm text-gray-600">
                          {deleteTarget.entry.type === 'training' 
                            ? `${deleteTarget.entry.role} for ${deleteTarget.entry.client} (${deleteTarget.entry.course})`
                            : deleteTarget.entry.taskDetails
                          }
                        </p>
                        <p className="text-sm text-gray-600">
                          Date: {deleteTarget.entry.startDate 
                            ? formatDateForDisplay(deleteTarget.entry.startDate)
                            : (deleteTarget.date 
                              ? formatDateForDisplay(deleteTarget.date)
                              : 'N/A')}
                        </p>
                      </div>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-email-delete"
                    checked={sendEmailOnDelete}
                    onCheckedChange={(checked) => setSendEmailOnDelete(checked)}
                  />
                  <label
                    htmlFor="send-email-delete"
                    className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-gray-500" />
                    Send email notification to trainer
                  </label>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <Button
                  variant="destructive"
                  onClick={confirmDeleteEntry}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeleteConfirmModalOpen(false);
                    setDeleteTarget(null);
                    setSendEmailOnDelete(true); // Reset to default
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
      </AnimatePresence>
      , document.body)}

      {/* Enhanced Edit Modal */}
      {isEditModalOpen && createPortal(
      <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/80 flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            role="presentation"
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-200"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={modalContentTransition}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-task-modal-title"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelEditTask}
                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      aria-label="Back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  <div>
                      <h3 id="edit-task-modal-title" className="text-lg font-semibold text-slate-900">
                      {isBulkEditMode ? 'Bulk Edit Task' : 'Edit Task'}
                    </h3>
                      <p className="text-sm text-slate-500">
                      {isBulkEditMode 
                          ? 'Update this assignment across multiple days.'
                          : 'Modify task details for the selected day.'}
                    </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEditTask}
                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <WizardSteps title="Update Steps" steps={allocateWizardSteps} />
              </div>
              
              {/* Content */}
              <form
                onSubmit={saveEditTask}
                className="flex-1 grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]"
              >
                {/* Left Side: Form Fields */}
                <div
                  className={cn(
                    'overflow-y-auto border border-slate-200 bg-white px-6 py-6',
                    sectionSpacing,
                    'rounded-xl shadow-sm'
                  )}
                >
                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-4')}>
                    <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-violet-500" />
                        <span className="text-sm font-semibold text-slate-700">Edit Mode</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBulkEditMode(!isBulkEditMode)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        isBulkEditMode
                            ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        )}
                    >
                      {isBulkEditMode ? 'Bulk Edit' : 'Single Day'}
                    </button>
                  </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      <div className="flex gap-3">
                        <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-amber-500 text-[11px] font-semibold text-white flex items-center justify-center">
                          !
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-800">Task type cannot be changed</p>
                          <p>
                            To switch from {originalTaskType === 'training' ? 'Training' : 'Non-Training'} to{' '}
                            {originalTaskType === 'training' ? 'Non-Training' : 'Training'}, delete this task and create a
                            new one.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label
                        className={cn(
                          'relative flex flex-col gap-2 rounded-xl border-2 p-3 transition shadow-sm',
                        editingForm.type === 'training' 
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 bg-slate-50',
                          originalTaskType === 'training'
                            ? 'cursor-default'
                            : 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <input 
                          type="radio" 
                          name="editType" 
                          value="training" 
                          checked={editingForm.type === 'training'} 
                          onChange={() => {}} 
                          disabled={originalTaskType !== 'training'}
                          className="sr-only" 
                        />
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border-2',
                              editingForm.type === 'training' ? 'border-sky-500' : 'border-slate-300'
                            )}
                          >
                            {editingForm.type === 'training' && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">Training</span>
                          </div>
                        <p className="text-xs text-slate-500">Client-facing sessions</p>
                      </label>

                      <label
                        className={cn(
                          'relative flex flex-col gap-2 rounded-xl border-2 p-3 transition shadow-sm',
                        editingForm.type === 'non-training' 
                          ? 'border-orange-500 bg-orange-50' 
                            : 'border-slate-200 bg-slate-50',
                          originalTaskType === 'non-training'
                            ? 'cursor-default'
                            : 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <input 
                          type="radio" 
                          name="editType" 
                          value="non-training" 
                          checked={editingForm.type === 'non-training'} 
                          onChange={() => {}} 
                          disabled={originalTaskType !== 'non-training'}
                          className="sr-only" 
                        />
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border-2',
                              editingForm.type === 'non-training' ? 'border-orange-500' : 'border-slate-300'
                            )}
                          >
                            {editingForm.type === 'non-training' && (
                              <span className="h-2 w-2 rounded-full bg-orange-500" />
                            )}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">Non-Training</span>
                          </div>
                        <p className="text-xs text-slate-500">Internal tasks & meetings</p>
                      </label>
                    </div>
                  </div>

                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-3')}>
                  <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Select Trainer
                    </label>
                      <p className="text-xs text-slate-500">Only active trainers appear in this list.</p>
                    </div>
                    <select 
                      name="trainer" 
                      value={editingForm.trainer || ''} 
                      onChange={(e) => setEditingForm((f) => ({ ...f, trainer: e.target.value }))}
                      required 
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">Choose a trainer...</option>
                      {activeTrainers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-4')}>
                  <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date Range
                    </label>
                      <p className="text-xs text-slate-500">
                        {isBulkEditMode ? 'Choose the window for this bulk update.' : 'Dates are locked for single-day edits.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
                                                  <input 
                          type="date" 
                          value={
                            isBulkEditMode ? bulkEditDateRange.startDate : editingForm.startDate || ''
                          }
                          onChange={(e) => {
                            if (isBulkEditMode) {
                              setBulkEditDateRange((prev) => ({ ...prev, startDate: e.target.value }));
                            }
                            setEditingForm((prev) => ({ ...prev, startDate: e.target.value }));
                          }} 
                          required 
                          readOnly={!isBulkEditMode}
                          className={cn(
                            'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100',
                            !isBulkEditMode && 'bg-slate-50'
                          )}
                        />
                        </div>
                        <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">End Date</label>
                                                  <input 
                          type="date" 
                          value={
                            isBulkEditMode ? bulkEditDateRange.endDate : editingForm.endDate || ''
                          }
                          onChange={(e) => {
                            if (isBulkEditMode) {
                              setBulkEditDateRange((prev) => ({ ...prev, endDate: e.target.value }));
                            }
                            setEditingForm((prev) => ({ ...prev, endDate: e.target.value }));
                          }} 
                          required 
                          readOnly={!isBulkEditMode}
                          className={cn(
                            'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100',
                            !isBulkEditMode && 'bg-slate-50'
                          )}
                        />
                        </div>
                  </div>

                  {isBulkEditMode && bulkEditDateRange.startDate && bulkEditDateRange.endDate && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {(() => {
                          const startDate = new Date(bulkEditDateRange.startDate);
                          const endDate = new Date(bulkEditDateRange.endDate);
                          const datesInRange = [];
                          
                          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                            datesInRange.push(new Date(d).toISOString().split('T')[0]);
                          }
                          
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">
                                  Toggle dates to exclude from this bulk update.
                                </span>
                                {excludedDates.length > 0 && (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                    {excludedDates.length} excluded
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-7 gap-1 text-xs">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                  <div
                                    key={`day-header-${index}`}
                                    className="py-1 text-center font-semibold text-slate-400"
                                  >
                                    {day}
                                  </div>
                                ))}
                                
                                {(() => {
                                  const firstDay = new Date(startDate).getDay();
                                  const paddingDays = Array(firstDay).fill(null);
                                  const dateDays = datesInRange.map((dateStr) => {
                                    const date = new Date(dateStr);
                                    const isExcluded = excludedDates.includes(dateStr);
                                    return { dateStr, date, isExcluded };
                                  });
                                  
                                  return [...paddingDays, ...dateDays].map((item, index) => (
                                    <div key={index} className="flex h-8 items-center justify-center">
                                      {item && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (excludedDates.includes(item.dateStr)) {
                                              setExcludedDates((prev) => prev.filter((d) => d !== item.dateStr));
                                            } else {
                                              setExcludedDates((prev) => [...prev, item.dateStr]);
                                            }
                                          }}
                                          className={cn(
                                            'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                                            item.isExcluded
                                              ? 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600'
                                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                                          )}
                                        >
                                          {item.date.getDate()}
                                        </button>
                                      )}
                                    </div>
                                  ));
                                })()}
                              </div>
                              
                              {excludedDates.length > 0 && (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                                  <p className="text-xs font-semibold text-rose-700">Excluded Dates</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {excludedDates.map((dateStr) => (
                                      <span
                                        key={dateStr}
                                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-medium text-rose-700"
                                      >
                                        {new Date(dateStr).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => setExcludedDates((prev) => prev.filter((d) => d !== dateStr))}
                                          className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-rose-100"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  )}
                  </div>

                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-4')}>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {editingForm.type === 'training' ? 'Training Details' : 'Task Details'}
                      </label>
                      <p className="text-xs text-slate-500">
                        Update the key fields that trainers and program managers will see.
                      </p>
                    </div>

                  {editingForm.type === 'training' ? (
                    <>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</span>
                        <select 
                          name="role" 
                          value={editingForm.role || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, role: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">Select role...</option>
                          <option value="TA">TA</option>
                          <option value="Trainer">Trainer</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</span>
                        <input 
                          type="text" 
                          name="client" 
                          value={editingForm.client || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, client: e.target.value }))}
                          required 
                          placeholder="Enter client name..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Course</span>
                        <input 
                          type="text" 
                          name="course" 
                          value={editingForm.course || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, course: e.target.value }))}
                          required 
                          placeholder="Enter course name..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</span>
                        <textarea 
                          name="description" 
                          value={editingForm.description || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, description: e.target.value }))}
                          required 
                            placeholder="Add context for this session..."
                          rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Task</span>
                        <input 
                          type="text" 
                          name="taskDetails" 
                          value={editingForm.taskDetails || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, taskDetails: e.target.value }))}
                          required 
                          placeholder="Enter task details..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</span>
                        <textarea 
                          name="description" 
                          value={editingForm.description || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, description: e.target.value }))}
                          required 
                            placeholder="Describe what needs to be done..."
                          rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                      <div className="space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Task Type</span>
                        <select 
                          name="taskType" 
                          value={editingForm.taskType || ''} 
                            onChange={(e) => setEditingForm((f) => ({ ...f, taskType: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">Select task type...</option>
                          <option value="Question creation">Question creation</option>
                          <option value="QC">QC</option>
                          <option value="Upskilling">Upskilling</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </>
                  )}
                  </div>
                </div>

                {/* Right Side: Preview & Actions */}
                <div
                  className={cn(
                    'overflow-y-auto border border-slate-200 bg-slate-50 px-6 py-6',
                    'rounded-xl shadow-sm flex flex-col gap-4'
                  )}
                >
                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-3')}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Task Preview</h4>
                      <span
                        className={cn(
                          getChipClasses(editingForm.type === 'training' ? 'info' : 'warning'),
                          'px-2 py-0.5 text-[11px] uppercase'
                        )}
                      >
                          {editingForm.type === 'training' ? 'Training' : 'Non-Training'}
                        </span>
                      </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Trainer</span>
                        <span className="font-medium text-slate-900">{editingForm.trainer || 'Not selected'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Date</span>
                        <span className="font-medium text-slate-900">
                          {isBulkEditMode 
                            ? `${bulkEditDateRange.startDate || '—'} to ${bulkEditDateRange.endDate || '—'}`
                            : editingForm.startDate || '—'}
                        </span>
                      </div>
                      {isBulkEditMode && excludedDates.length > 0 && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Excluded</span>
                          <span className="font-medium text-rose-600">
                            {excludedDates.length} date{excludedDates.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {editingForm.type === 'training' ? (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Role</span>
                            <span className="font-medium text-slate-900">{editingForm.role || 'Not selected'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Client</span>
                            <span className="font-medium text-slate-900">{editingForm.client || 'Not specified'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Course</span>
                            <span className="font-medium text-slate-900">{editingForm.course || 'Not specified'}</span>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-slate-500">Description</span>
                            <span className="max-w-[60ch] text-right text-slate-900">
                              {editingForm.description || 'Not specified'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Task</span>
                            <span className="font-medium text-slate-900">{editingForm.taskDetails || 'Not specified'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Type</span>
                            <span className="font-medium text-slate-900">{editingForm.taskType || 'Not selected'}</span>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-slate-500">Description</span>
                            <span className="max-w-[60ch] text-right text-slate-900">
                              {editingForm.description || 'Not specified'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={cn(cardStyles.surface, cardPadding, 'space-y-3')}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="send-email-update"
                        checked={sendEmailOnUpdate}
                        onCheckedChange={(checked) => setSendEmailOnUpdate(checked)}
                      />
                      <label
                        htmlFor="send-email-update"
                        className="text-sm font-medium text-slate-700 flex items-start gap-2"
                      >
                        <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                        <span>Send email notification to trainer</span>
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">
                      Trainers receive an updated summary of the assignment details.
                    </p>
                  </div>

                  <div className={cn(cardStyles.surface, cardPadding)}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={cancelEditTask}
                        className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                      <Button type="submit" className="w-full sm:w-auto">
                      {isBulkEditMode ? 'Update All Days' : 'Save Changes'}
                    </Button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
      </AnimatePresence>
      , document.body)}

      {/* Add the export modal */}
      {isExportModalOpen && renderExportModal()}

      {/* More Tasks Modal */}
      {isMoreTasksModalOpen && renderMoreTasksModal()}

      {/* Enhanced Matrix Filter Modal */}
      {isMatrixFilterModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Filter className="w-5 h-5 text-blue-600" />
            </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Matrix View Filters</h3>
                  <p className="text-sm text-gray-500">Filter trainers and schedules across the entire matrix</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMatrixFilterModalOpen(false)} 
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Specialization Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">S</span>
                    </div>
                    Specialization
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, specialization: uniqueSpecializations }))}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, specialization: [] }))}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {uniqueSpecializations.length > 0 ? (uniqueSpecializations.map(spec => (
                    <label key={spec} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={matrixFilters.specialization.includes(spec)}
                        onChange={(e) => {
                          setMatrixFilters(prev => ({
                            ...prev,
                            specialization: e.target.checked
                              ? [...prev.specialization, spec]
                              : prev.specialization.filter(s => s !== spec)
                          }));
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700 truncate">{spec}</span>
                    </label>
                  ))) : (<p className="col-span-2 md:col-span-3 text-gray-500 text-center py-2">No specializations found.</p>)}
                </div>
              </div>

              {/* Client Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">
                      <span className="text-green-600 text-xs font-bold">C</span>
                    </div>
                    Client
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, client: uniqueClients }))}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, client: [] }))}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {uniqueClients.length > 0 ? (uniqueClients.map(client => (
                    <label key={client} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={matrixFilters.client.includes(client)}
                        onChange={(e) => {
                          setMatrixFilters(prev => ({
                            ...prev,
                            client: e.target.checked
                              ? [...prev.client, client]
                              : prev.client.filter(c => c !== client)
                          }));
                        }}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-gray-700 truncate">{client}</span>
                    </label>
                  ))) : (<p className="col-span-2 md:col-span-3 text-gray-500 text-center py-2">No clients found.</p>)}
                </div>
              </div>

              {/* Course Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                      <span className="text-purple-600 text-xs font-bold">C</span>
                    </div>
                    Course
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, course: uniqueCourses }))}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixFilters(prev => ({ ...prev, course: [] }))}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {uniqueCourses.length > 0 ? (uniqueCourses.map(course => (
                    <label key={course} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={matrixFilters.course.includes(course)}
                        onChange={(e) => {
                          setMatrixFilters(prev => ({
                            ...prev,
                            course: e.target.checked
                              ? [...prev.course, course]
                              : prev.course.filter(c => c !== course)
                          }));
                        }}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-gray-700 truncate">{course}</span>
                    </label>
                  ))) : (<p className="col-span-2 md:col-span-3 text-gray-500 text-center py-2">No courses found.</p>)}
                </div>
              </div>

              {/* Date Range Filter */}
                <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center">
                    <span className="text-orange-600 text-xs font-bold">D</span>
                  </div>
                  Date Range
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={matrixFilters.startDate}
                    onChange={e => setMatrixFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={matrixFilters.endDate}
                    onChange={e => setMatrixFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  />
                  </div>
                </div>
              </div>
              
              {/* Type Filter */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-xs font-bold">T</span>
                  </div>
                  Schedule Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input 
                      type="radio" 
                      name="matrixFilterType" 
                      value="all" 
                      checked={matrixFilters.type === 'all'} 
                      onChange={() => setMatrixFilters(prev => ({ 
                        ...prev, 
                        type: 'all',
                        role: 'all', // Reset role when switching to all types
                        nonTrainingTaskTypes: [] // Reset non-training task types
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    /> 
                    <span className="text-gray-700">All Types</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input 
                      type="radio" 
                      name="matrixFilterType" 
                      value="training" 
                      checked={matrixFilters.type === 'training'} 
                      onChange={() => setMatrixFilters(prev => ({ 
                        ...prev, 
                        type: 'training',
                        nonTrainingTaskTypes: [] // Reset non-training task types when switching to training
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    /> 
                    <span className="text-gray-700">Training Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input 
                      type="radio" 
                      name="matrixFilterType" 
                      value="non-training" 
                      checked={matrixFilters.type === 'non-training'} 
                      onChange={() => setMatrixFilters(prev => ({ 
                        ...prev, 
                        type: 'non-training',
                        role: 'all' // Reset role when switching to non-training
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    /> 
                    <span className="text-gray-700">Non-Training Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input 
                      type="radio" 
                      name="matrixFilterType" 
                      value="available" 
                      checked={matrixFilters.type === 'available'} 
                      onChange={() => setMatrixFilters(prev => ({ 
                        ...prev, 
                        type: 'available',
                        role: 'all', // Reset role when switching to available
                        nonTrainingTaskTypes: [] // Reset non-training task types
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    /> 
                    <span className="text-gray-700">Available Only</span>
                  </label>
                </div>
              </div>

              {/* Role Filter - Only show when Training is selected */}
              {matrixFilters.type === 'training' && (
              <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <div className="w-4 h-4 bg-indigo-100 rounded flex items-center justify-center">
                      <span className="text-indigo-600 text-xs font-bold">R</span>
                    </div>
                    Trainer Role
                  </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                      <input 
                        type="radio" 
                        name="matrixFilterRole" 
                        value="all" 
                        checked={matrixFilters.role === 'all'} 
                        onChange={() => setMatrixFilters(prev => ({ ...prev, role: 'all' }))}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      /> 
                      <span className="text-gray-700">All Roles</span>
                  </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                      <input 
                        type="radio" 
                        name="matrixFilterRole" 
                        value="TA" 
                        checked={matrixFilters.role === 'TA'} 
                        onChange={() => setMatrixFilters(prev => ({ ...prev, role: 'TA' }))}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      /> 
                      <span className="text-gray-700">TA Only</span>
                  </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                      <input 
                        type="radio" 
                        name="matrixFilterRole" 
                        value="Trainer" 
                        checked={matrixFilters.role === 'Trainer'} 
                        onChange={() => setMatrixFilters(prev => ({ ...prev, role: 'Trainer' }))}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      /> 
                      <span className="text-gray-700">Trainer Only</span>
                  </label>
                </div>
              </div>
              )}

              {/* Non-Training Task Types Filter - Only show when Non-Training is selected */}
              {matrixFilters.type === 'non-training' && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                      <span className="text-purple-600 text-xs font-bold">NT</span>
            </div>
                    Non-Training Task Types
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setMatrixFilters(prev => ({ ...prev, nonTrainingTaskTypes: ['Question creation', 'QC', 'Upskilling', 'Others'] }))}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrixFilters(prev => ({ ...prev, nonTrainingTaskTypes: [] }))}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        None
                      </button>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Question creation', 'QC', 'Upskilling', 'Others'].map(taskType => (
                      <label key={taskType} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                        <input 
                          type="checkbox" 
                          checked={matrixFilters.nonTrainingTaskTypes.includes(taskType)} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMatrixFilters(prev => ({ 
                                ...prev, 
                                nonTrainingTaskTypes: [...prev.nonTrainingTaskTypes, taskType] 
                              }));
                            } else {
                              setMatrixFilters(prev => ({ 
                                ...prev, 
                                nonTrainingTaskTypes: prev.nonTrainingTaskTypes.filter(t => t !== taskType) 
                              }));
                            }
                          }}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        /> 
                        <span className="text-gray-700">{taskType}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" />
                <span>
                  {(() => {
                    let activeCount = 0;
                    // Count array-based filters
                    activeCount += matrixFilters.specialization.length;
                    activeCount += matrixFilters.client.length;
                    activeCount += matrixFilters.course.length;
                    activeCount += matrixFilters.nonTrainingTaskTypes.length;
                    // Count radio button filters (if not 'all')
                    if (matrixFilters.type !== 'all') activeCount += 1;
                    if (matrixFilters.role !== 'all') activeCount += 1;
                    // Count date filters
                    if (matrixFilters.startDate && matrixFilters.startDate.trim() !== '') activeCount += 1;
                    if (matrixFilters.endDate && matrixFilters.endDate.trim() !== '') activeCount += 1;
                    return activeCount;
                  })()} filters active
                </span>
              </div>
              <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setMatrixFilters({
                    specialization: [],
                    client: [],
                    course: [],
                    startDate: '',
                    endDate: '',
                    type: 'all',
                    role: 'all',
                    nonTrainingTaskTypes: [],
                  });
                }}
                  className="px-4 py-2 text-sm"
              >
                  Reset All
              </Button>
                <Button 
                  onClick={() => setIsMatrixFilterModalOpen(false)}
                  className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700"
                >
                Apply Filters
              </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Async Confirm Dialog */}
      <Dialog open={confirmState.open} onOpenChange={(open) => { if (!open) handleConfirmCancel(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmState.title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap text-gray-700">
            {confirmState.content}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleConfirmCancel}>{confirmState.cancelText}</Button>
            <Button onClick={handleConfirmOk}>{confirmState.okText}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
  