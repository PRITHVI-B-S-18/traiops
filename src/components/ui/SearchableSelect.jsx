import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Single-value searchable dropdown (like Bulk Assignment client/role).
 * Use for Role and Client on Schedule add/edit forms.
 */
const SearchableSelect = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const ref = useRef(null);

  const selected = options.find(option => option.value === value);
  const filtered = term
    ? options.filter(option => (option.label || '').toLowerCase().includes(term.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm',
          disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'text-slate-700'
        )}
      >
        {selected?.label || value || placeholder}
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matches.</p>
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setTerm('');
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-50',
                    option.value === value ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
