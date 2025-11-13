
import { format, parse, isValid, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { formatDateForDisplay, convertFromUTC, convertToUTC } from '@/utils/timezoneUtils';

export const DATE_FORMAT_STORAGE = 'yyyy-MM-dd';
export const DATE_FORMAT_DISPLAY_FULL = 'MMMM d, yyyy';
export const DATE_FORMAT_DISPLAY_MONTH_YEAR = 'MMMM yyyy';
export const DATE_FORMAT_EXCEL_HEADER = 'd-MMM-yy';

export const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getCurrentMonthYear = () => new Date();

/**
 * Format date for storage (convert to UTC)
 * Dates should be stored in UTC format
 */
export const getFormattedDateForStorage = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    // If it's already a date string, ensure it's in UTC
    const parsed = parseISOString(date);
    if (isValid(parsed)) {
      const dateStr = format(parsed, DATE_FORMAT_STORAGE);
      // Convert to UTC if not already
      return convertToUTC(dateStr);
  }
    return '';
  }
  if (isValid(date)) {
    const dateStr = format(date, DATE_FORMAT_STORAGE);
    return convertToUTC(dateStr);
  }
  return '';
};

/**
 * Format date for display (convert from UTC to user's timezone)
 * Dates stored in UTC should be converted to user's timezone for display
 */
export const getFormattedDateForDisplayFull = (dateString) => {
  if (!dateString) return 'N/A';
  // Assume dateString is in UTC, convert to user's timezone for display
  const userTimezoneDate = convertFromUTC(dateString);
  const date = parse(userTimezoneDate, DATE_FORMAT_STORAGE, new Date());
  return isValid(date) ? format(date, DATE_FORMAT_DISPLAY_FULL) : 'Invalid Date';
};

export const getFormattedDateForDisplayMonthYear = (date) => {
  return format(date, DATE_FORMAT_DISPLAY_MONTH_YEAR);
};

export const getFormattedDateForExcelHeader = (date) => {
  return format(date, DATE_FORMAT_EXCEL_HEADER);
};

export const parseExcelDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  let parsedDate;
  
  parsedDate = parse(dateStr, 'd-MMM-yy', new Date());
  if (isValid(parsedDate)) return parsedDate;

  parsedDate = parse(dateStr, 'M/d/yyyy', new Date());
  if (isValid(parsedDate)) return parsedDate;
  
  parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (isValid(parsedDate)) return parsedDate;

  const numericDate = parseInt(dateStr, 10);
  if (!isNaN(numericDate) && numericDate > 0 && numericDate < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    parsedDate = new Date(excelEpoch.getTime() + numericDate * 24 * 60 * 60 * 1000);
    if (isValid(parsedDate)) return parsedDate;
  }
  
  return null;
};

const parseISOString = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isValid(date) ? date : null;
};


export const getMonthDetails = (currentMonthDate) => {
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const daysInMonthArray = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startingDayOfWeek = getDay(monthStart);
  return { monthStart, monthEnd, daysInMonthArray, startingDayOfWeek };
};

export const getPreviousMonth = (date) => subMonths(date, 1);
export const getNextMonth = (date) => addMonths(date, 1);

export const isSameDate = (date1, date2) => {
    if (!date1 || !date2) return false;
    const d1 = typeof date1 === 'string' ? parse(date1, DATE_FORMAT_STORAGE, new Date()) : date1;
    const d2 = typeof date2 === 'string' ? parse(date2, DATE_FORMAT_STORAGE, new Date()) : date2;
    if (!isValid(d1) || !isValid(d2)) return false;
    return format(d1, DATE_FORMAT_STORAGE) === format(d2, DATE_FORMAT_STORAGE);
};

export const isToday = (date) => {
    if (!date) return false;
    const d = typeof date === 'string' ? parse(date, DATE_FORMAT_STORAGE, new Date()) : date;
    if (!isValid(d)) return false;
    return format(d, DATE_FORMAT_STORAGE) === format(new Date(), DATE_FORMAT_STORAGE);
}
  