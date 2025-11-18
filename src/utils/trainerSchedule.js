import { loadScheduleData } from './firestoreSchedule';
import { getCurrentDateInUserTimezone, convertFromUTC } from './timezoneUtils';

/**
 * Filter schedules for a specific trainer from full schedule data
 * @param {Object} allSchedules - Full schedule data object
 * @param {string} trainerName - Name of the trainer
 * @returns {Object} Filtered schedules for the trainer
 */
export const filterTrainerSchedules = (allSchedules, trainerName) => {
  if (!allSchedules || typeof allSchedules !== 'object') {
    return {};
  }

  if (!trainerName || typeof trainerName !== 'string') {
    console.warn('filterTrainerSchedules: Invalid trainer name:', trainerName);
    return {};
  }

  const trainerSchedules = {};
  const trainerNameTrimmed = trainerName.trim();

  // Filter schedules for this trainer
  Object.entries(allSchedules).forEach(([date, tasks]) => {
    if (Array.isArray(tasks)) {
      const trainerTasks = tasks.filter(task => {
        const taskTrainer = task.trainer ? task.trainer.trim() : '';
        return taskTrainer === trainerNameTrimmed;
      });
      if (trainerTasks.length > 0) {
        trainerSchedules[date] = trainerTasks;
      }
    }
  });

  console.log('filterTrainerSchedules:', {
    trainerName: trainerNameTrimmed,
    totalDates: Object.keys(allSchedules).length,
    filteredDates: Object.keys(trainerSchedules).length,
    sampleTasks: Object.values(trainerSchedules).flat().slice(0, 2)
  });

  return trainerSchedules;
};

/**
 * Get all schedules for a specific trainer
 * @param {string} trainerName - Name of the trainer
 * @returns {Promise<Object>} Object with dates as keys and arrays of tasks as values
 */
export const getTrainerSchedules = async (trainerName) => {
  try {
    const allSchedules = await loadScheduleData();
    return filterTrainerSchedules(allSchedules, trainerName);
  } catch (error) {
    console.error('Error loading trainer schedules:', error);
    return {};
  }
};

/**
 * Get schedules for a specific trainer within a date range
 * @param {string} trainerName - Name of the trainer
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Filtered schedules
 */
export const getTrainerSchedulesInRange = async (trainerName, startDate, endDate) => {
  try {
    const allSchedules = await getTrainerSchedules(trainerName);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredSchedules = {};
    
    Object.entries(allSchedules).forEach(([date, tasks]) => {
      const currentDate = new Date(date);
      if (currentDate >= start && currentDate <= end) {
        filteredSchedules[date] = tasks;
      }
    });
    
    return filteredSchedules;
  } catch (error) {
    console.error('Error loading trainer schedules in range:', error);
    return {};
  }
};

/**
 * Get tasks for a specific date
 * @param {string} trainerName - Name of the trainer
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of tasks for that date
 */
export const getTrainerTasksForDate = async (trainerName, date) => {
  try {
    const schedules = await getTrainerSchedules(trainerName);
    return schedules[date] || [];
  } catch (error) {
    console.error('Error loading trainer tasks for date:', error);
    return [];
  }
};

/**
 * Check if trainer has any tasks on a specific date
 * @param {string} trainerName - Name of the trainer
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<boolean>}
 */
export const hasTasksOnDate = async (trainerName, date) => {
  const tasks = await getTrainerTasksForDate(trainerName, date);
  return tasks.length > 0;
};

/**
 * Calculate task statistics for a trainer from schedule data
 * @param {Object} schedules - Schedule data object (filtered for trainer)
 * @returns {Object} Statistics object
 */
export const calculateTrainerStats = (schedules) => {
  if (!schedules || typeof schedules !== 'object') {
    return {
      totalTasks: 0,
      totalDays: 0,
      trainingTasks: 0,
      nonTrainingTasks: 0,
      upcomingTasks: 0,
      todayTasks: 0
    };
  }

  const allTasks = Object.values(schedules).flat();
  
  const stats = {
    totalTasks: allTasks.length,
    totalDays: Object.keys(schedules).length,
    trainingTasks: allTasks.filter(t => t.client && t.course).length,
    nonTrainingTasks: allTasks.filter(t => t.taskType && t.taskDetails).length,
    upcomingTasks: 0,
    todayTasks: 0
  };
  
  // Use timezone-aware date comparison
  const today = getCurrentDateInUserTimezone();
  
  Object.entries(schedules).forEach(([utcDate]) => {
    // Convert UTC date from schedule to user timezone for comparison
    const userTimezoneDate = convertFromUTC(utcDate);
    if (userTimezoneDate === today) {
      stats.todayTasks += schedules[utcDate].length;
    }
    // Compare date strings directly (YYYY-MM-DD format)
    if (userTimezoneDate >= today) {
      stats.upcomingTasks += schedules[utcDate].length;
    }
  });
  
  return stats;
};

/**
 * Get task statistics for a trainer
 * @param {string} trainerName - Name of the trainer
 * @returns {Promise<Object>} Statistics object
 */
export const getTrainerStats = async (trainerName) => {
  try {
    const schedules = await getTrainerSchedules(trainerName);
    return calculateTrainerStats(schedules);
  } catch (error) {
    console.error('Error getting trainer stats:', error);
    return {
      totalTasks: 0,
      totalDays: 0,
      trainingTasks: 0,
      nonTrainingTasks: 0,
      upcomingTasks: 0,
      todayTasks: 0
    };
  }
};

