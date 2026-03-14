import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Filter, Users, Layers, Calendar } from 'lucide-react';
import { subscribeToScheduleUpdates } from '@/utils/firestoreSchedule';
import { compareDateStrings, convertToUTC, formatDateForDisplay, isValidDateString, getDatesInRange as getDatesInRangeTZ } from '@/utils/timezoneUtils';
import { LoadingSkeleton } from '@/components/ui/loading-skeletons';
import { cn } from '@/lib/utils';
import { cardStyles, cardPadding } from '@/styles/designSystem';
import { loadTrainerData } from '@/utils/firestoreTrainers';
import { getAllClients } from '@/utils/firestoreClients';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import FilterPanelSelect from '@/components/ui/FilterPanelSelect';

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
    : `${selected.length} selected`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</p>
            ) : (
              filtered.map(option => (
                <label key={option.value} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
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
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-700"
              onClick={() => onChange(options.map(option => option.value))}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AssignmentsDashboardPage = () => {
  const { setCommandState } = useOutletContext();
  const [scheduleData, setScheduleData] = useState({});
  const [trainerList, setTrainerList] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [clientFilter, setClientFilter] = useState([]);
  const [trainerFilter, setTrainerFilter] = useState([]);
  const [techStackFilter, setTechStackFilter] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [availableModalOpen, setAvailableModalOpen] = useState(false);
  const [techStacks, setTechStacks] = useState([]);

  const todayString = useMemo(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    setCommandState?.({
      title: 'Assignments Dashboard',
      description: 'Visualize assignments by client, trainer, tech stack, and dates.',
      actions: null,
      metrics: null
    });
  }, [setCommandState]);

  useEffect(() => {
    const unsubscribe = subscribeToScheduleUpdates((data) => {
      setScheduleData(data || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [trainers, clients] = await Promise.all([
          loadTrainerData(),
          getAllClients()
        ]);
        setTrainerList(trainers || []);
        setClientsList(clients || []);
      } catch (error) {
        console.error('Error loading dashboard meta:', error);
      }
    }
    fetchMeta();
  }, []);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'techStacks');
    getDoc(docRef).then((snap) => {
      const list = snap.exists() ? (snap.data().values || []) : [];
      setTechStacks(Array.isArray(list) ? list : []);
    }).catch((err) => console.error('Error loading tech stacks:', err));
  }, []);

  useEffect(() => {
    if (!startDate && !endDate) {
      setStartDate(todayString);
      setEndDate(todayString);
    }
  }, [startDate, endDate, todayString]);

  const flattenedEntries = useMemo(() => {
    return Object.entries(scheduleData).flatMap(([dateKey, entries]) => {
      if (!Array.isArray(entries)) return [];
      return entries.map(entry => ({
        ...entry,
        startDate: entry.startDate || dateKey,
        endDate: entry.endDate || dateKey,
        dateKey
      }));
    });
  }, [scheduleData]);

  const uniqueClients = useMemo(() => {
    return (clientsList || [])
      .map(client => client.name || client.clientId)
      .filter(Boolean)
      .sort();
  }, [clientsList]);

  const uniqueTrainers = useMemo(() => {
    const set = new Set();
    flattenedEntries.forEach(entry => {
      if (entry.trainer) set.add(entry.trainer);
    });
    return Array.from(set).sort();
  }, [flattenedEntries]);

  const trainerClientStats = useMemo(() => {
    const map = new Map();
    flattenedEntries.forEach(entry => {
      if (!entry.trainer) return;
      if (!entry.client || entry.client === 'Not Alloted') return;
      if (!map.has(entry.trainer)) map.set(entry.trainer, {});
      const trainerMap = map.get(entry.trainer);
      trainerMap[entry.client] = (trainerMap[entry.client] || 0) + 1;
    });
    return map;
  }, [flattenedEntries]);

  const availableTrainers = useMemo(() => {
    if (!trainerList.length) return [];
    const rangeStart = isValidDateString(startDate) ? startDate : todayString;
    const rangeEnd = isValidDateString(endDate) ? endDate : rangeStart;

    const startUTC = convertToUTC(rangeStart);
    const endUTC = convertToUTC(rangeEnd);
    const datesInRange = getDatesInRangeTZ(startUTC, endUTC);

    const entryList = Object.values(scheduleData).flatMap(entries => entries || []);

    const passesTrainerFilters = (trainer) => {
      if (trainerFilter.length > 0 && !trainerFilter.includes(trainer.name)) return false;
      if (categoryFilter.length > 0) {
        const category = trainer.category || 'Internal';
        if (!categoryFilter.includes(category)) return false;
      }
      if (techStackFilter.length > 0) {
        const rawStacks = (trainer.specialization || trainer.skill || '').split(/\s*,\s*/).filter(Boolean);
        if (!rawStacks.some(stack => techStackFilter.includes(stack))) return false;
      }
      if (clientFilter.length > 0) {
        const clientMap = trainerClientStats.get(trainer.name) || {};
        const hasClient = clientFilter.some(client => clientMap[client]);
        if (!hasClient) return false;
      }
      return true;
    };

    const availability = (trainerList || [])
      .filter(trainer => trainer.status !== 'Inactive')
      .filter(passesTrainerFilters)
      .map(trainer => {
        const availableDates = datesInRange.filter(dateStr => {
          const hasAssignment = entryList.some(entry => {
            if (entry.trainer !== trainer.name) return false;
            if (!entry.startDate || !entry.endDate) return false;
            if (dateStr < entry.startDate || dateStr > entry.endDate) return false;
            if (entry.type === 'training' && entry.client === 'Not Alloted') return false;
            if (entry.type === 'non-training' && (!entry.taskDetails || entry.taskDetails === 'Not Alloted')) return false;
            return true;
          });
          return !hasAssignment;
        });

        return {
          name: trainer.name,
          category: trainer.category || 'Internal',
          techStack: trainer.specialization || trainer.skill || '—',
          availableDates
        };
      })
      .filter(trainer => trainer.availableDates.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return availability;
  }, [
    trainerList,
    scheduleData,
    startDate,
    endDate,
    todayString,
    trainerFilter,
    categoryFilter,
    techStackFilter,
    clientFilter,
    trainerClientStats
  ]);

  // Use only managed tech stacks from Firestore (Manage Tech Stack) for filter options
  const techStackFilterOptions = useMemo(() => [...(techStacks || [])].sort(), [techStacks]);

  const trainerCategoryMap = useMemo(() => {
    const map = new Map();
    (trainerList || []).forEach(trainer => {
      if (trainer.name) {
        map.set(trainer.name, trainer.category || 'Internal');
      }
    });
    return map;
  }, [trainerList]);

  const uniqueCategories = useMemo(() => {
    const set = new Set();
    trainerCategoryMap.forEach(value => set.add(value));
    return Array.from(set).sort();
  }, [trainerCategoryMap]);

  const filteredEntries = useMemo(() => {
    return flattenedEntries.filter(entry => {
      if (clientFilter.length > 0) {
        if (!clientFilter.includes(entry.client || 'Not Alloted')) return false;
      }
      if (trainerFilter.length > 0) {
        if (!trainerFilter.includes(entry.trainer)) return false;
      }
      if (techStackFilter.length > 0) {
        const stack = entry.techStack || entry.specialization || entry.skill || '';
        if (!techStackFilter.includes(stack)) return false;
      }
      if (categoryFilter.length > 0) {
        const category = trainerCategoryMap.get(entry.trainer) || 'Internal';
        if (!categoryFilter.includes(category)) return false;
      }
      if (typeFilter.length > 0) {
        const entryType = entry.type || 'training';
        if (!typeFilter.includes(entryType)) return false;
      }
      if (startDate && isValidDateString(startDate)) {
        const compareStart = compareDateStrings(entry.startDate, startDate);
        if (compareStart < 0) return false;
      }
      if (endDate && isValidDateString(endDate)) {
        const compareEnd = compareDateStrings(entry.endDate, endDate);
        if (compareEnd > 0) return false;
      }
      return true;
    });
  }, [flattenedEntries, clientFilter, trainerFilter, techStackFilter, categoryFilter, typeFilter, startDate, endDate, trainerCategoryMap]);

  const summaryCounts = useMemo(() => {
    const clientMap = {};
    const trainerMap = {};
    const techMap = {};
    const typeCounts = { training: 0, 'non-training': 0, leave: 0 };

    filteredEntries.forEach(entry => {
      const t = entry.type || 'training';
      if (t === 'training' || t === 'non-training' || t === 'leave') {
        typeCounts[t] += 1;
      }
      if (entry.client && entry.client !== 'Not Alloted') {
        clientMap[entry.client] = (clientMap[entry.client] || 0) + 1;
      }
      if (entry.trainer) {
        trainerMap[entry.trainer] = (trainerMap[entry.trainer] || 0) + 1;
      }
      const stack = entry.techStack || entry.specialization || entry.skill;
      if (stack) {
        techMap[stack] = (techMap[stack] || 0) + 1;
      }
      const category = trainerCategoryMap.get(entry.trainer) || 'Internal';
      if (category) {
        // category counts could be added later if needed
      }
    });

    const toTopList = (map) =>
      Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count }));

    return {
      total: filteredEntries.length,
      typeCounts,
      uniqueClients: Object.keys(clientMap).length,
      uniqueTrainers: Object.keys(trainerMap).length,
      uniqueTechStacks: Object.keys(techMap).length,
      clients: toTopList(clientMap),
      trainers: toTopList(trainerMap),
      techStacks: toTopList(techMap)
    };
  }, [filteredEntries]);

  const isFilterActive = useMemo(() => {
    const hasNonDefault =
      clientFilter.length > 0 ||
      trainerFilter.length > 0 ||
      techStackFilter.length > 0 ||
      categoryFilter.length > 0 ||
      typeFilter.length > 0;
    const dateIsDefault = startDate === todayString && endDate === todayString;
    return hasNonDefault || !dateIsDefault;
  }, [clientFilter, trainerFilter, techStackFilter, categoryFilter, typeFilter, startDate, endDate, todayString]);

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, page, pageSize]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  }, [filteredEntries.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return <LoadingSkeleton message="Loading assignments dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Assignments Overview</h2>
          <p className="text-sm text-slate-500">Total assignments: {summaryCounts.total}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAvailableModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Users className="h-4 w-4 text-slate-500" />
            Available Trainers
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50",
              showFilters ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700"
            )}
          >
            <Filter className="h-4 w-4 text-slate-500" />
            Filters
          </button>
        </div>
      </div>

      {availableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Available Trainers</h3>
                <p className="text-xs text-slate-500">
                  {formatDateForDisplay(isValidDateString(startDate) ? startDate : todayString)}{' '}
                  {isValidDateString(endDate) && endDate !== startDate ? `→ ${formatDateForDisplay(endDate)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvailableModalOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">{availableTrainers.length} available</span>
              </div>
              {availableTrainers.length === 0 ? (
                <p className="text-sm text-slate-500">No available trainers for this filter/date range.</p>
              ) : (
                <div className="space-y-3">
                  {availableTrainers.map(trainer => (
                    <div key={trainer.name} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{trainer.name}</p>
                          <p className="text-xs text-slate-500 truncate">Tech Stack: {trainer.techStack}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {trainer.category}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {trainer.availableDates.slice(0, 10).map(date => (
                          <span key={date} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            {formatDateForDisplay(date)}
                          </span>
                        ))}
                        {trainer.availableDates.length > 10 && (
                          <span className="text-[11px] text-slate-500">
                            +{trainer.availableDates.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isFilterActive && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Filters are applied. Results reflect the selected clients, trainers, tech stacks, categories, types, and dates.
        </div>
      )}

      {showFilters && (
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <p className="text-xs text-slate-500 mb-3">Click the Filters button again to close filters.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Clients</label>
              <FilterPanelSelect
                title="All clients"
                options={uniqueClients.map(client => ({ value: client, label: client }))}
                selected={clientFilter}
                onChange={setClientFilter}
                searchPlaceholder="Search clients..."
                emptyLabel="No clients"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trainers</label>
              <FilterPanelSelect
                title="All trainers"
                options={uniqueTrainers.map(trainer => ({ value: trainer, label: trainer }))}
                selected={trainerFilter}
                onChange={setTrainerFilter}
                searchPlaceholder="Search trainers..."
                emptyLabel="No trainers"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tech Stacks</label>
              <FilterPanelSelect
                title="All tech stacks"
                options={techStackFilterOptions.map(stack => ({ value: stack, label: stack }))}
                selected={techStackFilter}
                onChange={setTechStackFilter}
                searchPlaceholder="Search tech stacks..."
                emptyLabel="No tech stacks"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categories</label>
              <FilterPanelSelect
                title="All categories"
                options={uniqueCategories.map(category => ({ value: category, label: category }))}
                selected={categoryFilter}
                onChange={setCategoryFilter}
                searchPlaceholder="Search categories..."
                emptyLabel="No categories"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <FilterPanelSelect
                title="All types"
                options={[
                  { value: 'training', label: 'Training' },
                  { value: 'non-training', label: 'Non-training' },
                  { value: 'leave', label: 'Leave' }
                ]}
                selected={typeFilter}
                onChange={setTypeFilter}
                searchPlaceholder="Search types..."
                emptyLabel="No types"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {isFilterActive && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setClientFilter([]);
                  setTrainerFilter([]);
                  setTechStackFilter([]);
                  setCategoryFilter([]);
                  setTypeFilter([]);
                  setStartDate(todayString);
                  setEndDate(todayString);
                  setPage(1);
                }}
                className="text-xs text-slate-600 hover:text-slate-800"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Assignments</p>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summaryCounts.total}</p>
          <p className="text-xs text-slate-600 mt-1">
            Training {summaryCounts.typeCounts.training}, Non-training {summaryCounts.typeCounts['non-training']}, Leave {summaryCounts.typeCounts.leave}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {startDate === todayString && endDate === todayString ? 'Defaulting to today' : `${formatDateForDisplay(startDate)} – ${formatDateForDisplay(endDate)}`}
          </p>
        </div>
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Trainers</p>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summaryCounts.uniqueTrainers}</p>
          <p className="text-xs text-slate-500 mt-1">Unique in view</p>
        </div>
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Clients</p>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summaryCounts.uniqueClients}</p>
          <p className="text-xs text-slate-500 mt-1">Unique in view</p>
        </div>
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-violet-500" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tech Stacks</p>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summaryCounts.uniqueTechStacks}</p>
          <p className="text-xs text-slate-500 mt-1">Unique in view</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900">Top Trainers</h3>
          </div>
          {summaryCounts.trainers.length === 0 ? (
            <p className="text-xs text-slate-500">No trainer data.</p>
          ) : (
            <div className="space-y-2">
              {summaryCounts.trainers.map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{item.label}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900">Top Clients</h3>
          </div>
          {summaryCounts.clients.length === 0 ? (
            <p className="text-xs text-slate-500">No client data.</p>
          ) : (
            <div className="space-y-2">
              {summaryCounts.clients.map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{item.label}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">Top Tech Stacks</h3>
          </div>
          {summaryCounts.techStacks.length === 0 ? (
            <p className="text-xs text-slate-500">No tech stack data.</p>
          ) : (
            <div className="space-y-2">
              {summaryCounts.techStacks.map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate">{item.label}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn(cardStyles.surface, cardPadding, 'border border-slate-200')}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Assignments</h3>
        </div>
        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No assignments match the filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-left font-medium">Trainer</th>
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-left font-medium">Tech Stack</th>
                  <th className="py-2 text-left font-medium">Start Date</th>
                  <th className="py-2 text-left font-medium">End Date</th>
                  <th className="py-2 text-left font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {pagedEntries.map((entry, idx) => (
                  <tr key={`${entry.id || idx}-${entry.dateKey}`} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{entry.client || '—'}</td>
                    <td className="py-2 text-slate-700">{entry.trainer || '—'}</td>
                    <td className="py-2 text-slate-700">{trainerCategoryMap.get(entry.trainer) || 'Internal'}</td>
                    <td className="py-2 text-slate-700">{entry.techStack || entry.specialization || entry.skill || '—'}</td>
                    <td className="py-2 text-slate-700">{formatDateForDisplay(entry.startDate)}</td>
                    <td className="py-2 text-slate-700">{formatDateForDisplay(entry.endDate)}</td>
                    <td className="py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                        {entry.type || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length > pageSize && (
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                <span>
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, filteredEntries.length)} of {filteredEntries.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                    disabled={page === 1}
                  >
                    Prev
                  </button>
                  <span>Page {page} / {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentsDashboardPage;
