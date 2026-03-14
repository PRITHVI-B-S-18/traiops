import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/styles/designSystem';
import { loadTrainerData } from '@/utils/firestoreTrainers';
import { getClientsWithPMs } from '@/utils/firestoreClients';
import { getUsersByRole } from '@/utils/firestoreUsers';
import { saveScheduleData, subscribeToScheduleUpdates } from '@/utils/firestoreSchedule';
import { convertToUTC, compareDateStrings, isValidDateString, getDatesInRange as getDatesInRangeTZ, formatDateForDisplay } from '@/utils/timezoneUtils';
import DateRangeSelector from '@/components/DateRangeSelector';
import FilterPanelSelect from '@/components/ui/FilterPanelSelect';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { X } from 'lucide-react';

const TASK_TYPES = ['Question creation', 'QC', 'Upskilling', 'Others'];

const normalizeTechStackValue = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  return [];
};

const MultiSearchSelect = ({
  options,
  selected,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  emptyLabel = 'No options'
}) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = term
    ? options.filter(option => option.label.toLowerCase().includes(term.toLowerCase()))
    : options;

  const toggleValue = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectedLabel = selected.length === 0
    ? placeholder
    : selected.length <= 2 ? selected.join(', ') : `${selected.length} selected`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto max-h-40">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</p>
            ) : (
              filtered.map(option => (
                <label key={option.value} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-between border-t border-slate-100 px-3 py-2 text-xs">
            <button type="button" className="text-blue-600 hover:text-blue-700" onClick={() => onChange(options.map(o => o.value))}>Select all</button>
            <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => onChange([])}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
};

const BulkAssignmentPage = () => {
  const { toast } = useToast();
  const { setCommandState, resetCommandState } = useOutletContext();

  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState({});
  const [trainerList, setTrainerList] = useState([]);
  const [clientsWithPMs, setClientsWithPMs] = useState([]);
  const [allPMs, setAllPMs] = useState([]);
  const [techStacks, setTechStacks] = useState([]);

  const initialRowId = useMemo(() => Date.now(), []);
  const [rows, setRows] = useState(() => ([
    {
      id: initialRowId,
      trainer: '',
      type: 'training',
      startDate: '',
      endDate: '',
      excludedDates: [],
      client: '',
      selectedPMs: [],
      role: '',
      course: '',
      techStack: [],
      batchCount: '1',
      learnerCount: '',
      description: '',
      taskType: TASK_TYPES[0],
      taskDetails: '',
      leaveReason: ''
    }
  ]));
  const [expandedRowId, setExpandedRowId] = useState(initialRowId);

  const [pendingBulkPlan, setPendingBulkPlan] = useState(null);
  const [isConflictConfirmOpen, setIsConflictConfirmOpen] = useState(false);

  useEffect(() => {
    setCommandState?.({
      title: 'Bulk Assignment',
      description: 'Assign one set of fields to multiple trainers at once.',
      actions: null,
      metrics: null
    });
    return () => resetCommandState?.();
  }, [setCommandState, resetCommandState]);


  useEffect(() => {
    const unsubscribe = subscribeToScheduleUpdates((data) => {
      setScheduleData(data || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [trainersData, clientsData, pmsData] = await Promise.all([
        loadTrainerData(),
        getClientsWithPMs(),
        getUsersByRole('program_manager')
      ]);
      setTrainerList(trainersData || []);
      setClientsWithPMs(clientsData || []);
      setAllPMs(pmsData || []);
    }
    fetchData();
  }, []);

  useEffect(() => {
    const fetchTechStacks = async () => {
      try {
        const docRef = doc(db, 'settings', 'techStacks');
        const snapshot = await getDoc(docRef);
        const storedStacks = snapshot.exists() ? snapshot.data()?.values : [];
        const normalized = Array.isArray(storedStacks) ? storedStacks.filter(Boolean) : [];
        setTechStacks(normalized);
      } catch (error) {
        console.warn('Tech stacks unavailable, using trainer data only.');
        setTechStacks([]);
      }
    };
    fetchTechStacks();
  }, []);

  const activeTrainers = useMemo(() => {
    return trainerList.filter(trainer => trainer.status !== 'Inactive');
  }, [trainerList]);

  // Use only managed tech stacks from Firestore (Manage Tech Stack) everywhere
  const techStackOptions = useMemo(() => [...(techStacks || [])].sort(), [techStacks]);

  const updateRow = (rowId, patch) => {
    setRows(prev => prev.map(row => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const createRow = (base = {}) => {
    const cleanBase = { ...base };
    delete cleanBase.id;
    delete cleanBase.expanded;
    if (typeof cleanBase.techStack === 'string') cleanBase.techStack = normalizeTechStackValue(cleanBase.techStack);
    return {
      trainer: '',
      type: 'training',
      startDate: '',
      endDate: '',
      excludedDates: [],
      client: '',
      selectedPMs: [],
      role: '',
      course: '',
      techStack: [],
      batchCount: '1',
      learnerCount: '',
      description: '',
      taskType: TASK_TYPES[0],
      taskDetails: '',
      leaveReason: '',
      ...cleanBase,
      id: Date.now() + Math.random()
    };
  };

  const resetForm = () => {
    const newRow = createRow();
    setRows([newRow]);
    setExpandedRowId(newRow.id);
    setPendingBulkPlan(null);
    setIsConflictConfirmOpen(false);
  };

  const applyBulkPlan = (plan) => {
    if (!plan) return;
    setScheduleData(plan.newScheduleData);
    saveScheduleData(plan.newScheduleData).catch((error) => {
      console.error('Error saving schedule data:', error);
      toast({ title: 'Error', description: 'Failed to save schedule data.', variant: 'destructive' });
    });

    if (plan.conflictCount > 0) {
      toast({
        title: 'Bulk assignment completed',
        description: `Added ${plan.addedCount} assignments. Skipped ${plan.conflictCount} due to conflicts.`,
      });
    } else {
      toast({
        title: 'Bulk assignment completed',
        description: `Added ${plan.addedCount} assignments.`,
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const newScheduleData = Object.fromEntries(
      Object.entries(scheduleData).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
    );

    const conflictMap = {};
    let addedCount = 0;

    if (rows.length === 0) {
      toast({ title: 'Error', description: 'Add at least one assignment row.', variant: 'destructive' });
      return;
    }

    for (const row of rows) {
      if (!row.trainer) {
        toast({ title: 'Error', description: 'Each row must have a trainer.', variant: 'destructive' });
        return;
      }
      if (!isValidDateString(row.startDate) || !isValidDateString(row.endDate)) {
        toast({ title: 'Error', description: 'Each row must have a valid start and end date.', variant: 'destructive' });
        return;
      }
      if (compareDateStrings(row.startDate, row.endDate) > 0) {
        toast({ title: 'Error', description: 'Start date must be before or equal to end date.', variant: 'destructive' });
        return;
      }
      if (row.type === 'training') {
        if (!row.client) {
          toast({ title: 'Error', description: 'Training rows require a client.', variant: 'destructive' });
          return;
        }
        if (row.selectedPMs.length === 0) {
          toast({ title: 'Error', description: 'Training rows require at least one Program Manager.', variant: 'destructive' });
          return;
        }
      }
      if (row.type === 'non-training' && !row.taskDetails.trim()) {
        toast({ title: 'Error', description: 'Non-training rows require task details.', variant: 'destructive' });
        return;
      }
    }

    rows.forEach((row) => {
      const startUTC = convertToUTC(row.startDate);
      const endUTC = convertToUTC(row.endDate);
      const dates = getDatesInRangeTZ(startUTC, endUTC);
      if (dates.length === 0) {
        return;
      }

      const excludedDatesUTC = (row.excludedDates || [])
        .filter(isValidDateString)
        .map(date => convertToUTC(date));
      const validDates = dates.filter(dateStr => !excludedDatesUTC.includes(dateStr));
      if (validDates.length === 0) {
        return;
      }

      const client = clientsWithPMs.find(c => c.clientId === row.client);
      const clientDisplayName = client?.name || row.client || 'N/A';

      validDates.forEach((date) => {
        const existingEntries = newScheduleData[date] || [];
        const hasConflict = existingEntries.some(entry => entry.trainer === row.trainer);

        if (hasConflict) {
          if (!conflictMap[row.trainer]) conflictMap[row.trainer] = [];
          conflictMap[row.trainer].push(date);
          return;
        }

        const baseEntry = {
          trainer: row.trainer,
          type: row.type,
          startDate: date,
          endDate: date,
          id: Date.now() + Math.random(),
          excludedDates: excludedDatesUTC
        };

        let newEntry = baseEntry;
        if (row.type === 'training') {
          newEntry = {
            ...baseEntry,
            role: row.role,
            client: clientDisplayName,
            clientId: client?.clientId || null,
            course: row.course,
            techStack: Array.isArray(row.techStack) ? row.techStack.join(', ') : (row.techStack || ''),
            batchCount: row.batchCount,
            learnerCount: row.learnerCount,
            description: row.description,
            assignedPMIds: row.selectedPMs
          };
        } else if (row.type === 'leave') {
          newEntry = {
            ...baseEntry,
            description: row.leaveReason
          };
        } else {
          newEntry = {
            ...baseEntry,
            taskDetails: row.taskDetails,
            taskType: row.taskType,
            description: row.description
          };
        }

        if (!newScheduleData[date]) newScheduleData[date] = [];
        newScheduleData[date].push(newEntry);
        addedCount += 1;
      });
    });

    if (addedCount === 0) {
      toast({
        title: 'No assignments added',
        description: 'All selected trainers already have tasks on the chosen dates.',
        variant: 'destructive'
      });
      return;
    }

    const conflictCount = Object.values(conflictMap).reduce((sum, dates) => sum + dates.length, 0);
    if (conflictCount > 0) {
      setPendingBulkPlan({ newScheduleData, addedCount, conflictCount, conflictMap });
      setIsConflictConfirmOpen(true);
      return;
    }

    applyBulkPlan({ newScheduleData, addedCount, conflictCount, conflictMap });
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading schedule data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={cn(cardStyles.surface, 'border border-slate-200 p-6 shadow-sm')}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Bulk Assignment</h2>
            <p className="text-sm text-slate-500">Apply one set of fields to multiple trainers.</p>
          </div>
          <Button type="button" variant="outline" onClick={resetForm}>
            Reset Form
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Assignment Rows</p>
              <p className="text-xs text-slate-500">Copy a row and change only trainer/details.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const newRow = createRow();
                setRows(prev => [...prev, newRow]);
                setExpandedRowId(newRow.id);
              }}
            >
              Add Row
            </Button>
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => {
              const client = clientsWithPMs.find(c => c.clientId === row.client);
              const rowAvailablePMs = client?.programManagerIds?.length
                ? allPMs.filter(pm => client.programManagerIds.includes(pm.uid || pm.id))
                : [];
              const isExpanded = expandedRowId === row.id;
              return (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800">Row {index + 1}</p>
                      <p className="text-xs text-slate-500">
                        Dates: {row.startDate && row.endDate ? `${formatDateForDisplay(row.startDate)} → ${formatDateForDisplay(row.endDate)}` : 'Not set'}
                        {' · '}
                        Excluded: {row.excludedDates.length ? `${row.excludedDates.length} date(s)` : 'None'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedRowId(prev => (prev === row.id ? null : row.id))}
                      >
                        {isExpanded ? 'Collapse' : 'Details'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newRow = createRow({ ...row });
                          setRows(prev => [...prev, newRow]);
                          setExpandedRowId(newRow.id);
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRows(prev => {
                            const next = prev.filter(r => r.id !== row.id);
                            if (next.length === 0) {
                              const newRow = createRow();
                              setExpandedRowId(newRow.id);
                              return [newRow];
                            }
                            if (expandedRowId === row.id) {
                              setExpandedRowId(next[0].id);
                            }
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1.6fr_1fr]">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Trainer</label>
                      <div className="mt-1">
                        <SearchableSelect
                          value={row.trainer}
                          onChange={(value) => updateRow(row.id, { trainer: value })}
                          options={activeTrainers.map(trainer => ({
                            value: trainer.name,
                            label: trainer.name
                          }))}
                          placeholder="Select trainer"
                          searchPlaceholder="Search trainers..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Type</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {['training', 'non-training', 'leave'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateRow(row.id, { type })}
                            className={cn(
                              'rounded-full border px-3 py-1 text-[11px] font-medium transition',
                              row.type === type
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            )}
                          >
                            {type === 'non-training' ? 'Non-Training' : type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Schedule window</label>
                        <div className="mt-2 rounded-lg border border-slate-200 p-3">
                          <DateRangeSelector
                            key={row.id}
                            initialStartDate={row.startDate}
                            initialEndDate={row.endDate}
                            initialExcludedDates={row.excludedDates}
                            onDateRangeChange={(range) => {
                              updateRow(row.id, {
                                startDate: range.startDate,
                                endDate: range.endDate,
                                excludedDates: range.excludedDates || []
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && row.type === 'training' && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Client</label>
                        <div className="mt-1">
                          <SearchableSelect
                            value={row.client}
                            onChange={(value) => {
                              const nextClientObj = clientsWithPMs.find(c => c.clientId === value);
                              updateRow(row.id, {
                                client: value,
                                selectedPMs: nextClientObj?.programManagerIds || []
                              });
                            }}
                            options={clientsWithPMs.map(clientOption => ({
                              value: clientOption.clientId,
                              label: clientOption.name || clientOption.clientId
                            }))}
                            placeholder="Select client"
                            searchPlaceholder="Search clients..."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Role</label>
                        <div className="mt-1">
                          <SearchableSelect
                            value={row.role}
                            onChange={(value) => updateRow(row.id, { role: value })}
                            options={[
                              { value: 'Trainer', label: 'Trainer' },
                              { value: 'TA', label: 'TA' }
                            ]}
                            placeholder="Select role"
                            searchPlaceholder="Search roles..."
                          />
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Program Managers</label>
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
                          {rowAvailablePMs.length === 0 ? (
                            <p className="text-xs text-slate-500">Select a client with assigned PMs.</p>
                          ) : (
                            rowAvailablePMs.map(pm => {
                              const pmId = pm.uid || pm.id;
                              return (
                                <label key={pmId} className="flex items-center gap-2 text-xs text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={row.selectedPMs.includes(pmId)}
                                    onChange={(event) => {
                                      updateRow(row.id, {
                                        selectedPMs: event.target.checked
                                          ? [...row.selectedPMs, pmId]
                                          : row.selectedPMs.filter(id => id !== pmId)
                                      });
                                    }}
                                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded"
                                  />
                                  {pm.name || pm.email || pmId}
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Course</label>
                        <input
                          value={row.course}
                          onChange={(event) => updateRow(row.id, { course: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Course name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Tech Stack</label>
                        <div className="mt-1">
                          <FilterPanelSelect
                            title="All tech stacks"
                            options={techStackOptions.map(stack => ({ value: stack, label: stack }))}
                            selected={normalizeTechStackValue(row.techStack)}
                            onChange={(arr) => updateRow(row.id, { techStack: arr })}
                            searchPlaceholder="Search tech stacks..."
                            emptyLabel="No tech stacks"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">No. of Batches</label>
                        <input
                          type="text"
                          value={row.batchCount ?? ''}
                          onChange={(event) => updateRow(row.id, { batchCount: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="e.g., 2"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">No. of Learners</label>
                        <input
                          type="number"
                          min="0"
                          value={row.learnerCount ?? ''}
                          onChange={(event) => updateRow(row.id, { learnerCount: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="e.g., 40"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Description</label>
                        <textarea
                          value={row.description}
                          onChange={(event) => updateRow(row.id, { description: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  {isExpanded && row.type === 'non-training' && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Task type</label>
                        <div className="mt-1">
                          <SearchableSelect
                            value={row.taskType}
                            onChange={(value) => updateRow(row.id, { taskType: value })}
                            options={TASK_TYPES.map(type => ({ value: type, label: type }))}
                            placeholder="Select task type"
                            searchPlaceholder="Search task types..."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Task details</label>
                        <input
                          value={row.taskDetails}
                          onChange={(event) => updateRow(row.id, { taskDetails: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Task details"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Description</label>
                        <textarea
                          value={row.description}
                          onChange={(event) => updateRow(row.id, { description: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  {isExpanded && row.type === 'leave' && (
                    <div className="mt-4">
                      <label className="text-xs font-medium text-slate-600">Leave reason</label>
                      <textarea
                        value={row.leaveReason}
                        onChange={(event) => updateRow(row.id, { leaveReason: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Create Bulk Assignments
          </Button>
        </form>
      </div>

      {isConflictConfirmOpen && pendingBulkPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Conflicts detected</h3>
                <p className="text-sm text-slate-500">
                  Some trainers already have assignments on the selected dates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConflictConfirmOpen(false);
                  setPendingBulkPlan(null);
                }}
                className="rounded-lg p-2 hover:bg-slate-100"
                aria-label="Close conflict dialog"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {pendingBulkPlan.conflictCount} conflicts found across{' '}
              {Object.keys(pendingBulkPlan.conflictMap).length} trainer(s).
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {Object.entries(pendingBulkPlan.conflictMap).slice(0, 6).map(([trainer, dates]) => (
                  <div key={trainer} className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-700">{trainer}</span>
                    <span className="text-slate-500">{dates.length} date(s) conflicted</span>
                  </div>
                ))}
                {Object.keys(pendingBulkPlan.conflictMap).length > 6 && (
                  <p className="text-slate-500">More conflicts not shown.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsConflictConfirmOpen(false);
                  setPendingBulkPlan(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  applyBulkPlan(pendingBulkPlan);
                  setIsConflictConfirmOpen(false);
                  setPendingBulkPlan(null);
                }}
              >
                Proceed with available dates
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkAssignmentPage;
