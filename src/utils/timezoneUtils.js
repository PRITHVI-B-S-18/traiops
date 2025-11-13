import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Timezone utility functions for consistent date handling across the application
 * 
 * Strategy:
 * - Store all dates in UTC (as ISO strings)
 * - Convert to user's timezone for display
 * - Convert from user's timezone to UTC for storage
 */

// Default timezone (can be configured per user)
const DEFAULT_TIMEZONE = 'America/New_York'; // EST/EDT

/**
 * Get user's timezone preference
 * Falls back to browser timezone, then default
 */
export const getUserTimezone = () => {
  try {
    // Try to get from localStorage (user preference)
    const stored = localStorage.getItem('userTimezone');
    if (stored) {
      return stored;
    }
    
    // Fall back to browser timezone
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz) {
      return browserTz;
    }
    
    // Final fallback
    return DEFAULT_TIMEZONE;
  } catch (error) {
    console.warn('Error getting user timezone:', error);
    return DEFAULT_TIMEZONE;
  }
};

/**
 * Set user's timezone preference
 */
export const setUserTimezone = (timezone) => {
  try {
    localStorage.setItem('userTimezone', timezone);
  } catch (error) {
    console.warn('Error setting user timezone:', error);
  }
};

/**
 * Convert a date string (YYYY-MM-DD) from user's timezone to UTC
 * This is used when storing dates to ensure they're in UTC
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format (assumed to be in user's timezone)
 * @param {string} timezone - Optional timezone (defaults to user's timezone)
 * @returns {string} UTC date string in YYYY-MM-DD format
 */
export const convertToUTC = (dateStr, timezone = null) => {
  if (!dateStr) return null;
  
  try {
    const tz = timezone || getUserTimezone();
    
    // Parse the date string as if it's in the user's timezone
    // Create a date at midnight in the user's timezone
    const localDate = parseISO(`${dateStr}T00:00:00`);
    
    if (!isValid(localDate)) {
      console.warn(`Invalid date string: ${dateStr}`);
      return dateStr; // Return as-is if invalid
    }
    
    // Convert to UTC
    const utcDate = fromZonedTime(localDate, tz);
    
    // Return as YYYY-MM-DD string
    return format(utcDate, 'yyyy-MM-dd');
  } catch (error) {
    console.warn(`Error converting ${dateStr} to UTC:`, error);
    return dateStr; // Return as-is on error
  }
};

/**
 * Convert a UTC date string (YYYY-MM-DD) to user's timezone
 * This is used when displaying dates to users
 * 
 * @param {string} utcDateStr - UTC date string in YYYY-MM-DD format
 * @param {string} timezone - Optional timezone (defaults to user's timezone)
 * @returns {string} Date string in user's timezone (YYYY-MM-DD format)
 */
export const convertFromUTC = (utcDateStr, timezone = null) => {
  if (!utcDateStr) return null;
  
  try {
    const tz = timezone || getUserTimezone();
    
    // Parse UTC date string
    const utcDate = parseISO(`${utcDateStr}T00:00:00`);
    
    if (!isValid(utcDate)) {
      console.warn(`Invalid UTC date string: ${utcDateStr}`);
      return utcDateStr; // Return as-is if invalid
    }
    
    // Convert from UTC to user's timezone
    const zonedDate = toZonedTime(utcDate, tz);
    
    // Return as YYYY-MM-DD string
    return format(zonedDate, 'yyyy-MM-dd');
  } catch (error) {
    console.warn(`Error converting ${utcDateStr} from UTC:`, error);
    return utcDateStr; // Return as-is on error
  }
};

/**
 * Format a date string for display in user's timezone
 * 
 * @param {string} dateStr - Date string (assumed to be in UTC if isUTC=true)
 * @param {string} formatStr - Format string (default: 'MMM dd, yyyy')
 * @param {boolean} isUTC - Whether the input date is in UTC (default: true)
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (dateStr, formatStr = 'MMM dd, yyyy', isUTC = true) => {
  if (!dateStr) return '';
  
  try {
    const tz = getUserTimezone();
    let date;
    
    if (isUTC) {
      // Parse as UTC and convert to user's timezone
      const utcDate = parseISO(`${dateStr}T00:00:00`);
      if (!isValid(utcDate)) {
        return dateStr; // Return as-is if invalid
      }
      // Use formatInTimeZone to format directly in the timezone
      return formatInTimeZone(utcDate, tz, formatStr);
    } else {
      // Parse as local date
      const localDate = parseISO(`${dateStr}T00:00:00`);
      if (!isValid(localDate)) {
        return dateStr; // Return as-is if invalid
      }
      // Format the local date
      return format(localDate, formatStr);
    }
  } catch (error) {
    console.warn(`Error formatting date ${dateStr}:`, error);
    return dateStr; // Return as-is on error
  }
};

/**
 * Get start of day in UTC for a given date string (in user's timezone)
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format (user's timezone)
 * @returns {Date} Start of day in UTC
 */
export const getStartOfDayUTC = (dateStr) => {
  if (!dateStr) return null;
  
  try {
    const tz = getUserTimezone();
    const localDate = parseISO(`${dateStr}T00:00:00`);
    const startOfLocalDay = startOfDay(localDate);
    return fromZonedTime(startOfLocalDay, tz);
  } catch (error) {
    console.warn(`Error getting start of day UTC for ${dateStr}:`, error);
    return null;
  }
};

/**
 * Get end of day in UTC for a given date string (in user's timezone)
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format (user's timezone)
 * @returns {Date} End of day in UTC
 */
export const getEndOfDayUTC = (dateStr) => {
  if (!dateStr) return null;
  
  try {
    const tz = getUserTimezone();
    const localDate = parseISO(`${dateStr}T00:00:00`);
    const endOfLocalDay = endOfDay(localDate);
    return fromZonedTime(endOfLocalDay, tz);
  } catch (error) {
    console.warn(`Error getting end of day UTC for ${dateStr}:`, error);
    return null;
  }
};

/**
 * Convert a Date object to UTC date string (YYYY-MM-DD)
 * 
 * @param {Date} date - Date object
 * @returns {string} UTC date string in YYYY-MM-DD format
 */
export const dateToUTCString = (date) => {
  if (!date || !isValid(date)) return null;
  
  try {
    // Format in UTC
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.warn('Error converting date to UTC string:', error);
    return null;
  }
};

/**
 * Get current date in user's timezone as YYYY-MM-DD string
 * 
 * @returns {string} Current date in user's timezone
 */
export const getCurrentDateInUserTimezone = () => {
  try {
    const tz = getUserTimezone();
    const now = new Date();
    const zonedNow = toZonedTime(now, tz);
    return format(zonedNow, 'yyyy-MM-dd');
  } catch (error) {
    console.warn('Error getting current date in user timezone:', error);
    return format(new Date(), 'yyyy-MM-dd'); // Fallback
  }
};

/**
 * Validate date string format (YYYY-MM-DD)
 * 
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
export const isValidDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  const date = parseISO(dateStr);
  return isValid(date);
};

/**
 * Compare two date strings (handles timezone conversion)
 * 
 * @param {string} dateStr1 - First date string (assumed UTC)
 * @param {string} dateStr2 - Second date string (assumed UTC)
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export const compareDateStrings = (dateStr1, dateStr2) => {
  if (!dateStr1 || !dateStr2) return 0;
  
  try {
    const date1 = parseISO(`${dateStr1}T00:00:00`);
    const date2 = parseISO(`${dateStr2}T00:00:00`);
    
    if (!isValid(date1) || !isValid(date2)) return 0;
    
    if (date1 < date2) return -1;
    if (date1 > date2) return 1;
    return 0;
  } catch (error) {
    console.warn('Error comparing dates:', error);
    return 0;
  }
};

/**
 * Get all dates in a range (timezone-aware)
 * 
 * @param {string} startDate - Start date (YYYY-MM-DD, assumed UTC)
 * @param {string} endDate - End date (YYYY-MM-DD, assumed UTC)
 * @returns {string[]} Array of date strings in YYYY-MM-DD format (UTC)
 */
export const getDatesInRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  
  try {
    const start = parseISO(`${startDate}T00:00:00`);
    const end = parseISO(`${endDate}T00:00:00`);
    
    if (!isValid(start) || !isValid(end)) {
      console.warn('Invalid date range:', startDate, endDate);
      return [];
    }
    
    if (start > end) {
      console.warn('Start date is after end date:', startDate, endDate);
      return [];
    }
    
    const dates = [];
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  } catch (error) {
    console.warn('Error getting dates in range:', error);
    return [];
  }
};

/**
 * Format timestamp for display with timezone
 * 
 * @param {Date|Timestamp|string} timestamp - Timestamp to format
 * @param {string} formatStr - Format string (default: 'MMM dd, yyyy hh:mm a')
 * @returns {string} Formatted timestamp
 */
export const formatTimestamp = (timestamp, formatStr = 'MMM dd, yyyy hh:mm a') => {
  if (!timestamp) return '';
  
  try {
    const tz = getUserTimezone();
    let date;
    
    // Handle Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = parseISO(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    if (!isValid(date)) {
      return String(timestamp);
    }
    
    // Convert to user's timezone and format
    return formatInTimeZone(date, tz, formatStr);
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return String(timestamp);
  }
};

