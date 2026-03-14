import React, { useEffect, useState, useRef } from 'react';
import { Search, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Multi-select dropdown with filter UI: gray header, search with icon, checkbox list, Done button.
 * Used for filters (Assignments Dashboard) and tech stack selection (Trainer Management, Schedule, Bulk Assignment).
 */
const FilterPanelSelect = ({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Search...',
  emptyLabel = 'No options',
  triggerClassName,
  panelClassName
}) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const ref = useRef(null);

  const filtered = term
    ? options.filter(opt => (opt.label || '').toLowerCase().includes(term.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const toggleValue = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const triggerLabel = selected.length === 0
    ? title
    : selected.length <= 2
      ? selected.map(v => options.find(o => o.value === v)?.label || v).join(', ')
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 flex items-center justify-between gap-2',
          triggerClassName
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronUp className={cn('h-4 w-4 text-slate-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-30 left-0 mt-1 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col',
            panelClassName
          )}
        >
          <div className="bg-slate-100 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200"
              aria-label="Close"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 text-center">{emptyLabel}</p>
            ) : (
              <div className="py-1">
                {filtered.map(opt => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => toggleValue(opt.value)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanelSelect;
